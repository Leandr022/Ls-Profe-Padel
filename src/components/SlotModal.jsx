import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, waLink, fillTemplate, groupSizeLabel, jsDayToIdx, categoryLabel } from '../lib/helpers'
import { CloseIcon, WhatsAppIcon, PlusIcon, WarningIcon } from './Icons'

function sizeKeyFor(count) {
  if (count <= 1) return 'individual'
  if (count === 2) return 'duo'
  if (count === 3) return 'trio'
  return 'grupo4'
}

export default function SlotModal({ slot, profile, onClose, onSaved }) {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [rates, setRates] = useState(null)
  const [templates, setTemplates] = useState({})
  const [fixedIds, setFixedIds] = useState(new Set())
  const [debtIds, setDebtIds] = useState(new Set())
  const [rows, setRows] = useState(slot.existingClasses || [])
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [swapForId, setSwapForId] = useState(null)
  const [editingPriceId, setEditingPriceId] = useState(null)
  const [priceDraft, setPriceDraft] = useState('')

  const dayIdx = slot.dayIdx ?? jsDayToIdx(new Date(slot.iso + 'T12:00:00').getDay())

  async function loadAll() {
    if (!user) return
    const [{ data: st }, { data: rt }, { data: tpl }, { data: fixed }] = await Promise.all([
      supabase.from('students').select('*').eq('profesor_id', user.id).order('name'),
      supabase.from('rates').select('*').eq('profesor_id', user.id).maybeSingle(),
      supabase.from('message_templates').select('*').eq('profesor_id', user.id),
      supabase.from('student_fixed_slots').select('student_id').eq('profesor_id', user.id).eq('day_of_week', dayIdx).eq('start_time', slot.time),
    ])
    setStudents(st || [])
    setRates(rt)
    const map = {}
    ;(tpl || []).forEach((t) => (map[t.key] = t.template))
    setTemplates(map)
    setFixedIds(new Set((fixed || []).map((f) => f.student_id)))

    const ids = (slot.existingClasses || []).map((c) => c.student_id).filter(Boolean)
    if (ids.length) {
      const { data: unpaid } = await supabase.from('classes').select('student_id').eq('profesor_id', user.id).eq('paid', false).in('student_id', ids).lt('class_date', slot.iso)
      setDebtIds(new Set((unpaid || []).map((u) => u.student_id)))
    }
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const priceFor = (size) => (rates ? { individual: rates.individual_price, duo: rates.duo_price, trio: rates.trio_price, grupo4: rates.group4_price }[size] : 0)
  const commissionFor = (size) =>
    (rates ? { individual: rates.individual_commission, duo: rates.duo_commission, trio: rates.trio_commission, grupo4: rates.group4_commission }[size] : 0) || 0

  const assignedIds = new Set(rows.map((r) => r.student_id))
  const suggestions = query.trim()
    ? students.filter((s) => !assignedIds.has(s.id) && s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : []

  // Recalcula precio/comisión de todas las filas cuando cambia la cantidad de gente en el hueco
  async function repriceAll(nextRows) {
    const size = sizeKeyFor(nextRows.length)
    const price = priceFor(size)
    const commission = commissionFor(size)
    await Promise.all(
      nextRows.map((r) => supabase.from('classes').update({ price, commission }).eq('id', r.id)),
    )
    return nextRows.map((r) => ({ ...r, price, commission }))
  }

  async function insertClass(student) {
    const size = sizeKeyFor(rows.length + 1)
    const { data } = await supabase
      .from('classes')
      .insert({
        profesor_id: user.id,
        student_id: student.id,
        class_date: slot.iso,
        start_time: slot.time,
        status: 'scheduled',
        price: priceFor(size),
        commission: commissionFor(size),
      })
      .select('*, students(id, name, phone, category, category_level)')
      .single()
    if (!data) return
    const next = [...rows, data]
    const repriced = await repriceAll(next)
    setRows(repriced)
  }

  async function addFromQuery() {
    if (!query.trim()) return
    setSaving(true)
    const exact = students.find((s) => !assignedIds.has(s.id) && s.name.toLowerCase() === query.trim().toLowerCase())
    if (exact) {
      await insertClass(exact)
    } else {
      const { data: student } = await supabase
        .from('students')
        .insert({ profesor_id: user.id, name: query.trim(), group_size: 'individual', status: 'active' })
        .select()
        .single()
      if (student) {
        setStudents((s) => [...s, student])
        await insertClass(student)
      }
    }
    setQuery('')
    setSaving(false)
  }

  async function pickSuggestion(s) {
    setSaving(true)
    await insertClass(s)
    setQuery('')
    setSaving(false)
  }

  async function removeRow(row) {
    setSaving(true)
    await supabase.from('classes').delete().eq('id', row.id)
    const next = rows.filter((r) => r.id !== row.id)
    if (next.length > 0) {
      const repriced = await repriceAll(next)
      setRows(repriced)
    } else {
      setRows([])
    }
    setSaving(false)
  }

  async function toggleFalta(row) {
    setSaving(true)
    const nextStatus = row.status === 'absent' ? 'scheduled' : 'absent'
    await supabase.from('classes').update({ status: nextStatus }).eq('id', row.id)
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)))
    setSaving(false)
  }

  async function togglePaid(row) {
    setSaving(true)
    const nowPaid = !row.paid
    await supabase.from('classes').update({ paid: nowPaid, paid_at: nowPaid ? new Date().toISOString() : null }).eq('id', row.id)
    if (nowPaid) {
      await supabase.from('payments').insert({
        profesor_id: user.id,
        student_id: row.student_id,
        class_id: row.id,
        amount: row.price || 0,
        currency: profile?.currency || 'ARS',
      })
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, paid: nowPaid } : r)))
    setSaving(false)
  }

  async function savePrice(row) {
    const val = Number(priceDraft)
    if (!isNaN(val)) {
      await supabase.from('classes').update({ price: val }).eq('id', row.id)
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, price: val } : r)))
    }
    setEditingPriceId(null)
  }

  async function markNotified(row) {
    await supabase.from('classes').update({ notified: true }).eq('id', row.id)
  }

  async function doSwap(row, newStudent) {
    setSaving(true)
    await supabase.from('classes').delete().eq('id', row.id)
    const { data } = await supabase
      .from('classes')
      .insert({
        profesor_id: user.id,
        student_id: newStudent.id,
        class_date: slot.iso,
        start_time: slot.time,
        status: 'scheduled',
        price: row.price,
        commission: row.commission,
      })
      .select('*, students(id, name, phone, category, category_level)')
      .single()
    if (data) setRows((rs) => rs.map((r) => (r.id === row.id ? data : r)))
    setSwapForId(null)
    setSaving(false)
  }

  async function removeWholeSlot() {
    if (!confirm('¿Quitar esta clase? Se van a desasignar todos los alumnos de este horario.')) return
    setSaving(true)
    await Promise.all(rows.map((r) => supabase.from('classes').delete().eq('id', r.id)))
    setSaving(false)
    onSaved()
  }

  const sizeLabel = rows.length > 0 ? groupSizeLabel(sizeKeyFor(rows.length)) : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold flex items-center gap-2">
            ¿Quién viene a las {slot.time}?
            {rows.length > 0 && <span className="text-[10px] font-bold uppercase bg-brand/15 text-brand px-2 py-0.5 rounded-full">Editando</span>}
          </div>
          <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
        </div>

        <div className="flex gap-2 mb-4 relative">
          <input
            className="input flex-1"
            placeholder="Nombre (ej: Leo)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFromQuery()}
          />
          <button onClick={addFromQuery} disabled={saving || !query.trim()} className="btn-secondary shrink-0 flex items-center gap-1">
            <PlusIcon size={14} /> Sumar
          </button>
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 card z-10 divide-y divide-bg-border overflow-hidden">
              {suggestions.map((s) => (
                <button key={s.id} onClick={() => pickSuggestion(s)} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5">
                  {s.name}
                  {s.category && <span className="text-slate-500"> / {categoryLabel(s.category, s.category_level)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {rows.length === 0 && <div className="text-sm text-slate-500 text-center py-6">Todavía nadie asignado a este hueco.</div>}

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="card p-3">
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <span className="font-semibold text-sm text-brand">
                  {row.students?.name}
                  {row.students?.category && ` / ${categoryLabel(row.students.category, row.students.category_level)}`}
                </span>
                {fixedIds.has(row.student_id) && (
                  <span className="text-[10px] font-bold uppercase bg-bg-card border border-bg-border px-1.5 py-0.5 rounded-full">Fijo ↺</span>
                )}
                {debtIds.has(row.student_id) && <WarningIcon size={14} className="text-amber-400" />}
              </div>

              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <button onClick={() => toggleFalta(row)} className={`pill text-xs font-semibold ${row.status === 'absent' ? 'bg-amber-500/20 text-amber-400' : 'card text-slate-300'}`}>
                  {row.status === 'absent' ? 'Faltó' : 'Falta'}
                </button>
                {row.students?.phone && (
                  <a
                    href={waLink(row.students.phone, fillTemplate(templates.recordatorio || 'Hola {nombre}!', { nombre: row.students.name, hora: slot.time }))}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markNotified(row)}
                    className="btn-secondary p-2 text-brand"
                  >
                    <WhatsAppIcon size={14} />
                  </a>
                )}
                <button onClick={() => setSwapForId(swapForId === row.id ? null : row.id)} className="btn-secondary p-2 text-slate-300" title="Cambiar alumno">
                  ⇄
                </button>
                <button onClick={() => removeRow(row)} disabled={saving} className="btn-secondary p-2 text-red-400" title="Quitar de este hueco">
                  <CloseIcon size={14} />
                </button>
              </div>

              {swapForId === row.id && (
                <SwapPicker
                  students={students.filter((s) => !assignedIds.has(s.id))}
                  onPick={(s) => doSwap(row, s)}
                  onCancel={() => setSwapForId(null)}
                />
              )}

              <div className="flex items-center justify-between text-sm">
                <button onClick={() => togglePaid(row)} className={`underline decoration-dotted ${row.paid ? 'text-brand' : 'text-slate-400'}`}>
                  {row.paid ? 'Pagó esta clase' : 'Marcar como pagada'}
                </button>
                {editingPriceId === row.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="number"
                      className="input w-24 py-1"
                      value={priceDraft}
                      onChange={(e) => setPriceDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && savePrice(row)}
                    />
                    <button onClick={() => savePrice(row)} className="text-brand text-xs font-bold">OK</button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingPriceId(row.id)
                      setPriceDraft(String(row.price ?? 0))
                    }}
                    className="text-xs text-slate-500"
                  >
                    {formatMoney(row.price, profile?.currency)} ✎
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {sizeLabel && <div className="text-sm text-slate-400 mt-4">Tipo: <span className="text-brand font-semibold">{sizeLabel}</span></div>}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={onSaved} className="btn-primary">Guardar clase ✓</button>
        </div>

        {rows.length > 0 && (
          <button onClick={removeWholeSlot} disabled={saving} className="w-full text-center text-sm text-red-400 font-semibold py-3 mt-2 card">
            Quitar esta clase...
          </button>
        )}
      </div>
    </div>
  )
}

function SwapPicker({ students, onPick, onCancel }) {
  const [q, setQ] = useState('')
  const filtered = students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6)
  return (
    <div className="card p-2 mb-2 bg-bg-card">
      <div className="flex items-center gap-1.5 mb-1.5">
        <input autoFocus className="input py-1.5 text-sm flex-1" placeholder="Buscar reemplazo..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={onCancel} className="text-slate-500 text-xs">Cancelar</button>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {filtered.length === 0 && <div className="text-xs text-slate-500 px-1">Sin resultados.</div>}
        {filtered.map((s) => (
          <button key={s.id} onClick={() => onPick(s)} className="w-full text-left px-2 py-1.5 text-sm rounded-lg hover:bg-white/5">
            {s.name}
          </button>
        ))}
      </div>
    </div>
  )
}
