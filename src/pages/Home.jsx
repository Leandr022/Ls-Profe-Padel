import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { formatMoney, toISODate, waLink, fillTemplate } from '../lib/helpers'
import { CalendarIcon, ChevronRight, SettingsIcon, WhatsAppIcon, CloseIcon } from '../components/Icons'

export default function Home() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ classesToday: 0, gain: 0, students: 0 })
  const [debtInfo, setDebtInfo] = useState({ debtors: 0, total: 0 })
  const [tomorrowClasses, setTomorrowClasses] = useState([])
  const [templates, setTemplates] = useState({})
  const [showTomorrowModal, setShowTomorrowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const unnotified = tomorrowClasses.filter((c) => !c.notified).length

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const today = new Date()
      const iso = toISODate(today)
      const monthStart = toISODate(new Date(today.getFullYear(), today.getMonth(), 1))
      const monthEnd = toISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0))

      const [{ data: todayClasses }, { data: payments }, { data: expenses }, { count: students }, { data: pendingClasses }, { data: tomorrow }, { data: tpl }] =
        await Promise.all([
          supabase
            .from('classes')
            .select('start_time')
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
            .select('id, student_id, notified, start_time, students(name, phone)')
            .eq('profesor_id', user.id)
            .eq('class_date', toISODate(new Date(today.getTime() + 86400000)))
            .not('student_id', 'is', null)
            .not('status', 'eq', 'cancelled')
            .order('start_time'),
          supabase.from('message_templates').select('*').eq('profesor_id', user.id).eq('key', 'recordatorio'),
        ])

      if (cancelled) return
      // "Clases hoy" cuenta horarios únicos (una clase de a 2 no son "2 clases") — no filas.
      const classesToday = new Set((todayClasses || []).map((c) => c.start_time)).size
      const gain = (payments || []).reduce((s, p) => s + Number(p.amount), 0) - (expenses || []).reduce((s, e) => s + Number(e.amount), 0)
      const debtTotal = (pendingClasses || []).reduce((s, c) => s + Number(c.price || 0), 0)
      const debtorsSet = new Set((pendingClasses || []).map((c) => c.student_id))

      setStats({ classesToday, gain, students: students || 0 })
      setDebtInfo({ debtors: debtorsSet.size, total: debtTotal })
      setTomorrowClasses(tomorrow || [])
      setTemplates({ recordatorio: tpl?.[0]?.template || '' })
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  async function markNotified(classId) {
    await supabase.from('classes').update({ notified: true }).eq('id', classId)
    setTomorrowClasses((prev) => prev.map((c) => (c.id === classId ? { ...c, notified: true } : c)))
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Profe'
  const todayLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1.5 font-extrabold text-lg">
          <img src="/logo.png" alt="" className="w-6 h-6 rounded-full object-cover" />
          <span>LsPadel<span className="text-brand">Pro</span></span>
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
            <button
              onClick={() => setShowTomorrowModal(true)}
              className="w-full rounded-xl bg-brand/10 border border-brand/30 text-brand text-sm font-semibold text-center py-3 px-4"
            >
              Avisar a {unnotified} alumno{unnotified > 1 ? 's' : ''} de mañana →
            </button>
          )}
        </div>
      )}

      {showTomorrowModal && (
        <TomorrowModal
          classes={tomorrowClasses}
          template={templates.recordatorio}
          onMarkNotified={markNotified}
          onClose={() => setShowTomorrowModal(false)}
        />
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

function TomorrowModal({ classes, template, onMarkNotified, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-sm max-h-[85vh] overflow-y-auto rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="font-bold text-lg">¿Les avisamos de mañana?</div>
          <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
        </div>
        <p className="text-xs text-slate-500 mb-4">Tocá WhatsApp junto a cada uno — en el orden que quieras.</p>

        <div className="space-y-2.5 mb-4">
          {classes.length === 0 && <div className="text-sm text-slate-500 text-center py-4">No tenés clases cargadas para mañana.</div>}
          {classes.map((c) => (
            <div key={c.id} className="rounded-xl bg-bg-card border border-bg-border px-3.5 py-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{c.students?.name || 'Alumno'}</div>
                <div className="text-xs text-slate-500">{c.start_time?.slice(0, 5)}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {c.students?.phone ? (
                  <a
                    href={waLink(c.students.phone, fillTemplate(template || 'Hola {nombre}! Te espero mañana a las {hora}.', { nombre: c.students.name, hora: c.start_time?.slice(0, 5) || '' }))}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => onMarkNotified(c.id)}
                    className="btn-secondary flex items-center gap-1.5 text-brand text-xs px-3 py-1.5"
                  >
                    <WhatsAppIcon size={14} /> Avisar
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-600">Sin teléfono</span>
                )}
                {!c.notified ? (
                  <button onClick={() => onMarkNotified(c.id)} className="text-[11px] text-slate-500 underline decoration-dotted">Ya le avisé</button>
                ) : (
                  <span className="text-[11px] text-brand font-semibold">Ya avisado ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="btn-secondary w-full">Cerrar</button>
      </div>
    </div>
  )
}
