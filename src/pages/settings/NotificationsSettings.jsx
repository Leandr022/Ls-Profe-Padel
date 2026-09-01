import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import Header from '../../components/Header'
import Toggle from '../../components/Toggle'

const ITEMS = [
  { key: 'proxima_clase', title: 'Próxima clase', desc: 'Te avisamos 90 minutos antes de que empiece.' },
  { key: 'falta_sin_reemplazo', title: 'Falta sin reemplazo', desc: 'Cuando alguien no viene y todavía no conseguiste quién lo cubra.' },
  { key: 'fichas_incompletas', title: 'Fichas incompletas', desc: 'Cuando se junta un grupo de alumnos sin celular o disponibilidad cargada.' },
  { key: 'pago_pendiente', title: 'Pago pendiente de un alumno', desc: 'Cuando un alumno te debe hace más de 3 días.' },
  { key: 'pago_fallo', title: 'Pago que falló', desc: 'Si no pudimos cobrarte tu plan.' },
  { key: 'prueba_vencer', title: 'Prueba o plan por vencer', desc: 'Unos días antes de que termine tu prueba o se renueve tu plan.' },
  { key: 'resumen_mensual', title: 'Resumen mensual', desc: 'Apenas arranca el mes, con el resumen del anterior.' },
  { key: 'alumnos_sin_avisar', title: 'Alumnos sin avisar', desc: 'A las 20hs, si todavía te queda alguien sin avisar de la clase de mañana.' },
]

export default function NotificationsSettings() {
  const { user } = useAuth()
  const [settings, setSettings] = useState({})
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default')

  useEffect(() => {
    if (!user) return
    supabase.from('notification_settings').select('*').eq('profesor_id', user.id).then(({ data }) => {
      const map = {}
      ;(data || []).forEach((r) => (map[r.key] = r.enabled))
      setSettings(map)
    })
  }, [user])

  async function toggle(key, value) {
    setSettings((s) => ({ ...s, [key]: value }))
    await supabase.from('notification_settings').upsert({ profesor_id: user.id, key, enabled: value })
  }

  async function activateAll() {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const perm = await Notification.requestPermission()
      setNotifPermission(perm)
    }
    const next = {}
    ITEMS.forEach((i) => (next[i.key] = true))
    setSettings(next)
    await supabase.from('notification_settings').upsert(ITEMS.map((i) => ({ profesor_id: user.id, key: i.key, enabled: true })))
  }

  return (
    <div className="max-w-lg mx-auto px-5 py-6 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Notificaciones</h1>
      <p className="text-slate-400 text-sm mb-5">Elegí qué te queremos avisar sin que tengas que abrir la app.</p>

      <div className="space-y-3 mb-6">
        {ITEMS.map((item) => (
          <div key={item.key} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm">{item.title}</div>
              <div className="text-xs text-slate-400 mt-0.5">{item.desc}</div>
            </div>
            <Toggle checked={!!settings[item.key]} onChange={(v) => toggle(item.key, v)} />
          </div>
        ))}
      </div>

      <button onClick={activateAll} className="btn-primary">
        Activar notificaciones
      </button>
    </div>
  )
}
