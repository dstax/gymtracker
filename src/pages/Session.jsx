import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = (workoutId) => `gymtracker_session_${workoutId}`

const DEFAULT_EXERCISES = [
  { name: 'Abdominal Crunch', machine: 'Abdominal Crunch' },
  { name: 'Arm Curl', machine: 'Arm Curl' },
  { name: 'Arm Extension', machine: 'Arm Extension' },
  { name: 'Chest Press', machine: 'Chest Press' },
  { name: 'Curl con Barra EZ', machine: 'Barra EZ' },
  { name: 'Curl con Manubri', machine: 'Bilancieri e Manubri' },
  { name: 'Delts Machine', machine: 'Delts Machine' },
  { name: 'Glute Press', machine: 'Glute Press' },
  { name: 'Incline Chest Press', machine: 'Incline Chest Press' },
  { name: 'Lat Machine', machine: 'Lat Machine' },
  { name: 'Leg Curl (Seduto)', machine: 'Leg Curl (Seduto)' },
  { name: 'Leg Extension', machine: 'Leg Extension' },
  { name: 'Leg Press', machine: 'Leg Press' },
  { name: 'Low Row', machine: 'Low Row' },
  { name: 'Panca Piana', machine: 'Panca Piana (Bilanciere/Manubri)' },
  { name: 'Pectoral Machine', machine: 'Pectoral Machine' },
  { name: 'Plank', machine: 'Corpo libero' },
  { name: 'Pulley', machine: 'Pulley' },
  { name: 'Row Machine', machine: 'Row Machine' },
  { name: 'Shoulder Press', machine: 'Shoulder Press' },
  { name: 'Standing Leg Curl', machine: 'Standing Leg Curl' },
  { name: 'Tricipiti ai Cavi', machine: 'Cavi' },
]

