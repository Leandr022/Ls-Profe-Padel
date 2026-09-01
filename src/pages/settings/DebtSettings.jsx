import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Header from '../../components/Header'

export default function DebtSettings() {
  const { user, profile, refreshProfile } = useAuth()
  const [threshold, setThreshold] = useState(profile?.debt_alert_threshold ?? 50000)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await supabase.from('profiles').update({ debt_alert_threshold: Number(threshold) || 0 }).eq('id', user.id)
    await refreshProfile()
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto px-5 py-6 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Aviso de deuda</h1>
      <p className="text-slate-400 text-sm mb-5">
        En Inicio te avisamos cuando la deuda total de tus alumnos supera este monto.
      </p>

      <div className="card p-4">
        <div className="label-muted mb-2">Monto de aviso</div>
        <div className="flex items-center bg-bg-card border border-bg-border rounded-xl px-3 py-2.5 mb-4">
          <span className="text-slate-500 mr-1">$</span>
          <input
            type="number"
            className="bg-transparent outline-none w-full"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <span className="text-slate-500 ml-2 text-sm">{profile?.currency || 'ARS'}</span>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          Guardar
        </button>
      </div>
    </div>
  )
}
