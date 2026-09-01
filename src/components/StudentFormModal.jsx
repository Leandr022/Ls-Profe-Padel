import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { DAY_NAMES_FULL, waLink, fillTemplate, formatMoney, CATEGORIES, GENDERS, LEVEL_MODS } from '../lib/helpers'
import { CloseIcon, WhatsAppIcon } from './Icons'

const GROUP_SIZES = [
  { key: 'individual', label: 'Individual' },
  { key: 'duo', label: 'Dúo' },
  { key: 'trio', label: 'Trío' },
  { key: 'grupo4', label: 'Grupo de 4' },
  { key: 'mensual', label: 'Mensual' },
]

export default function StudentFormModal({ student, onClose, onSaved }) {
  const { user, profile } = useAuth()
  const isEdit = !!student
  const [name, setName] = useState(student?.name || '')
  const [phone, setPhone] = useState(student?.phone || '')
  const [gender, setGender] = useState(student?.gender || '')
  const [category, setCategory] = useState(student?.category || '')
  const [categoryLevel, setCategoryLevel] = useState(student?.category_level || '')
  const [groupSize, setGroupSize] = useState(student?.group_size || 'individual')
  const [dayOfWeek, setDayOfWeek] = useState(student?.day_of_week ?? '')
  const [timeSlot, setTimeSlot] = useState(student?.time_slot?.slice(0, 5) || '')
  const [status, setStatus] = useState(student?.status || 'active')
  const [notes, setNotes] = useState(student?.notes || '')
  const [templates, setTemplates] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
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

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const payload = {
      profesor_id: user.id,
      name: name.trim(),
      phone: phone.trim() || null,
      gender: gender || null,
      category: category || null,
      category_level: category ? categoryLevel || null : null,
      group_size: groupSize,
      day_of_week: dayOfWeek === '' ? null : Number(dayOfWeek),
      time_slot: timeSlot || null,
      status,
      notes: notes.trim() || null,
    }
    if (isEdit) {
      await supabase.from('students').update(payload).eq('id', student.id)
    } else {
      await supabase.from('students').insert(payload)
    }
    setSaving(false)
    onSaved()
  }

  async function remove() {
    if (!confirm(`¿Eliminar a ${student.name}? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    await supabase.from('students').delete().eq('id', student.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg">{isEdit ? 'Editar alumno' : 'Nuevo alumno'}</div>
          <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
        </div>

        <div className="space-y-3">
          <input className="input" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="WhatsApp (ej: 5491122334455)" value={phone} onChange={(e) => setPhone(e.target.value)} />

          <div>
            <div className="label-muted mb-1.5">Género</div>
            <div className="grid grid-cols-2 gap-1.5">
              {GENDERS.map((g) => (
                <button key={g.key} onClick={() => setGender(gender === g.key ? '' : g.key)} className={`py-2 rounded-xl text-xs font-semibold ${gender === g.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="label-muted mb-1.5">Categoría</div>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setCategory(category === c ? '' : c)} className={`py-2 rounded-xl text-xs font-semibold ${category === c ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                  {c}
                </button>
              ))}
            </div>
            {category && (
              <div className="grid grid-cols-2 gap-1.5">
                {LEVEL_MODS.map((l) => (
                  <button key={l.key} onClick={() => setCategoryLevel(categoryLevel === l.key ? '' : l.key)} className={`py-2 rounded-xl text-xs font-semibold ${categoryLevel === l.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="label-muted mb-1.5">Tamaño de grupo</div>
            <div className="grid grid-cols-3 gap-1.5">
              {GROUP_SIZES.map((g) => (
                <button key={g.key} onClick={() => setGroupSize(g.key)} className={`py-2 rounded-xl text-xs font-semibold ${groupSize === g.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
              <option value="">Día habitual</option>
              {DAY_NAMES_FULL.map((d, i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
            <input type="time" className="input" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} />
          </div>

          <div className="flex items-center justify-between card p-3">
            <span className="text-sm font-medium">Enfriándose</span>
            <button
              onClick={() => setStatus(status === 'cooling' ? 'active' : 'cooling')}
              className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${status === 'cooling' ? 'bg-amber-500/20 text-amber-400' : 'card text-slate-400'}`}
            >
              {status === 'cooling' ? 'Sí' : 'No'}
            </button>
          </div>

          <textarea className="input min-h-20" placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />

          {isEdit && phone && (
            <div className="grid grid-cols-2 gap-2">
              <a href={waLink(phone, fillTemplate(templates.recordatorio || '', { nombre: name, hora: timeSlot || '' }))} target="_blank" rel="noreferrer" className="btn-secondary flex items-center justify-center gap-1.5 text-brand">
                <WhatsAppIcon size={16} /> Recordatorio
              </a>
              <a href={waLink(phone, fillTemplate(templates.reconquista || '', { nombre: name }))} target="_blank" rel="noreferrer" className="btn-secondary flex items-center justify-center gap-1.5 text-brand">
                <WhatsAppIcon size={16} /> Reconquista
              </a>
            </div>
          )}

          <button onClick={save} disabled={saving || !name.trim()} className="btn-primary">
            {isEdit ? 'Guardar cambios' : 'Crear alumno'}
          </button>
          {isEdit && (
            <button onClick={remove} disabled={saving} className="w-full text-center text-sm text-red-400 font-semibold py-2">
              Eliminar alumno
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
