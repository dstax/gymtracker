import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Stats({ session }) {
  const [exercises, setExercises] = useState([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [progressData, setProgressData] = useState([])
  const [volumeData, setVolumeData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)

  useEffect(() => {
    fetchExercises()
  }, [])

  useEffect(() => {
    if (selectedExercise) fetchProgress(selectedExercise)
  }, [selectedExercise])

  async function fetchExercises() {
    const { data } = await supabase
      .from('session_sets')
      .select('exercise_name')
      .eq('session_id', await getSessionIds())
    
    // Recupera tutti i session_sets dell'utente tramite join
    const { data: sets } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', session.user.id)

    if (sets && sets.length > 0) {
      const ids = sets.map(s => s.id)
      const { data: exData } = await supabase
        .from('session_sets')
        .select('exercise_name')
        .in('session_id', ids)

      if (exData) {
        const unique = [...new Set(exData.map(e => e.exercise_name))].sort()
        setExercises(unique)
        if (unique.length > 0) setSelectedExercise(unique[0])
      }
    }
    setLoading(false)
  }

  async function getSessionIds() {
    const { data } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', session.user.id)
    return data ? data.map(s => s.id) : []
  }

  async function fetchProgress(exerciseName) {
    setLoadingChart(true)

    const ids = await getSessionIds()
    if (ids.length === 0) { setLoadingChart(false); return }

    const { data: sets } = await supabase
      .from('session_sets')
      .select('*, sessions(ended_at)')
      .in('session_id', ids)
      .eq('exercise_name', exerciseName)
      .order('executed_at', { ascending: true })

    if (sets && sets.length > 0) {
      // Raggruppa per sessione e calcola max kg e volume
      const bySession = {}
      sets.forEach(s => {
        const date = s.sessions?.ended_at
          ? new Date(s.sessions.ended_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
          : s.session_id.slice(0, 6)
        if (!bySession[date]) bySession[date] = { date, maxKg: 0, volume: 0, sets: 0 }
        if (s.kg > bySession[date].maxKg) bySession[date].maxKg = s.kg
        bySession[date].volume += (s.kg * s.reps)
        bySession[date].sets += 1
      })

      const chartData = Object.values(bySession)
      setProgressData(chartData)
      setVolumeData(chartData)
    } else {
      setProgressData([])
      setVolumeData([])
    }
    setLoadingChart(false)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-3 py-2">
          <p className="text-[#666] text-xs">{label}</p>
          <p className="text-[#e8ff47] font-bold text-sm">{payload[0].value} {payload[0].name === 'maxKg' ? 'kg' : 'kg·rip'}</p>
        </div>
      )
    }
    return null
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm">Caricamento...</div>

  if (exercises.length === 0) return (
    <div className="pt-8">
      <div className="text-[#e8ff47] text-3xl font-black tracking-wide">STATISTICHE</div>
      <div className="mt-6 p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
        <p className="text-[#666] text-sm">Nessun dato disponibile.</p>
        <p className="text-[#444] text-xs mt-1">Completa qualche sessione per vedere le statistiche!</p>
      </div>
    </div>
  )

  return (
    <div className="pt-8">
      <div className="text-[#e8ff47] text-3xl font-black tracking-wide">STATISTICHE</div>
      <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Progressione esercizi</div>

      {/* SELETTORE ESERCIZIO */}
      <div className="mt-4">
        <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Esercizio</label>
        <select
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47]"
          value={selectedExercise}
          onChange={e => setSelectedExercise(e.target.value)}
        >
          {exercises.map(ex => (
            <option key={ex} value={ex}>{ex}</option>
          ))}
        </select>
      </div>

      {loadingChart ? (
        <div className="mt-6 text-[#666] text-sm">Caricamento dati...</div>
      ) : progressData.length > 0 ? (
        <div className="mt-6 space-y-6">

          {/* GRAFICO PESO MASSIMO */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
            <div className="text-white font-bold mb-1">Peso massimo</div>
            <div className="text-[#666] text-xs mb-4">Kg più alto sollevato per sessione</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="maxKg"
                  stroke="#e8ff47"
                  strokeWidth={2}
                  dot={{ fill: '#e8ff47', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* GRAFICO VOLUME */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
            <div className="text-white font-bold mb-1">Volume totale</div>
            <div className="text-[#666] text-xs mb-4">Kg × ripetizioni per sessione</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fill: '#666', fontSize: 10 }} />
                <YAxis tick={{ fill: '#666', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="volume"
                  stroke="#ff6b35"
                  strokeWidth={2}
                  dot={{ fill: '#ff6b35', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* RECORD PERSONALE */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
            <div className="text-white font-bold mb-3">Record personale</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-[#e8ff47] font-black text-2xl">
                  {Math.max(...progressData.map(d => d.maxKg))} kg
                </div>
                <div className="text-[#666] text-xs mt-1">Peso max</div>
              </div>
              <div className="text-center">
                <div className="text-[#ff6b35] font-black text-2xl">
                  {Math.max(...progressData.map(d => d.volume))}
                </div>
                <div className="text-[#666] text-xs mt-1">Vol. max</div>
              </div>
              <div className="text-center">
                <div className="text-white font-black text-2xl">
                  {progressData.length}
                </div>
                <div className="text-[#666] text-xs mt-1">Sessioni</div>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="mt-6 p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
          <p className="text-[#666] text-sm">Nessun dato per questo esercizio.</p>
        </div>
      )}
    </div>
  )
}