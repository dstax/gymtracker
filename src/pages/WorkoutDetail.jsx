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
  { name: 'Row (Macchina)', machine: 'Row (Macchina)' },
  { name: 'Shoulder Press', machine: 'Shoulder Press' },
  { name: 'Standing Leg Curl', machine: 'Standing Leg Curl' },
  { name: 'Tricipiti ai Cavi', machine: 'Cavi' },
  { name: 'Vertical Traction / Lat Machine', machine: 'Vertical Traction / Lat Machine' },
]

export default function WorkoutDetail({ workout, session, onBack }) {
  const [exercises, setExercises] = useState([])
  const [customExercises, setCustomExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [sessionActive, setSessionActive] = useState(false)
  const [selectedEx, setSelectedEx] = useState('')
  const [exMachine, setExMachine] = useState('')
  const [numSets, setNumSets] = useState(3)
  const [reps, setReps] = useState(10)
  const [defaultKg, setDefaultKg] = useState(0)
  const [kgPerSet, setKgPerSet] = useState([0, 0, 0])
  const [saving, setSaving] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [newExMachine, setNewExMachine] = useState('')
  const [savingCustom, setSavingCustom] = useState(false)

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

  function getAllExercises() {
    const custom = customExercises.map(e => ({ name: e.name, machine: e.machine || '', isCustom: true }))
    const all = [...DEFAULT_EXERCISES, ...custom]
    return all.sort((a, b) => a.name.localeCompare(b.name))
  }

  function onSelectExercise(name) {
    setSelectedEx(name)
    const all = getAllExercises()
    const found = all.find(e => e.name === name)
    if (found) setExMachine(found.machine)
    else setExMachine('')
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
        position: exercises.length
      })
      .select()
      .single()

    if (!error && ex) {
      const setsToInsert = kgPerSet.map((kg, i) => ({
        exercise_id: ex.id,
        reps: parseInt(reps),
        kg: parseFloat(kg),
        position: i
      }))
      await supabase.from('sets').insert(setsToInsert)
      resetModal()
      fetchExercises()
    }
    setSaving(false)
  }

  async function saveCustomExercise() {
    if (!newExName.trim()) return
    setSavingCustom(true)
    const { error } = await supabase
      .from('custom_exercises')
      .insert({
        user_id: session.user.id,
        name: newExName.trim(),
        machine: newExMachine.trim() || null
      })
    if (!error) {
      setNewExName('')
      setNewExMachine('')
      setShowCustomModal(false)
      fetchCustomExercises()
    }
    setSavingCustom(false)
  }

  function resetModal() {
    setSelectedEx('')
    setExMachine('')
    setNumSets(3)
    setReps(10)
    setDefaultKg(0)
    setKgPerSet([0, 0, 0])
    setShowModal(false)
  }

  async function deleteExercise(id) {
    if (!confirm('Rimuovere questo esercizio?')) return
    await supabase.from('exercises').delete().eq('id', id)
    fetchExercises()
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm">Caricamento...</div>

  if (sessionActive) return (
    <Session
      workout={workout}
      userSession={session}
      onEnd={() => setSessionActive(false)}
    />
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

      <div className="mt-3">
        <button
          onClick={() => setSessionActive(true)}
          disabled={exercises.length === 0}
          className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-30"
        >
          ▶ Inizia sessione
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {exercises.length === 0 && (
          <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
            <p className="text-[#666] text-sm">Nessun esercizio ancora.</p>
            <button onClick={() => setShowModal(true)} className="text-[#e8ff47] text-sm mt-1">＋ Aggiungi il primo esercizio</button>
          </div>
        )}

        {exercises.map(ex => (
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
              </div>
              <button onClick={() => deleteExercise(ex.id)} className="w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center ml-2">✕</button>
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

      {/* MODAL AGGIUNGI ESERCIZIO */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={resetModal}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-black text-2xl tracking-wide">AGGIUNGI ESERCIZIO</div>
              <button
                onClick={() => { resetModal(); setShowCustomModal(true) }}
                className="text-xs bg-[#e8ff47]/10 border border-[#e8ff47]/30 text-[#e8ff47] rounded-lg px-3 py-1.5"
              >
                ＋ Nuovo
              </button>
            </div>

            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Esercizio</label>
            <select
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-3"
              value={selectedEx}
              onChange={e => onSelectExercise(e.target.value)}
            >
              <option value="">— Seleziona dalla libreria —</option>
              {getAllExercises().map(ex => (
                <option key={ex.name} value={ex.name}>
                  {ex.name}{ex.isCustom ? ' ★' : ''}
                </option>
              ))}
            </select>

            {exMachine && (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-2 mb-3">
                <span>🟢</span>
                <span className="text-blue-400 text-sm">{exMachine}</span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-2 text-center">Serie</label>
                <input
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-3 text-white text-2xl font-bold text-center outline-none focus:border-[#e8ff47]"
                  type="number" min="1" max="10"
                  value={numSets}
                  onChange={e => setNumSets(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-2 text-center">Rip.</label>
                <input
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-3 text-white text-2xl font-bold text-center outline-none focus:border-[#e8ff47]"
                  type="number" min="1"
                  value={reps}
                  onChange={e => setReps(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-2 text-center">Kg base</label>
                <input
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl py-3 text-white text-2xl font-bold text-center outline-none focus:border-[#e8ff47]"
                  type="number" min="0" step="2.5"
                  value={defaultKg}
                  onChange={e => setDefaultKg(e.target.value)}
                />
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
                    type="number" min="0" step="2.5"
                    value={kg}
                    onChange={e => {
                      const updated = [...kgPerSet]
                      updated[i] = parseFloat(e.target.value) || 0
                      setKgPerSet(updated)
                    }}
                  />
                  <span className="text-[#666] text-sm">kg</span>
                </div>
              ))}
            </div>

            <button
              onClick={addExercise}
              disabled={saving || !selectedEx}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : '＋ Aggiungi alla scheda'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL NUOVO ESERCIZIO PERSONALIZZATO */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => setShowCustomModal(false)}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-2xl tracking-wide mb-4">NUOVO ESERCIZIO</div>

            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nome esercizio</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-3"
              placeholder="es. Bulgarian Split Squat"
              value={newExName}
              onChange={e => setNewExName(e.target.value)}
            />

            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Macchinario (opzionale)</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
              placeholder="es. Manubri, Bilanciere, Corpo libero"
              value={newExMachine}
              onChange={e => setNewExMachine(e.target.value)}
            />

            <button
              onClick={saveCustomExercise}
              disabled={savingCustom || !newExName.trim()}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50 mb-3"
            >
              {savingCustom ? 'Salvataggio...' : 'Salva esercizio'}
            </button>

            <button
              onClick={() => { setShowCustomModal(false); setShowModal(true) }}
              className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]"
            >
              ← Torna alla libreria
            </button>
          </div>
        </div>
      )}
    </div>
  )
}