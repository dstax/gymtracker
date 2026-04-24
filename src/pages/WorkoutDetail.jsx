import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Session from './Session'

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
  { name: 'Lat Machine', machine: 'Lat Machine' },
]

export default function WorkoutDetail({ workout, session, onBack, scheduledId }) {
  const [exercises, setExercises] = useState([])
  const [customExercises, setCustomExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [showEditExModal, setShowEditExModal] = useState(false)
  const [editingEx, setEditingEx] = useState(null)
  const [editSetValues, setEditSetValues] = useState([])
  const [savingEditEx, setSavingEditEx] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [selectedEx, setSelectedEx] = useState('')
  const [exMachine, setExMachine] = useState('')
  const [exNote, setExNote] = useState('')
  const [numSets, setNumSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [defaultKg, setDefaultKg] = useState(0)
  const [kgPerSet, setKgPerSet] = useState([0, 0, 0])
  const [saving, setSaving] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [newExMachine, setNewExMachine] = useState('')
  const [savingCustom, setSavingCustom] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [editingCustomEx, setEditingCustomEx] = useState(null)
  const [editingCustomName, setEditingCustomName] = useState('')
  const [editingCustomMachine, setEditingCustomMachine] = useState('')
  const [savingCustomEdit, setSavingCustomEdit] = useState(false)
  const [loadingLastSession, setLoadingLastSession] = useState(false)
  const [lastSessionApplied, setLastSessionApplied] = useState(false)

  useEffect(() => {
    fetchExercises()
    fetchCustomExercises()
  }, [])

  useEffect(() => {
    setKgPerSet(Array.from({ length: parseInt(numSets) }, (_, i) => kgPerSet[i] ?? parseFloat(defaultKg) ?? 0))
  }, [numSets])

  useEffect(() => {
    setKgPerSet(Array.from({ length: parseInt(numSets) }, () => parseFloat(defaultKg) || 0))
  }, [defaultKg])

  async function fetchExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*, sets(*)')
      .eq('workout_id', workout.id)
      .order('position')
    if (data) setExercises(data)
    setLoading(false)
  }

  async function fetchCustomExercises() {
    const { data } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name')
    if (data) setCustomExercises(data)
  }

  async function copyLastSession() {
    setLoadingLastSession(true)

    const { data: lastSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('workout_id', workout.id)
      .order('ended_at', { ascending: false })
      .limit(1)

    if (!lastSessions || lastSessions.length === 0) {
      setLoadingLastSession(false)
      alert('Nessuna sessione precedente trovata per questa scheda.')
      return
    }

    const lastSessionId = lastSessions[0].id

    const { data: lastSets } = await supabase
      .from('session_sets')
      .select('exercise_name, set_number, kg, reps')
      .eq('session_id', lastSessionId)
      .order('exercise_order', { ascending: true })
      .order('set_number', { ascending: true })

    if (!lastSets || lastSets.length === 0) {
      setLoadingLastSession(false)
      alert("Nessun dato trovato nell'ultima sessione.")
      return
    }

    // Costruisci mappa: exercise_name -> [{ kg, reps }]
    const lastMap = {}
    lastSets.forEach(s => {
      if (!lastMap[s.exercise_name]) lastMap[s.exercise_name] = []
      lastMap[s.exercise_name].push({ kg: s.kg, reps: s.reps })
    })

    // Per ogni esercizio della scheda, aggiorna le serie adattando il numero
    const updatedExercises = []
    const dbOps = []

    for (const ex of exercises) {
      const lastData = lastMap[ex.name]
      if (!lastData) { updatedExercises.push(ex); continue }

      const currentSets = ex.sets?.sort((a, b) => a.position - b.position) || []
      const lastCount = lastData.length
      const currentCount = currentSets.length

      // Aggiorna le serie esistenti
      const updatedSets = currentSets.map((s, i) => ({
        ...s,
        kg: lastData[i]?.kg ?? s.kg,
        reps: lastData[i]?.reps ?? s.reps
      }))

      // Aggiorna le serie esistenti su DB
      updatedSets.forEach((s, i) => {
        dbOps.push(
          supabase.from('sets').update({
            kg: lastData[i]?.kg ?? s.kg,
            reps: lastData[i]?.reps ?? s.reps
          }).eq('id', s.id)
        )
      })

      // Se l'ultima sessione aveva più serie, inserisci quelle mancanti
      if (lastCount > currentCount) {
        const toInsert = lastData.slice(currentCount).map((d, i) => ({
          exercise_id: ex.id,
          kg: d.kg,
          reps: d.reps,
          position: currentCount + i
        }))
        dbOps.push(supabase.from('sets').insert(toInsert))
      }

      // Se l'ultima sessione aveva meno serie, elimina quelle in eccesso
      if (lastCount < currentCount) {
        const toDelete = currentSets.slice(lastCount).map(s => s.id)
        dbOps.push(supabase.from('sets').delete().in('id', toDelete))
        updatedSets.splice(lastCount)
      }

      updatedExercises.push({ ...ex, sets: updatedSets.slice(0, lastCount) })
    }

    await Promise.all(dbOps)

    // Ricarica da DB per avere i dati aggiornati (incluse le nuove serie inserite)
    await fetchExercises()

    setLastSessionApplied(true)
    setLoadingLastSession(false)
    setTimeout(() => setLastSessionApplied(false), 3000)
  }

  async function moveExercise(fromIdx, toIdx) {
    if (toIdx < 0 || toIdx >= exercises.length) return
    const updated = [...exercises]
    const [moved] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, moved)
    setExercises(updated)
    await Promise.all(updated.map((ex, i) =>
      supabase.from('exercises').update({ position: i }).eq('id', ex.id)
    ))
  }

  function openEditExModal(ex) {
    setEditingEx(ex)
    const sorted = ex.sets?.sort((a, b) => a.position - b.position) || []
    setEditSetValues(sorted.map(s => ({ id: s.id, reps: s.reps, kg: s.kg })))
    setShowEditExModal(true)
  }

  async function saveEditEx() {
    if (!editingEx) return
    setSavingEditEx(true)

    const currentSets = editingEx.sets?.sort((a, b) => a.position - b.position) || []
    const newCount = editSetValues.length
    const oldCount = currentSets.length

    await Promise.all(editSetValues.slice(0, oldCount).map((sv, i) =>
      supabase.from('sets').update({ reps: parseInt(sv.reps) || 0, kg: parseFloat(sv.kg) || 0 }).eq('id', currentSets[i].id)
    ))

    if (newCount > oldCount) {
      const toInsert = editSetValues.slice(oldCount).map((sv, i) => ({
        exercise_id: editingEx.id,
        reps: parseInt(sv.reps) || 0,
        kg: parseFloat(sv.kg) || 0,
        position: oldCount + i
      }))
      await supabase.from('sets').insert(toInsert)
    }

    if (newCount < oldCount) {
      const toDelete = currentSets.slice(newCount).map(s => s.id)
      await supabase.from('sets').delete().in('id', toDelete)
    }

    await fetchExercises()
    setShowEditExModal(false)
    setEditingEx(null)
    setEditSetValues([])
    setSavingEditEx(false)
  }

  function addSetToEdit() {
    const lastKg = editSetValues.length > 0 ? editSetValues[editSetValues.length - 1].kg : 0
    const lastReps = editSetValues.length > 0 ? editSetValues[editSetValues.length - 1].reps : 10
    setEditSetValues(prev => [...prev, { id: null, reps: lastReps, kg: lastKg }])
  }

  function removeSetFromEdit(idx) {
    if (editSetValues.length <= 1) return
    setEditSetValues(prev => prev.filter((_, i) => i !== idx))
  }

  function getAllExercises() {
    const custom = customExercises.map(e => ({ name: e.name, machine: e.machine || '', isCustom: true }))
    return [...DEFAULT_EXERCISES, ...custom].sort((a, b) => a.name.localeCompare(b.name))
  }

  function onSelectExercise(name) {
    setSelectedEx(name)
    const found = getAllExercises().find(e => e.name === name)
    setExMachine(found ? found.machine : '')
  }

  async function addExercise() {
    if (!selectedEx) return
    setSaving(true)
    const { data: ex, error } = await supabase
      .from('exercises')
      .insert({
        workout_id: workout.id,
        name: selectedEx,
        machine: exMachine,
        position: exercises.length,
        note: exNote.trim() || null
      })
      .select().single()

    if (!error && ex) {
      const setsToInsert = kgPerSet.map((kg, i) => ({
        exercise_id: ex.id, reps: parseInt(reps), kg: parseFloat(kg), position: i
      }))
      await supabase.from('sets').insert(setsToInsert)
      resetModal()
      fetchExercises()
    }
    setSaving(false)
  }

  async function saveNote(exId) {
    await supabase.from('exercises').update({ note: editingNoteValue.trim() || null }).eq('id', exId)
    setExercises(prev => prev.map(e => e.id === exId ? { ...e, note: editingNoteValue.trim() || null } : e))
    setEditingNote(null)
    setEditingNoteValue('')
  }

  async function saveCustomExercise() {
    if (!newExName.trim()) return
    setSavingCustom(true)
    const { error } = await supabase.from('custom_exercises').insert({
      user_id: session.user.id,
      name: newExName.trim(),
      machine: newExMachine.trim() || null
    })
    if (!error) { setNewExName(''); setNewExMachine(''); fetchCustomExercises() }
    setSavingCustom(false)
  }

  async function saveCustomExerciseEdit() {
    if (!editingCustomName.trim() || !editingCustomEx) return
    setSavingCustomEdit(true)
    const { error } = await supabase
      .from('custom_exercises')
      .update({ name: editingCustomName.trim(), machine: editingCustomMachine.trim() || null })
      .eq('id', editingCustomEx)
    if (!error) {
      setEditingCustomEx(null)
      setEditingCustomName('')
      setEditingCustomMachine('')
      fetchCustomExercises()
    }
    setSavingCustomEdit(false)
  }

  async function deleteCustomExercise(id) {
    if (!confirm('Eliminare questo esercizio?')) return
    await supabase.from('custom_exercises').delete().eq('id', id)
    fetchCustomExercises()
  }

  function resetModal() {
    setSelectedEx(''); setExMachine(''); setExNote(''); setNumSets(3); setReps(10)
    setDefaultKg(0); setKgPerSet([0, 0, 0]); setShowModal(false)
  }

  async function deleteExercise(id) {
    if (!confirm('Rimuovere questo esercizio?')) return
    await supabase.from('exercises').delete().eq('id', id)
    fetchExercises()
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm">Caricamento...</div>

  if (sessionActive) return (
    <Session workout={workout} userSession={session} scheduledId={scheduledId} onEnd={() => setSessionActive(false)} />
  )

  return (
    <div className="pt-6">
      <button onClick={onBack} className="text-[#666] text-sm flex items-center gap-1 mb-4">← Schede</button>

      <div className="flex items-start justify-between">
        <div>
          <div className="text-[#e8ff47] text-3xl font-black tracking-wide">{workout.name.toUpperCase()}</div>
          {workout.target_muscles && <div className="text-[#666] text-xs mt-1">{workout.target_muscles}</div>}
        </div>
        <button onClick={() => setShowModal(true)} className="w-10 h-10 border border-[#2a2a2a] rounded-xl bg-[#1a1a1a] text-white text-xl flex items-center justify-center">＋</button>
      </div>

      <div className="mt-3 space-y-2">
        <button
          onClick={() => setSessionActive(true)}
          disabled={exercises.length === 0}
          className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-30"
        >▶ Inizia sessione</button>

        {exercises.length > 0 && (
          <button
            onClick={copyLastSession}
            disabled={loadingLastSession}
            className="w-full py-2.5 rounded-xl text-sm font-semibold border border-[#2a2a2a] bg-[#1a1a1a] disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loadingLastSession ? (
              <span className="text-[#666]">Caricamento...</span>
            ) : lastSessionApplied ? (
              <span className="text-green-400">✓ Serie, rip e pesi copiati dall'ultima sessione!</span>
            ) : (
              <>
                <span className="text-[#666]">📋</span>
                <span className="text-[#888]">Copia serie, rip e pesi dall'ultima sessione</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {exercises.length === 0 && (
          <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
            <p className="text-[#666] text-sm">Nessun esercizio ancora.</p>
            <button onClick={() => setShowModal(true)} className="text-[#e8ff47] text-sm mt-1">＋ Aggiungi il primo esercizio</button>
          </div>
        )}

        {exercises.map((ex, idx) => (
          <div key={ex.id} className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-white font-bold">{ex.name}</div>
                {ex.machine && (
                  <div className="inline-flex items-center gap-1 bg-blue-500/10 border border-blue-500/25 rounded-lg px-2 py-1 text-blue-400 text-xs mt-1">
                    🟢 {ex.machine}
                  </div>
                )}
                <div className="mt-2 space-y-1">
                  {ex.sets?.sort((a, b) => a.position - b.position).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="text-[#444] font-mono text-xs w-4">{i + 1}</span>
                      <span className="text-white">{s.reps} rip</span>
                      <span className="text-[#e8ff47] font-mono font-bold">{s.kg} kg</span>
                    </div>
                  ))}
                </div>

                {editingNote === ex.id ? (
                  <div className="flex items-center gap-2 mt-3">
                    <input
                      className="flex-1 bg-[#0a0a0a] border border-[#e8ff47]/30 rounded-lg px-3 py-1.5 text-white text-xs outline-none"
                      placeholder="Aggiungi nota..."
                      value={editingNoteValue}
                      onChange={e => setEditingNoteValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => saveNote(ex.id)} className="w-7 h-7 rounded-lg bg-[#e8ff47] text-black text-xs font-bold flex items-center justify-center">✓</button>
                    <button onClick={() => { setEditingNote(null); setEditingNoteValue('') }} className="w-7 h-7 rounded-lg border border-[#2a2a2a] text-[#666] text-xs flex items-center justify-center">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingNote(ex.id); setEditingNoteValue(ex.note || '') }}
                    className="flex items-center gap-1.5 mt-2"
                  >
                    <span className="text-[#444] text-xs">📝</span>
                    <span className={`text-xs ${ex.note ? 'text-[#888] italic' : 'text-[#444]'}`}>
                      {ex.note || 'Aggiungi nota...'}
                    </span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveExercise(idx, idx - 1)}
                    disabled={idx === 0}
                    className="w-7 h-7 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs flex items-center justify-center disabled:opacity-20"
                  >↑</button>
                  <button
                    onClick={() => moveExercise(idx, idx + 1)}
                    disabled={idx === exercises.length - 1}
                    className="w-7 h-7 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs flex items-center justify-center disabled:opacity-20"
                  >↓</button>
                </div>
                <button
                  onClick={() => openEditExModal(ex)}
                  className="w-8 h-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-[#666] text-sm flex items-center justify-center"
                >✎</button>
                <button
                  onClick={() => deleteExercise(ex.id)}
                  className="w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center"
                >✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {exercises.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowModal(true)} className="w-full py-3 rounded-xl text-sm font-semibold bg-[#1a1a1a] border border-[#2a2a2a] text-white">
            ＋ Aggiungi esercizio
          </button>
        </div>
      )}

      {/* MODAL MODIFICA SERIE ESERCIZIO */}
      {showEditExModal && editingEx && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => { setShowEditExModal(false); setEditingEx(null) }}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-xl tracking-wide mb-1">MODIFICA SERIE</div>
            <div className="text-[#666] text-xs mb-5">{editingEx.name}</div>
            <table className="w-full mb-3">
              <thead>
                <tr>
                  <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center w-8">Set</th>
                  <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Kg</th>
                  <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Rip</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {editSetValues.map((sv, i) => (
                  <tr key={i} className="border-t border-[#1a1a1a]">
                    <td className="py-2 text-center text-[#444] font-mono text-sm">{i + 1}</td>
                    <td className="py-2 text-center">
                      <input
                        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                        type="number" step="2.5" min="0" value={sv.kg}
                        onChange={e => { const u = [...editSetValues]; u[i] = { ...u[i], kg: e.target.value }; setEditSetValues(u) }}
                      />
                    </td>
                    <td className="py-2 text-center">
                      <input
                        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                        type="number" min="1" value={sv.reps}
                        onChange={e => { const u = [...editSetValues]; u[i] = { ...u[i], reps: e.target.value }; setEditSetValues(u) }}
                      />
                    </td>
                    <td className="py-2 text-center">
                      <button onClick={() => removeSetFromEdit(i)} disabled={editSetValues.length <= 1}
                        className="w-6 h-6 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center mx-auto disabled:opacity-20">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={addSetToEdit} className="w-full py-2 rounded-xl text-sm text-[#e8ff47] border border-[#e8ff47]/30 bg-[#e8ff47]/5 mb-5">
              ＋ Aggiungi serie
            </button>
            <button onClick={saveEditEx} disabled={savingEditEx}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              {savingEditEx ? 'Salvataggio...' : '✓ Salva modifiche'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL AGGIUNGI ESERCIZIO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={resetModal}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-black text-2xl tracking-wide">AGGIUNGI ESERCIZIO</div>
              <button onClick={() => { resetModal(); setShowCustomModal(true) }}
                className="text-xs bg-[#e8ff47]/10 border border-[#e8ff47]/30 text-[#e8ff47] rounded-lg px-3 py-1.5">
                ＋ Nuovo
              </button>
            </div>
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Esercizio</label>
            <select
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-3"
              value={selectedEx} onChange={e => onSelectExercise(e.target.value)}
            >
              <option value="">— Seleziona dalla libreria —</option>
              {getAllExercises().map(ex => (
                <option key={ex.name} value={ex.name}>{ex.name}{ex.isCustom ? ' ★' : ''}</option>
              ))}
            </select>
            {exMachine && (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-2 mb-3">
                <span>🟢</span><span className="text-blue-400 text-sm">{exMachine}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-2 text-center">Serie</label>
                <input className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-3 text-white text-2xl font-bold text-center outline-none focus:border-[#e8ff47]"
                  type="number" min="1" max="10" value={numSets} onChange={e => setNumSets(e.target.value)} />
              </div>
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-2 text-center">Rip.</label>
                <input className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-3 text-white text-2xl font-bold text-center outline-none focus:border-[#e8ff47]"
                  type="number" min="1" value={reps} onChange={e => setReps(e.target.value)} />
              </div>
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-2 text-center">Kg base</label>
                <input className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-3 text-white text-2xl font-bold text-center outline-none focus:border-[#e8ff47]"
                  type="number" min="0" step="2.5" value={defaultKg} onChange={e => setDefaultKg(e.target.value)} />
              </div>
            </div>
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Peso per serie</label>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 mb-4 space-y-2">
              {kgPerSet.map((kg, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[#444] font-mono text-xs w-4">{i + 1}</span>
                  <span className="text-[#666] text-sm flex-1">{reps} rip</span>
                  <input
                    className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#e8ff47] font-mono font-bold text-sm text-center w-20 outline-none focus:border-[#e8ff47]"
                    type="number" min="0" step="2.5" value={kg}
                    onChange={e => { const updated = [...kgPerSet]; updated[i] = parseFloat(e.target.value) || 0; setKgPerSet(updated) }}
                  />
                  <span className="text-[#666] text-sm">kg</span>
                </div>
              ))}
            </div>
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nota (opzionale)</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
              placeholder="es. Presa prona, gomiti stretti..."
              value={exNote} onChange={e => setExNote(e.target.value)}
            />
            <button onClick={addExercise} disabled={saving || !selectedEx}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              {saving ? 'Salvataggio...' : '＋ Aggiungi alla scheda'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL ESERCIZI PERSONALIZZATI */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => { setShowCustomModal(false); setEditingCustomEx(null) }}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-2xl tracking-wide mb-4">ESERCIZI PERSONALIZZATI</div>
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nome esercizio</label>
            <input className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-3"
              placeholder="es. Bulgarian Split Squat" value={newExName} onChange={e => setNewExName(e.target.value)} />
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Macchinario (opzionale)</label>
            <input className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
              placeholder="es. Manubri, Bilanciere, Corpo libero" value={newExMachine} onChange={e => setNewExMachine(e.target.value)} />
            <button onClick={saveCustomExercise} disabled={savingCustom || !newExName.trim()}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50 mb-5">
              {savingCustom ? 'Salvataggio...' : 'Salva esercizio'}
            </button>

            {customExercises.length > 0 && (
              <div>
                <div className="text-[#666] text-xs uppercase tracking-widest mb-3">I tuoi esercizi</div>
                <div className="space-y-2">
                  {customExercises.map(ex => (
                    <div key={ex.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                      {editingCustomEx === ex.id ? (
                        <div className="p-3 space-y-2">
                          <input
                            className="w-full bg-[#0a0a0a] border border-[#e8ff47]/30 rounded-lg px-3 py-2 text-white text-sm outline-none"
                            value={editingCustomName} onChange={e => setEditingCustomName(e.target.value)} autoFocus />
                          <input
                            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-[#666] text-sm outline-none"
                            placeholder="Macchinario (opzionale)"
                            value={editingCustomMachine} onChange={e => setEditingCustomMachine(e.target.value)} />
                          <div className="flex gap-2">
                            <button onClick={saveCustomExerciseEdit} disabled={savingCustomEdit || !editingCustomName.trim()}
                              className="flex-1 py-2 rounded-lg bg-[#e8ff47] text-black text-xs font-bold disabled:opacity-50">
                              {savingCustomEdit ? 'Salvo...' : '✓ Salva'}
                            </button>
                            <button onClick={() => { setEditingCustomEx(null); setEditingCustomName(''); setEditingCustomMachine('') }}
                              className="flex-1 py-2 rounded-lg border border-[#2a2a2a] text-[#666] text-xs">
                              Annulla
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between p-3">
                          <div>
                            <div className="text-white text-sm font-medium">{ex.name}</div>
                            {ex.machine && <div className="text-[#666] text-xs mt-0.5">{ex.machine}</div>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setEditingCustomEx(ex.id); setEditingCustomName(ex.name); setEditingCustomMachine(ex.machine || '') }}
                              className="w-7 h-7 rounded-lg border border-[#2a2a2a] bg-[#111] text-[#666] text-xs flex items-center justify-center">✎</button>
                            <button onClick={() => deleteCustomExercise(ex.id)}
                              className="w-7 h-7 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center">✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => { setShowCustomModal(false); setShowModal(true); setEditingCustomEx(null) }}
              className="w-full mt-5 py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]">
              ← Torna alla libreria
            </button>
          </div>
        </div>
      )}
    </div>
  )
}