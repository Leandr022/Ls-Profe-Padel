import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { CURRENCIES } from '../../lib/helpers'
import Header from '../../components/Header'

export default function RatesSettings() {
  const { user, refreshProfile } = useAuth()
  const [rates, setRates] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('rates').select('*').eq('profesor_id', user.id).maybeSingle().then(({ data }) => setRates(data))
  }, [user])

  function update(field, value) {
    setRates((r) => ({ ...r, [field]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    await supabase.from('rates').update({
      currency: rates.currency,
      individual_price: Number(rates.individual_price) || 0,
      duo_price: Number(rates.duo_price) || 0,
      trio_price: Number(rates.trio_price) || 0,
      group4_price: Number(rates.group4_price) || 0,
      monthly_price: Number(rates.monthly_price) || 0,
      updated_at: new Date().toISOString(),
    }).eq('profesor_id', user.id)
    await supabase.from('profiles').update({ currency: rates.currency }).eq('id', user.id)
    await refreshProfile()
    setSaving(false)
    setDirty(false)
  }

  if (!rates) return null

  return (
    <div className="max-w-lg mx-auto px-5 py-6 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Mis tarifas</h1>
      <p className="text-slate-400 text-sm mb-5">Lo que le cobrás a cada alumno según el tamaño del grupo — se usa para armar tu Caja.</p>

      <div className="card p-4">
        <div className="label-muted mb-2">Moneda</div>
        <div className="flex gap-2 mb-5 flex-wrap">
          {CURRENCIES.map((c) => (
            <button key={c} onClick={() => update('currency', c)} className={`pill ${rates.currency === c ? 'bg-white text-slate-900 font-bold' : 'card text-slate-300'}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="label-muted mb-1">Precio por alumno</div>
        <PriceRow label="Individual" value={rates.individual_price} onChange={(v) => update('individual_price', v)} />
        <PriceRow label="Dúo (c/u)" value={rates.duo_price} onChange={(v) => update('duo_price', v)} />
        <PriceRow label="Trío (c/u)" value={rates.trio_price} onChange={(v) => update('trio_price', v)} />
        <PriceRow label="Grupo de 4 (c/u)" value={rates.group4_price} onChange={(v) => update('group4_price', v)} last />

        <div className="label-muted mb-1 mt-4">Tarifa mensual (para alumnos que pagan por mes)</div>
        <PriceRow label="Por mes, venga las veces que venga" value={rates.monthly_price} onChange={(v) => update('monthly_price', v)} last />

        <button onClick={save} disabled={saving || !dirty} className="btn-primary mt-5">
          Guardar tarifas
        </button>
      </div>
    </div>
  )
}

function PriceRow({ label, value, onChange, last }) {
  return (
    <div className={`flex items-center justify-between py-3 ${!last ? 'border-b border-bg-border' : ''}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center bg-bg-card border border-bg-border rounded-xl px-3 py-2 w-32">
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
