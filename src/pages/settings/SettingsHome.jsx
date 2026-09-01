import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Header from '../../components/Header'
import { ChevronRight } from '../../components/Icons'
import { planLabel } from '../../lib/plans'

const THEMES = [
  { key: 'auto', label: 'Auto' },
  { key: 'light', label: 'Claro' },
  { key: 'dark', label: 'Oscuro' },
]
const FONTS = [
  { key: 'normal', label: 'Normal' },
  { key: 'large', label: 'Grande' },
  { key: 'xlarge', label: 'Extra grande' },
]

export default function SettingsHome() {
  const { profile, refreshProfile, signOut, user } = useAuth()
  const [name, setName] = useState(profile?.full_name || '')
  const [saving, setSaving] = useState(false)

  async function saveName() {
    setSaving(true)
    await supabase.from('profiles').update({ full_name: name.trim() }).eq('id', user.id)
    await refreshProfile()
    setSaving(false)
  }

  async function updateProfile(fields) {
    await supabase.from('profiles').update(fields).eq('id', user.id)
    await refreshProfile()
  }

  const trialDaysLeft = profile
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(profile.trial_started_at).getTime()) / 86400000))
    : 30

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-16 fade-in">
      <Header backTo="/" backLabel="Inicio" />
      <h1 className="text-xl font-extrabold mb-4">Configuración</h1>

      <Section title="Cuenta">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-brand text-slate-900 flex items-center justify-center font-extrabold text-lg">
            {(profile?.full_name || 'P').charAt(0).toUpperCase()}
          </div>
          <div className="font-semibold">{profile?.full_name || 'Profe'}</div>
        </div>
        <div className="label-muted mb-1">Tu nombre</div>
        <div className="flex gap-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre..." />
          {name !== (profile?.full_name || '') && (
            <button onClick={saveName} disabled={saving} className="btn-secondary shrink-0">Guardar</button>
          )}
        </div>
        <div className="text-xs text-slate-500 mt-2">{profile?.email}</div>
      </Section>

      <SettingsLink to="/configuracion/horarios" title="Mis horarios" desc="Configurá tu semana laboral: qué días das clases y en qué franjas." />
      <SettingsLink to="/configuracion/tarifas" title="Mis tarifas" desc="Configurá cuánto le cobrás a cada alumno, según el tamaño del grupo." />
      <SettingsLink to="/configuracion/deuda" title="Aviso de deuda" desc={`En Inicio te avisamos cuando la deuda total pasa los ${profile?.debt_alert_threshold ?? 50000} ${profile?.currency || 'ARS'}.`} />
      <SettingsLink to="/configuracion/mensajes" title="Mis mensajes" desc="Configurá los WhatsApp que la app te arma solo: recordatorios, invitaciones a cubrir un hueco y reconquista." />

      <Section title="Diseño">
        <div className="label-muted mb-1.5">Tema</div>
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {THEMES.map((t) => (
            <button key={t.key} onClick={() => updateProfile({ theme: t.key })} className={`py-2 rounded-full text-xs font-semibold ${profile?.theme === t.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="label-muted mb-1.5">Tamaño de letra</div>
        <div className="grid grid-cols-3 gap-1.5">
          {FONTS.map((f) => (
            <button key={f.key} onClick={() => updateProfile({ font_size: f.key })} className={`py-2 rounded-full text-xs font-semibold ${profile?.font_size === f.key ? 'bg-brand text-slate-900' : 'card text-slate-300'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </Section>

      <SettingsLink to="/configuracion/notificaciones" title="Notificaciones" desc="Elegí qué te queremos avisar sin que tengas que abrir la app." actionLabel="Entrar" />

      <SettingsLink
        to="/configuracion/plan"
        title="Mi plan"
        desc={profile?.plan ? `Plan ${planLabel(profile.plan) || profile.plan}.` : `Te quedan ${trialDaysLeft} días de prueba gratuita.`}
        actionLabel={profile?.plan ? 'Cambiar' : 'Elegir plan'}
      />

      <Section title="Soporte">
        <div className="font-semibold text-sm">Contactanos</div>
        <a href="mailto:leandro.santagada@icloud.com" className="text-xs text-slate-400">leandro.santagada@icloud.com</a>
      </Section>

      <Section title="Novedades">
        <a href="https://instagram.com/Ls-Profe-Padel" target="_blank" rel="noreferrer" className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Todo lo nuevo, primero en Instagram</div>
            <div className="text-xs text-slate-400">@Ls-Profe-Padel</div>
          </div>
          <ChevronRight className="text-slate-500" />
        </a>
      </Section>

      <Section title="Legal">
        <div className="space-y-3">
          <div className="font-semibold text-sm">Términos y condiciones</div>
          <div className="font-semibold text-sm">Política de privacidad</div>
        </div>
      </Section>

      <button onClick={signOut} className="w-full rounded-full bg-red-950/50 border border-red-800/40 text-red-400 font-bold py-3.5 mt-4">
        Cerrar sesión
      </button>
      <div className="text-center text-xs text-slate-600 mt-4">ProfePadel · versión beta</div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card p-4 mb-3">
      <div className="label-muted mb-2">{title}</div>
      {children}
    </div>
  )
}

function SettingsLink({ to, title, desc, actionLabel = 'Editar' }) {
  return (
    <Link to={to} className="card p-4 mb-3 flex items-center justify-between gap-3">
      <div>
        <div className="label-muted mb-1">{title}</div>
        <div className="text-sm text-slate-300">{desc}</div>
      </div>
      <span className="text-xs font-bold text-brand bg-brand/10 px-3 py-1.5 rounded-full shrink-0">{actionLabel} →</span>
    </Link>
  )
}
