import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, waLink, fillTemplate, groupSizeLabel, DAY_NAMES_FULL, jsDayToIdx, CATEGORIES, GENDERS, LEVEL_MODS, categoryLabel } from '../lib/helpers'
import { CloseIcon, WhatsAppIcon } from './Icons'

const GROUP_SIZES = [
  { key: 'individual', label: 'Individual' },
  { key: 'duo', label: 'Dúo' },
  { key: 'trio', label: 'Trío' },
  { key: 'grupo4', label: 'Grupo de 4' },
]

export default function SlotModal({ slot, profile, onClose, onSaved }) {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [rates, setRates] = useState(null)
  const [templates, setTemplates] = useState({})
  const [mode, setMode] = useState(slot.existingClass ? 'view' : 'search')
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newGender, setNewGender] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newCategoryLevel, setNewCategoryLevel] = useState('')
  const [groupSize, setGroupSize] = useState('individual')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('*').eq('profesor_id', user.id).order('name').then(({ data }) => setStudents(data || []))
    supabase.from('rates').select('*').eq('profesor_id', user.id).maybeSingle().then(({ data }) => setRates(data))
    supabase
      .from('message_templates')
      .select('*')
      .eq('profesor_id', user.id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach((t) => (map[t.key] = t.template))
        setTemplates(map)
      })
  }, [user])

  const filtered = students.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
  const priceFor = (size) => (rates ? { individual: rates.individual_price, duo: rates.duo_price, trio: rates.trio_price, grupo4: rates.group4_price }[size] : 0)

  async function assignExisting(student) {
    setSaving(true)
    await supabase.from('classes').insert({
      profesor_id: user.id,
      student_id: student.id,
      class_date: slot.iso,
      start_time: slot.time,
      status: 'scheduled',
      price: student.price_override ?? priceFor(student.group_size || 'individual'),
    })
    setSaving(false)
    onSaved()
  }

  async function createAndAssign() {
    if (!newName.trim()) return
    setSaving(true)
    const dayIdx = jsDayToIdx(new Date(slot.iso + 'T12:00:00').getDay())
    const { data: student } = await supabase
      .from('students')
      .insert({
        profesor_id: user.id,
        name: newName.trim(),
        phone: newPhone.trim() || null,
        gender: newGender || null,
        category: newCategory || null,
        category_level: newCategory ? newCategoryLevel || null : null,
        group_size: groupSize,
        day_of_week: dayIdx,
        time_slot: slot.time,
      })
      .select()
      .single()

    if (student) {
      await supabase.from('classes').insert({
        profesor_id: user.id,
        student_id: student.id,
        class_date: slot.iso,
        start_time: slot.time,
        status: 'scheduled',
        price: priceFor(groupSize),
      })
    }
    setSaving(false)
    onSaved()
  }

  async function togglePaid() {
    setSaving(true)
    const nowPaid = !slot.existingClass.paid
    await supabase.from('classes').update({ paid: nowPaid, paid_at: nowPaid ? new Date().toISOString() : null }).eq('id', slot.existingClass.id)
    if (nowPaid) {
      await supabase.from('payments').insert({
        profesor_id: user.id,
        student_id: slot.existingClass.student_id,
        class_id: slot.existingClass.id,
        amount: slot.existingClass.price || 0,
        currency: profile?.currency || 'ARS',
      })
    }
    setSaving(false)
    onSaved()
  }

  async function markAbsent() {
    setSaving(true)
    await supabase.from('classes').update({ status: 'absent' }).eq('id', slot.existingClass.id)
    setSaving(false)
    onSaved()
  }

  async function freeSlot() {
    setSaving(true)
    await supabase.from('classes').delete().eq('id', slot.existingClass.id)
    setSaving(false)
    onSaved()
  }

  async function markNotified() {
    await supabase.from('classes').update({ notified: true }).eq('id', slot.existingClass.id)
    onSaved()
  }

  const student = slot.existingClass?.students

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="card w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold">{slot.time} hs</div>
          <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
        </div>

        {mode === 'view' && slot.existingClass && (
          <div className="space-y-4">
            <div>
              <div className="text-lg font-bold">{student?.name}</div>
              <div className="text-sm text-slate-400">{formatMoney(slot.existingClass.price, profile?.currency)}</div>
            </div>

            <div className="flex items-center justify-between card p-3">
              <span className="text-sm font-medium">Pagó la clase</span>
              <button
                onClick={togglePaid}
                disabled={saving}
                className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${slot.existingClass.paid ? 'bg-brand text-slate-900' : 'bg-amber-500/20 text-amber-400'}`}
              >
                {slot.existingClass.paid ? 'Pagó' : 'Marcar pagado'}
              </button>
            </div>

            {student?.phone && (
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={waLink(student.phone, fillTemplate(templates.recordatorio || '', { nombre: student.name, hora: slot.time }))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={markNotified}
                  className="btn-secondary flex items-center justify-center gap-1.5 text-brand"
                >
                  <WhatsAppIcon size={16} /> Recordar
                </a>
                {!slot.existingClass.paid && (
                  <a
                    href={waLink(student.phone, fillTemplate(templates.deuda || '', { nombre: student.name, monto: slot.existingClass.price }))}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary flex items-center justify-center gap-1.5 text-amber-400"
                  >
                    <WhatsAppIcon size={16} /> Avisar deuda
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button onClick={markAbsent} disabled={saving} className="btn-secondary">Marcar falta</button>
              <button onClick={freeSlot} disabled={saving} className="btn-secondary text-red-400">Liberar hueco</button>
            </div>
          </div>
        )}

        {mode !== 'view' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 card p-1">
              <button onClick={() => setMode('search')} className={`py-2 rounded-xl text-sm font-semibold ${mode === 'search' ? 'bg-brand text-slate-900' : 'text-slate-400'}`}>
                Alumno existente
              </button>
              <button onClick={() => setMode('new')} className={`py-2 rounded-xl text-sm font-semibold ${mode === 'new' ? 'bg-brand text-slate-900' : 'text-slate-400'}`}>
                Alumno nuevo
              </button>
            </div>

            {mode === 'search' && (
              <div>
                <input className="input mb-3" placeholder="Buscar alumno..." value={query} onChange={(e) => setQuery(e.target.value)} />
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {filtered.length === 0 && <div className="text-sm text-slate-500 text-center py-6">No hay alumnos que coincidan.</div>}
                  {filtered.map((s) => (
                    <button
                      key={s.id}
                      disabled={saving}
                      onClick={() => assignExisting(s)}
                      className="w-full text-left card p-3 flex items-center justify-between hover:border-brand/40"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.category ? categoryLabel(s.category, s.category_level) : groupSizeLabel(s.group_size)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'new' && (
              <div className="space-y-3">
                <input className="input" placeholder="Nombre del alumno" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className="input" placeholder="WhatsApp (opcional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                <div>
                  <div className="label-muted mb-1.5">Género</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {GENDERS.map((g) => (
                      <button key={g.key} onClick={() => setNewGender(newGender === g.key ? '' : g.key)} className={`py-2 rounded-xl text-xs font-semibold ${newGender === g.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="label-muted mb-1.5">Categoría</div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {CATEGORIES.map((c) => (
                      <button key={c} onClick={() => setNewCategory(newCategory === c ? '' : c)} className={`py-2 rounded-xl text-xs font-semibold ${newCategory === c ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                  {newCategory && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {LEVEL_MODS.map((l) => (
                        <button key={l.key} onClick={() => setNewCategoryLevel(newCategoryLevel === l.key ? '' : l.key)} className={`py-2 rounded-xl text-xs font-semibold ${newCategoryLevel === l.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="label-muted mb-1.5">Tamaño de grupo</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {GROUP_SIZES.map((g) => (
                      <button
                        key={g.key}
                        onClick={() => setGroupSize(g.key)}
                        className={`py-2 rounded-xl text-xs font-semibold ${groupSize === g.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
                {rates && <div className="text-xs text-slate-500">Precio sugerido: {formatMoney(priceFor(groupSize), profile?.currency)}</div>}
                <button onClick={createAndAssign} disabled={saving || !newName.trim()} className="btn-primary">
                  Crear y asignar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
