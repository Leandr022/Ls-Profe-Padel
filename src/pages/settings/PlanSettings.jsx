import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PLANS, CURRENCY_LABELS } from '../../lib/plans'
import { formatMoneyShort } from '../../lib/helpers'
import Header from '../../components/Header'

export default function PlanSettings() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState(profile?.plan || 'trimestral')
  const [saving, setSaving] = useState(false)

  const trialDaysLeft = profile
    ? Math.max(0, 30 - Math.floor((Date.now() - new Date(profile.trial_started_at).getTime()) / 86400000))
    : 30
  const currency = profile?.currency || 'ARS'
  const currencyLabel = CURRENCY_LABELS[currency] || currency

  async function confirm() {
    setSaving(true)
    await supabase.from('profiles').update({ plan: selected, plan_selected_at: new Date().toISOString() }).eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    navigate('/configuracion')
  }

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-10 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Elegí tu plan</h1>
      <p className="text-slate-400 text-sm mb-5">
        {profile?.plan ? `Tu plan actual: ${PLANS.find((p) => p.key === profile.plan)?.label || profile.plan}.` : `Estás en la prueba gratuita — te quedan ${trialDaysLeft} días.`}
      </p>

      <div className="card p-3 mb-4 bg-amber-500/10 border-amber-500/30 text-amber-400 text-sm font-semibold text-center">
        🎉 Oferta de lanzamiento — precios especiales por tiempo limitado
      </div>

      <div className="space-y-3 mb-3">
        {PLANS.map((p) => (
          <button
            key={p.key}
            onClick={() => setSelected(p.key)}
            className={`w-full text-left rounded-2xl border p-4 relative transition ${
              p.highlight
                ? 'bg-brand/10 border-brand'
                : selected === p.key
                  ? 'border-brand bg-bg-panel'
                  : 'border-bg-border bg-bg-panel'
            }`}
          >
            {p.tag && (
              <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase bg-brand text-slate-900 px-2 py-0.5 rounded-full">
                ★ {p.tag}
              </span>
            )}
            <div className="flex items-start gap-3">
              <span className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 ${selected === p.key ? 'border-brand bg-brand' : 'border-slate-500'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{p.label}</span>
                  {p.badge && <span className="text-[10px] font-bold bg-bg-card border border-bg-border px-1.5 py-0.5 rounded">{p.badge}</span>}
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-slate-500 line-through text-sm">{formatMoneyShort(p.originalPrice)}</span>
                  <span className="text-xl font-extrabold">{formatMoneyShort(p.price)}</span>
                  <span className="text-xs text-slate-400">{p.period}</span>
                </div>
                {p.perMonth && <div className="text-xs text-slate-500 mt-0.5">equivale a {formatMoneyShort(p.perMonth)}/mes</div>}
                {p.savingsVsMonthly && (
                  <div className="text-xs text-brand font-semibold mt-0.5">
                    Ahorrás {formatMoneyShort(p.savingsVsMonthly)} respecto al plan Mensual ({formatMoneyShort(PLANS[0].price)}/mes)
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <div className="font-bold">Personalizado</div>
        <div className="text-xs text-slate-400 mb-3">Para academias y clubes con múltiples profesores.</div>
        <a href="mailto:leandro.santagada@icloud.com?subject=Plan personalizado ProfePadel" className="btn-secondary block text-center">
          Contáctanos
        </a>
      </div>

      <button onClick={confirm} disabled={saving} className="btn-primary">
        Confirmar y continuar →
      </button>
      <div className="text-center text-xs text-slate-600 mt-3">{currencyLabel}</div>
    </div>
  )
}
