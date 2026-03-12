import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Profile({ session, onProfileUpdate }) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [weight, setWeight] = useState('')
  const [gender, setGender] = useState('')
  const [weightHistory, setWeightHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    getProfile()
    getWeightHistory()
  }, [session])

  async function getProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('name, birth_date, weight, gender')
      .eq('id', session.user.id)
      .single()
    if (data) {
      setName(data.name || '')
      setBirthDate(data.birth_date || '')
      setWeight(data.weight || '')
      setGender(data.gender || '')
    }
    setLoading(false)
  }

  async function getWeightHistory() {
    const { data } = await supabase
      .from('weight_history')
      .select('*')
      .eq('user_id', session.user.id)
      .order('recorded_at', { ascending: false })
      .limit(10)
    if (data) setWeightHistory(data)
  }

  async function saveProfile() {
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: session.user.id,
        name,
        birth_date: birthDate || null,
        weight: weight || null,
        gender: gender || null
      })

    if (error) {
      setMessage('Errore nel salvataggio')
      setSaving(false)
      return
    }

    if (weight) {
      await supabase.from('weight_history').insert({
        user_id: session.user.id,
        weight: parseFloat(weight)
      })
      getWeightHistory()
    }

    setMessage('Profilo aggiornato! ✓')
    onProfileUpdate(name)
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function deleteWeightEntry(id) {
    await supabase.from('weight_history').delete().eq('id', id)
    getWeightHistory()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  function calcAge(birthDateStr) {
    if (!birthDateStr) return null
    const today = new Date()
    const birth = new Date(birthDateStr)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  if (loading) return <div className="pt-8 text-[#666] text-sm">Caricamento...</div>

  const age = calcAge(birthDate)

  return (
    <div className="pt-8">
      <div className="text-[#e8ff47] text-3xl font-black tracking-wide">PROFILO</div>

      <div className="mt-6 space-y-3">

        <div>
          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Nome</label>
          <input
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors"
            placeholder="Il tuo nome"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Email</label>
          <div className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl px-4 py-3 text-[#666] text-sm">
            {session.user.email}
          </div>
        </div>

        <div>
          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">
            Data di nascita {age !== null && <span className="text-[#e8ff47] ml-2">{age} anni</span>}
          </label>
          <input
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors"
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Peso (kg)</label>
          <input
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#e8ff47] transition-colors"
            placeholder="es. 80"
            type="number" min="30" max="300" step="0.1"
            value={weight}
            onChange={e => setWeight(e.target.value)}
          />
        </div>

        <div>
          <label className="text-[#666] text-xs uppercase tracking-widest block mb-2">Sesso</label>
          <div className="grid grid-cols-3 gap-2">
            {['M', 'F', 'Altro'].map(g => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`py-3 rounded-xl text-sm font-bold border transition-all ${gender === g ? 'bg-[#e8ff47] text-black border-[#e8ff47]' : 'bg-[#1a1a1a] text-white border-[#2a2a2a]'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

      </div>

      {message && (
        <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
          {message}
        </div>
      )}

      <button
        onClick={saveProfile}
        disabled={saving}
        className="w-full mt-4 bg-[#e8ff47] text-black font-bold py-3 rounded-xl text-sm tracking-wide disabled:opacity-50"
      >
        {saving ? 'Salvataggio...' : 'Salva modifiche'}
      </button>

      {weightHistory.length > 0 && (
        <div className="mt-6">
          <div className="text-[#666] text-xs uppercase tracking-widest mb-3">Storico peso</div>
          <div className="space-y-2">
            {weightHistory.map((w, i) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-[#111] border border-[#2a2a2a] rounded-xl">
                <span className="text-[#666] text-xs">{formatDate(w.recorded_at)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[#e8ff47] font-mono font-bold">{w.weight} kg</span>
                  {i < weightHistory.length - 1 && (
                    <span className={`text-xs ${w.weight < weightHistory[i + 1].weight ? 'text-green-400' : w.weight > weightHistory[i + 1].weight ? 'text-red-400' : 'text-[#666]'}`}>
                      {w.weight < weightHistory[i + 1].weight ? '↓' : w.weight > weightHistory[i + 1].weight ? '↑' : '—'}
                    </span>
                  )}
                  <button
                    onClick={() => deleteWeightEntry(w.id)}
                    className="w-6 h-6 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full mt-6 mb-4 py-3 rounded-xl text-sm font-semibold bg-red-500/10 border border-red-500/30 text-red-400"
      >
        ⎋ Logout
      </button>

    </div>
  )
}