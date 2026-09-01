import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  DAY_NAMES,
  DAY_NAMES_FULL,
  waLink,
  fillTemplate,
  formatMoney,
  CATEGORIES,
  GENDERS,
  LEVEL_MODS,
  PERIODS,
  categoryLabel,
} from '../lib/helpers'
import { CloseIcon, WhatsAppIcon, CheckCircleIcon, WarningIcon, PlusIcon } from './Icons'

const GROUP_SIZES = [
  { key: 'individual', label: 'Individual' },
  { key: 'duo', label: 'Dúo' },
  { key: 'trio', label: 'Trío' },
  { key: 'grupo4', label: 'Grupo de 4' },
  { key: 'mensual', label: 'Mensual' },
]

export default function StudentFormModal({ student, onClose, onSaved }) {
  const isEdit = !!student
  const [mode, setMode] = useState(isEdit ? 'view' : 'edit')

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        {mode === 'view' && student ? (
          <StudentProfile student={student} onClose={onClose} onEdit={() => setMode('edit')} onChanged={onSaved} />
        ) : (
          <StudentEditForm student={student} onClose={onClose} onSaved={onSaved} onCancelEdit={isEdit ? () => setMode('view') : null} />
        )}
      </div>
    </div>
  )
}

// ---------- Ficha de alumno (vista) ----------

