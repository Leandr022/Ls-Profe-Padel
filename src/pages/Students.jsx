import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { DAY_NAMES_FULL, groupSizeLabel, GENDERS, categoryLabel } from '../lib/helpers'
import Header from '../components/Header'
import StudentFormModal from '../components/StudentFormModal'
import { PlusIcon, UsersIcon } from '../components/Icons'

export default function Students() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('todos')
  const [genderFilter, setGenderFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [modalStudent, setModalStudent] = useState(undefined) // undefined = closed, null = new

  async function load() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('students').select('*').eq('profesor_id', user.id).order('name')
    setStudents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user])

  const categories = useMemo(() => [...new Set(students.map((s) => s.category).filter(Boolean))], [students])
  const coolingCount = students.filter((s) => s.status === 'cooling').length

  const filtered = students.filter((s) => {
    if (tab === 'enfriando' && s.status !== 'cooling') return false
    if (query && !s.name.toLowerCase().includes(query.toLowerCase())) return false
    if (genderFilter && s.gender !== genderFilter) return false
    if (dayFilter !== '' && String(s.day_of_week) !== dayFilter) return false
    if (categoryFilter && s.category !== categoryFilter) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto px-5 py-6 pb-24 fade-in">
      <Header backTo="/panel" backLabel="Panel" />
      <div className="text-sm text-slate-400 mb-2">{students.length} alumnos</div>

      <input className="input mb-3" placeholder="Buscar alumno..." value={query} onChange={(e) => setQuery(e.target.value)} />

      <button onClick={() => setModalStudent(null)} className="w-full rounded-full bg-brand/10 border border-brand/30 text-brand font-semibold py-2.5 mb-3">
        + Agregar alumno
      </button>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab('todos')} className={`pill ${tab === 'todos' ? 'bg-brand text-slate-900 font-bold' : 'card text-slate-300'}`}>Todos</button>
        <button onClick={() => setTab('enfriando')} className={`pill ${tab === 'enfriando' ? 'bg-brand text-slate-900 font-bold' : 'card text-slate-300'}`}>
          Enfriándose {coolingCount}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <select className="input" value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
          <option value="">Todos los géneros</option>
          {GENDERS.map((g) => (
            <option key={g.key} value={g.key}>{g.label}</option>
          ))}
        </select>
        <select className="input" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)}>
          <option value="">Todos los días</option>
          {DAY_NAMES_FULL.map((d, i) => (
            <option key={i} value={i}>{d}</option>
          ))}
        </select>
      </div>
      <select className="input mb-5" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <UsersIcon size={40} className="mx-auto text-slate-600 mb-3" />
          <div className="font-bold">{students.length === 0 ? 'Todavía no tenés alumnos' : 'No hay alumnos que coincidan'}</div>
          <div className="text-xs text-slate-500 mt-1">{students.length === 0 ? 'Sumá el primero con el botón +.' : 'Probá cambiar los filtros.'}</div>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((s) => (
          <button key={s.id} onClick={() => setModalStudent(s)} className="w-full card p-3.5 flex items-center gap-3 text-left hover:border-brand/40">
            <div className="w-10 h-10 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold shrink-0">
              {s.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{s.name}</div>
              <div className="text-xs text-slate-400 truncate">
                {groupSizeLabel(s.group_size)}
                {s.category ? ` · ${categoryLabel(s.category, s.category_level)}` : ''}
                {s.gender ? ` · ${s.gender}` : ''}
                {s.day_of_week != null ? ` · ${DAY_NAMES_FULL[s.day_of_week]}${s.time_slot ? ' ' + s.time_slot.slice(0, 5) : ''}` : ''}
              </div>
            </div>
            {s.status === 'cooling' && (
              <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full shrink-0">Enfriándose</span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => setModalStudent(null)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-brand text-slate-900 flex items-center justify-center shadow-xl active:scale-95 transition"
      >
        <PlusIcon size={26} />
      </button>

      {modalStudent !== undefined && (
        <StudentFormModal
          student={modalStudent}
          onClose={() => setModalStudent(undefined)}
          onSaved={() => {
            setModalStudent(undefined)
            load()
          }}
        />
      )}
    </div>
  )
}
