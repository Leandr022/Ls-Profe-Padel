import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PLANS, CURRENCY_LABELS } from '../../lib/plans'
import { getAccessStatus } from '../../lib/access'
import { formatMoneyShort } from '../../lib/helpers'
import Header from '../../components/Header'

export default function PlanSettings() {
  const { user, profile } = useAuth()
  const location = useLocation()
  const [selected, setSelected] = useState(profile?.plan || 'trimestral')
  const [payingKey, setPayingKey] = useState(null)
  const [payError, setPayError] = useState('')

  const access = getAccessStatus(profile)
  const currency = profile?.currency || 'ARS'
  const currencyLabel = CURRENCY_LABELS[currency] || currency

  const params = new URLSearchParams(location.search)
  const pago = params.get('pago')

  async function pagar(planKey) {
    setPayError('')
    setPayingKey(planKey)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/mp-create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planKey }),
      })
      const data = await res.json()
      if (!res.ok || !data.init_point) throw new Error(data.error || 'No se pudo iniciar el pago.')
      window.location.href = data.init_point
    } catch (err) {
      setPayError(err.message || 'No se pudo iniciar el pago. Probá de nuevo.')
      setPayingKey(null)
    }
  }

  if (profile?.unlimited_access) {
    return (
      <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-10 fade-in">
        <Header backTo="/configuracion" backLabel="Configuración" />
        <h1 className="text-xl font-extrabold mb-0.5">Mi plan</h1>
        <div className="card p-4 mt-4 bg-brand/10 border-brand/30 text-center">
          <div className="text-2xl mb-1">✨</div>
          <div className="font-bold">Acceso ilimitado</div>
          <p className="text-sm text-slate-400 mt-1">Esta cuenta es la del dueño de ProfePadel — no tiene vencimiento ni límite de plan.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-10 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Elegí tu plan</h1>

      {location.state?.blocked && (
        <div className="card p-3 mb-4 bg-red-950/40 border-red-800/40 text-red-400 text-sm font-semibold text-center">
          {access.source === 'trial' ? 'Tu prueba gratuita terminó.' : 'Tu plan venció.'} Elegí uno para seguir usando ProfePadel.
        </div>
      )}

      {pago === 'exito' && (
        <div className="card p-3 mb-4 bg-brand/10 border-brand/30 text-brand text-sm font-semibold text-center">
          ¡Pago recibido! Puede tardar unos segundos en activarse — si no ves tu plan actualizado, volvé a entrar a esta pantalla.
        </div>
      )}
      {pago === 'pendiente' && (
        <div className="card p-3 mb-4 bg-amber-500/10 border-amber-500/30 text-amber-400 text-sm font-semibold text-center">
          Tu pago está pendiente de confirmación. Te activamos el plan apenas se acredite.
        </div>
      )}
      {pago === 'error' && (
        <div className="card p-3 mb-4 bg-red-950/40 border-red-800/40 text-red-400 text-sm font-semibold text-center">
          El pago no se completó. Podés volver a intentarlo cuando quieras.
        </div>
      )}

      <p className="text-slate-400 text-sm mb-5">
        {profile?.plan
          ? access.daysLeft > 0
            ? `Plan ${PLANS.find((p) => p.key === profile.plan)?.label || profile.plan} — te quedan ${access.daysLeft} día${access.daysLeft === 1 ? '' : 's'}.`
            : `Tu plan ${PLANS.find((p) => p.key === profile.plan)?.label || profile.plan} venció.`
          : `Estás en la prueba gratuita — te quedan ${Math.max(0, access.daysLeft)} días.`}
      </p>

      <div className="card p-3 mb-4 bg-amber-500/10 border-amber-500/30 text-amber-400 text-sm font-semibold text-center">
        🎉 Oferta de lanzamiento — precios especiales por tiempo limitado
      </div>

      {payError && <div className="text-xs text-red-400 font-medium mb-3 text-center">{payError}</div>}

      <div className="space-y-3 mb-3">
        {PLANS.map((p) => (
          <div
            key={p.key}
            className={`rounded-2xl border p-4 relative transition ${
              p.highlight ? 'bg-brand/10 border-brand' : selected === p.key ? 'border-brand bg-bg-panel' : 'border-bg-border bg-bg-panel'
            }`}
          >
            {p.tag && (
              <span className="absolute -top-2.5 left-4 text-[10px] font-bold uppercase bg-brand text-slate-900 px-2 py-0.5 rounded-full">
                ★ {p.tag}
              </span>
            )}
            <button onClick={() => setSelected(p.key)} className="w-full text-left flex items-start gap-3">
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
            </button>
            {selected === p.key && (
              <button onClick={() => pagar(p.key)} disabled={payingKey !== null} className="btn-primary w-full mt-3">
                {payingKey === p.key ? 'Abriendo Mercado Pago...' : profile?.plan === p.key ? 'Renovar con Mercado Pago →' : 'Pagar con Mercado Pago →'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="card p-4 mb-4">
        <div className="font-bold">Personalizado</div>
        <div className="text-xs text-slate-400 mb-3">Para academias y clubes con múltiples profesores.</div>
        <a href="mailto:leandro.santagada@icloud.com?subject=Plan personalizado ProfePadel" className="btn-secondary block text-center">
          Contáctanos
        </a>
      </div>

      <div className="text-center text-xs text-slate-600 mt-3">{currencyLabel} · pago seguro con Mercado Pago</div>
    </div>
  )
}
