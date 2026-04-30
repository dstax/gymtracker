import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Profile from './Profile'
import Workouts from './Workouts'
import History from './History'
import WorkoutDetail from './WorkoutDetail'

export default function Home({ session }) {
  const [page, setPage] = useState('home')
  const [profile, setProfile] = useState(null)
  const [scheduled, setScheduled] = useState([])
  const [directWorkout, setDirectWorkout] = useState(null)
  const [directScheduledId, setDirectScheduledId] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(null) // { id, workout_name, scheduled_date }
  const [editDate, setEditDate] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    getProfile()
    getScheduled()
  }, [session])

  async function getProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', session.user.id)
      .single()
    if (data) setProfile(data)
  }

  async function getScheduled() {
    const { data } = await supabase
      .from('scheduled_workouts')
      .select('*, workouts(*)')
      .eq('user_id', session.user.id)
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(2)
    if (data) setScheduled(data)
  }

  async function saveEditDate() {
    if (!editDate || !editingSchedule) return
    setSavingEdit(true)
    await supabase
      .from('scheduled_workouts')
      .update({ scheduled_date: editDate })
      .eq('id', editingSchedule.id)
    setSavingEdit(false)
    setEditingSchedule(null)
    setEditDate('')
    getScheduled()
  }

  async function deleteEditSchedule() {
    if (!editingSchedule) return
    if (!confirm('Eliminare questa data programmata?')) return
    await supabase.from('scheduled_workouts').delete().eq('id', editingSchedule.id)
    setEditingSchedule(null)
    setEditDate('')
    getScheduled()
  }

  function formatScheduledDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00')
    const t = new Date(); t.setHours(0,0,0,0)
    const tom = new Date(t); tom.setDate(t.getDate() + 1)
    if (date.getTime() === t.getTime()) return 'Oggi'
    if (date.getTime() === tom.getTime()) return 'Domani'
    return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const name = profile?.name || session.user.user_metadata?.name || session.user.email.split('@')[0]

  if (directWorkout) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white max-w-[430px] mx-auto relative flex flex-col">
      <div className="flex-1 overflow-y-auto pb-24 px-5">
        <WorkoutDetail
          workout={directWorkout}
          session={session}
          scheduledId={directScheduledId}
          onBack={() => { setDirectWorkout(null); setDirectScheduledId(null); setPage('home'); getScheduled() }}
        />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white max-w-[430px] mx-auto relative flex flex-col">

      {/* MODAL MODIFICA DATA PROGRAMMATA */}
      {editingSchedule && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-5 backdrop-blur-sm">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-3xl w-full max-w-[360px] p-6">
            <div className="text-2xl mb-2">📅</div>
            <div className="text-white font-black text-xl mb-1">Modifica data</div>
            <div className="text-[#666] text-sm mb-5">
              <span className="text-white font-medium">{editingSchedule.workout_name}</span>
              <span className="text-[#444] text-xs block mt-1 capitalize">
                Attuale: {formatScheduledDate(editingSchedule.scheduled_date)}
              </span>
            </div>

            <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nuova data</label>
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors mb-5"
              type="date"
              min={today}
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
            />

            <div className="space-y-3">
              <button
                onClick={saveEditDate}
                disabled={savingEdit || !editDate}
                className="w-full bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm disabled:opacity-50"
              >
                {savingEdit ? 'Salvataggio...' : '✓ Salva nuova data'}
              </button>
              <button
                onClick={deleteEditSchedule}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/30 text-red-400"
              >
                🗑 Elimina questa data
              </button>
              <button
                onClick={() => { setEditingSchedule(null); setEditDate('') }}
                className="w-full py-3 rounded-xl text-sm text-[#666] border border-[#2a2a2a]"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24 px-5">

        {page === 'home' && (
          <div className="pt-8">
            <div className="flex flex-col items-center mb-2">
              <img src="/logo_gymtracker_TRASP.png" alt="GymTracker" className="w-48 h-48 object-contain" />
            </div>
            <div className="text-[#999] text-xs tracking-widest uppercase">Bentornato/a</div>
            <div className="text-[#e8ff47] text-5xl font-black tracking-wide mt-1">
              {name.toUpperCase()}
            </div>
            <p className="text-[#888] text-sm italic mt-2">"La costanza batte il talento."</p>

            <div className="mt-6">
              {scheduled.length === 0 ? (
                <div className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
                  <p className="text-[#999] text-xs uppercase tracking-widest">Nessun allenamento programmato</p>
                  <p className="text-white text-sm mt-1">Vai su Schede per programmare i tuoi allenamenti!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[#999] text-xs uppercase tracking-widest mb-2">Prossimi allenamenti</div>
                  {scheduled.map(s => (
                    <div key={s.id} className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
                      <div className="flex items-start justify-between gap-3">
                        {/* Area click per iniziare */}
                        <div
                          className="flex-1 cursor-pointer active:opacity-70 transition-opacity"
                          onClick={() => { setDirectWorkout(s.workouts); setDirectScheduledId(s.id) }}
                        >
                          <div className="text-[#e8ff47] text-xs uppercase tracking-widest font-bold capitalize">
                            {formatScheduledDate(s.scheduled_date)}
                          </div>
                          <div className="text-white font-black text-lg mt-0.5">
                            {s.workouts?.name}
                          </div>
                          <div className="text-[#666] text-xs mt-1">Tocca per iniziare →</div>
                        </div>
                        {/* Pulsante modifica data */}
                        <button
                          onClick={() => {
                            setEditingSchedule({
                              id: s.id,
                              workout_name: s.workouts?.name,
                              scheduled_date: s.scheduled_date
                            })
                            setEditDate(s.scheduled_date)
                          }}
                          className="w-9 h-9 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-base flex items-center justify-center flex-shrink-0 mt-0.5"
                          title="Modifica data"
                        >📅</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {page === 'workouts' && <Workouts session={session} onScheduleUpdate={getScheduled} />}
        {page === 'history' && <History session={session} />}
        {page === 'profile' && (
          <Profile
            session={session}
            onProfileUpdate={(newName) => setProfile({ name: newName })}
          />
        )}

      </div>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[#111] border-t border-[#2a2a2a] flex py-2">
        {[
          { id: 'home',     icon: '🏠', label: 'Home' },
          { id: 'workouts', icon: '📋', label: 'Schede' },
          { id: 'history',  icon: '📊', label: 'Storico' },
          { id: 'profile',  icon: '👤', label: 'Profilo' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => { setPage(item.id); if (item.id === 'home') getScheduled() }}
            className="flex-1 flex flex-col items-center gap-1 py-1"
          >
            <span className="text-xl">{item.icon}</span>
            <span className={`text-[10px] font-medium tracking-wide uppercase ${page === item.id ? 'text-[#e8ff47]' : 'text-[#666]'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

    </div>
  )
}