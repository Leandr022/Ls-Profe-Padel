import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CURRENCIES } from '../../lib/helpers'
import Header from '../../components/Header'

const ROWS = [
  { key: 'individual', label: 'Individual', count: 1 },
  { key: 'duo', label: 'Dúo (c/u)', count: 2 },
  { key: 'trio', label: 'Trío (c/u)', count: 3 },
  { key: 'group4', label: 'Grupo de 4 (c/u)', count: 4 },
]
const ALL_FIELDS = ['individual_price', 'duo_price', 'trio_price', 'group4_price', 'monthly_price', 'individual_commission', 'duo_commission', 'trio_commission', 'group4_commission', 'monthly_commission']
const EMPTY_PRICES = Object.fromEntries(ALL_FIELDS.map((f) => [f, 0]))

export default function RatesSettings() {
  const { user, profile, refreshProfile } = useAuth()
  const [currency, setCurrency] = useState(null)
  const [pricesByCurrency, setPricesByCurrency] = useState({})
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [alias, setAlias] = useState(profile?.payment_alias || '')
  const [cbu, setCbu] = useState(profile?.payment_cbu_cvu || '')
  const [savingCobro, setSavingCobro] = useState(false)
  const cobroDirty = alias !== (profile?.payment_alias || '') || cbu !== (profile?.payment_cbu_cvu || '')

  useEffect(() => {
    setAlias(profile?.payment_alias || '')
    setCbu(profile?.payment_cbu_cvu || '')
  }, [profile?.payment_alias, profile?.payment_cbu_cvu])

  useEffect(() => {
    if (!user) return
    supabase
      .from('rates')
      .select('*')
      .eq('profesor_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return
        setCurrency(data.currency)
        const currentPrices = {}
        ALL_FIELDS.forEach((f) => (currentPrices[f] = data[f] ?? 0))
        setPricesByCurrency({
          ...(data.prices_by_currency || {}),
          [data.currency]: currentPrices,
        })
      })
  }, [user])

  function update(field, value) {
    setPricesByCurrency((p) => ({
      ...p,
      [currency]: { ...(p[currency] || EMPTY_PRICES), [field]: value },
    }))
    setDirty(true)
  }

  function switchCurrency(c) {
    setCurrency(c)
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    const active = pricesByCurrency[currency] || EMPTY_PRICES
    const normalized = {}
    ALL_FIELDS.forEach((f) => (normalized[f] = Number(active[f]) || 0))
    const updatedByCurrency = { ...pricesByCurrency, [currency]: normalized }

    await supabase
      .from('rates')
      .update({
        currency,
        ...normalized,
        prices_by_currency: updatedByCurrency,
        updated_at: new Date().toISOString(),
      })
      .eq('profesor_id', user.id)
    await supabase.from('profiles').update({ currency }).eq('id', user.id)
    await refreshProfile()
    setPricesByCurrency(updatedByCurrency)
    setSaving(false)
    setDirty(false)
  }

  async function saveCobro() {
    setSavingCobro(true)
    await supabase.from('profiles').update({ payment_alias: alias.trim() || null, payment_cbu_cvu: cbu.trim() || null }).eq('id', user.id)
    await refreshProfile()
    setSavingCobro(false)
  }

  if (!currency) return null
  const active = pricesByCurrency[currency] || EMPTY_PRICES

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Mis tarifas</h1>
      <p className="text-slate-400 text-sm mb-5">Lo que le cobrás a cada alumno y lo que le dejás al club por cada clase — se usa para armar tu Caja.</p>

      <div className="card p-4">
        <div className="label-muted mb-2">Moneda</div>
        <div className="flex gap-2 mb-2 flex-wrap">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => switchCurrency(c)}
              className={`pill ${currency === c ? 'bg-brand text-slate-900 font-bold' : 'card text-slate-300'}`}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 mb-5">
          Cada moneda tiene sus propios precios y comisiones — cambiá aquí entre {CURRENCIES.join(' / ')} sin que se mezclen los valores.
        </p>

        <div className="label-muted mb-1">Precio por alumno y comisión al club</div>
        <p className="text-xs text-slate-500 mb-3">Cargá lo que le cobrás al alumno y, si le rendís algo al club por cada clase, cuánto es — te queda calculado lo que ganás vos.</p>
        {ROWS.map((r, i) => (
          <PriceCommissionRow
            key={r.key}
            label={r.label}
            count={r.count}
            price={active[`${r.key}_price`]}
            commission={active[`${r.key}_commission`]}
            onPriceChange={(v) => update(`${r.key}_price`, v)}
            onCommissionChange={(v) => update(`${r.key}_commission`, v)}
            currency={currency}
            last={i === ROWS.length - 1}
          />
        ))}

        <div className="label-muted mb-1 mt-4">Tarifa mensual (para alumnos que pagan por mes)</div>
        <PriceCommissionRow
          label="Por mes, venga las veces que venga"
          count={1}
          price={active.monthly_price}
          commission={active.monthly_commission}
          onPriceChange={(v) => update('monthly_price', v)}
          onCommissionChange={(v) => update('monthly_commission', v)}
          currency={currency}
          last
        />

        <button onClick={save} disabled={saving || !dirty} className="btn-primary mt-5">
          Guardar tarifas en {currency}
        </button>
      </div>

      <div className="card p-4 mt-4">
        <div className="label-muted mb-1">Datos para cobros</div>
        <p className="text-xs text-slate-500 mb-3">
          Se usan en los mensajes de "Aviso de deuda" (Mis mensajes) para que el alumno tenga a mano dónde transferirte. Si los dejás vacíos, esos mensajes van con [Tu alias] / [Tu CBU/CVU] para que los completes vos antes de enviar.
        </p>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Alias de tu billetera virtual (opcional)</div>
            <input className="input" placeholder="tu.alias.mp" value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">CBU o CVU (opcional)</div>
            <input className="input" placeholder="0000003100000000000000" value={cbu} onChange={(e) => setCbu(e.target.value)} />
          </div>
          <button onClick={saveCobro} disabled={savingCobro || !cobroDirty} className="btn-secondary">
            Guardar datos de cobro
          </button>
        </div>
      </div>
    </div>
  )
}

function PriceCommissionRow({ label, count = 1, price, commission, onPriceChange, onCommissionChange, currency, last }) {
  const total = (Number(price) || 0) * count
  const neto = total - (Number(commission) || 0)
  return (
    <div className={`py-3 ${!last ? 'border-b border-bg-border' : ''}`}>
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="Tarifa al alumno" value={price} onChange={onPriceChange} />
        <MiniInput label="Comisión al club" value={commission} onChange={onCommissionChange} />
      </div>
      {Number(price) > 0 && (
        <div className="text-[11px] text-slate-500 mt-1.5">
          {count > 1 && (
            <>Clase completa <span className="text-slate-300 font-semibold">${total.toLocaleString('es-AR')} {currency}</span> ({count} x ${Number(price).toLocaleString('es-AR')}) · </>
          )}
          Te queda <span className="text-brand font-semibold">${neto.toLocaleString('es-AR')} {currency}</span> por clase
        </div>
      )}
    </div>
  )
}

function MiniInput({ label, value, onChange }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-slate-500 mb-1">{label}</div>
      <div className="flex items-center bg-bg-card border border-bg-border rounded-xl px-3 py-2">
        <span className="text-slate-500 mr-1">$</span>
        <input
          type="number"
          className="bg-transparent outline-none w-full text-right"
          value={value ?? 0}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}
