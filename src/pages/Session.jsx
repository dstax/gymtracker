import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function Session({ workout, userSession, onEnd }) {
  const [exercises, setExercises] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [completedSets, setCompletedSets] = useState({})
  const [setValues, setSetValues] = useState({})
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [restSeconds, setRestSeconds] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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

  async function fetchExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*, sets(*)')
      .eq('workout_id', workout.id)
      .order('position')
    if (data) {
      setExercises(data)
      const vals = {}
      data.forEach(ex => {
        ex.sets?.sort((a, b) => a.position - b.position).forEach(s => {
          vals[s.id] = { reps: s.reps, kg: s.kg }
        })
      })
      setSetValues(vals)
    }
    setLoading(false)
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

  function nextExercise() {
    const currentEx = exercises[currentIdx]
    const updates = {}
    currentEx.sets?.forEach(s => { updates[s.id] = true })
    setCompletedSets(prev => ({ ...prev, ...updates }))
    setRestSeconds(0)
    setRestActive(true)
    if (currentIdx < exercises.length - 1) {
      setCurrentIdx(currentIdx + 1)
    } else {
      endSession()
    }
  }

  function prevExercise() {
    setRestActive(false)
    setRestSeconds(0)
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1)
  }

  function resetRest() {
    setRestSeconds(0)
    setRestActive(false)
  }

  async function endSession() {
    setSaving(true)
    clearInterval(totalRef.current)
    clearInterval(restRef.current)

    let totalVolume = 0
    const sessionSetsToInsert = []

    exercises.forEach(ex => {
      const sortedSets = ex.sets?.sort((a, b) => a.position - b.position) || []
      sortedSets.forEach(s => {
        const val = setValues[s.id] || { reps: s.reps, kg: s.kg }
        const kg = parseFloat(val.kg) || 0
        const reps = parseInt(val.reps) || 0
        totalVolume += reps * kg
        sessionSetsToInsert.push({
          exercise_name: ex.name,
          exercise_id: ex.id,
          set_number: s.position + 1,
          reps: reps,
          kg: kg,
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
      .select()
      .single()

    if (error) {
      console.error('Errore salvataggio sessione:', error)
      setSaving(false)
      return
    }

    if (sess && sessionSetsToInsert.length > 0) {
      const setsWithSession = sessionSetsToInsert.map(s => ({
        ...s,
        session_id: sess.id
      }))
      const { error: setsError } = await supabase
        .from('session_sets')
        .insert(setsWithSession)
      if (setsError) console.error('Errore salvataggio serie:', setsError)
    }

    setSaving(false)
    onEnd()
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
  const progress = (currentIdx / exercises.length) * 100

  return (
    <div className="pt-0 -mx-5">

      {/* HEADER */}
      <div className="bg-[#111] border-b border-[#2a2a2a] px-5 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[#666] text-xs uppercase tracking-widest">In corso</div>
            <div className="text-white font-black text-xl tracking-wide">{workout.name}</div>
          </div>
          <div className="text-[#666] text-xs">Esercizio {currentIdx + 1} di {exercises.length}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 text-center">
            <div className="text-[#666] text-xs uppercase tracking-widest mb-1">⏱ Totale</div>
            <div className="text-[#e8ff47] font-black text-2xl tracking-widest">{fmt(totalSeconds)}</div>
          </div>
          <div className={`border rounded-xl p-3 text-center transition-all ${restSeconds >= 120 ? 'bg-orange-500/10 border-orange-500/50 animate-pulse' : restActive ? 'bg-[#1a1a1a] border-[#ff6b35]/50' : 'bg-[#1a1a1a] border-[#2a2a2a]'}`}>
            <div className="text-[#666] text-xs uppercase tracking-widest mb-1">☕ Pausa</div>
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
        <div className="text-white font-black text-xl">{currentEx.name}</div>
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

      {/* NAVIGAZIONE */}
      <div className="px-5 mt-4 flex gap-3">
        <button
          onClick={prevExercise}
          disabled={currentIdx === 0}
          className="flex-1 py-3 rounded-xl text-sm font-bold bg-[#1a1a1a] border border-[#2a2a2a] text-white disabled:opacity-30"
        >
          ← Prec.
        </button>
        <button
          onClick={nextExercise}
          className="py-3 rounded-xl text-sm font-bold bg-[#e8ff47] text-black"
          style={{ flex: 2 }}
        >
          {currentIdx === exercises.length - 1 ? '⏹ Termina e Salva' : 'Prossimo →'}
        </button>
      </div>

      <div className="px-5 mt-3 mb-6">
        <button
          onClick={() => { if (confirm('Terminare la sessione?')) endSession() }}
          disabled={saving}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/30 text-red-400 disabled:opacity-50"
        >
{saving ? 'Salvataggio in corso...' : '⚠️ Abbandona sessione'}        </button>
      </div>

    </div>
  )
}