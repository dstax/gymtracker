import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'

export default function Stats({ session }) {
  const [exercises, setExercises] = useState([])
  const [selectedEx, setSelectedEx] = useState('')
  const [chartData, setChartData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingChart, setLoadingChart] = useState(false)
  const [allStats, setAllStats] = useState([])

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    const { data, error } = await supabase
      .rpc('get_user_exercise_stats', { p_user_id: session.user.id })

    if (error || !data) {
      console.error('Errore fetchStats:', error)
      setLoading(false)
      return
    }

    setAllStats(data)

    // Estrai lista esercizi unici
    const uniqueExercises = [...new Set(data.map(r => r.exercise_name))].sort()
    setExercises(uniqueExercises)

    if (uniqueExercises.length > 0) {
      const first = uniqueExercises[0]
      setSelectedEx(first)
      buildChartData(data, first)
    }

    setLoading(false)
  }

  function buildChartData(data, exerciseName) {
    const filtered = data
      .filter(r => r.exercise_name === exerciseName)
      .map(r => ({
        date: new Date(r.session_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
        maxKg: parseFloat(r.max_kg) || 0,
        volume: parseFloat(r.total_volume) || 0,
      }))
    setChartData(filtered)
  }

  function handleSelectExercise(name) {
    setSelectedEx(name)
    buildChartData(allStats, name)
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null
    return (
      <div className="bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2 text-xs">
        <div className="text-[#666] mb-1">{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }} className="font-mono font-bold">
            {p.name}: {p.value}{p.name === 'Max kg' ? ' kg' : ' kg'}
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div className="text-[#666] text-sm">Caricamento statistiche...</div>

  if (exercises.length === 0) return (
    <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
      <p className="text-[#666] text-sm">Nessun dato ancora. Completa qualche sessione!</p>
    </div>
  )

  return (
    <div className="space-y-6 pb-6">
      <div>
        <div className="text-[#e8ff47] text-3xl font-black tracking-wide mb-1">GRAFICI</div>
        <div className="text-[#666] text-xs uppercase tracking-widest">Progressione per esercizio</div>
      </div>

      <div>
        <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Esercizio</label>
        <select
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors"
          value={selectedEx}
          onChange={e => handleSelectExercise(e.target.value)}
        >
          {exercises.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {chartData.length === 0 ? (
        <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
          <p className="text-[#666] text-sm">Nessun dato per questo esercizio.</p>
        </div>
      ) : (
        <>
          {/* GRAFICO MAX KG */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
            <div className="text-white font-bold text-sm mb-1">Max kg per sessione</div>
            <div className="text-[#666] text-xs mb-4">Il peso massimo sollevato in ogni sessione</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#666', fontSize: 10 }}
                  axisLine={{ stroke: '#2a2a2a' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#666', fontSize: 10 }}
                  axisLine={{ stroke: '#2a2a2a' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="maxKg"
                  name="Max kg"
                  stroke="#e8ff47"
                  strokeWidth={2}
                  dot={{ fill: '#4ade80', r: 3 }}
                  activeDot={{ r: 5, fill: '#e8ff47' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* GRAFICO VOLUME */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
            <div className="text-white font-bold text-sm mb-1">Volume per sessione</div>
            <div className="text-[#666] text-xs mb-4">Tonnellate totali spostate (kg × rip)</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#666', fontSize: 10 }}
                  axisLine={{ stroke: '#2a2a2a' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#666', fontSize: 10 }}
                  axisLine={{ stroke: '#2a2a2a' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="volume"
                  name="Volume"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={{ fill: '#60a5fa', r: 3 }}
                  activeDot={{ r: 5, fill: '#60a5fa' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* RIEPILOGO NUMERICO */}
          {chartData.length > 0 && (
            <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
              <div className="text-white font-bold text-sm mb-3">Riepilogo — {selectedEx}</div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-[#e8ff47] font-black text-xl font-mono">
                    {Math.max(...chartData.map(d => d.maxKg))} kg
                  </div>
                  <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Record</div>
                </div>
                <div className="text-center">
                  <div className="text-[#60a5fa] font-black text-xl font-mono">
                    {chartData.length}
                  </div>
                  <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Sessioni</div>
                </div>
                <div className="text-center">
                  <div className="text-[#4ade80] font-black text-xl font-mono">
                    {(() => {
                      const first = chartData[0]?.maxKg || 0
                      const last = chartData[chartData.length - 1]?.maxKg || 0
                      const diff = last - first
                      return (diff >= 0 ? '+' : '') + diff.toFixed(1) + ' kg'
                    })()}
                  </div>
                  <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Progresso</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}