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
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('scheduled_workouts')
      .select('*, workouts(*)')
      .eq('user_id', session.user.id)
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(2)
    if (data) setScheduled(data)
  }

  function formatScheduledDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    if (date.getTime() === today.getTime()) return 'Oggi'
    if (date.getTime() === tomorrow.getTime()) return 'Domani'
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

      <div className="flex-1 overflow-y-auto pb-24 px-5">

        {page === 'home' && (
          <div className="pt-6">
            <div className="flex flex-col items-center mb-4">
              <img src="/logo_gymtracker_TRASP.png" alt="GymTracker" className="w-28 h-28 object-contain" />
              <div className="text-[#e8ff47] text-2xl font-black tracking-widest uppercase mt-1">GymTracker</div>
            </div>

            <div className="text-[#999] text-xs tracking-widest uppercase">Bentornato/a</div>
            <div className="text-white text-3xl font-black tracking-wide mt-1">
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
                    <div
                      key={s.id}
                      onClick={() => { setDirectWorkout(s.workouts); setDirectScheduledId(s.id) }}
                      className="p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl cursor-pointer active:scale-[.98] transition-transform"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[#e8ff47] text-xs uppercase tracking-widest font-bold capitalize">
                            {formatScheduledDate(s.scheduled_date)}
                          </div>
                          <div className="text-white font-black text-lg mt-0.5">
                            {s.workouts?.name}
                          </div>
                          <div className="text-[#666] text-xs mt-1">Tocca per iniziare →</div>
                        </div>
                        <div className="text-2xl">
                          {s.is_recurring ? '🔁' : '📅'}
                        </div>
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
          { id: 'home', icon: '🏠', label: 'Home' },
          { id: 'workouts', icon: '📋', label: 'Schede' },
          { id: 'history', icon: '📊', label: 'Storico' },
          { id: 'profile', icon: '👤', label: 'Profilo' },
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