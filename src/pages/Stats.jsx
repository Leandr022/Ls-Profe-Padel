import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, monthLabel, toISODate, isClassFinished, sizeKeyFor, groupSizeLabel } from '../lib/helpers'
import Header from '../components/Header'
import { CashIcon, ChartIcon, UsersIcon, WarningIcon, ChevronDown, TrophyIcon, CheckCircleIcon } from '../components/Icons'

const BREAKDOWN_SIZES = ['individual', 'duo', 'trio', 'grupo4']

async function monthTotals(userId, monthStart, monthEnd) {
  const [{ data: rawClasses }, { data: expenses }] = await Promise.all([
    supabase
      .from('classes')
      .select('price, commission, paid, student_id, status, class_date, start_time, end_time, students(name)')
      .eq('profesor_id', userId)
      .gte('class_date', toISODate(monthStart))
      .lte('class_date', toISODate(monthEnd))
      .not('student_id', 'is', null)
      .not('status', 'eq', 'cancelled'),
    supabase.from('expenses').select('amount').eq('profesor_id', userId).gte('expense_date', toISODate(monthStart)).lte('expense_date', toISODate(monthEnd)),
  ])
  // Solo cuenta lo que ya terminó — nada de clases agendadas a futuro dentro del mes.
  const classes = (rawClasses || []).filter((c) => isClassFinished(c))

  const facturado = classes.reduce((s, c) => s + Number(c.price || 0), 0)
  const comisionClub = classes.reduce((s, c) => s + Number(c.commission || 0), 0)
  const pendiente = classes.filter((c) => !c.paid).reduce((s, c) => s + Number(c.price || 0), 0)
  const gastos = (expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0)
  const done = classes.filter((c) => c.status !== 'absent')
  const students = new Set(done.map((c) => c.student_id)).size
  // "Clases dadas" cuenta clases reales (día+horario únicos), no una vez por cada alumno anotado
  // — un dúo son 2 filas pero 1 sola clase.
  const clasesDadas = new Set(done.map((c) => `${c.class_date}_${c.start_time}`)).size

  const countByStudent = new Map()
  done.forEach((c) => {
    const key = c.student_id
    const entry = countByStudent.get(key) || { name: c.students?.name || 'Alumno', count: 0 }
    entry.count += 1
    countByStudent.set(key, entry)
  })
  const top = [...countByStudent.values()].sort((a, b) => b.count - a.count)

  // Guía de clases por tamaño de grupo: cuántos alumnos (filas) pagaron individual/dúo/trío/grupo
  // de 4, y cuánto facturaron entre todos — según cuánta gente compartía ese mismo día y horario.
  const sizeByDateTime = {}
  classes.forEach((c) => {
    const key = `${c.class_date}_${c.start_time}`
    sizeByDateTime[key] = (sizeByDateTime[key] || 0) + 1
  })
  const breakdown = Object.fromEntries(BREAKDOWN_SIZES.map((s) => [s, { count: 0, amount: 0, classes: [] }]))
  classes.forEach((c) => {
    const key = `${c.class_date}_${c.start_time}`
    const size = sizeKeyFor(sizeByDateTime[key] || 1)
    breakdown[size].count += 1
    breakdown[size].amount += Number(c.price || 0)
    breakdown[size].classes.push({
      id: `${c.class_date}_${c.start_time}_${c.student_id}`,
      name: c.students?.name || 'Alumno',
      class_date: c.class_date,
      start_time: c.start_time,
      price: c.price,
    })
  })
  BREAKDOWN_SIZES.forEach((s) => {
    breakdown[s].classes.sort((a, b) => (a.class_date + a.start_time).localeCompare(b.class_date + b.start_time))
  })

  return { facturado, comisionClub, pendiente, gastos, ganancia: facturado - comisionClub - gastos, clases: clasesDadas, students, top, breakdown }
}

function monthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return [start, end]
}

