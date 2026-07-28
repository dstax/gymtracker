import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Stats from './Stats'

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

export default function History({ session }) {
  const [sessions, setSessions] = useState([])
  const [sessionPRs, setSessionPRs] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showPRs, setShowPRs] = useState(false)
  const [prData, setPRData] = useState([])
  const [loadingPRs, setLoadingPRs] = useState(false)
  const [globalStats, setGlobalStats] = useState({
    totalSessions: 0, totalVolume: 0, totalHours: 0, avgPerWeek: 0
  })
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editMinutes, setEditMinutes] = useState('')
  const [editSets, setEditSets] = useState({})
  const [editNotes, setEditNotes] = useState({})
  const [editNewSets, setEditNewSets] = useState({})
  const [editDeletedExercises, setEditDeletedExercises] = useState([])
  const [editNewExercises, setEditNewExercises] = useState([])
  const [editExerciseOrder, setEditExerciseOrder] = useState([])
  const [saving, setSaving] = useState(false)
  const [showAddExModal, setShowAddExModal] = useState(false)
  const [addExSelected, setAddExSelected] = useState('')
  const [addExSets, setAddExSets] = useState([{ kg: 0, reps: 10 }])
  const [confirmDeleteEx, setConfirmDeleteEx] = useState(null)
  const [customExercises, setCustomExercises] = useState([])
  const [prCopied, setPrCopied] = useState(false)

  useEffect(() => {
    fetchSessions()
    fetchGlobalStats()
    fetchSessionPRs()
    fetchCustomExercises()
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

  async function fetchSessionPRs() {
    const { data } = await supabase
      .from('session_sets')
      .select('session_id, sessions!inner(user_id)')
      .eq('is_pr', true)
      .eq('sessions.user_id', session.user.id)
    if (data) {
      const prMap = {}
      data.forEach(s => { prMap[s.session_id] = true })
      setSessionPRs(prMap)
    }
  }

  async function fetchGlobalStats() {
    const { data } = await supabase
      .from('sessions')
      .select('duration_seconds, total_volume, ended_at')
      .eq('user_id', session.user.id)
    if (!data || data.length === 0) return
    const totalSessions = data.length
    const totalVolume = data.reduce((sum, s) => sum + (s.total_volume || 0), 0)
    const totalSeconds = data.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
    const totalHours = totalSeconds / 3600
    const dates = data.map(s => new Date(s.ended_at)).sort((a, b) => a - b)
    const weeksDiff = Math.max(1, (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 7))
    setGlobalStats({
      totalSessions,
      totalVolume: (totalVolume / 1000).toFixed(1),
      totalHours: totalHours.toFixed(1),
      avgPerWeek: (totalSessions / weeksDiff).toFixed(1)
    })
  }

  async function fetchCustomExercises() {
    const { data } = await supabase
      .from('custom_exercises')
      .select('*')
      .eq('user_id', session.user.id)
      .order('name')
    if (data) setCustomExercises(data)
  }

  // FIX: prima prendi le sessioni dell'utente, poi i session_sets.
  // Il filtro .eq() su tabella joinata non funziona in modo affidabile con RLS.
  async function fetchPRs() {
    setLoadingPRs(true)

    // Step 1: prendi tutti gli id sessione dell'utente
    const { data: userSessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', session.user.id)
      .not('ended_at', 'is', null)

    if (sessErr || !userSessions || userSessions.length === 0) {
      setPRData([])
      setLoadingPRs(false)
      return
    }

    const sessionIds = userSessions.map(s => s.id)

    // Step 2: prendi tutti i session_sets di quelle sessioni
    // Supabase gestisce bene .in() su colonne dirette (non join)
    const { data, error } = await supabase
      .from('session_sets')
      .select('exercise_name, kg, reps')
      .in('session_id', sessionIds)

    if (error || !data) {
      setPRData([])
      setLoadingPRs(false)
      return
    }

    // Calcola max kg e volume totale per esercizio
    const exercises = {}
    data.forEach(s => {
      const name = s.exercise_name
      const kg = parseFloat(s.kg) || 0
      const reps = parseInt(s.reps) || 0
      if (!exercises[name]) exercises[name] = { maxKg: 0, totalVolume: 0 }
      if (kg > exercises[name].maxKg) exercises[name].maxKg = kg
      exercises[name].totalVolume += kg * reps
    })

    setPRData(
      Object.entries(exercises)
        .map(([name, stats]) => ({ name, maxKg: stats.maxKg, totalVolume: stats.totalVolume }))
        .sort((a, b) => a.name.localeCompare(b.name))
    )
    setLoadingPRs(false)
  }

  async function sharePRs() {
    if (prData.length === 0) return
    const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    let text = `🏆 *RECORD PERSONALI*\n`
    text += `📅 ${today}\n\n`
    prData.forEach(ex => {
      text += `*${ex.name}*\n`
      if (ex.maxKg > 0) text += `  PR: ${ex.maxKg} kg\n`
      if (ex.totalVolume > 0) {
        const vol = ex.totalVolume >= 1000
          ? (ex.totalVolume / 1000).toFixed(1) + 't'
          : ex.totalVolume + ' kg'
        text += `  Volume totale: ${vol}\n`
      }
      text += `\n`
    })
    text += `_Inviato da GymTracker 💪_`
    if (navigator.share) {
      try { await navigator.share({ text }); return } catch { /* fallback */ }
    }
    try {
      await navigator.clipboard.writeText(text)
      setPrCopied(true)
      setTimeout(() => setPrCopied(false), 2500)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); document.body.removeChild(ta)
      setPrCopied(true)
      setTimeout(() => setPrCopied(false), 2500)
    }
  }

  async function deleteSession(id) {
    if (!confirm('Eliminare questa sessione?')) return
    await supabase.from('session_sets').delete().eq('session_id', id)
    await supabase.from('sessions').delete().eq('id', id)
    setSelected(null)
    fetchSessions()
    fetchGlobalStats()
    fetchSessionPRs()
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

  function groupByExerciseOrdered(sets) {
    const order = []
    const groups = {}
    sets.forEach(s => {
      if (!groups[s.exercise_name]) { groups[s.exercise_name] = []; order.push(s.exercise_name) }
      groups[s.exercise_name].push(s)
    })
    return order.map(name => ({ name, sets: groups[name] }))
  }

  function getAllExerciseNames() {
    const custom = customExercises.map(e => e.name)
    return [...DEFAULT_EXERCISES.map(e => e.name), ...custom].sort((a, b) => a.localeCompare(b))
  }

  function startEdit() {
    setEditName(selected.workout_name || '')
    setEditMinutes(Math.floor((selected.duration_seconds || 0) / 60))
    const vals = {}
    const notes = {}
    const newSets = {}
    const order = []
    groupByExerciseOrdered(detail).forEach(({ name, sets }) => {
      sets.forEach(s => { vals[s.id] = { reps: s.reps, kg: s.kg } })
      notes[name] = sets[0]?.note || ''
      newSets[name] = []
      order.push(name)
    })
    setEditSets(vals)
    setEditNotes(notes)
    setEditNewSets(newSets)
    setEditDeletedExercises([])
    setEditNewExercises([])
    setEditExerciseOrder(order)
    setEditMode(true)
  }

  function moveExercise(name, direction) {
    setEditExerciseOrder(prev => {
      const idx = prev.indexOf(name)
      if (idx === -1) return prev
      const newOrder = [...prev]
      const targetIdx = idx + direction
      if (targetIdx < 0 || targetIdx >= newOrder.length) return prev
      ;[newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]]
      return newOrder
    })
  }

  function moveNewExercise(idx, direction) {
    setEditNewExercises(prev => {
      const newArr = [...prev]
      const targetIdx = idx + direction
      if (targetIdx < 0 || targetIdx >= newArr.length) return prev
      ;[newArr[idx], newArr[targetIdx]] = [newArr[targetIdx], newArr[idx]]
      return newArr
    })
  }

  function addNewSet(exerciseName, sets) {
    const last = sets[sets.length - 1]
    const lastKg = editSets[last?.id]?.kg ?? last?.kg ?? 0
    const lastReps = editSets[last?.id]?.reps ?? last?.reps ?? 10
    setEditNewSets(prev => ({
      ...prev,
      [exerciseName]: [...(prev[exerciseName] || []), { kg: lastKg, reps: lastReps }]
    }))
  }

  function removeNewSet(exerciseName, idx) {
    setEditNewSets(prev => ({
      ...prev,
      [exerciseName]: prev[exerciseName].filter((_, i) => i !== idx)
    }))
  }

  function removeExistingSet(setId, exerciseName) {
    const setsOfEx = detail.filter(s => s.exercise_name === exerciseName)
    const remainingExisting = setsOfEx.filter(s => editSets[s.id] && s.id !== setId).length
    const remainingNew = (editNewSets[exerciseName] || []).length
    if (remainingExisting + remainingNew === 0) return
    setEditSets(prev => { const u = { ...prev }; delete u[setId]; return u })
    setDetail(prev => prev.filter(s => s.id !== setId))
  }

  function markDeleteExercise(name) {
    setConfirmDeleteEx(null)
    setEditDeletedExercises(prev => [...prev, name])
    setEditNewSets(prev => { const u = { ...prev }; delete u[name]; return u })
  }

  function unmarkDeleteExercise(name) {
    setEditDeletedExercises(prev => prev.filter(n => n !== name))
  }

  function confirmAddExercise() {
    if (!addExSelected || addExSets.length === 0) return
    setEditNewExercises(prev => [...prev, {
      name: addExSelected,
      sets: addExSets.map(s => ({ kg: parseFloat(s.kg) || 0, reps: parseInt(s.reps) || 0 }))
    }])
    setShowAddExModal(false)
    setAddExSelected('')
    setAddExSets([{ kg: 0, reps: 10 }])
  }

  function removeNewExercise(idx) {
    setEditNewExercises(prev => prev.filter((_, i) => i !== idx))
  }

  async function saveEdit() {
    setSaving(true)
    const newDuration = parseInt(editMinutes) * 60
    const grouped = groupByExerciseOrdered(detail)

    for (const exName of editDeletedExercises) {
      const idsToDelete = detail.filter(s => s.exercise_name === exName).map(s => s.id)
      if (idsToDelete.length > 0) {
        await supabase.from('session_sets').delete().in('id', idsToDelete)
      }
    }

    const allExistingNames = editExerciseOrder.filter(n => !editDeletedExercises.includes(n))
    const newExNames = editNewExercises.map(e => e.name)
    const finalOrder = [...allExistingNames, ...newExNames]

    const activeDetail = detail.filter(s => !editDeletedExercises.includes(s.exercise_name))
    await Promise.all(activeDetail.map(s => {
      const val = editSets[s.id]
      if (!val) return supabase.from('session_sets').delete().eq('id', s.id)
      const newOrder = finalOrder.indexOf(s.exercise_name)
      return supabase.from('session_sets').update({
        reps: parseInt(val.reps) || 0,
        kg: parseFloat(val.kg) || 0,
        note: editNotes[s.exercise_name] ?? s.note,
        exercise_order: newOrder >= 0 ? newOrder : s.exercise_order
      }).eq('id', s.id)
    }))

    const toInsert = []
    grouped.filter(g => !editDeletedExercises.includes(g.name)).forEach(({ name, sets }) => {
      const newS = editNewSets[name] || []
      const exerciseOrder = finalOrder.indexOf(name)
      const exerciseId = sets[0]?.exercise_id ?? null
      newS.forEach((ns, i) => {
        toInsert.push({
          session_id: selected.id,
          exercise_name: name,
          exercise_id: exerciseId,
          exercise_order: exerciseOrder >= 0 ? exerciseOrder : 0,
          set_number: sets.length + i + 1,
          reps: parseInt(ns.reps) || 0,
          kg: parseFloat(ns.kg) || 0,
          note: editNotes[name] || null,
          is_pr: false
        })
      })
    })

    editNewExercises.forEach((ex) => {
      const exerciseOrder = finalOrder.indexOf(ex.name)
      ex.sets.forEach((s, i) => {
        toInsert.push({
          session_id: selected.id,
          exercise_name: ex.name,
          exercise_id: null,
          exercise_order: exerciseOrder >= 0 ? exerciseOrder : finalOrder.length,
          set_number: i + 1,
          reps: s.reps,
          kg: s.kg,
          note: null,
          is_pr: false
        })
      })
    })

    if (toInsert.length > 0) {
      await supabase.from('session_sets').insert(toInsert)
    }

    const allActiveSets = [
      ...activeDetail.filter(s => editSets[s.id]).map(s => ({
        kg: parseFloat(editSets[s.id]?.kg) || 0,
        reps: parseInt(editSets[s.id]?.reps) || 0
      })),
      ...toInsert.map(s => ({ kg: s.kg, reps: s.reps }))
    ]
    const newVolume = allActiveSets.reduce((sum, s) => sum + s.kg * s.reps, 0)

    await supabase.from('sessions').update({
      workout_name: editName.trim(),
      duration_seconds: newDuration,
      total_volume: newVolume
    }).eq('id', selected.id)

    const updatedSession = { ...selected, workout_name: editName.trim(), duration_seconds: newDuration, total_volume: newVolume }
    setSelected(updatedSession)
    setSessions(prev => prev.map(s => s.id === selected.id ? updatedSession : s))
    setEditMode(false)
    setSaving(false)

    const { data } = await supabase
      .from('session_sets')
      .select('*')
      .eq('session_id', selected.id)
      .order('exercise_order', { ascending: true })
      .order('set_number', { ascending: true })
    if (data) setDetail(data)
  }

  function shareSession() {
    const grouped = groupByExerciseOrdered(detail)
    const hasPR = sessionPRs[selected.id]
    let text = `💪 *${selected.workout_name}*\n`
    text += `📅 ${formatDate(selected.ended_at)}\n`
    text += `⏱ Durata: ${fmt(selected.duration_seconds)} | Volume: ${(selected.total_volume / 1000).toFixed(1)}t`
    if (hasPR) text += ` | 🏆 PR`
    text += `\n\n`
    groupByExerciseOrdered(detail).forEach(({ name, sets }) => {
      text += `*${name}*\n`
      sets.forEach((s, i) => {
        text += `  Serie ${i + 1}: ${s.reps} rip × ${s.kg} kg`
        if (s.is_pr) text += ` 🏆 PR`
        text += `\n`
      })
      const nota = sets[0]?.note
      if (nota) text += `  📝 ${nota}\n`
      text += `\n`
    })
    text += `_Inviato da GymTracker_`
    if (navigator.share) {
      navigator.share({ text })
    } else {
      navigator.clipboard.writeText(text).then(() => alert('Testo copiato! Incollalo su WhatsApp.'))
    }
  }

  function fmt(seconds) {
    if (!seconds) return '—'
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  function exportCSV() {
    if (sessions.length === 0) return
    const rows = [['Data', 'Scheda', 'Durata (min)', 'Volume (kg)']]
    sessions.forEach(s => rows.push([
      new Date(s.ended_at).toLocaleDateString('it-IT'),
      s.workout_name,
      Math.floor((s.duration_seconds || 0) / 60),
      s.total_volume || 0
    ]))
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'gymtracker_sessioni.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm">Caricamento...</div>

  if (showStats) return (
    <div className="pt-6">
      <button onClick={() => setShowStats(false)} className="text-[#666] text-sm flex items-center gap-1 mb-4">← Storico</button>
      <Stats session={session} />
    </div>
  )

  if (showPRs) return (
    <div className="pt-6">

      {prCopied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#e8ff47] text-black text-xs font-bold px-4 py-2 rounded-xl shadow-lg">
          Testo copiato — incollalo su WhatsApp!
        </div>
      )}

      <button onClick={() => setShowPRs(false)} className="text-[#666] text-sm flex items-center gap-1 mb-4">← Storico</button>
      <div className="flex items-center justify-between mb-1">
        <div className="text-[#e8ff47] text-3xl font-black tracking-wide">RECORD</div>
        <button
          onClick={sharePRs}
          disabled={prData.length === 0}
          className="w-10 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center disabled:opacity-30"
          title="Condividi Record"
        >
          {prCopied
            ? <span className="text-green-400 text-xs font-bold">✓</span>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#888]">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
          }
        </button>
      </div>
      <div className="text-[#666] text-xs uppercase tracking-widest mb-5">Personal best per esercizio</div>

      {loadingPRs ? <div className="text-[#666] text-sm">Caricamento...</div> : prData.length === 0 ? (
        <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
          <p className="text-[#666] text-sm">Nessun dato ancora. Completa qualche sessione!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prData.map(ex => (
            <div key={ex.name} className="p-3 bg-[#111] border border-[#2a2a2a] rounded-xl">
              <div className="text-white font-bold text-sm">{ex.name}</div>
              <div className="flex gap-4 mt-1.5">
                {ex.maxKg > 0 && <div className="flex items-center gap-1.5">
                  <span className="text-[#666] text-xs uppercase tracking-widest">PR</span>
                  <span className="text-[#e8ff47] font-mono font-black text-sm">{ex.maxKg} kg</span>
                </div>}
                {ex.totalVolume > 0 && <div className="flex items-center gap-1.5">
                  <span className="text-[#666] text-xs uppercase tracking-widest">Totale</span>
                  <span className="text-[#60a5fa] font-mono font-bold text-sm">
                    {ex.totalVolume >= 1000 ? (ex.totalVolume / 1000).toFixed(1) + 't' : ex.totalVolume + ' kg'}
                  </span>
                </div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (selected) return (
    <div className="pt-6">

      {confirmDeleteEx && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-5 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-3xl w-full max-w-[340px] p-6">
            <div className="text-2xl mb-2">🗑</div>
            <div className="text-white font-black text-lg mb-1">Eliminare l'esercizio?</div>
            <div className="text-[#666] text-sm mb-5">
              Tutte le serie di <span className="text-white font-medium">{confirmDeleteEx}</span> verranno rimosse dalla sessione.
            </div>
            <div className="space-y-3">
              <button onClick={() => markDeleteExercise(confirmDeleteEx)}
                className="w-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-3 rounded-xl text-sm">
                Elimina esercizio
              </button>
              <button onClick={() => setConfirmDeleteEx(null)}
                className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddExModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => setShowAddExModal(false)}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-xl tracking-wide mb-4">AGGIUNGI ESERCIZIO</div>
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Esercizio</label>
            <select
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
              value={addExSelected} onChange={e => setAddExSelected(e.target.value)}
            >
              <option value="">— Seleziona esercizio —</option>
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
                      <input className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                        type="number" step="2.5" min="0" value={s.kg}
                        onChange={e => setAddExSets(prev => prev.map((x, j) => j === i ? { ...x, kg: e.target.value } : x))} />
                    </td>
                    <td className="py-2 text-center">
                      <input className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                        type="number" min="1" value={s.reps}
                        onChange={e => setAddExSets(prev => prev.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} />
                    </td>
                    <td className="py-2 text-center">
                      <button onClick={() => setAddExSets(prev => prev.filter((_, j) => j !== i))}
                        disabled={addExSets.length <= 1}
                        className="w-6 h-6 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center mx-auto disabled:opacity-20">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setAddExSets(prev => { const last = prev[prev.length - 1]; return [...prev, { kg: last?.kg ?? 0, reps: last?.reps ?? 10 }] })}
              className="w-full py-2 rounded-xl text-xs text-[#e8ff47] border border-[#e8ff47]/20 bg-[#e8ff47]/5 mb-5">
              ＋ Aggiungi serie
            </button>
            <button onClick={confirmAddExercise} disabled={!addExSelected}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              ＋ Aggiungi alla sessione
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => { setSelected(null); setEditMode(false) }} className="text-[#666] text-sm flex items-center gap-1">← Storico</button>
        <div className="flex items-center gap-2">
          {!editMode && (
            <>
              <button onClick={shareSession} className="w-8 h-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-sm flex items-center justify-center" title="Condividi">📤</button>
              <button onClick={startEdit} className="w-8 h-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-sm flex items-center justify-center">✎</button>
            </>
          )}
          <button onClick={() => deleteSession(selected.id)} className="w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center">🗑</button>
        </div>
      </div>

      {editMode ? (
        <div>
          <div className="text-[#e8ff47] text-xs uppercase tracking-widest mb-4">Modifica sessione</div>
          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nome sessione</label>
          <input className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
            value={editName} onChange={e => setEditName(e.target.value)} />
          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Durata (minuti)</label>
          <input className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-5"
            type="number" min="1" value={editMinutes} onChange={e => setEditMinutes(e.target.value)} />
          <div className="flex items-center justify-between mb-3">
            <div className="text-[#666] text-xs uppercase tracking-widest">Esercizi e serie</div>
            <button onClick={() => { setShowAddExModal(true); setAddExSelected(''); setAddExSets([{ kg: 0, reps: 10 }]) }}
              className="text-xs bg-[#e8ff47]/10 border border-[#e8ff47]/30 text-[#e8ff47] rounded-lg px-3 py-1.5 font-bold">
              ＋ Esercizio
            </button>
          </div>
          <div className="space-y-4">
            {editExerciseOrder.map((name, orderIdx) => {
              const group = groupByExerciseOrdered(detail).find(g => g.name === name)
              if (!group) return null
              const { sets } = group
              const isDeleted = editDeletedExercises.includes(name)
              const totalExisting = editExerciseOrder.length
              const totalNew = editNewExercises.length
              return (
                <div key={name} className={`rounded-2xl p-4 border transition-all ${isDeleted ? 'bg-red-500/5 border-red-500/20 opacity-50' : 'bg-[#111] border-[#2a2a2a]'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white font-bold flex-1">{name}</div>
                    <div className="flex items-center gap-1">
                      {!isDeleted && (
                        <div className="flex flex-col gap-0.5 mr-1">
                          <button onClick={() => moveExercise(name, -1)} disabled={orderIdx === 0}
                            className="w-6 h-6 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs flex items-center justify-center disabled:opacity-20">↑</button>
                          <button onClick={() => moveExercise(name, 1)} disabled={orderIdx === totalExisting - 1 && totalNew === 0}
                            className="w-6 h-6 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs flex items-center justify-center disabled:opacity-20">↓</button>
                        </div>
                      )}
                      {isDeleted ? (
                        <button onClick={() => unmarkDeleteExercise(name)}
                          className="text-xs text-[#e8ff47] border border-[#e8ff47]/30 rounded-lg px-2 py-1">↩ Ripristina</button>
                      ) : (
                        <button onClick={() => setConfirmDeleteEx(name)}
                          className="w-7 h-7 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center">🗑</button>
                      )}
                    </div>
                  </div>
                  {!isDeleted && (
                    <>
                      <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 mb-3">
                        <span className="text-[#444] text-xs flex-shrink-0">📝</span>
                        <input className="flex-1 bg-transparent text-white text-xs outline-none placeholder-[#444]"
                          placeholder="Nota esercizio..."
                          value={editNotes[name] ?? ''}
                          onChange={e => setEditNotes(prev => ({ ...prev, [name]: e.target.value }))} />
                      </div>
                      <table className="w-full mb-2">
                        <thead>
                          <tr>
                            <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center w-8">Set</th>
                            <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Kg</th>
                            <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Rip</th>
                            <th className="w-7"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {sets.filter(s => editSets[s.id]).map((s, i) => (
                            <tr key={s.id} className="border-t border-[#1a1a1a]">
                              <td className="py-2 text-center text-[#444] font-mono text-sm">{i + 1}</td>
                              <td className="py-2 text-center">
                                <input className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                                  type="number" step="2.5" min="0"
                                  value={editSets[s.id]?.kg ?? s.kg}
                                  onChange={e => setEditSets(prev => ({ ...prev, [s.id]: { ...prev[s.id], kg: e.target.value } }))} />
                              </td>
                              <td className="py-2 text-center">
                                <input className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                                  type="number" min="1"
                                  value={editSets[s.id]?.reps ?? s.reps}
                                  onChange={e => setEditSets(prev => ({ ...prev, [s.id]: { ...prev[s.id], reps: e.target.value } }))} />
                              </td>
                              <td className="py-2 text-center">
                                <button onClick={() => removeExistingSet(s.id, name)}
                                  disabled={sets.filter(x => editSets[x.id]).length <= 1 && (editNewSets[name] || []).length === 0}
                                  className="w-6 h-6 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center mx-auto disabled:opacity-20">✕</button>
                              </td>
                            </tr>
                          ))}
                          {(editNewSets[name] || []).map((ns, i) => {
                            const existingCount = sets.filter(s => editSets[s.id]).length
                            return (
                              <tr key={`new-${i}`} className="border-t border-[#1a1a1a]">
                                <td className="py-2 text-center text-[#e8ff47] font-mono text-sm">{existingCount + i + 1}</td>
                                <td className="py-2 text-center">
                                  <input className="bg-[#0a0a0a] border border-[#e8ff47]/30 rounded-lg text-[#e8ff47] font-mono font-bold text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                                    type="number" step="2.5" min="0" value={ns.kg}
                                    onChange={e => setEditNewSets(prev => { const u = [...prev[name]]; u[i] = { ...u[i], kg: e.target.value }; return { ...prev, [name]: u } })} />
                                </td>
                                <td className="py-2 text-center">
                                  <input className="bg-[#0a0a0a] border border-[#e8ff47]/30 rounded-lg text-white font-mono text-sm text-center w-16 py-1.5 outline-none focus:border-[#e8ff47]"
                                    type="number" min="1" value={ns.reps}
                                    onChange={e => setEditNewSets(prev => { const u = [...prev[name]]; u[i] = { ...u[i], reps: e.target.value }; return { ...prev, [name]: u } })} />
                                </td>
                                <td className="py-2 text-center">
                                  <button onClick={() => removeNewSet(name, i)}
                                    className="w-6 h-6 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center mx-auto">✕</button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <button onClick={() => addNewSet(name, sets)}
                        className="w-full py-1.5 rounded-lg text-xs text-[#e8ff47] border border-[#e8ff47]/20 bg-[#e8ff47]/5">
                        ＋ Aggiungi serie
                      </button>
                    </>
                  )}
                </div>
              )
            })}
            {editNewExercises.map((ex, exIdx) => (
              <div key={`newex-${exIdx}`} className="bg-[#111] border border-[#e8ff47]/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white font-bold flex-1">{ex.name}</div>
                  <div className="flex items-center gap-1">
                    <div className="flex flex-col gap-0.5 mr-1">
                      <button onClick={() => moveNewExercise(exIdx, -1)} disabled={exIdx === 0}
                        className="w-6 h-6 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs flex items-center justify-center disabled:opacity-20">↑</button>
                      <button onClick={() => moveNewExercise(exIdx, 1)} disabled={exIdx === editNewExercises.length - 1}
                        className="w-6 h-6 rounded border border-[#2a2a2a] bg-[#1a1a1a] text-white text-xs flex items-center justify-center disabled:opacity-20">↓</button>
                    </div>
                    <span className="text-[#e8ff47] text-xs mr-1">nuovo</span>
                    <button onClick={() => removeNewExercise(exIdx)}
                      className="w-7 h-7 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center">🗑</button>
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center w-8">Set</th>
                      <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Kg</th>
                      <th className="text-[#666] text-xs uppercase tracking-widest pb-2 text-center">Rip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ex.sets.map((s, i) => (
                      <tr key={i} className="border-t border-[#1a1a1a]">
                        <td className="py-2 text-center text-[#e8ff47] font-mono text-sm">{i + 1}</td>
                        <td className="py-2 text-center"><span className="text-[#e8ff47] font-mono font-bold text-sm">{s.kg} kg</span></td>
                        <td className="py-2 text-center"><span className="text-white font-mono text-sm">{s.reps} rip</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            <button onClick={saveEdit} disabled={saving} className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50">
              {saving ? 'Salvataggio...' : '✓ Salva modifiche'}
            </button>
            <button onClick={() => setEditMode(false)} className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]">Annulla</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[#e8ff47] text-3xl font-black tracking-wide">{selected.workout_name?.toUpperCase()}</div>
            {sessionPRs[selected.id] && (
              <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg px-2 py-0.5 font-bold">PR</span>
            )}
          </div>
          <div className="text-[#666] text-xs capitalize">{formatDate(selected.ended_at)}</div>
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
              {groupByExerciseOrdered(detail).map(({ name, sets }) => {
                const nota = sets[0]?.note
                return (
                  <div key={name} className="bg-[#111] border border-[#2a2a2a] rounded-2xl p-4">
                    <div className="text-white font-bold mb-2">{name}</div>
                    <div className="space-y-1">
                      {sets.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3 text-sm">
                          <span className="text-[#444] font-mono text-xs w-4">{i + 1}</span>
                          <span className="text-white">{s.reps} rip</span>
                          <span className="text-[#e8ff47] font-mono font-bold">{s.kg} kg</span>
                          {s.is_pr && (
                            <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg px-2 py-0.5 font-bold">PR</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {nota && (
                      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-[#1a1a1a]">
                        <span className="text-[#444] text-xs mt-0.5">📝</span>
                        <span className="text-[#888] text-xs italic">{nota}</span>
                      </div>
                    )}
                  </div>
                )
              })}
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
          <div className="text-[#e8ff47] text-3xl font-black tracking-wide">STORICO</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">{sessions.length} sessioni completate</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={sessions.length === 0}
            className="w-10 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center disabled:opacity-30" title="Esporta CSV">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" fill="#1d6f42"/>
              <path d="M7 8h2.5M7 12h2.5M7 16h2.5M12 8h5M12 12h5M12 16h5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M10 8v8" stroke="white" strokeWidth="1" opacity="0.4"/>
            </svg>
          </button>
          <button onClick={() => { setShowPRs(true); fetchPRs() }}
            className="w-10 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-xl flex items-center justify-center" title="Record personali">🏆</button>
          <button onClick={() => setShowStats(true)}
            className="w-10 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-xl flex items-center justify-center" title="Statistiche">📈</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
          <div className="text-[#e8ff47] font-black text-xl">{globalStats.totalSessions}</div>
          <div className="text-[#666] text-xs uppercase tracking-widest">Sessioni</div>
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
          <div className="text-[#e8ff47] font-black text-xl">{globalStats.totalVolume}t</div>
          <div className="text-[#666] text-xs uppercase tracking-widest">Volume</div>
        </div>
        <div className="bg-[#111] border border-[#2a2a2a] rounded-xl px-3 py-2.5">
          <div className="text-[#e8ff47] font-black text-xl">{globalStats.totalHours}h</div>
          <div className="text-[#666] text-xs uppercase tracking-widest">Ore</div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {sessions.length === 0 && (
          <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
            <p className="text-[#666] text-sm">Nessuna sessione completata ancora.</p>
            <p className="text-[#444] text-xs mt-1">Completa il tuo primo allenamento per vederlo qui!</p>
          </div>
        )}
        {sessions.map(s => (
          <div key={s.id} className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl cursor-pointer active:scale-[.98] transition-transform relative">
            <div onClick={() => openDetail(s)}>
              <div className="text-[#666] text-xs uppercase tracking-widest capitalize">{formatDate(s.ended_at)}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="text-white font-black text-lg">{s.workout_name}</div>
                {sessionPRs[s.id] && (
                  <span className="text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg px-2 py-0.5 font-bold">🏆 PR</span>
                )}
              </div>
              <div className="flex gap-4 mt-2">
                <div className="text-[#666] text-xs">Durata: <span className="text-white font-medium">{fmt(s.duration_seconds)}</span></div>
                <div className="text-[#666] text-xs">Volume: <span className="text-white font-medium">{(s.total_volume / 1000).toFixed(1)}t</span></div>
              </div>
            </div>
            <button onClick={e => { e.stopPropagation(); deleteSession(s.id) }}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center">🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}