export default function Session({ workout, userSession, onEnd, scheduledId }) {
  const [exercises, setExercises] = useState([])
  const [customExercises, setCustomExercises] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [completedSets, setCompletedSets] = useState({})
  const [setValues, setSetValues] = useState({})
  const [extraSets, setExtraSets] = useState({})
  const [exerciseNotes, setExerciseNotes] = useState({})
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showExerciseList, setShowExerciseList] = useState(false)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [showSetConfirm, setShowSetConfirm] = useState(null)
  const [savedData, setSavedData] = useState(null)
  const [showAddExModal, setShowAddExModal] = useState(false)
  const [addExSelected, setAddExSelected] = useState('')
  const [addExSets, setAddExSets] = useState([{ kg: 0, reps: 10 }])
  const [confirmRemoveEx, setConfirmRemoveEx] = useState(null) // indice esercizio da rimuovere
  const totalRef = useRef(null)
  const restRef = useRef(null)

  useEffect(() => {
    fetchExercises()
    fetchCustomExercises()
    totalRef.current = setInterval(() => setTotalSeconds(s => s + 1), 1000)
    return () => {
      clearInterval(totalRef.current)
      clearInterval(restRef.current)
    }
  }, [])

  useEffect(() => {
    clearInterval(restRef.current)
    if (restActive) {
      restRef.current = setInterval(() => setRestSeconds(s => s + 1), 1000)
    }
    return () => clearInterval(restRef.current)
  }, [restActive])

  useEffect(() => {
    let hiddenAt = null
    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAt = Date.now()
      } else {
        if (hiddenAt) {
          const elapsed = Math.floor((Date.now() - hiddenAt) / 1000)
          setTotalSeconds(s => s + elapsed)
          hiddenAt = null
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (loading || exercises.length === 0) return
    const state = {
      completedSets, setValues, extraSets, exerciseNotes,
      totalSeconds, currentIdx,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY(workout.id), JSON.stringify(state))
  }, [completedSets, setValues, extraSets, exerciseNotes, totalSeconds, currentIdx])

  async function fetchExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*, sets(*)')
      .eq('workout_id', workout.id)
      .order('position')
    if (data) {
      setExercises(data)
      const saved = localStorage.getItem(STORAGE_KEY(workout.id))
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setSavedData(parsed)
          setShowResumeModal(true)
          const vals = {}
          data.forEach(ex => {
            ex.sets?.sort((a, b) => a.position - b.position).forEach(s => {
              vals[s.id] = { reps: s.reps, kg: s.kg }
            })
          })
          setSetValues(vals)
        } catch {
          localStorage.removeItem(STORAGE_KEY(workout.id))
          initDefaultValues(data)
        }
      } else {
        initDefaultValues(data)
      }
    }
    setLoading(false)
  }

  async function fetchCustomExercises() {
    const { data } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_id', userSession.user.id)
      .order('name')
    if (data) setCustomExercises(data)
  }

  function initDefaultValues(data) {
    const vals = {}
    const notes = {}
    data.forEach(ex => {
      ex.sets?.sort((a, b) => a.position - b.position).forEach(s => {
        vals[s.id] = { reps: s.reps, kg: s.kg }
      })
      if (ex.note) notes[ex.id] = ex.note
    })
    setSetValues(vals)
    setExerciseNotes(notes)
    setExtraSets({})
  }

  function resumeSession() {
    if (!savedData) return
    setCompletedSets(savedData.completedSets || {})
    setSetValues(savedData.setValues || {})
    setExtraSets(savedData.extraSets || {})
    setExerciseNotes(savedData.exerciseNotes || {})
    setTotalSeconds(savedData.totalSeconds || 0)
    setCurrentIdx(savedData.currentIdx || 0)
    setShowResumeModal(false)
    setSavedData(null)
  }

  function discardSaved() {
    localStorage.removeItem(STORAGE_KEY(workout.id))
    setShowResumeModal(false)
    setSavedData(null)
    initDefaultValues(exercises)
  }

  function clearStorage() {
    localStorage.removeItem(STORAGE_KEY(workout.id))
  }

  // Aggiunge esercizio solo in locale, senza toccare il DB
  function confirmAddExercise() {
    if (!addExSelected) return
    const allEx = [...DEFAULT_EXERCISES, ...customExercises.map(e => ({ name: e.name, machine: e.machine || '' }))]
    const found = allEx.find(e => e.name === addExSelected)
    const tempId = `session_ex_${Date.now()}`
    const newSets = addExSets.map((s, i) => ({
      id: `session_set_${Date.now()}_${i}`,
      reps: parseInt(s.reps) || 10,
      kg: parseFloat(s.kg) || 0,
      position: i
    }))
    const newEx = {
      id: tempId,
      name: addExSelected,
      machine: found?.machine || '',
      note: null,
      sets: newSets,
      isSessionOnly: true // flag: non appartiene alla scheda originale
    }
    // Inizializza setValues per le nuove serie
    const newVals = {}
    newSets.forEach(s => { newVals[s.id] = { kg: s.kg, reps: s.reps } })
    setSetValues(prev => ({ ...prev, ...newVals }))
    setExercises(prev => [...prev, newEx])
    setShowAddExModal(false)
    setAddExSelected('')
    setAddExSets([{ kg: 0, reps: 10 }])
    // Naviga all'esercizio appena aggiunto
    setCurrentIdx(exercises.length)
  }

  // Rimuove esercizio solo dallo state locale
  function removeExercise(idx) {
    const ex = exercises[idx]
    // Pulisci setValues per le serie di questo esercizio
    const keysToRemove = (ex.sets || []).map(s => s.id)
    setSetValues(prev => {
      const u = { ...prev }
      keysToRemove.forEach(k => delete u[k])
      return u
    })
    // Pulisci completedSets
    setCompletedSets(prev => {
      const u = { ...prev }
      keysToRemove.forEach(k => delete u[k])
      return u
    })
    // Pulisci extraSets
    setExtraSets(prev => {
      const u = { ...prev }
      delete u[ex.id]
      return u
    })
    // Pulisci note
    setExerciseNotes(prev => {
      const u = { ...prev }
      delete u[ex.id]
      return u
    })
    setExercises(prev => prev.filter((_, i) => i !== idx))
    // Aggiusta currentIdx se necessario
    setCurrentIdx(prev => {
      if (prev >= idx && prev > 0) return prev - 1
      return prev
    })
    setConfirmRemoveEx(null)
  }

  function getAllExerciseNames() {
    const custom = customExercises.map(e => e.name)
    const currentNames = exercises.map(e => e.name)
    return [...DEFAULT_EXERCISES.map(e => e.name), ...custom]
      .filter(name => !currentNames.includes(name)) // escludi già presenti
      .sort((a, b) => a.localeCompare(b))
  }

  function confirmAddSet() {
    const exId = exercises[currentIdx].id
    const currentSets = exercises[currentIdx].sets?.sort((a, b) => a.position - b.position) || []
    const allSets = [...currentSets, ...(extraSets[exId] || [])]
    const lastSet = allSets[allSets.length - 1]
    const lastKg = lastSet
      ? (setValues[lastSet.id]?.kg ?? extraSets[exId]?.find(s => s.id === lastSet.id)?.kg ?? lastSet.kg ?? 0)
      : 0
    const lastReps = lastSet
      ? (setValues[lastSet.id]?.reps ?? extraSets[exId]?.find(s => s.id === lastSet.id)?.reps ?? lastSet.reps ?? 10)
      : 10
    const newId = `extra_${exId}_${Date.now()}`
    setExtraSets(prev => ({
      ...prev,
      [exId]: [...(prev[exId] || []), { id: newId, kg: lastKg, reps: lastReps, completed: false }]
    }))
    setShowSetConfirm(null)
  }

  function confirmRemoveSet() {
    const ex = exercises[currentIdx]
    const exId = ex.id
    const currentExtras = extraSets[exId] || []
    const currentSets = ex.sets?.sort((a, b) => a.position - b.position) || []

    if (currentExtras.length > 0) {
      setExtraSets(prev => {
        const current = prev[exId] || []
        if (current.length === 0) return prev
        const removed = current[current.length - 1]
        setCompletedSets(c => { const u = { ...c }; delete u[removed.id]; return u })
        return { ...prev, [exId]: current.slice(0, -1) }
      })
    } else {
      const lastBase = [...currentSets].reverse().find(s => !completedSets[s.id])
      if (!lastBase) { setShowSetConfirm(null); return }
      setExercises(prev => prev.map(e => {
        if (e.id !== exId) return e
        return { ...e, sets: e.sets.filter(s => s.id !== lastBase.id) }
      }))
      setSetValues(prev => { const u = { ...prev }; delete u[lastBase.id]; return u })
      setCompletedSets(prev => { const u = { ...prev }; delete u[lastBase.id]; return u })
    }
    setShowSetConfirm(null)
  }

  function toggleSet(setId, isExtra = false, exId = null) {
    const isCompleting = isExtra
      ? !extraSets[exId]?.find(s => s.id === setId)?.completed
      : !completedSets[setId]

    if (isExtra && exId) {
      setExtraSets(prev => ({
        ...prev,
        [exId]: prev[exId].map(s => s.id === setId ? { ...s, completed: !s.completed } : s)
      }))
    } else {
      setCompletedSets(prev => ({ ...prev, [setId]: !prev[setId] }))
    }

    if (isCompleting) {
      setRestSeconds(0)
      setRestActive(true)
    }
  }

  function isExerciseCompleted(ex) {
    const baseSets = ex.sets || []
    const extras = extraSets[ex.id] || []
    const allBase = baseSets.length > 0 && baseSets.every(s => completedSets[s.id])
    const allExtra = extras.every(s => s.completed)
    return baseSets.length > 0 && allBase && allExtra
  }

  function resetRest() {
    setRestSeconds(0)
    setRestActive(false)
  }

  function goTo(i) {
    setCurrentIdx(i)
    setShowExerciseList(false)
  }

  async function clearScheduled() {
    if (!scheduledId) return
    const { data } = await supabase
      .from('scheduled_workouts')
      .select('is_recurring, recurring_days')
      .eq('id', scheduledId)
      .single()
    if (!data) return
    if (!data.is_recurring) {
      await supabase.from('scheduled_workouts').delete().eq('id', scheduledId)
    } else {
      const today = new Date()
      for (let i = 1; i <= 7; i++) {
        const d = new Date(today)
        d.setDate(today.getDate() + i)
        if ((data.recurring_days || []).includes(String(d.getDay()))) {
          await supabase.from('scheduled_workouts').update({
            scheduled_date: d.toISOString().split('T')[0]
          }).eq('id', scheduledId)
          return
        }
      }
    }
  }

  async function fetchHistoricalMaxKg() {
    const { data, error } = await supabase
      .rpc('get_user_pr', { p_user_id: userSession.user.id })
    if (error || !data) {
      console.error('Errore fetchHistoricalMaxKg:', error)
      return {}
    }
    const maxKg = {}
    data.forEach(row => {
      maxKg[row.exercise_name] = parseFloat(row.max_kg) || 0
    })
    return maxKg
  }

  function fmt(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
  }

  async function endSession() {
    setSaving(true)
    clearInterval(totalRef.current)
    clearInterval(restRef.current)

    const historicalMax = await fetchHistoricalMaxKg()
    let totalVolume = 0
    const sessionSetsToInsert = []
    const sessionMax = {}

    exercises.forEach((ex, exerciseOrder) => {
      const sortedSets = ex.sets?.sort((a, b) => a.position - b.position) || []
      const extras = extraSets[ex.id] || []
      const note = exerciseNotes[ex.id] || null

      // Solo serie base completate
      const completedBaseSets = sortedSets
        .filter(s => completedSets[s.id])
        .map(s => ({
          kg: parseFloat(setValues[s.id]?.kg) || 0,
          reps: parseInt(setValues[s.id]?.reps) || 0,
        }))

      // Solo serie extra completate
      const completedExtraSets = extras
        .filter(s => s.completed)
        .map(s => ({
          kg: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps) || 0,
        }))

      const allCompletedSets = [...completedBaseSets, ...completedExtraSets]
      if (allCompletedSets.length === 0) return

      allCompletedSets.forEach((s, i) => {
        const { kg, reps } = s
        totalVolume += reps * kg
        const prevMax = Math.max(historicalMax[ex.name] || 0, sessionMax[ex.name] || 0)
        const isPR = kg > 0 && kg > prevMax
        if (kg > (sessionMax[ex.name] || 0)) sessionMax[ex.name] = kg
        sessionSetsToInsert.push({
          exercise_name: ex.name,
          exercise_id: ex.isSessionOnly ? null : ex.id, // gli esercizi aggiunti in sessione non hanno id DB
          exercise_order: exerciseOrder,
          set_number: i + 1,
          reps, kg, note, is_pr: isPR,
        })
      })
    })

    const { data: sess, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userSession.user.id,
        workout_id: workout.id,
        workout_name: workout.name,
        duration_seconds: totalSeconds,
        total_volume: totalVolume,
        ended_at: new Date().toISOString()
      })
      .select().single()

    if (error) {
      console.error('Errore salvataggio sessione:', error)
      setSaving(false)
      return
    }

    if (sess && sessionSetsToInsert.length > 0) {
      const { error: setsError } = await supabase
        .from('session_sets')
        .insert(sessionSetsToInsert.map(s => ({ ...s, session_id: sess.id })))
      if (setsError) console.error('Errore salvataggio serie:', setsError)
    }

    clearStorage()
    await clearScheduled()
    setSaving(false)
    onEnd()
  }

  function handleAbandon() {
    if (confirm('Abbandonare la sessione? I dati non salvati andranno persi.')) {
      clearStorage()
      onEnd()
    }
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm px-5">Caricamento...</div>

  if (exercises.length === 0) return (
    <div className="pt-8 px-5">
      <p className="text-[#666]">Nessun esercizio in questa scheda.</p>
      <button onClick={onEnd} className="mt-4 text-[#e8ff47] text-sm">← Torna indietro</button>
    </div>
  )

  const currentEx = exercises[currentIdx]
  const currentSets = currentEx.sets?.sort((a, b) => a.position - b.position) || []
  const currentExtras = extraSets[currentEx.id] || []
  const totalSetsCount = currentSets.length + currentExtras.length
  const completedCount = exercises.filter(isExerciseCompleted).length
  const progress = (completedCount / exercises.length) * 100

  return (
    <div className="pt-0 -mx-5">

      {/* MODAL RIPRENDI SESSIONE */}
      {showResumeModal && savedData && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center px-5 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-3xl w-full max-w-[380px] p-6">
            <div className="text-2xl mb-2">⚡</div>
            <div className="text-white font-black text-xl mb-1">Sessione in corso</div>
            <div className="text-[#666] text-sm mb-1">
              Hai una sessione non completata di <span className="text-white font-medium">{workout.name}</span>.
            </div>
            <div className="text-[#444] text-xs mb-5">
              Salvata il {new Date(savedData.savedAt).toLocaleString('it-IT')}
            </div>
            <div className="space-y-3">
              <button onClick={resumeSession} className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm">
                ⚡ Riprendi sessione
              </button>
              <button onClick={discardSaved} className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]">
                Inizia da capo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFERMA AGGIUNGI/RIMUOVI SERIE */}
      {showSetConfirm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-5 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-3xl w-full max-w-[340px] p-6">
            {showSetConfirm === 'add' ? (
              <>
                <div className="text-2xl mb-2">＋</div>
                <div className="text-white font-black text-lg mb-1">Aggiungere una serie?</div>
                <div className="text-[#666] text-sm mb-5">
                  Verrà aggiunta una serie extra a <span className="text-white font-medium">{currentEx.name}</span>.
                </div>
                <div className="space-y-3">
                  <button onClick={confirmAddSet} className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm">＋ Aggiungi serie</button>
                  <button onClick={() => setShowSetConfirm(null)} className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]">Annulla</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl mb-2">−</div>
                <div className="text-white font-black text-lg mb-1">Rimuovere una serie?</div>
                <div className="text-[#666] text-sm mb-5">
                  Verrà rimossa l'ultima serie di <span className="text-white font-medium">{currentEx.name}</span>.
                </div>
                <div className="space-y-3">
                  <button onClick={confirmRemoveSet} className="w-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-3 rounded-xl text-sm">− Rimuovi serie</button>
                  <button onClick={() => setShowSetConfirm(null)} className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]">Annulla</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL CONFERMA RIMUOVI ESERCIZIO */}
      {confirmRemoveEx !== null && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-5 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-3xl w-full max-w-[340px] p-6">
            <div className="text-2xl mb-2">🗑</div>
            <div className="text-white font-black text-lg mb-1">Rimuovere l'esercizio?</div>
            <div className="text-[#666] text-sm mb-5">
              <span className="text-white font-medium">{exercises[confirmRemoveEx]?.name}</span> verrà rimosso dalla sessione in corso. La scheda originale non viene modificata.
            </div>
            <div className="space-y-3">
              <button onClick={() => removeExercise(confirmRemoveEx)}
                className="w-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-3 rounded-xl text-sm">
                Rimuovi esercizio
              </button>
              <button onClick={() => setConfirmRemoveEx(null)}
                className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AGGIUNGI ESERCIZIO IN SESSIONE */}
      {showAddExModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => setShowAddExModal(false)}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-xl tracking-wide mb-1">AGGIUNGI ESERCIZIO</div>
            <div className="text-[#666] text-xs mb-4">Solo per questa sessione — la scheda non viene modificata.</div>

            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Esercizio</label>
            <select
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
              value={addExSelected}
              onChange={e => setAddExSelected(e.target.value)}
            >
              <option value="">— Seleziona dalla libreria —</option>
              {getAllExerciseNames().map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <div className="text-[#666] text-xs uppercase tracking-widest mb-2">Serie</div>
            <table className="w-full mb-3">
              <thead>
                <tr>
                  <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center w-8">Set</th>
                  <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Kg</th>
                  <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Rip</th>
                  <th className="w-7"></th>
                </tr>
              </thead>
              <tbody>
                {addExSets.map((s, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a]">
                    <td className="py-2 text-center text-[#444] font-mono text-sm">{i + 1}</td>
                    <td className="py-2 text-center">
                      <input
                        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                        type="number" step="2.5" min="0" value={s.kg}
                        onChange={e => setAddExSets(prev => prev.map((x, j) => j === i ? { ...x, kg: e.target.value } : x))} />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                        type="number" min="1" value={s.reps}
                        onChange={e => setAddExSets(prev => prev.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} />
                    </td>
                    <td className="py-2 text-center">
                      <button
                        onClick={() => setAddExSets(prev => prev.filter((_, j) => j !== i))}
                        disabled={addExSets.length <= 1}
                        className="w-6 h-6 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center mx-auto disabled:opacity-20">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button
              onClick={() => setAddExSets(prev => { const last = prev[prev.length - 1]; return [...prev, { kg: last?.kg ?? 0, reps: last?.reps ?? 10 }] })}
              className="w-full py-2 rounded-xl text-xs text-[#e8ff47] border border-[#e8ff47]/20 bg-[#e8ff47]/5 mb-5">
              ＋ Aggiungi serie
            </button>

            <button
              onClick={confirmAddExercise}
              disabled={!addExSelected}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              ＋ Aggiungi alla sessione
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#666] text-xs uppercase tracking-widest">In corso</div>
            <div className="text-white font-black text-xl tracking-wide">{workout.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[#666] text-xs">{completedCount}/{exercises.length} esercizi</div>
            <button
              onClick={() => { setShowAddExModal(true); setAddExSelected(''); setAddExSets([{ kg: 0, reps: 10 }]) }}
              className="w-8 h-8 rounded-lg border border-[#e8ff47]/30 bg-[#e8ff47]/10 text-[#e8ff47] text-sm flex items-center justify-center"
              title="Aggiungi esercizio"
            >＋</button>
            <button
              onClick={() => setShowExerciseList(true)}
              className="w-8 h-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-sm flex items-center justify-center"
            >☰</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-center">
            <div className="text-[#666] text-xs uppercase tracking-widest mb-1">⏱ Totale</div>
            <div className="text-[#e8ff47] font-black text-2xl tracking-widest">{fmt(totalSeconds)}</div>
          </div>
          <div className={`border rounded-xl p-3 text-center transition-all ${restSeconds >= 120 ? 'bg-orange-500/10 border-orange-500/50 animate-pulse' : restActive ? 'bg-[#1a1a1a] border-[#ff6b35]/50' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
            <div className="text-[#666] text-xs uppercase tracking-widest mb-1">Pausa</div>
            <div className={`font-black text-2xl tracking-widest ${restSeconds >= 120 ? 'text-orange-400' : 'text-[#ff6b35]'}`}>{fmt(restSeconds)}</div>
            <button onClick={resetRest} className="text-[#444] text-xs mt-1">↺ reset</button>
          </div>
        </div>

        <div className="mt-3 h-1 bg-[#222] rounded-full overflow-hidden">
          <div className="h-full bg-[#e8ff47] rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* ESERCIZIO */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-white font-black text-xl">{currentEx.name}</div>
            {isExerciseCompleted(currentEx) && <span className="text-green-400 text-sm">✓</span>}
            {currentEx.isSessionOnly && (
              <span className="text-xs bg-[#e8ff47]/10 border border-[#e8ff47]/30 text-[#e8ff47] rounded-lg px-2 py-0.5">solo sessione</span>
            )}
          </div>
          <button
            onClick={() => setConfirmRemoveEx(currentIdx)}
            className="w-7 h-7 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center"
            title="Rimuovi esercizio dalla sessione"
          >🗑</button>
        </div>
        <div className="text-[#666] text-xs mt-1">{totalSetsCount} serie</div>
        {currentEx.machine && (
          <div className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/25 rounded-lg px-2 py-1 text-blue-400 text-xs mt-2">
            🟢 {currentEx.machine}
          </div>
        )}
      </div>

      {/* TABELLA SERIE */}
      <div className="px-5">
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center w-8">Set</th>
              <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Kg</th>
              <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Rip</th>
              <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center w-10">✓</th>
            </tr>
          </thead>
          <tbody>
            {currentSets.map((s, i) => (
              <tr key={s.id} className={`border-t border-[#1a1a1a] transition-opacity ${completedSets[s.id] ? 'opacity-40' : ''}`}>
                <td className="py-2 text-center text-[#444] font-mono text-sm">{i + 1}</td>
                <td className="py-2 text-center">
                  <input
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                    type="number" step="2.5" min="0"
                    value={setValues[s.id]?.kg ?? s.kg}
                    onChange={e => setSetValues(prev => ({ ...prev, [s.id]: { ...prev[s.id], kg: parseFloat(e.target.value) || 0 } }))}
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                    type="number" min="1"
                    value={setValues[s.id]?.reps ?? s.reps}
                    onChange={e => setSetValues(prev => ({ ...prev, [s.id]: { ...prev[s.id], reps: parseInt(e.target.value) || 0 } }))}
                  />
                </td>
                <td className="py-2 text-center">
                  <button
                    onClick={() => toggleSet(s.id)}
                    className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center mx-auto transition-all ${completedSets[s.id] ? 'bg-[#4ade80] border-[#4ade80] text-black' : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#444]'}`}
                  >
                    {completedSets[s.id] ? '✓' : '○'}
                  </button>
                </td>
              </tr>
            ))}

            {currentExtras.map((s, i) => (
              <tr key={s.id} className={`border-t border-[#e8ff47]/10 transition-opacity ${s.completed ? 'opacity-40' : ''}`}>
                <td className="py-2 text-center">
                  <span className="text-[#e8ff47] font-mono text-xs">+{i + 1}</span>
                </td>
                <td className="py-2 text-center">
                  <input
                    className="bg-[#1a1a1a] border border-[#e8ff47]/30 rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                    type="number" step="2.5" min="0"
                    value={s.kg}
                    onChange={e => setExtraSets(prev => ({
                      ...prev,
                      [currentEx.id]: prev[currentEx.id].map(es => es.id === s.id ? { ...es, kg: parseFloat(e.target.value) || 0 } : es)
                    }))}
                  />
                </td>
                <td className="py-2 text-center">
                  <input
                    className="bg-[#1a1a1a] border border-[#e8ff47]/30 rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                    type="number" min="1"
                    value={s.reps}
                    onChange={e => setExtraSets(prev => ({
                      ...prev,
                      [currentEx.id]: prev[currentEx.id].map(es => es.id === s.id ? { ...es, reps: parseInt(e.target.value) || 0 } : es)
                    }))}
                  />
                </td>
                <td className="py-2 text-center">
                  <button
                    onClick={() => toggleSet(s.id, true, currentEx.id)}
                    className={`w-8 h-8 rounded-lg border text-sm flex items-center justify-center mx-auto transition-all ${s.completed ? 'bg-[#4ade80] border-[#4ade80] text-black' : 'bg-[#1a1a1a] border-[#e8ff47]/30 text-[#e8ff47]'}`}
                  >
                    {s.completed ? '✓' : '○'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setShowSetConfirm('add')}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-[#e8ff47] border border-[#e8ff47]/30 bg-[#e8ff47]/5"
          >＋ Serie</button>
          <button
            onClick={() => setShowSetConfirm('remove')}
            disabled={totalSetsCount <= 1}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-red-400 border border-red-500/30 bg-red-500/5 disabled:opacity-20"
          >− Serie</button>
        </div>
      </div>

      {/* NOTE ESERCIZIO */}
      <div className="px-5 mt-3">
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2">
          <span className="text-[#444] text-sm flex-shrink-0">📝</span>
          <input
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-[#444]"
            placeholder="Nota esercizio..."
            value={exerciseNotes[currentEx.id] || ''}
            onChange={e => setExerciseNotes(prev => ({ ...prev, [currentEx.id]: e.target.value }))}
          />
        </div>
      </div>

      {/* NAVIGAZIONE */}
      <div className="px-5 mt-3 flex gap-3">
        <button
          onClick={() => goTo(currentIdx - 1)}
          disabled={currentIdx === 0}
          className="w-12 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-white disabled:opacity-30"
        >←</button>
        <button
          onClick={() => setShowExerciseList(true)}
          className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-white"
        >☰ {currentIdx + 1} / {exercises.length}</button>
        <button
          onClick={() => goTo(currentIdx + 1)}
          disabled={currentIdx === exercises.length - 1}
          className="w-12 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-white disabled:opacity-30"
        >→</button>
      </div>

      {/* TERMINA */}
      <div className="px-5 mt-3 mb-6 space-y-3">
        <button
          onClick={() => { if (confirm('Salvare e terminare la sessione?')) endSession() }}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-bold bg-[#e8ff47] text-black disabled:opacity-50"
        >
          {saving ? 'Salvataggio in corso...' : '⏹ Termina e Salva'}
        </button>
        <button
          onClick={handleAbandon}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/30 text-red-400"
        >⚠️ Abbandona sessione</button>
      </div>

      {/* MODAL LISTA ESERCIZI */}
      {showExerciseList && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => setShowExerciseList(false)}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-black text-xl tracking-wide">ESERCIZI</div>
              <div className="text-[#666] text-xs">{completedCount}/{exercises.length} completati</div>
            </div>
            <div className="space-y-2">
              {exercises.map((ex, i) => (
                <button
                  key={ex.id}
                  onClick={() => goTo(i)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${i === currentIdx ? 'bg-[#e8ff47]/10 border-[#e8ff47]/30' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isExerciseCompleted(ex) ? 'bg-[#4ade80] text-black' : i === currentIdx ? 'bg-[#e8ff47] text-black' : 'bg-[#2a2a2a] text-[#666]'}`}>
                    {isExerciseCompleted(ex) ? '✓' : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className={`text-sm font-bold ${i === currentIdx ? 'text-[#e8ff47]' : isExerciseCompleted(ex) ? 'text-[#666]' : 'text-white'}`}>
                      {ex.name}
                    </div>
                    {ex.machine && <div className="text-[#444] text-xs mt-0.5">{ex.machine}</div>}
                    {ex.isSessionOnly && <div className="text-[#e8ff47] text-xs mt-0.5">solo sessione</div>}
                  </div>
                  {i === currentIdx && <span className="text-[#e8ff47] text-xs">← qui</span>}
                  {exerciseNotes[ex.id] && <span className="text-[#666] text-xs">📝</span>}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowAddExModal(true); setShowExerciseList(false); setAddExSelected(''); setAddExSets([{ kg: 0, reps: 10 }]) }}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold text-[#e8ff47] border border-[#e8ff47]/30 bg-[#e8ff47]/5"
            >＋ Aggiungi esercizio</button>
          </div>
        </div>
      )}

    </div>
  )
}