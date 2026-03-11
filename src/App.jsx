import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Home from './pages/Home'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="text-[#e8ff47] font-black text-5xl tracking-widest mb-4" style={{fontFamily:'sans-serif'}}>GYMTRACKER</div>
        <div className="w-32 h-0.5 bg-[#222] rounded overflow-hidden mx-auto">
          <div className="h-full bg-[#e8ff47] animate-pulse w-full"></div>
        </div>
      </div>
    </div>
  )

  return session ? <Home session={session} /> : <Auth />
}

export default App