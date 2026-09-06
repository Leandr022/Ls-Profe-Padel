import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { fillTemplate, MESSAGE_DEFAULTS } from '../../lib/helpers'
import Header from '../../components/Header'
import { ChevronDown } from '../../components/Icons'

const SECTIONS = [
  {
    key: 'recordatorio',
    title: 'Recordatorio de clase',
    desc: 'Al alumno que ya viene, para avisarle el horario',
    hint: 'Escribí [nombre], [fecha] y [hora] tal cual, entre corchetes — la app los cambia sola por el dato real de cada alumno y clase.',
    sample: { nombre: 'Juan', fecha: 'el lunes 27/7', hora: '18:00' },
  },
  {
    key: 'invitacion_hueco',
    title: 'Invitación a cubrir un hueco',
    desc: 'A un alumno activo, cuando falta alguien',
    hint: 'Escribí [nombre], [dia] y [hora] tal cual, entre corchetes — la app los cambia sola por el dato real de cada alumno y clase.',
    sample: { nombre: 'Juan', dia: 'El viernes', hora: '19:00' },
  },
  {
    key: 'reconquista',
    title: 'Reconquista',
    desc: 'A alguien que dejó de venir',
    hint: 'Escribí [nombre] y [hueco] tal cual, entre corchetes. [hueco] se completa solo con el horario libre cuando corresponde, y queda vacío en una invitación general.',
    sample: { nombre: 'Juan', hueco: '' },
  },
  {
    key: 'cancelacion',
    title: 'Cancelación de clase',
    desc: 'Para avisarle a un alumno que su clase no va',
    hint: 'Escribí [nombre], [dia] y [hora] tal cual, entre corchetes — la app los cambia sola por el dato real de cada alumno y clase.',
    sample: { nombre: 'Juan', dia: 'lunes', hora: '18:00' },
  },
]

const COBRO_SUBS = [
  {
    key: 'cobro_mensual',
    title: 'Mensual',
    sample: { nombre: 'Juan', periodo: 'septiembre', alias: 'juan.perez.mp', importe: '$20.000 ARS' },
  },
  {
    key: 'cobro_clase',
    title: 'Una clase',
    sample: { nombre: 'Juan', fecha: 'lunes 27/7', alias: 'juan.perez.mp', importe: '$3.500 ARS' },
  },
  {
    key: 'cobro_pendiente',
    title: 'Varias clases / total pendiente',
    sample: { nombre: 'Juan', alias: 'juan.perez.mp', importe: '$10.500 ARS' },
  },
]

const ALL_KEYS = [...SECTIONS.map((s) => s.key), ...COBRO_SUBS.map((s) => s.key)]

export default function MessagesSettings() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState({})
  const [openKey, setOpenKey] = useState('recordatorio')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('message_templates').select('*').eq('profesor_id', user.id).then(({ data }) => {
      const map = { ...MESSAGE_DEFAULTS }
      ;(data || []).forEach((t) => (map[t.key] = t.template))
      setTemplates(map)
      setLoading(false)
    })
  }, [user])

  function setValue(key, value) {
    setSaved(false)
    setTemplates((t) => ({ ...t, [key]: value }))
  }

  function resetToDefault(key) {
    setValue(key, MESSAGE_DEFAULTS[key])
  }

  function isCustom(key) {
    return (templates[key] ?? '') !== MESSAGE_DEFAULTS[key]
  }

  async function saveAll() {
    setSaving(true)
    const rows = ALL_KEYS.map((key) => ({ profesor_id: user.id, key, template: templates[key] ?? MESSAGE_DEFAULTS[key] }))
    await supabase.from('message_templates').upsert(rows, { onConflict: 'profesor_id,key' })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 pb-28 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Mis mensajes</h1>
      <p className="text-slate-400 text-sm mb-5">Así se arman los WhatsApp que la app te arma solos. Tocá una plantilla para editarla.</p>

      {!loading && (
        <div className="card divide-y divide-bg-border mb-4">
          {SECTIONS.map((s) => (
            <MessageAccordion
              key={s.key}
              section={s}
              value={templates[s.key] ?? ''}
              isOpen={openKey === s.key}
              isCustom={isCustom(s.key)}
              onToggle={() => setOpenKey(openKey === s.key ? null : s.key)}
              onChange={(v) => setValue(s.key, v)}
              onReset={() => resetToDefault(s.key)}
            />
          ))}

          <div>
            <button onClick={() => setOpenKey(openKey === 'cobros' ? null : 'cobros')} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
              <span className="flex-1">
                <span className="font-semibold block">Cobros</span>
                <span className="text-xs text-slate-500">Para pasar tu alias y cobrar por WhatsApp</span>
              </span>
              <ChevronDown className={`text-slate-500 transition shrink-0 ${openKey === 'cobros' ? 'rotate-180' : ''}`} />
            </button>
            {openKey === 'cobros' && (
              <div className="px-4 pb-4">
                <p className="text-xs text-slate-500 mb-3">
                  Escribí [nombre], [alias] e [importe] tal cual, entre corchetes — la app los completa sola. [periodo] y [fecha] se usan solo en su plantilla correspondiente.
                </p>
                <div className="space-y-4">
                  {COBRO_SUBS.map((s) => (
                    <div key={s.key}>
                      <div className="text-sm font-bold mb-1.5">{s.title}</div>
                      <MessageEditor
                        value={templates[s.key] ?? ''}
                        isCustom={isCustom(s.key)}
                        sample={s.sample}
                        onChange={(v) => setValue(s.key, v)}
                        onReset={() => resetToDefault(s.key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg/95 backdrop-blur-sm border-t border-bg-border">
        <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto">
          <button onClick={saveAll} disabled={saving || loading} className="btn-primary">
            {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar mensajes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageAccordion({ section, value, isOpen, isCustom, onToggle, onChange, onReset }) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
        <span className="flex-1">
          <span className="font-semibold flex items-center gap-1.5">
            {section.title}
            {isCustom && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
          </span>
          <span className="text-xs text-slate-500">{section.desc}</span>
        </span>
        <ChevronDown className={`text-slate-500 transition shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          <p className="text-xs text-slate-500 mb-3">{section.hint}</p>
          <MessageEditor value={value} isCustom={isCustom} sample={section.sample} onChange={onChange} onReset={onReset} />
        </div>
      )}
    </div>
  )
}

function MessageEditor({ value, isCustom, sample, onChange, onReset }) {
  return (
    <div>
      <textarea
        className="input min-h-24 focus:border-brand"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {isCustom && (
        <button onClick={onReset} className="text-xs text-slate-500 underline decoration-dotted mt-1.5">
          Restaurar original
        </button>
      )}
      <div className="label-muted mt-3 mb-1.5">Así lo va a recibir</div>
      <div className="wa-bubble">{fillTemplate(value, sample)}</div>
    </div>
  )
}
