import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import WorkoutDetail from './WorkoutDetail'

export default function Workouts({ session }) {
  const [workouts, setWorkouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [newName, setNewName] = useState('')
  const [newMuscles, setNewMuscles] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchWorkouts()
  }, [])

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
    const { error } = await supabase.from('workouts').insert({
      user_id: session.user.id,
      name: newName.trim(),
      target_muscles: newMuscles.trim(),
      position: workouts.length
    })
    if (!error) {
      setNewName('')
      setNewMuscles('')
      setShowModal(false)
      fetchWorkouts()
    }
    setSaving(false)
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
              <button
                onClick={e => { e.stopPropagation(); deleteWorkout(w.id) }}
                className="w-8 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center justify-center ml-2"
              >
                🗑
              </button>
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
    </div>
  )
}