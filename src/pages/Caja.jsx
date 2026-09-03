import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, monthLabel, toISODate, waLink, fillTemplate, sizeKeyFor, groupSizeLabel, isClassFinished } from '../lib/helpers'
import Header from '../components/Header'
import { ChevronLeft, ChevronRight, ChevronRight as Chev, WhatsAppIcon, PlusIcon, CloseIcon, CheckCircleIcon } from '../components/Icons'

export default function Caja() {
  const { user, profile } = useAuth()
  const [cursor, setCursor] = useState(new Date())
  const [classes, setClasses] = useState([])
  const [expenses, setExpenses] = useState([])
  const [templates, setTemplates] = useState({})
  const [loading, setLoading] = useState(true)
  const [openSection, setOpenSection] = useState(null) // 'debe' | 'pagaron' | 'gastos'
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expandedDebtId, setExpandedDebtId] = useState(null)
  const [payingId, setPayingId] = useState(null)

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)

  async function load() {
    if (!user) return
    setLoading(true)
    const [{ data: cls }, { data: exp }, { data: tpl }] = await Promise.all([
      supabase
        .from('classes')
        .select('*, students(id, name, phone)')
        .eq('profesor_id', user.id)
        .gte('class_date', toISODate(monthStart))
        .lte('class_date', toISODate(monthEnd))
        .not('student_id', 'is', null)
        .not('status', 'eq', 'cancelled'),
      supabase.from('expenses').select('*').eq('profesor_id', user.id).gte('expense_date', toISODate(monthStart)).lte('expense_date', toISODate(monthEnd)).order('expense_date', { ascending: false }),
      supabase.from('message_templates').select('*').eq('profesor_id', user.id),
    ])
    setClasses(cls || [])
    setExpenses(exp || [])
    const map = {}
    ;(tpl || []).forEach((t) => (map[t.key] = t.template))
    setTemplates(map)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user, cursor])

  // Todas las cuentas de plata (facturado, comisión, quién debe, quién pagó) sólo toman en
  // cuenta clases que ya terminaron — una clase agendada para más tarde hoy, mañana o la
  // semana que viene todavía no es plata "real" para el mes.
  const classesUpToToday = useMemo(() => classes.filter((c) => isClassFinished(c)), [classes])

  const totalFacturado = classesUpToToday.reduce((s, c) => s + Number(c.price || 0), 0)
  const totalComision = classesUpToToday.reduce((s, c) => s + Number(c.commission || 0), 0)
  const totalGastos = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const totalNeto = totalFacturado - totalComision - totalGastos

  // Para mostrar "Individual/Dúo/Trío..." en el detalle: cuántos alumnos activos comparten
  // ese mismo día y horario (dentro de las clases ya cargadas del mes).
  const sizeByDateTime = useMemo(() => {
    const counts = {}
    classes.forEach((c) => {
      const key = `${c.class_date}_${c.start_time}`
      counts[key] = (counts[key] || 0) + 1
    })
    return counts
  }, [classes])

  const debtByStudent = useMemo(() => {
    const map = {}
    classesUpToToday
      .filter((c) => !c.paid)
      .sort((a, b) => (a.class_date + (a.start_time || '')).localeCompare(b.class_date + (b.start_time || '')))
      .forEach((c) => {
        const id = c.student_id
        if (!map[id]) map[id] = { student: c.students, total: 0, classes: [] }
        map[id].total += Number(c.price || 0)
        map[id].classes.push(c)
      })
    return Object.values(map)
  }, [classesUpToToday])

  const paidByStudent = useMemo(() => {
    const map = {}
    classesUpToToday.filter((c) => c.paid).forEach((c) => {
      const id = c.student_id
      if (!map[id]) map[id] = { student: c.students, total: 0 }
      map[id].total += Number(c.price || 0)
    })
    return Object.values(map)
  }, [classesUpToToday])

  const totalDebe = debtByStudent.reduce((s, d) => s + d.total, 0)
  const totalPagaron = paidByStudent.reduce((s, d) => s + d.total, 0)

  const isCurrentMonth = monthLabel(cursor) === monthLabel(new Date())

  async function markClassPaid(classId) {
    setPayingId(classId)
    await supabase.from('classes').update({ paid: true }).eq('id', classId)
    setClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, paid: true } : c)))
    setPayingId(null)
  }

  function formatClassDate(iso) {
    const d = new Date(`${iso}T00:00:00`)
    const text = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 fade-in">
      <Header backTo="/panel" backLabel="Panel" />

      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="btn-secondary p-2 rounded-full"><ChevronLeft /></button>
        <div className="font-bold">{monthLabel(cursor)}</div>
        <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="btn-secondary p-2 rounded-full"><ChevronRight /></button>
      </div>

      <div className="card p-5 mb-3">
        <div className="label-muted mb-1">Total facturado</div>
        <div className="text-3xl font-extrabold">{loading ? '–' : formatMoney(totalFacturado, profile?.currency)}</div>
        <div className="text-xs text-slate-500 mt-1">
          {isCurrentMonth ? 'Clases dadas este mes, hasta hoy' : `Clases de ${monthLabel(cursor)}`}
        </div>
        {totalComision > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-bg-border text-sm">
            <span className="text-slate-400">Comisión al club</span>
            <span className="font-semibold text-amber-400">− {formatMoney(totalComision, profile?.currency)}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-1.5 text-sm">
          <span className="text-slate-400">Te queda neto</span>
          <span className="font-bold text-brand">{loading ? '–' : formatMoney(totalNeto, profile?.currency)}</span>
        </div>
        <Link to="/configuracion/tarifas" className="btn-secondary inline-block mt-3">Editar tarifas y comisión</Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <button onClick={() => setOpenSection(openSection === 'debe' ? null : 'debe')} className="text-left rounded-2xl bg-red-950/40 border border-red-800/40 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-red-400">Quién debe</span>
            <Chev className={`text-red-400 transition ${openSection === 'debe' ? 'rotate-90' : ''}`} size={14} />
          </div>
          <div className="text-xl font-extrabold mt-1">{loading ? '–' : formatMoney(totalDebe, profile?.currency)}</div>
          <div className="text-[11px] text-red-300/70 mt-0.5">{debtByStudent.length} alumnos</div>
        </button>
        <button onClick={() => setOpenSection(openSection === 'pagaron' ? null : 'pagaron')} className="text-left rounded-2xl bg-brand/10 border border-brand/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-brand">Ya pagaron</span>
            <Chev className={`text-brand transition ${openSection === 'pagaron' ? 'rotate-90' : ''}`} size={14} />
          </div>
          <div className="text-xl font-extrabold mt-1">{loading ? '–' : formatMoney(totalPagaron, profile?.currency)}</div>
          <div className="text-[11px] text-blue-300/70 mt-0.5">{paidByStudent.length} alumnos</div>
        </button>
      </div>

      {openSection === 'debe' && (
        <div className="card divide-y divide-bg-border mb-2.5">
          {debtByStudent.length === 0 && <div className="p-4 text-sm text-slate-500 text-center">Nadie te debe hasta hoy.</div>}
          {debtByStudent.map((d) => {
            const isOpen = expandedDebtId === d.student?.id
            return (
              <div key={d.student?.id}>
                <button
                  onClick={() => setExpandedDebtId(isOpen ? null : d.student?.id)}
                  className="w-full p-3.5 flex items-center justify-between text-left"
                >
                  <div>
                    <div className="font-semibold text-sm">{d.student?.name}</div>
                    <div className="text-xs text-slate-400">
                      {d.classes.length} clase{d.classes.length === 1 ? '' : 's'} sin pagar · {formatMoney(d.total, profile?.currency)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {d.student?.phone && (
                      <a
                        href={waLink(
                          d.student.phone,
                          fillTemplate(templates.deuda || '', {
                            nombre: d.student.name,
                            monto: formatMoney(d.total, profile?.currency),
                            alias: profile?.payment_alias || '[Tu alias]',
                            cbu: profile?.payment_cbu_cvu || '[Tu CBU/CVU]',
                          }),
                        )}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn-secondary flex items-center gap-1 text-amber-400 text-xs"
                      >
                        <WhatsAppIcon size={14} /> Avisar
                      </a>
                    )}
                    <Chev className={`text-slate-500 transition ${isOpen ? 'rotate-90' : ''}`} size={14} />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-1.5">
                    {d.classes.map((c) => {
                      const size = sizeKeyFor(sizeByDateTime[`${c.class_date}_${c.start_time}`] || 1)
                      return (
                        <div key={c.id} className="rounded-xl bg-bg-card border border-bg-border px-3 py-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-slate-300 min-w-0">
                            <span className="font-semibold">{formatClassDate(c.class_date)} · {c.start_time?.slice(0, 5)}</span>
                            <span className="text-slate-500"> — {groupSizeLabel(size)} — {formatMoney(c.price, profile?.currency)}</span>
                          </div>
                          <button
                            onClick={() => markClassPaid(c.id)}
                            disabled={payingId === c.id}
                            className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-brand bg-brand/10 rounded-full px-2.5 py-1"
                          >
                            <CheckCircleIcon size={12} /> Pagó
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {openSection === 'pagaron' && (
        <div className="card divide-y divide-bg-border mb-2.5">
          {paidByStudent.length === 0 && <div className="p-4 text-sm text-slate-500 text-center">Todavía nadie pagó este mes.</div>}
          {paidByStudent.map((d) => (
            <div key={d.student?.id} className="p-3.5 flex items-center justify-between">
              <div className="font-semibold text-sm">{d.student?.name}</div>
              <div className="text-xs text-brand font-semibold">{formatMoney(d.total, profile?.currency)}</div>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setOpenSection(openSection === 'gastos' ? null : 'gastos')} className="w-full text-left rounded-2xl bg-amber-950/40 border border-amber-800/40 p-4 flex items-center justify-between mb-2.5">
        <div>
          <div className="text-xs font-bold text-amber-400">Gastos</div>
          <div className="text-[11px] text-amber-300/70">{expenses.length} gastos</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold">{loading ? '–' : formatMoney(totalGastos, profile?.currency)}</span>
          <Chev className={`text-amber-400 transition ${openSection === 'gastos' ? 'rotate-90' : ''}`} size={14} />
        </div>
      </button>

      {openSection === 'gastos' && (
        <div className="card divide-y divide-bg-border mb-4">
          {expenses.length === 0 && <div className="p-4 text-sm text-slate-500 text-center">No cargaste gastos este mes.</div>}
          {expenses.map((e) => (
            <div key={e.id} className="p-3.5 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{e.description}</div>
                <div className="text-xs text-slate-400">{new Date(e.expense_date).toLocaleDateString('es-AR')}</div>
              </div>
              <div className="text-sm font-semibold text-amber-400">{formatMoney(e.amount, e.currency)}</div>
            </div>
          ))}
          <button onClick={() => setShowExpenseForm(true)} className="w-full p-3.5 text-brand font-semibold text-sm flex items-center justify-center gap-1">
            <PlusIcon size={16} /> Agregar gasto (ej: lo que rendís al club)
          </button>
        </div>
      )}

      {showExpenseForm && (
        <ExpenseModal
          currency={profile?.currency}
          onClose={() => setShowExpenseForm(false)}
          onSaved={() => {
            setShowExpenseForm(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function ExpenseModal({ currency, onClose, onSaved }) {
  const { user } = useAuth()
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!description.trim() || !amount) return
    setSaving(true)
    await supabase.from('expenses').insert({
      profesor_id: user.id,
      description: description.trim(),
      amount: Number(amount),
      currency: currency || 'ARS',
      expense_date: date,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-sm rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg">Nuevo gasto</div>
          <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Descripción (ej: Rendición club)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <input className="input" type="number" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button onClick={save} disabled={saving || !description.trim() || !amount} className="btn-primary">Guardar gasto</button>
        </div>
      </div>
    </div>
  )
}
