import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Stats from './Stats'

export default function History({ session }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [globalStats, setGlobalStats] = useState({ totalSessions: 0, totalPRs: 0 })
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editSets, setEditSets] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchSessions()
    fetchGlobalStats()
  }, [])

  async function fetchSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('ended_at', { ascending: false })
    if (data) setSessions(data)
    setLoading(false)
  }

  async function fetchGlobalStats() {
    const { count: totalSessions } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)

    const { count: totalPRs } = await supabase
      .from('session_sets')
      .select('session_id, sessions!inner(user_id)', { count: 'exact', head: true })
      .eq('is_pr', true)
      .eq('sessions.user_id', session.user.id)

    setGlobalStats({
      totalSessions: totalSessions || 0,
      totalPRs: totalPRs || 0
    })
  }

  async function deleteSession(id) {
    if (!confirm('Eliminare questa sessione?')) return
    await supabase.from('session_sets').delete().eq('session_id', id)
    await supabase.from('sessions').delete().eq('id', id)
    setSelected(null)
    fetchSessions()
    fetchGlobalStats()
  }

  async function openDetail(sess) {
    setSelected(sess)
    setEditMode(false)
    setLoadingDetail(true)
    const { data } = await supabase
      .from('session_sets')
      .select('*')
      .eq('session_id', sess.id)
      .order('exercise_order', { ascending: true })
      .order('set_number', { ascending: true })
    if (data) setDetail(data)
    setLoadingDetail(false)
  }

  // Raggruppa mantenendo l'ordine di apparizione in base a exercise_order
  function groupByExerciseOrdered(sets) {
    const order = []
    const groups = {}
    sets.forEach(s => {
      if (!groups[s.exercise_name]) {
        groups[s.exercise_name] = []
        order.push(s.exercise_name)
      }
      groups[s.exercise_name].push(s)
    })
    return order.map(name => ({ name, sets: groups[name] }))
  }

  function startEdit() {
    setEditName(selected.workout_name || '')
    setEditMinutes(Math.floor((selected.duration_seconds || 0) / 60))
    const vals = {}
    detail.forEach(s => {
      vals[s.id] = { reps: s.reps, kg: s.kg }
    })
    setEditSets(vals)
    setEditMode(true)
  }

  async function saveEdit() {
    setSaving(true)
    const newDuration = parseInt(editMinutes) * 60
    let newVolume = 0
    detail.forEach(s => {
      const val = editSets[s.id] || { reps: s.reps, kg: s.kg }
      newVolume += (parseFloat(val.kg) || 0) * (parseInt(val.reps) || 0)
    })

    await supabase.from('sessions').update({
      workout_name: editName.trim(),
      duration_seconds: newDuration,
      total_volume: newVolume
    }).eq('id', selected.id)

    await Promise.all(detail.map(s => {
      const val = editSets[s.id] || { reps: s.reps, kg: s.kg }
      return supabase.from('session_sets').update({
        reps: parseInt(val.reps) || 0,
        kg: parseFloat(val.kg) || 0
      }).eq('id', s.id)
    }))

    const updatedSession = {
      ...selected,
      workout_name: editName.trim(),
      duration_seconds: newDuration,
      total_volume: newVolume
    }
    setSelected(updatedSession)
    setSessions(prev => prev.map(s => s.id === selected.id ? updatedSession : s))
    setDetail(detail.map(s => {
      const val = editSets[s.id] || { reps: s.reps, kg: s.kg }
      return { ...s, reps: parseInt(val.reps) || 0, kg: parseFloat(val.kg) || 0 }
    }))
    setEditMode(false)
    setSaving(false)
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

  function exportCSV() {
    if (sessions.length === 0) return
    const rows = [['Data', 'Scheda', 'Durata (min)', 'Volume (kg)']]
    sessions.forEach(s => {
      rows.push([
        new Date(s.ended_at).toLocaleDateString('it-IT'),
        s.workout_name,
        Math.floor((s.duration_seconds || 0) / 60),
        s.total_volume || 0
      ])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gymtracker_sessioni.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm">Caricamento...</div>

  if (showStats) return (
    <div className="pt-6">
      <button onClick={() => setShowStats(false)} className="text-[#666] text-sm flex items-center gap-1 mb-4">← Cronologia</button>
      <Stats session={session} />
    </div>
  )

  if (selected) return (
    <div className="pt-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { setSelected(null); setEditMode(false) }} className="text-[#666] text-sm flex items-center gap-1">← Cronologia</button>
        <div className="flex items-center gap-2">
          {!editMode && (
            <button
              onClick={startEdit}
              className="w-8 h-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-sm flex items-center justify-center"
            >✎</button>
          )}
          <button
            onClick={() => deleteSession(selected.id)}
            className="w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center"
          >🗑</button>
        </div>
      </div>

      {editMode ? (
        <div>
          <div className="text-[#e8ff47] text-xs uppercase tracking-widest mb-4">Modifica sessione</div>

          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nome sessione</label>
          <input
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
            value={editName}
            onChange={e => setEditName(e.target.value)}
          />

          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Durata (minuti)</label>
          <input
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-5"
            type="number" min="1"
            value={editMinutes}
            onChange={e => setEditMinutes(e.target.value)}
          />

          <div className="text-[#666] text-xs uppercase tracking-widest mb-3">Serie</div>
          <div className="space-y-3">
            {groupByExerciseOrdered(detail).map(({ name, sets }) => (
              <div key={name} className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
                <div className="text-white font-bold mb-3">{name}</div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center w-8">Set</th>
                      <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Kg</th>
                      <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Rip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sets.map((s, i) => (
                      <tr key={s.id} className="border-t border-[#1a1a1a]">
                        <td className="py-2 text-center text-[#444] font-mono text-sm">{i + 1}</td>
                        <td className="py-2 text-center">
                          <input
                            className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                            type="number" step="2.5" min="0"
                            value={editSets[s.id]?.kg ?? s.kg}
                            onChange={e => setEditSets(prev => ({ ...prev, [s.id]: { ...prev[s.id], kg: e.target.value } }))}
                          />
                        </td>
                        <td className="py-2 text-center">
                          <input
                            className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                            type="number" min="1"
                            value={editSets[s.id]?.reps ?? s.reps}
                            onChange={e => setEditSets(prev => ({ ...prev, [s.id]: { ...prev[s.id], reps: e.target.value } }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            <button
              onClick={saveEdit}
              disabled={saving}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : '✓ Salva modifiche'}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]"
            >Annulla</button>
          </div>
        </div>
      ) : (
        <div>
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
              <div className="text-[#e8ff47] font-black text-xl">{groupByExerciseOrdered(detail).length}</div>
              <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Esercizi</div>
            </div>
          </div>
          {loadingDetail ? (
            <div className="mt-4 text-[#666] text-sm">Caricamento dettagli...</div>
          ) : (
            <div className="mt-4 space-y-3 mb-6">
              {groupByExerciseOrdered(detail).map(({ name, sets }) => (
                <div key={name} className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
                  <div className="text-white font-bold mb-2">{name}</div>
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
      )}
    </div>
  )

  return (
    <div className="pt-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#e8ff47] text-3xl font-black tracking-wide">CRONOLOGIA</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">{sessions.length} sessioni completate</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            disabled={sessions.length === 0}
            className="w-10 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center disabled:opacity-30"
            title="Esporta CSV"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" fill="#1d6f42"/>
              <path d="M7 8h2.5M7 12h2.5M7 16h2.5M12 8h5M12 12h5M12 16h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 8v8" stroke="white" strokeWidth="1" opacity="0.4"/>
            </svg>
          </button>
          <button
            onClick={() => setShowStats(true)}
            className="w-10 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-xl flex items-center justify-center"
          >📈</button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
          <div className="text-[#e8ff47] font-black text-2xl">{globalStats.totalSessions}</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">Sessioni totali</div>
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
          <div className="text-green-400 font-black text-2xl">{globalStats.totalPRs}</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">PR storici</div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sessions.length === 0 && (
          <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
            <p className="text-[#666] text-sm">Nessuna sessione completata ancora.</p>
            <p className="text-[#444] text-xs mt-1">Completa il tuo primo allenamento per vederlo qui!</p>
          </div>
        )}
        {sessions.map(s => (
          <div
            key={s.id}
            className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl cursor-pointer active:scale-[.98] transition-transform relative"
          >
            <div onClick={() => openDetail(s)}>
              <div className="text-[#666] text-xs uppercase tracking-widest capitalize">{formatDate(s.ended_at)}</div>
              <div className="text-white font-black text-lg mt-1">{s.workout_name}</div>
              <div className="flex gap-4 mt-2">
                <div className="text-[#666] text-xs">Durata: <span className="text-white font-medium">{fmt(s.duration_seconds)}</span></div>
                <div className="text-[#666] text-xs">Volume: <span className="text-white font-medium">{(s.total_volume / 1000).toFixed(1)}t</span></div>
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center"
            >🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}