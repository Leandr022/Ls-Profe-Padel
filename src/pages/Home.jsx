import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, toISODate } from '../lib/helpers'
import { CalendarIcon, ChevronRight, SettingsIcon } from '../components/Icons'

export default function Home() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ classesToday: 0, gain: 0, students: 0 })
  const [debtInfo, setDebtInfo] = useState({ debtors: 0, total: 0 })
  const [unnotified, setUnnotified] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const today = new Date()
      const iso = toISODate(today)
      const monthStart = toISODate(new Date(today.getFullYear(), today.getMonth(), 1))
      const monthEnd = toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0))

      const [{ count: classesToday }, { data: payments }, { data: expenses }, { count: students }, { data: pendingClasses }, { data: tomorrowClasses }] =
        await Promise.all([
          supabase
            .from('classes')
            .select('id', { count: 'exact', head: true })
            .eq('profesor_id', user.id)
            .eq('class_date', iso)
            .not('status', 'eq', 'cancelled'),
          supabase.from('payments').select('amount').eq('profesor_id', user.id).gte('paid_at', monthStart).lte('paid_at', monthEnd + 'T23:59:59'),
          supabase.from('expenses').select('amount').eq('profesor_id', user.id).gte('expense_date', monthStart).lte('expense_date', monthEnd),
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('profesor_id', user.id).eq('status', 'active'),
          supabase
            .from('classes')
            .select('id, price, paid, student_id')
            .eq('profesor_id', user.id)
            .eq('paid', false)
            .not('student_id', 'is', null)
            .lte('class_date', iso),
          supabase
            .from('classes')
            .select('id, student_id, notified, students(name)')
            .eq('profesor_id', user.id)
            .eq('class_date', toISODate(new Date(today.getTime() + 86400000)))
            .not('student_id', 'is', null),
        ])

      if (cancelled) return
      const gain = (payments || []).reduce((s, p) => s + Number(p.amount), 0) - (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
      const debtTotal = (pendingClasses || []).reduce((s, c) => s + Number(c.price || 0), 0)
      const debtorsSet = new Set((pendingClasses || []).map((c) => c.student_id))

      setStats({ classesToday: classesToday || 0, gain, students: students || 0 })
      setDebtInfo({ debtors: debtorsSet.size, total: debtTotal })
      setUnnotified((tomorrowClasses || []).filter((c) => !c.notified).length)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const firstName = profile?.full_name?.split(' ')[0] || 'Profe'
  const todayLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-lg mx-auto px-5 py-6 fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1.5 font-extrabold text-lg">
          <img src="/logo.png" alt="" className="w-6 h-6 rounded-full object-cover" />
          <span>Profe<span className="text-brand">Padel</span></span>
        </div>
        <Link to="/configuracion" className="btn-secondary p-2.5 rounded-full">
          <SettingsIcon />
        </Link>
      </div>

      <h1 className="text-2xl font-extrabold">Hola, {firstName}</h1>
      <p className="text-slate-400 text-sm mb-5 capitalize">{todayLabel}</p>

      <div className="label-muted mb-2">Tu día</div>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-brand">{loading ? '–' : stats.classesToday}</div>
          <div className="text-[11px] text-slate-400 mt-1">CLASES HOY</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-lg font-extrabold text-brand">{loading ? '–' : formatMoney(stats.gain, profile?.currency)}</div>
          <div className="text-[11px] text-slate-400 mt-1">GANANCIA ESTE MES</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-extrabold text-brand">{loading ? '–' : stats.students}</div>
          <div className="text-[11px] text-slate-400 mt-1">ALUMNOS</div>
        </div>
      </div>

      {!loading && stats.classesToday === 0 && (
        <p className="text-center text-sm text-slate-400 mb-4">
          Hoy no tenés clases cargadas. Tocá Panel Profe para armar tu semana.
        </p>
      )}

      <Link to="/panel/alumnos" className="btn-secondary w-full flex items-center justify-center gap-1 mb-4 py-3">
        ¿Quién no viene? →
      </Link>

      {!loading && (
        <div className="space-y-2 mb-6">
          {debtInfo.debtors === 0 ? (
            <div className="rounded-xl bg-brand/10 border border-brand/30 text-brand text-sm font-semibold text-center py-3 px-4">
              Estás al día con los cobros.
            </div>
          ) : (
            <Link
              to="/panel/caja"
              className="block rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold text-center py-3 px-4"
            >
              {debtInfo.debtors} alumno{debtInfo.debtors > 1 ? 's' : ''} te debe{debtInfo.debtors > 1 ? 'n' : ''} {formatMoney(debtInfo.total, profile?.currency)} →
            </Link>
          )}
          {unnotified === 0 ? (
            <div className="rounded-xl bg-brand/10 border border-brand/30 text-brand text-sm font-semibold text-center py-3 px-4">
              No tenés a quién avisar →
            </div>
          ) : (
            <Link
              to="/panel/calendario"
              className="block rounded-xl bg-brand/10 border border-brand/30 text-brand text-sm font-semibold text-center py-3 px-4"
            >
              Avisar a {unnotified} alumno{unnotified > 1 ? 's' : ''} de mañana →
            </Link>
          )}
        </div>
      )}

      <div className="label-muted mb-2">Secciones</div>
      <div className="space-y-3">
        <Link to="/panel" className="card block p-4 bg-gradient-to-br from-brand/15 to-transparent border-brand/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center text-brand">
              <CalendarIcon />
            </div>
            <div className="flex-1">
              <div className="font-bold text-brand">Panel Profe</div>
              <div className="text-xs text-slate-400">Tu semana: clases, alumnos y cobros</div>
            </div>
            <ChevronRight className="text-brand" />
          </div>
        </Link>

        <div className="card p-4 flex items-center gap-3 opacity-80">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">▶</div>
          <div className="flex-1">
            <div className="font-bold">Cómo usar la app</div>
            <div className="text-xs text-slate-400">En menos de 2 minutos</div>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3 opacity-50">
          <div className="flex-1">
            <div className="font-bold">Reservas</div>
            <div className="text-xs text-slate-400">Gestioná tus canchas</div>
          </div>
          <span className="text-[10px] font-bold uppercase bg-white/10 px-2 py-1 rounded-full">Próximamente</span>
        </div>

        <div className="card p-4 flex items-center gap-3 opacity-50">
          <div className="flex-1">
            <div className="font-bold">Torneos</div>
            <div className="text-xs text-slate-400">Armá torneos internos</div>
          </div>
          <span className="text-[10px] font-bold uppercase bg-white/10 px-2 py-1 rounded-full">Próximamente</span>
        </div>
      </div>
    </div>
  )
}
