import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = (workoutId) => `gymtracker_session_${workoutId}`

export default function Session({ workout, userSession, onEnd, scheduledId }) {
  const [exercises, setExercises] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [completedSets, setCompletedSets] = useState({})
  const [setValues, setSetValues] = useState({})
  const [exerciseNotes, setExerciseNotes] = useState({})
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showExerciseList, setShowExerciseList] = useState(false)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [savedData, setSavedData] = useState(null)
  const totalRef = useRef(null)
  const restRef = useRef(null)

  useEffect(() => {
    fetchExercises()
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
    if (loading || exercises.length === 0) return
    const state = {
      completedSets,
      setValues,
      exerciseNotes,
      totalSeconds,
      currentIdx,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY(workout.id), JSON.stringify(state))
  }, [completedSets, setValues, exerciseNotes, totalSeconds, currentIdx])

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
  }

  function resumeSession() {
    if (!savedData) return
    setCompletedSets(savedData.completedSets || {})
    setSetValues(savedData.setValues || {})
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
    // Reinizializza con le note della scheda
    initDefaultValues(exercises)
  }

  function clearStorage() {
    localStorage.removeItem(STORAGE_KEY(workout.id))
  }

  async function fetchHistoricalMaxKg() {
    const { data: userSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userSession.user.id)

    if (!userSessions || userSessions.length === 0) return {}

    const sessionIds = userSessions.map(s => s.id)

    const { data } = await supabase
      .from('session_sets')
      .select('exercise_name, kg')
      .in('session_id', sessionIds)

    const maxKg = {}
    if (data) {
      data.forEach(s => {
        const kg = parseFloat(s.kg) || 0
        if (!maxKg[s.exercise_name] || kg > maxKg[s.exercise_name]) {
          maxKg[s.exercise_name] = kg
        }
      })
    }
    return maxKg
  }

  function fmt(s) {
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
  }

  function toggleSet(setId) {
    const isCompleting = !completedSets[setId]
    setCompletedSets(prev => ({ ...prev, [setId]: !prev[setId] }))
    if (isCompleting) {
      setRestSeconds(0)
      setRestActive(true)
    }
  }

  function isExerciseCompleted(ex) {
    const sets = ex.sets || []
    return sets.length > 0 && sets.every(s => completedSets[s.id])
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
      const note = exerciseNotes[ex.id] || null
      sortedSets.forEach(s => {
        const val = setValues[s.id] || { reps: s.reps, kg: s.kg }
        const kg = parseFloat(val.kg) || 0
        const reps = parseInt(val.reps) || 0
        totalVolume += reps * kg

        const prevMax = Math.max(historicalMax[ex.name] || 0, sessionMax[ex.name] || 0)
        const isPR = kg > 0 && kg > prevMax
        if (kg > (sessionMax[ex.name] || 0)) sessionMax[ex.name] = kg

        sessionSetsToInsert.push({
          exercise_name: ex.name,
          exercise_id: ex.id,
          exercise_order: exerciseOrder,
          set_number: s.position + 1,
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
        <div className="flex items-center gap-2">
          <div className="text-white font-black text-xl">{currentEx.name}</div>
          {isExerciseCompleted(currentEx) && <span className="text-green-400 text-sm">✓</span>}
        </div>
        <div className="text-[#666] text-xs mt-1">{currentSets.length} serie</div>
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
          </tbody>
        </table>
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

      {/* NAVIGAZIONE LIBERA */}
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
                  </div>
                  {i === currentIdx && <span className="text-[#e8ff47] text-xs">← qui</span>}
                  {exerciseNotes[ex.id] && <span className="text-[#666] text-xs">📝</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}