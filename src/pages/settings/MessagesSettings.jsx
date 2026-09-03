import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Header from '../../components/Header'

const ITEMS = [
  { key: 'recordatorio', title: 'Recordatorio de clase', desc: 'Se envía antes de cada clase.', vars: '{nombre} {hora}' },
  { key: 'deuda', title: 'Aviso de pago pendiente', desc: 'Para avisarle a un alumno que te debe. {alias} y {cbu} se completan solos con lo que cargaste en Mis tarifas.', vars: '{nombre} {monto} {alias} {cbu}' },
  { key: 'invitacion_hueco', title: 'Invitación a cubrir un hueco', desc: 'Para ofrecerle un hueco libre a un alumno.', vars: '{nombre} {dia} {hora}' },
  { key: 'cancelacion', title: 'Aviso de cancelación de clase', desc: 'Para avisarle a un alumno que su clase no va, por el motivo que sea.', vars: '{nombre} {dia} {hora}' },
  { key: 'reconquista', title: 'Reconquista', desc: 'Para alumnos que dejaron de venir.', vars: '{nombre}' },
]

export default function MessagesSettings() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState({})
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('message_templates').select('*').eq('profesor_id', user.id).then(({ data }) => {
      const map = {}
      ;(data || []).forEach((t) => (map[t.key] = t.template))
      setTemplates(map)
    })
  }, [user])

  async function save(key) {
    setSaving(key)
    await supabase.from('message_templates').upsert({ profesor_id: user.id, key, template: templates[key] })
    setSaving(null)
  }

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Mis mensajes</h1>
      <p className="text-slate-400 text-sm mb-5">
        Configurá los WhatsApp que la app te arma sola: recordatorios, avisos de deuda, cancelaciones, invitaciones a cubrir un hueco y reconquista. Usá las variables entre llaves para personalizar cada envío.
      </p>

      <div className="space-y-4">
        {ITEMS.map((item) => (
          <div key={item.key} className="card p-4">
            <div className="font-bold text-sm">{item.title}</div>
            <div className="text-xs text-slate-400 mb-2">{item.desc} · Variables: {item.vars}</div>
            <textarea
              className="input min-h-24"
              value={templates[item.key] || ''}
              onChange={(e) => setTemplates((t) => ({ ...t, [item.key]: e.target.value }))}
            />
            <button
              onClick={() => save(item.key)}
              disabled={saving === item.key}
              className="btn-secondary mt-2 text-xs"
            >
              Guardar mensaje
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
