import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import WorkoutDetail from './WorkoutDetail'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

export default function Workouts({ session, initialWorkout, onClearInitial, onScheduleUpdate }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [schedulingWorkout, setSchedulingWorkout] = useState(null)
  const [renamingWorkout, setRenamingWorkout] = useState(null)
  const [newName, setNewName] = useState('')
  const [newMuscles, setNewMuscles] = useState('')
  const [renameName, setRenameName] = useState('')
  const [renameMuscles, setRenameMuscles] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingRename, setSavingRename] = useState(false)
  const [scheduleType, setScheduleType] = useState('single')
  const [scheduleDate, setScheduleDate] = useState('')
  const [recurringDays, setRecurringDays] = useState([])
  const [savingSchedule, setSavingSchedule] = useState(false)

  useEffect(() => {
    fetchWorkouts()
  }, [])

  useEffect(() => {
    if (initialWorkout) {
      setSelectedWorkout(initialWorkout)
      if (onClearInitial) onClearInitial()
    }
  }, [initialWorkout])

  async function fetchWorkouts() {
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('position')
    if (data) setWorkouts(data)
    setLoading(false)
  }

  async function createWorkout() {
    if (!newName.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('workouts').insert({
      user_id: session.user.id,
      name: newName.trim(),
      target_muscles: newMuscles.trim(),
      position: workouts.length
    }).select().single()
    if (!error && data) {
      setNewName('')
      setNewMuscles('')
      setShowModal(false)
      fetchWorkouts()
      setSchedulingWorkout(data)
      setShowScheduleModal(true)
    }
    setSaving(false)
  }

  async function renameWorkout() {
    if (!renameName.trim() || !renamingWorkout) return
    setSavingRename(true)
    const { error } = await supabase
      .from('workouts')
      .update({ name: renameName.trim(), target_muscles: renameMuscles.trim() })
      .eq('id', renamingWorkout.id)
    if (!error) {
      setShowRenameModal(false)
      setRenamingWorkout(null)
      fetchWorkouts()
    }
    setSavingRename(false)
  }

  async function saveSchedule() {
    if (!schedulingWorkout) return
    setSavingSchedule(true)

    if (scheduleType === 'single') {
      if (!scheduleDate) { setSavingSchedule(false); return }
      await supabase.from('scheduled_workouts').insert({
        user_id: session.user.id,
        workout_id: schedulingWorkout.id,
        scheduled_date: scheduleDate,
        is_recurring: false
      })
    } else {
      if (recurringDays.length === 0) { setSavingSchedule(false); return }
      await supabase.from('scheduled_workouts').insert({
        user_id: session.user.id,
        workout_id: schedulingWorkout.id,
        scheduled_date: getNextOccurrence(recurringDays),
        is_recurring: true,
        recurring_days: recurringDays
      })
    }

    setSavingSchedule(false)
    setShowScheduleModal(false)
    setSchedulingWorkout(null)
    setScheduleDate('')
    setRecurringDays([])
    setScheduleType('single')
    if (onScheduleUpdate) onScheduleUpdate()
  }

  function getNextOccurrence(days) {
    const today = new Date()
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      if (days.includes(String(d.getDay()))) {
        return d.toISOString().split('T')[0]
      }
    }
    return today.toISOString().split('T')[0]
  }

  function toggleDay(dayIndex) {
    const d = String(dayIndex)
    setRecurringDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  async function deleteWorkout(id) {
    if (!confirm('Eliminare questa scheda?')) return
    await supabase.from('workouts').delete().eq('id', id)
    fetchWorkouts()
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm px-5">Caricamento...</div>

  if (selectedWorkout) return (
    <WorkoutDetail
      workout={selectedWorkout}
      session={session}
      onBack={() => { setSelectedWorkout(null); fetchWorkouts() }}
    />
  )

  return (
    <div className="pt-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[#e8ff47] text-3xl font-black tracking-wide">SCHEDE</div>
          <div className="text-[#666] text-xs uppercase tracking-widest mt-1">{workouts.length} schede attive</div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="w-10 h-10 border border-[#2a2a2a] rounded-xl bg-[#1a1a1a] text-white text-xl flex items-center justify-center"
        >
          ＋
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {workouts.length === 0 && (
          <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
            <p className="text-[#666] text-sm">Nessuna scheda ancora.</p>
            <button onClick={() => setShowModal(true)} className="text-[#e8ff47] text-sm mt-1">＋ Crea la tua prima scheda</button>
          </div>
        )}

        {workouts.map(w => (
          <div
            key={w.id}
            className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl cursor-pointer active:scale-[.98] transition-transform"
            onClick={() => setSelectedWorkout(w)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-white font-bold text-lg">{w.name}</div>
                {w.target_muscles && <div className="text-[#666] text-xs mt-1">{w.target_muscles}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => { e.stopPropagation(); setRenamingWorkout(w); setRenameName(w.name); setRenameMuscles(w.target_muscles || ''); setShowRenameModal(true) }}
                  className="w-8 h-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-sm flex items-center justify-center"
                >
                  ✎
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setSchedulingWorkout(w); setShowScheduleModal(true) }}
                  className="w-8 h-8 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] text-sm flex items-center justify-center"
                >
                  📅
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteWorkout(w.id) }}
                  className="w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center"
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <button
          onClick={() => setShowModal(true)}
          className="w-full py-3 rounded-xl text-sm font-semibold bg-[#1a1a1a] border border-[#2a2a2a] text-white"
        >
          ＋ Nuova scheda
        </button>
      </div>

      {/* MODAL NUOVA SCHEDA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-2xl tracking-wide mb-4">NUOVA SCHEDA</div>
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nome scheda</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-3"
              placeholder="es. Giorno A — Push"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Muscoli target</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
              placeholder="es. Petto, Spalle, Tricipiti"
              value={newMuscles}
              onChange={e => setNewMuscles(e.target.value)}
            />
            <button
              onClick={createWorkout}
              disabled={saving || !newName.trim()}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Crea scheda'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL RINOMINA SCHEDA */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => setShowRenameModal(false)}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-2xl tracking-wide mb-4">MODIFICA SCHEDA</div>
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nome scheda</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-3"
              placeholder="es. Giorno A — Push"
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              autoFocus
            />
            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Muscoli target</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
              placeholder="es. Petto, Spalle, Tricipiti"
              value={renameMuscles}
              onChange={e => setRenameMuscles(e.target.value)}
            />
            <button
              onClick={renameWorkout}
              disabled={savingRename || !renameName.trim()}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50"
            >
              {savingRename ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL PROGRAMMA ALLENAMENTO */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end backdrop-blur-sm" onClick={() => { setShowScheduleModal(false); setSchedulingWorkout(null) }}>
          <div className="bg-[#111] border border-[#2a2a2a] rounded-t-3xl w-full max-w-[430px] mx-auto p-6 pb-10" onClick={e => e.stopPropagation()}>
            <div className="w-9 h-1 bg-[#2a2a2a] rounded mx-auto mb-5"></div>
            <div className="text-white font-black text-2xl tracking-wide mb-1">PROGRAMMA</div>
            <div className="text-[#666] text-xs mb-5">{schedulingWorkout?.name}</div>

            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                onClick={() => setScheduleType('single')}
                className={`py-3 rounded-xl text-sm font-bold border transition-all ${scheduleType === 'single' ? 'bg-[#e8ff47] text-black border-[#e8ff47]' : 'bg-[#1a1a1a] text-white border-[#2a2a2a]'}`}
              >
                📅 Data singola
              </button>
              <button
                onClick={() => setScheduleType('recurring')}
                className={`py-3 rounded-xl text-sm font-bold border transition-all ${scheduleType === 'recurring' ? 'bg-[#e8ff47] text-black border-[#e8ff47]' : 'bg-[#1a1a1a] text-white border-[#2a2a2a]'}`}
              >
                🔁 Ricorrente
              </button>
            </div>

            {scheduleType === 'single' ? (
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Data allenamento</label>
                <input
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-4"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="text-[#666] text-xs uppercase tracking-widest block mb-3">Giorni della settimana</label>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {DAYS.map((day, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${recurringDays.includes(String(i)) ? 'bg-[#e8ff47] text-black border-[#e8ff47]' : 'bg-[#1a1a1a] text-white border-[#2a2a2a]'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={saveSchedule}
              disabled={savingSchedule || (scheduleType === 'single' ? !scheduleDate : recurringDays.length === 0)}
              className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50 mb-3"
            >
              {savingSchedule ? 'Salvataggio...' : 'Salva programmazione'}
            </button>

            <button
              onClick={() => { setShowScheduleModal(false); setSchedulingWorkout(null) }}
              className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]"
            >
              Salta per ora
            </button>
          </div>
        </div>
      )}
    </div>
  )
}