export default function Stats() {
  const { user, profile } = useAuth()
  const [current, setCurrent] = useState(null)
  const [compareMonth, setCompareMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() - 1, 1)
  })
  const [compareTotals, setCompareTotals] = useState(null)
  const [attention, setAttention] = useState({ cooling: [], debtors: [] })
  const [showAttention, setShowAttention] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [newStudents, setNewStudents] = useState(0)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 1; i <= 12; i++) {
      opts.push(new Date(now.getFullYear(), now.getMonth() - i, 1))
    }
    return opts
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const [curStart, curEnd] = monthRange(now)
      const [cmpStart, cmpEnd] = monthRange(compareMonth)

      const [cur, cmp, { data: cooling }, { data: debtClasses }, { count: newCount }] = await Promise.all([
        monthTotals(user.id, curStart, curEnd),
        monthTotals(user.id, cmpStart, cmpEnd),
        supabase.from('students').select('id, name').eq('profesor_id', user.id).eq('status', 'cooling'),
        supabase
          .from('classes')
          .select('student_id, class_date, start_time, end_time, students(name)')
          .eq('profesor_id', user.id)
          .eq('paid', false)
          .not('student_id', 'is', null)
          .lte('class_date', toISODate(now)),
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('profesor_id', user.id)
          .gte('created_at', curStart.toISOString())
          .lte('created_at', new Date().toISOString()),
      ])
      if (cancelled) return
      const finishedDebt = (debtClasses || []).filter((c) => isClassFinished(c))
      const debtorNames = [...new Map(finishedDebt.map((c) => [c.student_id, c.students?.name])).values()]
      setCurrent(cur)
      setCompareTotals(cmp)
      setAttention({ cooling: cooling || [], debtors: debtorNames })
      setNewStudents(newCount || 0)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user, compareMonth])

  const diff = current && compareTotals ? current.ganancia - compareTotals.ganancia : 0
  const diffLabel = loading
    ? ''
    : diff === 0
      ? `= igual que ${monthLabel(compareMonth).toLowerCase()} a esta altura`
      : diff > 0
        ? `▲ ${formatMoney(diff, profile?.currency)} más que ${monthLabel(compareMonth).toLowerCase()}`
        : `▼ ${formatMoney(Math.abs(diff), profile?.currency)} menos que ${monthLabel(compareMonth).toLowerCase()}`

  const attentionCount = attention.cooling.length + attention.debtors.length
  const breakdownTotal = BREAKDOWN_SIZES.reduce((s, size) => s + (current?.breakdown?.[size]?.count || 0), 0)

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 fade-in">
      <Header backTo="/panel" backLabel="Panel" />
      <h1 className="text-xl font-extrabold mb-0.5">Estadísticas</h1>
      <p className="text-slate-400 text-sm mb-5">Cómo viene el mes, comparado con el que elijas</p>

      <button onClick={() => setShowSummary(true)} className="w-full card p-4 mb-4 bg-brand/10 border-brand/30 flex items-start gap-3 text-left">
        <span className="w-8 h-8 rounded-lg bg-brand/20 text-brand flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircleIcon size={18} />
        </span>
        <div className="flex-1">
          <div className="font-bold text-brand text-sm">Tu resumen de {monthLabel(now).split(' ')[0]} ya está listo</div>
          <div className="text-xs text-slate-400 mt-0.5">Facturación, alumnos nuevos, gastos — todo junto, para ver de un vistazo cómo te fue.</div>
        </div>
        <span className="text-brand shrink-0 mt-1">→</span>
      </button>

      {showSummary && (
        <MonthSummaryModal
          current={current}
          newStudents={newStudents}
          loading={loading}
          currency={profile?.currency}
          monthName={monthLabel(now)}
          onClose={() => setShowSummary(false)}
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-400">Comparar con</span>
        <select
          className="input w-auto"
          value={toISODate(compareMonth)}
          onChange={(e) => setCompareMonth(new Date(e.target.value + 'T12:00:00'))}
        >
          {monthOptions.map((m) => (
            <option key={toISODate(m)} value={toISODate(m)}>{monthLabel(m)}</option>
          ))}
        </select>
      </div>

      <div className="card p-5 mb-3 bg-gradient-to-br from-brand/10 via-brand-2/5 to-transparent border-brand/20">
        <div className="w-8 h-1 rounded-full bar-gradient mb-3" />
        <div className="label-muted text-brand mb-1">Ganancia del mes</div>
        <div className="text-3xl font-extrabold text-gradient">{loading ? '–' : formatMoney(current?.ganancia, profile?.currency)}</div>
        <div className="text-xs text-slate-500 mt-1">{diffLabel}</div>
      </div>

      <div className="card divide-y divide-bg-border mb-4">
        <Row icon={<CashIcon />} label="Facturado" value={loading ? '–' : formatMoney(current?.facturado, profile?.currency)} />
        {current?.comisionClub > 0 && (
          <Row icon={<CashIcon />} label="Comisión al club" value={loading ? '–' : `− ${formatMoney(current?.comisionClub, profile?.currency)}`} />
        )}
        <Row icon={<CashIcon />} label="Pendiente" value={loading ? '–' : formatMoney(current?.pendiente, profile?.currency)} />
        <Row icon={<UsersIcon />} label="Neto x alumno" value={loading ? '–' : formatMoney(current?.students ? current.ganancia / current.students : 0, profile?.currency)} />
        <Row icon={<ChartIcon />} label="Clases dadas" value={loading ? '–' : current?.clases} />

        <button onClick={() => setShowAttention((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <span className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center"><WarningIcon size={16} /></span>
          <span className="flex-1 font-semibold">Atención</span>
          {attentionCount > 0 && <span className="text-xs font-bold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{attentionCount}</span>}
          <ChevronDown className={`text-slate-500 transition ${showAttention ? 'rotate-180' : ''}`} />
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

        <button onClick={() => setShowTop((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <span className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center"><TrophyIcon size={16} /></span>
          <span className="flex-1">
            <span className="font-semibold block">Top asistencia</span>
            <span className="text-xs text-slate-500">{monthLabel(compareMonth)}</span>
          </span>
          <ChevronDown className={`text-slate-500 transition ${showTop ? 'rotate-180' : ''}`} />
        </button>
        {showTop && (
          <div className="px-4 pb-4">
            <p className="text-xs text-slate-500 mb-3">Ranking completo de asistencia — ideal para premiar a quien más vino al terminar el mes.</p>
            {loading && <div className="text-sm text-slate-500">Cargando...</div>}
            {!loading && (compareTotals?.top || []).length === 0 && (
              <div className="text-sm text-slate-500">Sin clases registradas ese mes.</div>
            )}
            {!loading && (compareTotals?.top || []).length > 0 && (
              <RankingList ranking={compareTotals.top} />
            )}
          </div>
        )}

        <button onClick={() => setShowBreakdown((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
          <span className="w-8 h-8 rounded-lg bg-brand/15 text-brand flex items-center justify-center"><ChartIcon size={16} /></span>
          <span className="flex-1 font-semibold">Guía de clases (individual, dúo, trío, grupo de 4)</span>
          {breakdownTotal > 0 && <span className="text-xs font-bold bg-brand/15 text-brand px-2 py-0.5 rounded-full">{breakdownTotal}</span>}
          <ChevronDown className={`text-slate-500 transition ${showBreakdown ? 'rotate-180' : ''}`} />
        </button>
        {showBreakdown && (
          <div className="px-4 pb-4">
            <p className="text-xs text-slate-500 mb-3">
              La cantidad es de alumnos que pagaron una clase de ese tamaño — si en una clase de 4 vinieron 4, esos 4 cuentan acá en "Grupo de 4".
            </p>
            {loading && <div className="text-sm text-slate-500">Cargando...</div>}
            {!loading && breakdownTotal === 0 && <div className="text-sm text-slate-500">Sin clases finalizadas todavía este mes.</div>}
            {!loading && breakdownTotal > 0 && (
              <BreakdownList breakdown={current?.breakdown} total={breakdownTotal} currency={profile?.currency} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const MEDAL_STYLES = [
  { badge: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950', bar: 'bg-gradient-to-r from-amber-300 to-amber-500', label: '🥇' },
  { badge: 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900', bar: 'bg-gradient-to-r from-slate-300 to-slate-400', label: '🥈' },
  { badge: 'bg-gradient-to-br from-orange-400 to-amber-700 text-amber-950', bar: 'bg-gradient-to-r from-orange-400 to-amber-700', label: '🥉' },
]

function RankingList({ ranking }) {
  const [showAll, setShowAll] = useState(false)
  const podium = ranking.slice(0, 3)
  const rest = ranking.slice(3)
  const maxCount = Math.max(1, ranking[0]?.count || 1)

  return (
    <div>
      {podium.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[podium[1], podium[0], podium[2]].map((s, i) =>
            s ? (
              <div
                key={s.name + i}
                className={`rounded-xl bg-bg-card border border-bg-border px-2 py-3 text-center flex flex-col items-center gap-1.5 ${i === 1 ? '-mt-2' : ''}`}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0 ${MEDAL_STYLES[i === 1 ? 0 : i === 0 ? 1 : 2].badge}`}>
                  {MEDAL_STYLES[i === 1 ? 0 : i === 0 ? 1 : 2].label}
                </span>
                <span className="text-xs font-semibold leading-tight break-words">{s.name}</span>
                <span className="text-[11px] text-slate-400">{s.count} clase{s.count !== 1 ? 's' : ''}</span>
              </div>
            ) : (
              <div key={'empty' + i} />
            )
          )}
        </div>
      )}

      {rest.length > 0 && (
        <>
          <div className="space-y-2">
            {(showAll ? rest : rest.slice(0, 5)).map((s, i) => (
              <div key={s.name + i} className="text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-violet-500/15 text-violet-400 text-[10px] font-bold flex items-center justify-center">{i + 4}</span>
                    {s.name}
                  </span>
                  <span className="text-slate-400">{s.count} clase{s.count !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-1 rounded-full bg-bg-card overflow-hidden ml-7">
                  <div className="h-full rounded-full bar-gradient" style={{ width: `${Math.max(4, (s.count / maxCount) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          {rest.length > 5 && (
            <button onClick={() => setShowAll((v) => !v)} className="text-xs text-brand font-semibold mt-3">
              {showAll ? 'Ver menos' : `Ver ranking completo (${rest.length - 5} más)`}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function BreakdownList({ breakdown, total, currency }) {
  const [openSize, setOpenSize] = useState(null)
  const maxAmount = Math.max(1, ...Object.values(breakdown || {}).map((b) => b.amount))

  function formatClassDate(iso) {
    const d = new Date(`${iso}T00:00:00`)
    const text = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  return (
    <div className="space-y-3">
      {BREAKDOWN_SIZES.map((size) => {
        const b = breakdown?.[size] || { count: 0, amount: 0, classes: [] }
        if (b.count === 0) return null
        const isOpen = openSize === size
        return (
          <div key={size}>
            <button onClick={() => setOpenSize(isOpen ? null : size)} className="w-full text-left">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-semibold flex items-center gap-1">
                  {groupSizeLabel(size)} <ChevronDown size={12} className={`text-slate-500 transition ${isOpen ? 'rotate-180' : '-rotate-90'}`} />
                </span>
                <span className="text-slate-400">{formatMoney(b.amount, currency)} · {b.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-card overflow-hidden">
                <div className="h-full rounded-full bar-gradient" style={{ width: `${Math.max(4, (b.amount / maxAmount) * 100)}%` }} />
              </div>
            </button>
            {isOpen && (
              <div className="mt-2 space-y-1.5">
                {b.classes.map((c) => (
                  <div key={c.id} className="rounded-xl bg-bg-card border border-bg-border px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-slate-500"> — {formatClassDate(c.class_date)} · {c.start_time?.slice(0, 5)}</span>
                    </span>
                    <span className="text-slate-400 font-semibold shrink-0">{formatMoney(c.price, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MonthSummaryModal({ current, newStudents, loading, currency, monthName, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="font-bold text-lg">Resumen de {monthName}</div>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">✕</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Facturación, alumnos nuevos y gastos, todo junto.</p>

        <div className="rounded-2xl bg-gradient-to-br from-brand/15 via-brand-2/8 to-transparent border border-brand/20 p-4 mb-3">
          <div className="label-muted text-brand mb-1">Ganancia del mes</div>
          <div className="text-2xl font-extrabold text-gradient">{loading ? '–' : formatMoney(current?.ganancia, currency)}</div>
        </div>

        <div className="card divide-y divide-bg-border mb-3">
          <SummaryRow label="Facturado" value={loading ? '–' : formatMoney(current?.facturado, currency)} />
          {current?.comisionClub > 0 && (
            <SummaryRow label="Comisión al club" value={loading ? '–' : `− ${formatMoney(current?.comisionClub, currency)}`} />
          )}
          <SummaryRow label="Pendiente de cobro" value={loading ? '–' : formatMoney(current?.pendiente, currency)} />
          <SummaryRow label="Gastos" value={loading ? '–' : formatMoney(current?.gastos, currency)} />
          <SummaryRow label="Clases dadas" value={loading ? '–' : current?.clases} />
          <SummaryRow label="Alumnos activos" value={loading ? '–' : current?.students} />
          <SummaryRow label="Alumnos nuevos" value={loading ? '–' : newStudents} />
        </div>

        <button onClick={onClose} className="btn-secondary w-full">Cerrar</button>
      </div>
    </div>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold">{value}</span>
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
