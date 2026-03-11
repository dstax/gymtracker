import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit() {
    setLoading(true)
    setError('')
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } }
      })
      if (error) setError(error.message)
      else setMessage('Controlla la tua email per confermare la registrazione!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <div className="text-[#e8ff47] text-5xl font-black tracking-widest mb-2">GYMTRACKER</div>
          <div className="text-[#666] text-xs tracking-widest uppercase">
            {isLogin ? 'Bentornato' : 'Crea il tuo account'}
          </div>
        </div>

        <div className="space-y-3">
          {!isLogin && (
            <input
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors"
              placeholder="Il tuo nome"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          )}
          <input
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors"
            placeholder="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <input
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
            {message}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-4 bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm tracking-wide hover:bg-[#d4eb3a] transition-colors disabled:opacity-50"
        >
          {loading ? 'Caricamento...' : isLogin ? 'Accedi' : 'Registrati'}
        </button>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); setMessage('') }}
          className="w-full mt-3 text-[#666] text-sm hover:text-white transition-colors"
        >
          {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
        </button>

      </div>
    </div>
  )
}