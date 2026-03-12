import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Profile from './Profile'
import Workouts from './Workouts'
import History from './History'

export default function Home({ session }) {
  const [page, setPage] = useState('home')
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    async function getProfile() {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .single()
      if (data) setProfile(data)
    }
    getProfile()
  }, [session])

  const name = profile?.name || session.user.user_metadata?.name || session.user.email.split('@')[0]

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white max-w-[430px] mx-auto relative flex flex-col">

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
            <div className="mt-6 p-4 bg-[#111] border border-[#2a2a2a] rounded-2xl">
              <p className="text-[#999] text-xs uppercase tracking-widest">Nessun allenamento programmato</p>
              <p className="text-white text-sm mt-1">Crea la tua prima scheda dalla sezione Schede!</p>
            </div>
          </div>
        )}

        {page === 'workouts' && <Workouts session={session} />}

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
            onClick={() => setPage(item.id)}
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