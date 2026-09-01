import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { DAY_NAMES, DAY_NAMES_FULL, timeSlots } from '../../lib/helpers'
import Header from '../../components/Header'
import { ChevronRight, PlusIcon, CloseIcon } from '../../components/Icons'

export default function ScheduleSettings() {
  const { user } = useAuth()
  const [workingDays, setWorkingDays] = useState({}) // {0: true, ...}
  const [defaultTimes, setDefaultTimes] = useState([]) // ['08:00', '09:30', ...]
  const [customByDay, setCustomByDay] = useState({}) // {dayIdx: ['08:00', ...]}
  const [editingDay, setEditingDay] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!user) return
    const [{ data: wd }, { data: sl }] = await Promise.all([
      supabase.from('working_days').select('*').eq('profesor_id', user.id),
      supabase.from('schedule_slots').select('*').eq('profesor_id', user.id),
    ])
    const wdMap = {}
    ;(wd || []).forEach((r) => (wdMap[r.day_of_week] = r.enabled))
    setWorkingDays(wdMap)

    const defaults = [...new Set((sl || []).filter((s) => s.day_of_week === null).map((s) => s.start_time.slice(0, 5)))].sort()
    setDefaultTimes(defaults)

    const custom = {}
    ;(sl || []).filter((s) => s.day_of_week !== null).forEach((s) => {
      if (!custom[s.day_of_week]) custom[s.day_of_week] = []
      custom[s.day_of_week].push(s.start_time.slice(0, 5))
    })
    Object.keys(custom).forEach((k) => custom[k].sort())
    setCustomByDay(custom)
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
    defaultTimes.forEach((t) => rows.push({ profesor_id: user.id, day_of_week: null, start_time: t, end_time: t }))
    Object.entries(customByDay).forEach(([day, times]) => {
      times.forEach((t) => rows.push({ profesor_id: user.id, day_of_week: Number(day), start_time: t, end_time: t }))
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
        <div className="label-muted mb-1">Horarios habituales</div>
        <p className="text-xs text-slate-500 mb-3">Los horarios exactos en los que das clase. Valen para todos tus días de clases, salvo los que personalices abajo.</p>
        <TimeListEditor times={defaultTimes} onChange={setDefaultTimes} />
      </div>

      <div className="card p-4 mb-3">
        <div className="label-muted mb-1">Personalizar por día</div>
        <p className="text-xs text-slate-500 mb-3">¿Un día tenés otros horarios? Definilos sin tocar el resto.</p>
        <div className="divide-y divide-bg-border -mx-4">
          {DAY_NAMES_FULL.map((d, i) => {
            const custom = customByDay[i]
            return (
              <button key={i} onClick={() => setEditingDay(i)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                <span className="font-bold text-sm">{d}</span>
                <span className="flex items-center gap-1 text-xs">
                  {custom?.length ? (
                    <span className="text-brand font-semibold">distinto: {custom.join(' · ')}</span>
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
          times={customByDay[editingDay] || []}
          onClose={() => setEditingDay(null)}
          onChange={(times) => setCustomByDay((c) => ({ ...c, [editingDay]: times }))}
        />
      )}
    </div>
  )
}

// Lista de horarios sueltos (chips), con opción de agregar uno por uno o generar varios desde un rango
function TimeListEditor({ times, onChange }) {
  const [newTime, setNewTime] = useState('')
  const [rangeFrom, setRangeFrom] = useState('08:00')
  const [rangeTo, setRangeTo] = useState('12:00')
  const [duration, setDuration] = useState(60)
  const [showGenerator, setShowGenerator] = useState(false)

  function addTime() {
    if (!newTime || times.includes(newTime)) return
    onChange([...times, newTime].sort())
    setNewTime('')
  }

  function removeTime(t) {
    onChange(times.filter((x) => x !== t))
  }

  function generateFromRange() {
    const generated = timeSlots(rangeFrom, rangeTo, Number(duration) || 60)
    const merged = [...new Set([...times, ...generated])].sort()
    onChange(merged)
    setShowGenerator(false)
  }

  return (
    <div>
      {times.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {times.map((t) => (
            <span key={t} className="flex items-center gap-1.5 bg-bg-card border border-bg-border rounded-full pl-3 pr-1.5 py-1 text-sm font-medium">
              {t}
              <button onClick={() => removeTime(t)} className="text-slate-500 hover:text-red-400"><CloseIcon size={12} /></button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-2">
        <input type="time" className="input" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        <button onClick={addTime} disabled={!newTime} className="btn-secondary shrink-0">+ Agregar horario</button>
      </div>

      <button onClick={() => setShowGenerator((v) => !v)} className="text-brand text-xs font-semibold flex items-center gap-1">
        <PlusIcon size={14} /> Generar varios horarios desde un rango
      </button>

      {showGenerator && (
        <div className="card p-3 mt-2 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">De:</span>
            <input type="time" className="input" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
            <span className="text-slate-500">hasta:</span>
            <input type="time" className="input" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Cada:</span>
            <select className="input" value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
              <option value="90">90 min</option>
              <option value="120">120 min</option>
            </select>
          </div>
          <button onClick={generateFromRange} className="btn-secondary w-full">Agregar estos horarios</button>
        </div>
      )}
    </div>
  )
}

function DayEditorModal({ dayIdx, times, onClose, onChange }) {
  const [local, setLocal] = useState(times)
  const [useCustom, setUseCustom] = useState(times.length > 0)

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
          <span className="text-sm font-medium">Usar horarios distintos este día</span>
          <button
            onClick={() => setUseCustom((v) => !v)}
            className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${useCustom ? 'bg-brand text-slate-900' : 'card text-slate-400'}`}
          >
            {useCustom ? 'Sí' : 'No'}
          </button>
        </div>
        {useCustom && <TimeListEditor times={local} onChange={setLocal} />}
        <button onClick={save} className="btn-primary mt-4">Guardar</button>
      </div>
    </div>
  )
}
