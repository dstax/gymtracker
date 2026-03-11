import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function History({ session }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetchSessions()
  }, [])

async function fetchSessions() {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', session.user.id)
    .order('ended_at', { ascending: false })
  console.log('Sessioni:', data, 'Errore:', error)
  if (data) setSessions(data)
  setLoading(false)
}

  async function openDetail(sess) {
    setSelected(sess)
    setLoadingDetail(true)
    const { data } = await supabase
      .from('session_sets')
      .select('*')
      .eq('session_id', sess.id)
      .order('exercise_name')
    if (data) setDetail(data)
    setLoadingDetail(false)
  }

  function fmt(seconds) {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('it-IT', {
      weekday: 'long', day: 'numeric', month: 'long'
    })
  }

  function groupByExercise(sets) {
    const groups = {}
    sets.forEach(s => {
      if (!groups[s.exercise_name]) groups[s.exercise_name] = []
      groups[s.exercise_name].push(s)
    })
    return groups
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm">Caricamento...</div>

  if (selected) return (
    <div className="pt-6">
      <button onClick={() => setSelected(null)} className="text-[#666] text-sm mb-4 flex items-center gap-1">← Cronologia</button>
      <div className="text-[#e8ff47] text-3xl font-black tracking-wide">{selected.workout_name?.toUpperCase()}</div>
      <div className="text-[#666] text-xs mt-1 capitalize">{formatDate(selected.ended_at)}</div>
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-center">
          <div className="text-[#e8ff47] font-black text-xl">{fmt(selected.duration_seconds)}</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Durata</div>
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-center">
          <div className="text-[#e8ff47] font-black text-xl">{(selected.total_volume / 1000).toFixed(1)}t</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Volume</div>
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl p-3 text-center">
          <div className="text-[#e8ff47] font-black text-xl">{Object.keys(groupByExercise(detail)).length}</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Esercizi</div>
        </div>
      </div>
      {loadingDetail ? (
        <div className="mt-4 text-[#666] text-sm">Caricamento dettagli...</div>
      ) : (
        <div className="mt-4 space-y-3">
          {Object.entries(groupByExercise(detail)).map(([exName, sets]) => (
            <div key={exName} className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
              <div className="text-white font-bold mb-2">{exName}</div>
              <div className="space-y-1">
                {sets.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 text-sm">
                    <span className="text-[#444] font-mono text-xs w-4">{i + 1}</span>
                    <span className="text-white">{s.reps} rip</span>
                    <span className="text-[#e8ff47] font-mono font-bold">{s.kg} kg</span>
                    {s.is_pr && <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded px-1.5 py-0.5">PR</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="pt-8">
      <div className="text-[#e8ff47] text-3xl font-black tracking-wide">CRONOLOGIA</div>
      <div className="text-[#666] text-xs uppercase tracking-widest mt-1">{sessions.length} sessioni completate</div>
      <div className="mt-4 space-y-3">
        {sessions.length === 0 && (
          <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
            <p className="text-[#666] text-sm">Nessuna sessione completata ancora.</p>
            <p className="text-[#444] text-xs mt-1">Completa il tuo primo allenamento per vederlo qui!</p>
          </div>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => openDetail(s)}
            className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl cursor-pointer active:scale-[.98] transition-transform"
          >
            <div className="text-[#666] text-xs uppercase tracking-widest capitalize">{formatDate(s.ended_at)}</div>
            <div className="text-white font-black text-lg mt-1">{s.workout_name}</div>
            <div className="flex gap-4 mt-2">
              <div className="text-[#666] text-xs">Durata: <span className="text-white font-medium">{fmt(s.duration_seconds)}</span></div>
              <div className="text-[#666] text-xs">Volume: <span className="text-white font-medium">{(s.total_volume / 1000).toFixed(1)}t</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}