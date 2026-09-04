import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  formatMoney,
  waLink,
  fillTemplate,
  groupSizeLabel,
  jsDayToIdx,
  categoryLabel,
  addMinutesToTime,
  sizeKeyFor,
  priceForSize,
  commissionForSize,
  DAY_NAMES_FULL,
} from '../lib/helpers'
import { CloseIcon, WhatsAppIcon, PlusIcon, WarningIcon, LockIcon, ChevronDown } from './Icons'

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
  const [showBlockForm, setShowBlockForm] = useState(false)
  const [blockReason, setBlockReason] = useState('')
  const [blockSaving, setBlockSaving] = useState(false)
  const [newIsFixed, setNewIsFixed] = useState(true)
  const [waMenuForId, setWaMenuForId] = useState(null)
  const [removeChoiceForId, setRemoveChoiceForId] = useState(null)

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

  const priceFor = (size) => priceForSize(rates, size)
  const commissionFor = (size) => commissionForSize(rates, size)

  const assignedIds = new Set(rows.map((r) => r.student_id))
  const suggestions = query.trim()
    ? students.filter((s) => !assignedIds.has(s.id) && s.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 5)
    : []

  // Recalcula precio/comisión de todas las filas cuando cambia la cantidad de gente en el hueco.
  // La comisión al club es un monto fijo POR CLASE (no por alumno), así que si hay varios
  // alumnos en el mismo hueco la repartimos entre todos para que la suma de las filas dé el
  // total real de la clase (y no lo multiplique por la cantidad de alumnos en Caja/Estadísticas).
  // Las filas "cancelled" (alguien que canceló solo por hoy) NO cuentan para el tamaño del grupo
  // ni tienen costo — así un dúo donde uno canceló pasa a cobrarse como individual, y un trío
  // pasa a cobrarse como dúo, automáticamente.
  async function repriceAll(nextRows) {
    const activeRows = nextRows.filter((r) => r.status !== 'cancelled')
    const size = sizeKeyFor(activeRows.length)
    const price = priceFor(size)
    const commissionTotal = commissionFor(size)
    const commission = activeRows.length > 0 ? commissionTotal / activeRows.length : 0
    await Promise.all(
      nextRows.map((r) =>
        r.status === 'cancelled'
          ? supabase.from('classes').update({ price: 0, commission: 0 }).eq('id', r.id)
          : supabase.from('classes').update({ price, commission }).eq('id', r.id),
      ),
    )
    return nextRows.map((r) => (r.status === 'cancelled' ? { ...r, price: 0, commission: 0 } : { ...r, price, commission }))
  }

  async function insertClass(student) {
    const nextCount = rows.length + 1
    const size = sizeKeyFor(nextCount)
    const durationMinutes = profile?.class_duration_minutes || 60
    const { data } = await supabase
      .from('classes')
      .insert({
        profesor_id: user.id,
        student_id: student.id,
        class_date: slot.iso,
        start_time: slot.time,
        end_time: addMinutesToTime(slot.time, durationMinutes),
        status: 'scheduled',
        price: priceFor(size),
        commission: commissionFor(size) / nextCount,
      })
      .select('*, students(id, name, phone, category, category_level)')
      .single()
    if (!data) return

    if (newIsFixed && !fixedIds.has(student.id)) {
      await supabase.from('student_fixed_slots').insert({
        profesor_id: user.id,
        student_id: student.id,
        day_of_week: dayIdx,
        start_time: slot.time,
      })
      setFixedIds((f) => new Set(f).add(student.id))
    }

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

  // Cancela solo la ocurrencia de HOY: el alumno sigue fijo (vuelve la semana que viene), pero
  // esta clase puntual no cuenta ni cobra, y el resto del grupo se recalcula más chico.
  async function cancelJustToday(row) {
    setSaving(true)
    await supabase.from('classes').update({ status: 'cancelled', price: 0, commission: 0 }).eq('id', row.id)
    const next = rows.map((r) => (r.id === row.id ? { ...r, status: 'cancelled', price: 0, commission: 0 } : r))
    const repriced = await repriceAll(next)
    setRows(repriced)
    setSaving(false)
    setRemoveChoiceForId(null)
  }

  // Saca al alumno de este hueco para siempre: borra la clase y, si era fijo, también la regla
  // de horario fijo (si no, la próxima semana volvería a aparecer solo).
  async function removeCompletely(row, alsoUnfix) {
    setSaving(true)
    await supabase.from('classes').delete().eq('id', row.id)
    if (alsoUnfix) {
      await supabase
        .from('student_fixed_slots')
        .delete()
        .eq('profesor_id', user.id)
        .eq('student_id', row.student_id)
        .eq('day_of_week', dayIdx)
        .eq('start_time', slot.time)
      setFixedIds((f) => {
        const n = new Set(f)
        n.delete(row.student_id)
        return n
      })
    }
    const next = rows.filter((r) => r.id !== row.id)
    if (next.length > 0) {
      const repriced = await repriceAll(next)
      setRows(repriced)
    } else {
      setRows([])
    }
    setSaving(false)
    setRemoveChoiceForId(null)
  }

  // Deshace una cancelación de hoy: el alumno vuelve a contar en el grupo y a cobrarse.
  async function reactivateRow(row) {
    setSaving(true)
    await supabase.from('classes').update({ status: 'scheduled' }).eq('id', row.id)
    const next = rows.map((r) => (r.id === row.id ? { ...r, status: 'scheduled' } : r))
    const repriced = await repriceAll(next)
    setRows(repriced)
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
        end_time: row.end_time || addMinutesToTime(slot.time, profile?.class_duration_minutes || 60),
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

  async function blockSlot() {
    setBlockSaving(true)
    const durationMinutes = profile?.class_duration_minutes || 60
    await supabase.from('schedule_blocks').insert({
      profesor_id: user.id,
      block_date: slot.iso,
      start_time: slot.time,
      end_time: addMinutesToTime(slot.time, durationMinutes),
      reason: blockReason.trim() || null,
    })
    setBlockSaving(false)
    onSaved()
  }

  async function unblockSlot() {
    setBlockSaving(true)
    await supabase.from('schedule_blocks').delete().eq('id', slot.block.id)
    setBlockSaving(false)
    onSaved()
  }

  async function removeWholeSlot() {
    if (!confirm('¿Quitar esta clase? Se van a desasignar todos los alumnos de este horario.')) return
    setSaving(true)
    await Promise.all(rows.map((r) => supabase.from('classes').delete().eq('id', r.id)))
    setSaving(false)
    onSaved()
  }

  const activeCount = rows.filter((r) => r.status !== 'cancelled').length
  const sizeLabel = activeCount > 0 ? groupSizeLabel(sizeKeyFor(activeCount)) : null

  if (slot.block) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold flex items-center gap-2">
              <LockIcon size={18} className="text-slate-400" />
              Horario bloqueado
            </div>
            <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
          </div>

          <div className="card p-4 mb-4 bg-bg-card">
            <div className="text-sm font-semibold mb-1">{slot.time} hs</div>
            <div className="text-sm text-slate-400">{slot.block.reason || 'Sin motivo especificado.'}</div>
          </div>

          <p className="text-xs text-slate-500 mb-4">Mientras esté bloqueado, nadie va a poder reservar clase en este horario.</p>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={onClose} className="btn-secondary">Cerrar</button>
            <button onClick={unblockSlot} disabled={blockSaving} className="btn-primary bg-none bg-red-500 hover:bg-red-600">
              {blockSaving ? 'Un momento...' : 'Desbloquear'}
            </button>
          </div>
        </div>
      </div>
    )
  }

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

        <div className="mb-2">
          <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">¿Viene fijo o solo por hoy?</div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setNewIsFixed(true)}
              className={`py-2 rounded-xl text-xs font-bold ${newIsFixed ? 'bg-brand/15 border border-brand text-brand' : 'card text-slate-400'}`}
            >
              Fijo ↺ <span className="font-normal">todas las semanas</span>
            </button>
            <button
              type="button"
              onClick={() => setNewIsFixed(false)}
              className={`py-2 rounded-xl text-xs font-bold ${!newIsFixed ? 'bg-brand/15 border border-brand text-brand' : 'card text-slate-400'}`}
            >
              Solo por hoy <span className="font-normal">invitado</span>
            </button>
          </div>
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

        {rows.length === 0 && !showBlockForm && (
          <div className="text-center py-4">
            <div className="text-sm text-slate-500 mb-3">Todavía nadie asignado a este hueco.</div>
            <button onClick={() => setShowBlockForm(true)} className="text-slate-400 text-xs font-semibold inline-flex items-center gap-1.5 hover:text-slate-300">
              <LockIcon size={13} /> Bloquear este horario (trámite, ausencia, etc.)
            </button>
          </div>
        )}

        {rows.length === 0 && showBlockForm && (
          <div className="card p-3 mb-4 bg-bg-card">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5"><LockIcon size={14} className="text-slate-400" /> Bloquear las {slot.time} hs</div>
            <input
              autoFocus
              className="input mb-2"
              placeholder="Motivo (opcional): trámite, médico..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && blockSlot()}
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setShowBlockForm(false)} className="btn-secondary">Cancelar</button>
              <button onClick={blockSlot} disabled={blockSaving} className="btn-primary">
                {blockSaving ? 'Bloqueando...' : 'Confirmar bloqueo'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {rows.map((row) =>
            row.status === 'cancelled' ? (
              <div key={row.id} className="card p-3 opacity-60">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-slate-400 line-through truncate">{row.students?.name}</span>
                      <span className="text-[10px] font-bold uppercase bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full shrink-0">Canceló hoy</span>
                    </div>
                    {fixedIds.has(row.student_id) && (
                      <div className="text-[11px] text-slate-500 mt-0.5">Sigue fijo — vuelve la semana que viene.</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => reactivateRow(row)} disabled={saving} className="btn-secondary p-2 text-brand" title="Reactivar">
                      ↺
                    </button>
                    <button onClick={() => removeCompletely(row, false)} disabled={saving} className="btn-secondary p-2 text-red-400" title="Eliminar del todo">
                      <CloseIcon size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
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

              {removeChoiceForId === row.id && (
                <div className="card p-2.5 mb-2 bg-bg-card space-y-1.5">
                  <div className="text-xs font-semibold text-slate-300 mb-1">¿Cómo lo sacás?</div>
                  <button onClick={() => cancelJustToday(row)} disabled={saving} className="w-full text-left text-xs px-2.5 py-2 rounded-lg bg-brand/10 text-brand font-semibold">
                    Canceló solo hoy — sigue fijo las próximas semanas
                  </button>
                  <button onClick={() => removeCompletely(row, true)} disabled={saving} className="w-full text-left text-xs px-2.5 py-2 rounded-lg bg-red-500/10 text-red-400 font-semibold">
                    Sacarlo también de fijo, para siempre
                  </button>
                  <button onClick={() => setRemoveChoiceForId(null)} className="w-full text-center text-xs px-2.5 py-1.5 text-slate-500">
                    Cancelar
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <button onClick={() => toggleFalta(row)} className={`pill text-xs font-semibold ${row.status === 'absent' ? 'bg-amber-500/20 text-amber-400' : 'card text-slate-300'}`}>
                  {row.status === 'absent' ? 'Faltó' : 'Falta'}
                </button>
                {row.students?.phone && (
                  <div className="relative">
                    <button
                      onClick={() => setWaMenuForId(waMenuForId === row.id ? null : row.id)}
                      className="btn-secondary p-2 text-brand flex items-center gap-0.5"
                    >
                      <WhatsAppIcon size={14} />
                      <ChevronDown size={11} />
                    </button>
                    {waMenuForId === row.id && (
                      <div className="absolute top-full left-0 mt-1 card z-10 divide-y divide-bg-border overflow-hidden w-52">
                        <a
                          href={waLink(row.students.phone, fillTemplate(templates.recordatorio || 'Hola {nombre}! Te espero a las {hora}.', { nombre: row.students.name, hora: slot.time }))}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => {
                            markNotified(row)
                            setWaMenuForId(null)
                          }}
                          className="block px-3 py-2.5 text-sm hover:bg-white/5"
                        >
                          Recordatorio de clase
                        </a>
                        {debtIds.has(row.student_id) && (
                          <a
                            href={waLink(
                              row.students.phone,
                              fillTemplate(templates.deuda || 'Hola {nombre}! Te escribo por un pago pendiente de {monto}.', {
                                nombre: row.students.name,
                                monto: formatMoney(row.price, profile?.currency),
                                alias: profile?.payment_alias || '[Tu alias]',
                                cbu: profile?.payment_cbu_cvu || '[Tu CBU/CVU]',
                              }),
                            )}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setWaMenuForId(null)}
                            className="block px-3 py-2.5 text-sm text-amber-400 hover:bg-white/5"
                          >
                            Aviso de deuda
                          </a>
                        )}
                        <a
                          href={waLink(
                            row.students.phone,
                            fillTemplate(templates.cancelacion || 'Hola {nombre}! Te escribo para avisarte que se cancela la clase de las {hora} de este {dia}.', {
                              nombre: row.students.name,
                              hora: slot.time,
                              dia: DAY_NAMES_FULL[dayIdx],
                            }),
                          )}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setWaMenuForId(null)}
                          className="block px-3 py-2.5 text-sm text-red-400 hover:bg-white/5"
                        >
                          Avisar cancelación
                        </a>
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => setSwapForId(swapForId === row.id ? null : row.id)} className="btn-secondary p-2 text-slate-300" title="Cambiar alumno">
                  ⇄
                </button>
                <button
                  onClick={() => (fixedIds.has(row.student_id) ? setRemoveChoiceForId(removeChoiceForId === row.id ? null : row.id) : removeCompletely(row, false))}
                  disabled={saving}
                  className="btn-secondary p-2 text-red-400"
                  title="Quitar de este hueco"
                >
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
            ),
          )}
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
