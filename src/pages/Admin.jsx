import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { planLabel } from '../lib/plans'
import { getAccessStatus } from '../lib/access'
import Header from '../components/Header'

// Panel solo visible para vos (unlimited_access = true). Muestra todos los profes que se
// registraron en Ls-PadelPro: en qué estado de acceso están (prueba, plan activo, vencido)
// y hace de "quién estaría contratando el servicio".
export default function Admin() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('todos') // todos | pagando | prueba | vencido

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProfiles((data || []).filter((p) => p.id !== user.id))
        setLoading(false)
      })
  }, [user])

  const rows = useMemo(() => {
    return profiles.map((p) => ({ profile: p, access: getAccessStatus(p) }))
  }, [profiles])

  const filtered = rows.filter(({ profile, access }) => {
    if (filter === 'todos') return true
    if (filter === 'pagando') return access.source === 'plan' && !access.blocked
    if (filter === 'prueba') return access.source === 'trial' && !access.blocked
    if (filter === 'vencido') return access.blocked
    return true
  })

  const counts = {
    pagando: rows.filter((r) => r.access.source === 'plan' && !r.access.blocked).length,
    prueba: rows.filter((r) => r.access.source === 'trial' && !r.access.blocked).length,
    vencido: rows.filter((r) => r.access.blocked).length,
  }

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-16 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Profes registrados</h1>
      <p className="text-slate-400 text-sm mb-5">
        Todos los que se crearon una cuenta en Ls-PadelPro, con su estado de acceso actual.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatTile value={counts.pagando} label="Con plan activo" color="text-brand" />
        <StatTile value={counts.prueba} label="En prueba" color="text-amber-400" />
        <StatTile value={counts.vencido} label="Vencidos" color="text-red-400" />
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {[
          { key: 'todos', label: `Todos (${rows.length})` },
          { key: 'pagando', label: `Con plan (${counts.pagando})` },
          { key: 'prueba', label: `Prueba (${counts.prueba})` },
          { key: 'vencido', label: `Vencidos (${counts.vencido})` },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold ${filter === f.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center text-slate-500 text-sm py-8">Cargando...</div>}

      {!loading && filtered.length === 0 && (
        <div className="card p-6 text-center text-slate-500 text-sm">No hay nadie en esta categoría todavía.</div>
      )}

      <div className="space-y-2.5">
        {filtered.map(({ profile, access }) => (
          <ProfileRow key={profile.id} profile={profile} access={access} />
        ))}
      </div>
    </div>
  )
}

function StatTile({ value, label, color }) {
  return (
    <div className="card p-3 text-center">
      <div className={`text-xl font-extrabold ${color}`}>{value}</div>
      <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function ProfileRow({ profile, access }) {
  const registered = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  let statusLabel = ''
  let statusClass = ''
  if (access.blocked) {
    statusLabel = access.source === 'plan' ? 'Plan vencido' : 'Prueba vencida'
    statusClass = 'bg-red-950/40 border-red-800/40 text-red-400'
  } else if (access.source === 'plan') {
    statusLabel = `Plan ${planLabel(profile.plan) || profile.plan} · ${access.daysLeft} día${access.daysLeft === 1 ? '' : 's'}`
    statusClass = 'bg-brand/10 border-brand/30 text-brand'
  } else {
    statusLabel = `Prueba · ${Math.max(0, access.daysLeft)} día${access.daysLeft === 1 ? '' : 's'}`
    statusClass = 'bg-amber-500/10 border-amber-500/30 text-amber-400'
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-sm truncate">{profile.full_name || 'Sin nombre'}</div>
          <div className="text-xs text-slate-400 truncate">{profile.email}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Se registró el {registered}</div>
        </div>
        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      {profile.last_payment_id && (
        <div className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-bg-border">
          Último pago (Mercado Pago): #{profile.last_payment_id}
        </div>
      )}
    </div>
  )
}
