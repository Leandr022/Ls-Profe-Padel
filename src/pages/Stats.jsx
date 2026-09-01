import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, toISODate } from '../lib/helpers'
import Header from '../components/Header'
import { CashIcon, ChartIcon, UsersIcon, WarningIcon, ChevronRight } from '../components/Icons'

async function monthTotals(userId, monthStart, monthEnd) {
  const [{ data: classes }, { data: expenses } ] = await Promise.all([
    supabase
      .from('classes')
      .select('price, paid, student_id, status')
      .eq('profesor_id', userId)
      .gte('class_date', toISODate(monthStart))
      .lte('class_date', toISODate(monthEnd))
      .not('student_id', 'is', null)
      .not('status', 'eq', 'cancelled'),
    supabase.from('expenses').select('amount').eq('profesor_id', userId).gte('expense_date', toISODate(monthStart)).lte('expense_date', toISODate(monthEnd)),
  ])
  const facturado = (classes || []).reduce((s, c) => s + Number(c.price || 0), 0)
  const pendiente = (classes || []).filter((c) => !c.paid).reduce((s, c) => s + Number(c.price || 0), 0)
  const gastos = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
  const done = (classes || []).filter((c) => c.status !== 'absent').length
  const students = new Set((classes || []).map((c) => c.student_id)).size
  return { facturado, pendiente, gastos, ganancia: facturado - gastos, clases: done, students }
}

export default function Stats() {
  const { user, profile } = useAuth()
  const [current, setCurrent] = useState(null)
  const [previous, setPrevious] = useState(null)
  const [attention, setAttention] = useState({ cooling: [], debtors: [] })
  const [showAttention, setShowAttention] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const now = new Date()
      const curStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const curEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0)

      const [cur, prev, { data: cooling }, { data: debtClasses }] = await Promise.all([
        monthTotals(user.id, curStart, curEnd),
        monthTotals(user.id, prevStart, prevEnd),
        supabase.from('students').select('id, name').eq('profesor_id', user.id).eq('status', 'cooling'),
        supabase
          .from('classes')
          .select('student_id, students(name)')
          .eq('profesor_id', user.id)
          .eq('paid', false)
          .not('student_id', 'is', null)
          .lte('class_date', toISODate(now)),
      ])
      if (cancelled) return
      const debtorNames = [...new Map((debtClasses || []).map((c) => [c.student_id, c.students?.name])).values()]
      setCurrent(cur)
      setPrevious(prev)
      setAttention({ cooling: cooling || [], debtors: debtorNames })
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const diff = current && previous ? current.ganancia - previous.ganancia : 0
  const diffLabel = loading
    ? ''
    : diff === 0
      ? '= igual que el mes pasado a esta altura'
      : diff > 0
        ? `▲ ${formatMoney(diff, profile?.currency)} más que el mes pasado`
        : `▼ ${formatMoney(Math.abs(diff), profile?.currency)} menos que el mes pasado`

  const attentionCount = attention.cooling.length + attention.debtors.length

  return (
    <div className="max-w-lg mx-auto px-5 py-6 fade-in">
      <Header backTo="/panel" backLabel="Panel" />
      <h1 className="text-xl font-extrabold mb-0.5">Estadísticas</h1>
      <p className="text-slate-400 text-sm mb-5">Cómo viene el mes, comparado con el que elijas</p>

      <div className="card p-5 mb-3 bg-gradient-to-br from-brand/10 to-transparent border-brand/20">
        <div className="w-8 h-1 rounded-full bg-brand mb-3" />
        <div className="label-muted text-brand mb-1">Ganancia del mes</div>
        <div className="text-3xl font-extrabold">{loading ? '–' : formatMoney(current?.ganancia, profile?.currency)}</div>
        <div className="text-xs text-slate-500 mt-1">{diffLabel}</div>
      </div>

      <div className="card divide-y divide-bg-border mb-4">
        <Row icon={<CashIcon />} label="Facturado" value={loading ? '–' : formatMoney(current?.facturado, profile?.currency)} />
        <Row icon={<CashIcon />} label="Pendiente" value={loading ? '–' : formatMoney(current?.pendiente, profile?.currency)} />
        <Row icon={<UsersIcon />} label="Neto x alumno" value={loading ? '–' : formatMoney(current?.students ? current.ganancia / current.students : 0, profile?.currency)} />
        <Row icon={<ChartIcon />} label="Clases dadas" value={loading ? '–' : current?.clases} />
        <button onClick={() => setShowAttention((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center"><WarningIcon size={16} /></span>
          <span className="flex-1 font-semibold">Atención</span>
          {attentionCount > 0 && <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{attentionCount}</span>}
          <ChevronRight className={`text-slate-500 transition ${showAttention ? 'rotate-90' : ''}`} />
        </button>
        {showAttention && (
          <div className="px-4 pb-4 space-y-2">
            {attentionCount === 0 && <div className="text-sm text-slate-500">Todo en orden por ahora.</div>}
            {attention.debtors.map((n, i) => (
              <div key={'d' + i} className="text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {n} tiene un pago pendiente
              </div>
            ))}
            {attention.cooling.map((s) => (
              <div key={s.id} className="text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {s.name} se está enfriando
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center">{icon}</span>
      <span className="flex-1 font-semibold">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  )
}
