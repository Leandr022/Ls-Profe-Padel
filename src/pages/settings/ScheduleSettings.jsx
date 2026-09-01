import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { DAY_NAMES, DAY_NAMES_FULL } from '../../lib/helpers'
import Header from '../../components/Header'
import { ChevronRight, PlusIcon, CloseIcon } from '../../components/Icons'

export default function ScheduleSettings() {
  const { user } = useAuth()
  const [workingDays, setWorkingDays] = useState({}) // {0: true, ...}
  const [defaultSlots, setDefaultSlots] = useState([{ start: '08:00', end: '16:30' }])
  const [customByDay, setCustomByDay] = useState({}) // {dayIdx: [{start,end}]}
  const [editingDay, setEditingDay] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!user) return
    setLoading(true)
    const [{ data: wd }, { data: sl }] = await Promise.all([
      supabase.from('working_days').select('*').eq('profesor_id', user.id),
      supabase.from('schedule_slots').select('*').eq('profesor_id', user.id),
    ])
    const wdMap = {}
    ;(wd || []).forEach((r) => (wdMap[r.day_of_week] = r.enabled))
    setWorkingDays(wdMap)

    const defaults = (sl || []).filter((s) => s.day_of_week === null).map((s) => ({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) }))
    setDefaultSlots(defaults.length ? defaults : [{ start: '08:00', end: '16:30' }])

    const custom = {}
    ;(sl || []).filter((s) => s.day_of_week !== null).forEach((s) => {
      if (!custom[s.day_of_week]) custom[s.day_of_week] = []
      custom[s.day_of_week].push({ start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })
    })
    setCustomByDay(custom)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [user])

  function toggleDay(idx) {
    setWorkingDays((w) => ({ ...w, [idx]: !w[idx] }))
  }

  async function saveAll() {
    setSaving(true)
    await supabase.from('working_days').delete().eq('profesor_id', user.id)
    await supabase.from('working_days').insert(
      Array.from({ length: 7 }, (_, i) => ({ profesor_id: user.id, day_of_week: i, enabled: !!workingDays[i] })),
    )

    await supabase.from('schedule_slots').delete().eq('profesor_id', user.id)
    const rows = []
    defaultSlots.forEach((s) => rows.push({ profesor_id: user.id, day_of_week: null, start_time: s.start, end_time: s.end }))
    Object.entries(customByDay).forEach(([day, slots]) => {
      slots.forEach((s) => rows.push({ profesor_id: user.id, day_of_week: Number(day), start_time: s.start, end_time: s.end }))
    })
    if (rows.length) await supabase.from('schedule_slots').insert(rows)
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto px-5 py-6 pb-10 fade-in">
      <Header backTo="/configuracion" backLabel="Configuración" />
      <h1 className="text-xl font-extrabold mb-0.5">Mis horarios</h1>
      <p className="text-slate-400 text-sm mb-5">Tu semana laboral, configurada una sola vez</p>

      <div className="card p-4 mb-3">
        <div className="label-muted mb-3">Días de clases</div>
        <div className="grid grid-cols-4 gap-2">
          {DAY_NAMES.concat('Dom').map((d, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`py-2.5 rounded-full text-sm font-semibold transition ${workingDays[i] ? 'bg-white text-slate-900' : 'bg-bg-card text-slate-500 border border-bg-border'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="card p-4 mb-3">
        <div className="label-muted mb-1">Horario habitual</div>
        <p className="text-xs text-slate-500 mb-3">Vale para todos tus días de clases, salvo los que tengan horario distinto abajo.</p>
        <SlotEditor slots={defaultSlots} onChange={setDefaultSlots} />
      </div>

      <div className="card p-4 mb-3">
        <div className="label-muted mb-1">Personalizar por día</div>
        <p className="text-xs text-slate-500 mb-3">¿Un día trabajás distinto? Dale su horario sin tocar el resto.</p>
        <div className="divide-y divide-bg-border -mx-4">
          {DAY_NAMES_FULL.map((d, i) => {
            const custom = customByDay[i]
            return (
              <button key={i} onClick={() => setEditingDay(i)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <span className="font-bold text-sm">{d}</span>
                <span className="flex items-center gap-1 text-xs">
                  {custom?.length ? (
                    <span className="text-brand font-semibold">distinto: {custom.map((s) => `${s.start}–${s.end}`).join(' · ')}</span>
                  ) : (
                    <span className="text-slate-500">horario habitual</span>
                  )}
                  <ChevronRight size={14} className="text-slate-500" />
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <button onClick={saveAll} disabled={saving} className="btn-primary">
        Guardar mis horarios
      </button>

      {editingDay !== null && (
        <DayEditorModal
          dayIdx={editingDay}
          slots={customByDay[editingDay] || []}
          onClose={() => setEditingDay(null)}
          onChange={(slots) => setCustomByDay((c) => ({ ...c, [editingDay]: slots }))}
        />
      )}
    </div>
  )
}

function SlotEditor({ slots, onChange }) {
  function update(i, field, value) {
    const next = [...slots]
    next[i] = { ...next[i], [field]: value }
    onChange(next)
  }
  function remove(i) {
    onChange(slots.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...slots, { start: '08:00', end: '12:00' }])
  }

  return (
    <div className="space-y-2">
      {slots.map((s, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">De:</span>
          <input type="time" className="input" value={s.start} onChange={(e) => update(i, 'start', e.target.value)} />
          <span className="text-slate-500">hasta:</span>
          <input type="time" className="input" value={s.end} onChange={(e) => update(i, 'end', e.target.value)} />
          {slots.length > 1 && (
            <button onClick={() => remove(i)} className="text-red-400 shrink-0"><CloseIcon size={14} /></button>
          )}
        </div>
      ))}
      <button onClick={add} className="text-brand text-xs font-semibold flex items-center gap-1">
        <PlusIcon size={14} /> Agregar otra franja (ej: la tarde)
      </button>
    </div>
  )
}

function DayEditorModal({ dayIdx, slots, onClose, onChange }) {
  const [local, setLocal] = useState(slots.length ? slots : [{ start: '08:00', end: '16:30' }])
  const [useCustom, setUseCustom] = useState(slots.length > 0)

  function save() {
    onChange(useCustom ? local : [])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full sm:max-w-md rounded-b-none sm:rounded-2xl p-5 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-lg">{DAY_NAMES_FULL[dayIdx]}</div>
          <button onClick={onClose} className="text-slate-400"><CloseIcon /></button>
        </div>
        <div className="flex items-center justify-between card p-3 mb-4">
          <span className="text-sm font-medium">Usar horario distinto este día</span>
          <button
            onClick={() => setUseCustom((v) => !v)}
            className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${useCustom ? 'bg-brand text-slate-900' : 'card text-slate-400'}`}
          >
            {useCustom ? 'Sí' : 'No'}
          </button>
        </div>
        {useCustom && <SlotEditor slots={local} onChange={setLocal} />}
        <button onClick={save} className="btn-primary mt-4">Guardar</button>
      </div>
    </div>
  )
}