function StudentProfile({ student, onClose, onEdit, onChanged }) {
  const { user, profile } = useAuth()
  const [templates, setTemplates] = useState({})
  const [fixedSlots, setFixedSlots] = useState([])
  const [partner, setPartner] = useState(null)
  const [stats, setStats] = useState(null)
  const [payAvg, setPayAvg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user || !student) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      const iso = (d) => d.toISOString().slice(0, 10)

      const [{ data: tpl }, { data: slots }, { data: partnerRow }, { data: thisMonth }, { data: lastMonth }, { data: unpaid }, { data: payments }] =
        await Promise.all([
          supabase.from('message_templates').select('*').eq('profesor_id', user.id),
          supabase.from('student_fixed_slots').select('*').eq('student_id', student.id).order('day_of_week'),
          student.partner_student_id
            ? supabase.from('students').select('id, name, category, category_level').eq('id', student.partner_student_id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from('classes').select('id, status').eq('student_id', student.id).gte('class_date', iso(monthStart)).lte('class_date', iso(now)),
          supabase.from('classes').select('id, status').eq('student_id', student.id).gte('class_date', iso(prevMonthStart)).lte('class_date', iso(prevMonthEnd)),
          supabase.from('classes').select('id').eq('student_id', student.id).eq('paid', false).lte('class_date', iso(now)),
          supabase.from('payments').select('amount').eq('student_id', student.id),
        ])

      if (cancelled) return
      const map = {}
      ;(tpl || []).forEach((t) => (map[t.key] = t.template))
      setTemplates(map)
      setFixedSlots(slots || [])
      setPartner(partnerRow || null)

      const thisCount = (thisMonth || []).filter((c) => c.status !== 'absent').length
      const lastCount = (lastMonth || []).filter((c) => c.status !== 'absent').length
      const weeksSoFar = Math.max(1, Math.ceil(now.getDate() / 7))
      setStats({
        thisMonthCount: thisCount,
        lastMonthCount: lastCount,
        perWeek: thisCount / weeksSoFar,
        alDia: (unpaid || []).length === 0,
      })

      if ((payments || []).length > 0) {
        const avg = payments.reduce((s, p) => s + Number(p.amount || 0), 0) / payments.length
        setPayAvg(avg)
      } else {
        setPayAvg(null)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, student])

  async function toggleBaja() {
    setBusy(true)
    const nextStatus = student.status === 'baja' ? 'active' : 'baja'
    if (nextStatus === 'baja' && !confirm(`¿Dar de baja a ${student.name}? Podés reactivarlo cuando quieras, no se pierde nada.`)) {
      setBusy(false)
      return
    }
    await supabase.from('students').update({ status: nextStatus }).eq('id', student.id)
    setBusy(false)
    onChanged()
  }

  const memberSince = student.created_at
    ? new Date(student.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    : null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="label-muted">Ficha de alumno</div>
        <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-brand/20 text-brand flex items-center justify-center font-bold text-lg shrink-0">
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold truncate">
            {student.name}{student.category ? ` / ${categoryLabel(student.category, student.category_level)}` : ''}
          </div>
          <div className="text-xs text-slate-400">
            {memberSince ? `Tu alumno desde ${memberSince}` : 'Alumno'}
            {' · '}
            {loading ? 'Cargando...' : stats?.thisMonthCount ? `${stats.thisMonthCount} clases este mes` : 'Todavía sin clases registradas'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatTile value={loading ? '–' : stats?.thisMonthCount ?? 0} label="Este mes" />
        <StatTile value={loading ? '–' : (stats?.perWeek ?? 0).toFixed(1)} label="Por semana" />
        <StatTile
          value={loading ? '–' : stats?.alDia ? <CheckCircleIcon size={18} className="mx-auto text-brand" /> : <WarningIcon size={18} className="mx-auto text-amber-400" />}
          label="Al día"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {student.phone ? (
          <a
            href={waLink(student.phone, fillTemplate(templates.recordatorio || 'Hola {nombre}!', { nombre: student.name }))}
            target="_blank"
            rel="noreferrer"
            className="btn-secondary flex items-center justify-center gap-1.5 text-brand"
          >
            <WhatsAppIcon size={16} /> WhatsApp
          </a>
        ) : (
          <div className="btn-secondary flex items-center justify-center gap-1.5 text-slate-600 cursor-not-allowed">
            <WhatsAppIcon size={16} /> Sin teléfono
          </div>
        )}
        <button onClick={onEdit} className="btn-secondary">Editar ficha</button>
      </div>

      <div className="space-y-3">
        <Section title="Asistencia">
          <div className="text-sm"><span className="font-bold">{stats?.thisMonthCount ?? 0} clases</span> este mes</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {loading
              ? ''
              : stats?.lastMonthCount > stats?.thisMonthCount
                ? 'El mes pasado había venido más a esta altura'
                : stats?.lastMonthCount === stats?.thisMonthCount
                  ? 'Igual que el mes pasado a esta altura'
                  : stats?.lastMonthCount === 0
                    ? 'El mes pasado no había venido a esta altura'
                    : 'Viene más seguido que el mes pasado'}
          </div>
        </Section>

        <Section title="Cuándo viene">
          {fixedSlots.length > 0 ? (
            <>
              <div className="text-xs font-semibold text-slate-400 mb-1.5">Fijo</div>
              <div className="flex flex-wrap gap-1.5">
                {fixedSlots.map((s) => (
                  <span key={s.id} className="text-xs font-medium bg-bg-panel border border-bg-border rounded-full px-2.5 py-1">
                    {DAY_NAMES_FULL[s.day_of_week]} {s.start_time?.slice(0, 5)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="text-sm text-slate-500">Sin horario fijo asignado todavía.</div>
          )}
        </Section>

        {partner && (
          <Section title="Con quién juega">
            <div className="text-sm font-medium">{partner.name}{partner.category ? ` / ${categoryLabel(partner.category, partner.category_level)}` : ''}</div>
          </Section>
        )}

        {(student.availability_days?.length > 0 || student.availability_periods?.length > 0) && (
          <Section title="Disponibilidad">
            <div className="text-sm">
              {(student.availability_days || []).map((d) => DAY_NAMES[d]).join(' · ')}
              {student.availability_days?.length && student.availability_periods?.length ? ' — ' : ''}
              {(student.availability_periods || []).join(', ')}
            </div>
          </Section>
        )}

        <Section title="Contacto">
          <div className="text-sm">{student.phone || 'Sin teléfono cargado'}</div>
        </Section>

        <Section title="Cómo paga">
          <div className="text-sm">
            {student.group_size === 'mensual' ? 'Por mes' : 'Por clase'}
            {payAvg != null ? ` · promedio ${formatMoney(payAvg, profile?.currency)}` : ' · todavía sin clases registradas para calcular el promedio'}
          </div>
        </Section>

        {student.notes && (
          <Section title="Notas">
            <div className="text-sm whitespace-pre-wrap">{student.notes}</div>
          </Section>
        )}
      </div>

      <button
        onClick={toggleBaja}
        disabled={busy}
        className={`w-full text-center font-semibold py-3 rounded-xl mt-4 ${student.status === 'baja' ? 'bg-brand/10 text-brand' : 'bg-red-500/10 text-red-400'}`}
      >
        {student.status === 'baja' ? 'Reactivar alumno' : 'Dar de baja'}
      </button>
      <button onClick={onClose} className="w-full text-center text-sm text-slate-400 font-semibold py-2.5 underline decoration-dotted">
        Cerrar
      </button>
    </div>
  )
}

function StatTile({ value, label }) {
  return (
    <div className="card p-3 text-center">
      <div className="text-lg font-extrabold leading-tight">{value}</div>
      <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card p-3">
      <div className="label-muted mb-1.5">{title}</div>
      {children}
    </div>
  )
}

// ---------- Editar ficha ----------

function StudentEditForm({ student, onClose, onSaved, onCancelEdit }) {
  const { user } = useAuth()
  const isEdit = !!student
  const [name, setName] = useState(student?.name || '')
  const [phone, setPhone] = useState(student?.phone || '')
  const [gender, setGender] = useState(student?.gender || '')
  const [category, setCategory] = useState(student?.category || '')
  const [categoryLevel, setCategoryLevel] = useState(student?.category_level || '')
  const [groupSize, setGroupSize] = useState(student?.group_size || 'individual')
  const [dayOfWeek, setDayOfWeek] = useState(student?.day_of_week ?? '')
  const [timeSlot, setTimeSlot] = useState(student?.time_slot?.slice(0, 5) || '')
  const [status, setStatus] = useState(student?.status === 'baja' ? 'active' : student?.status || 'active')
  const [notes, setNotes] = useState(student?.notes || '')
  const [partnerId, setPartnerId] = useState(student?.partner_student_id || '')
  const [availDays, setAvailDays] = useState(student?.availability_days || [])
  const [availPeriods, setAvailPeriods] = useState(student?.availability_periods || [])
  const [fixedSlots, setFixedSlots] = useState([])
  const [newSlotDay, setNewSlotDay] = useState(0)
  const [newSlotTime, setNewSlotTime] = useState('')
  const [otherStudents, setOtherStudents] = useState([])
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
    supabase
      .from('students')
      .select('id, name, category, category_level')
      .eq('profesor_id', user.id)
      .order('name')
      .then(({ data }) => setOtherStudents((data || []).filter((s) => s.id !== student?.id)))
    if (isEdit) {
      supabase
        .from('student_fixed_slots')
        .select('*')
        .eq('student_id', student.id)
        .order('day_of_week')
        .then(({ data }) => setFixedSlots(data || []))
    }
  }, [user])

  function toggleAvailDay(d) {
    setAvailDays((arr) => (arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d].sort()))
  }
  function toggleAvailPeriod(p) {
    setAvailPeriods((arr) => (arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p]))
  }

  async function addFixedSlot() {
    if (newSlotTime === '' || !isEdit) return
    const { data } = await supabase
      .from('student_fixed_slots')
      .insert({ profesor_id: user.id, student_id: student.id, day_of_week: Number(newSlotDay), start_time: newSlotTime })
      .select()
      .single()
    if (data) setFixedSlots((s) => [...s, data].sort((a, b) => a.day_of_week - b.day_of_week))
    setNewSlotTime('')
  }

  async function removeFixedSlot(id) {
    await supabase.from('student_fixed_slots').delete().eq('id', id)
    setFixedSlots((s) => s.filter((x) => x.id !== id))
  }

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
      partner_student_id: partnerId || null,
      availability_days: availDays,
      availability_periods: availPeriods,
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
    if (!confirm(`¿Eliminar a ${student.name} definitivamente? Esta acción no se puede deshacer.`)) return
    setSaving(true)
    await supabase.from('students').delete().eq('id', student.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div>
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

        {isEdit && (
          <div>
            <div className="label-muted mb-1.5">Horarios fijos (cuándo viene)</div>
            {fixedSlots.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fixedSlots.map((s) => (
                  <span key={s.id} className="flex items-center gap-1.5 bg-bg-card border border-bg-border rounded-full pl-3 pr-1.5 py-1 text-xs font-medium">
                    {DAY_NAMES[s.day_of_week]} {s.start_time?.slice(0, 5)}
                    <button onClick={() => removeFixedSlot(s.id)} className="text-slate-500 hover:text-red-400"><CloseIcon size={11} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1.5">
              <select className="input" value={newSlotDay} onChange={(e) => setNewSlotDay(e.target.value)}>
                {DAY_NAMES_FULL.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
              <input type="time" className="input" value={newSlotTime} onChange={(e) => setNewSlotTime(e.target.value)} />
              <button onClick={addFixedSlot} disabled={!newSlotTime} className="btn-secondary shrink-0 px-3"><PlusIcon size={16} /></button>
            </div>
          </div>
        )}

        <div>
          <div className="label-muted mb-1.5">Con quién juega</div>
          <select className="input" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">Sin compañero asignado</option>
            {otherStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.category ? ` / ${categoryLabel(s.category, s.category_level)}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="label-muted mb-1.5">Disponibilidad</div>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {DAY_NAMES.map((d, i) => (
              <button key={i} onClick={() => toggleAvailDay(i)} className={`py-2 rounded-xl text-xs font-semibold ${availDays.includes(i) ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                {d}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {PERIODS.map((p) => (
              <button key={p} onClick={() => toggleAvailPeriod(p)} className={`py-2 rounded-xl text-xs font-semibold ${availPeriods.includes(p) ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
                {p}
              </button>
            ))}
          </div>
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
        {onCancelEdit && (
          <button onClick={onCancelEdit} className="w-full text-center text-sm text-slate-400 font-semibold py-2">
            Volver a la ficha
          </button>
        )}
        {isEdit && (
          <button onClick={remove} disabled={saving} className="w-full text-center text-sm text-red-400 font-semibold py-2">
            Eliminar alumno definitivamente
          </button>
        )}
      </div>
    </div>
  )
}
