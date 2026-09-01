import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  DAY_NAMES,
  DAY_NAMES_FULL,
  jsDayToIdx,
  toISODate,
  addDays,
  startOfWeek,
  timeSlots,
  monthLabel,
  formatMoneyShort,
  waLink,
  fillTemplate,
} from '../lib/helpers'
import Header from '../components/Header'
import { ChevronLeft, ChevronRight, CloseIcon, WhatsAppIcon } from '../components/Icons'
import SlotModal from '../components/SlotModal'

function computeHoursForDay(dayIdx, workingDays, slots) {
  const wd = workingDays.find((w) => w.day_of_week === dayIdx)
  if (!wd || !wd.enabled) return []
  const custom = slots.filter((s) => s.day_of_week === dayIdx)
  const ranges = custom.length ? custom : slots.filter((s) => s.day_of_week === null)
  const set = new Set()
  ranges.forEach((r) => timeSlots(r.start_time?.slice(0, 5), r.end_time?.slice(0, 5)).forEach((h) => set.add(h)))
  return [...set].sort()
}

export default function Calendar() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState('dia')
  const [cursor, setCursor] = useState(new Date())
  const [workingDays, setWorkingDays] = useState([])
  const [slots, setSlots] = useState([])
  const [classesMap, setClassesMap] = useState({}) // iso -> [{...class, students:{name}}]
  const [loading, setLoading] = useState(true)
  const [activeSlot, setActiveSlot] = useState(null) // { iso, dayIdx, time, existingClass }
  const [showHint, setShowHint] = useState(true)

  const loadSchedule = useCallback(async () => {
    if (!user) return
    const [{ data: wd }, { data: sl }] = await Promise.all([
      supabase.from('working_days').select('*').eq('profesor_id', user.id),
      supabase.from('schedule_slots').select('*').eq('profesor_id', user.id),
    ])
    setWorkingDays(wd || [])
    setSlots(sl || [])
  }, [user])

  const loadClasses = useCallback(
    async (fromDate, toDate) => {
      if (!user) return
      const { data } = await supabase
        .from('classes')
        .select('*, students(id, name, phone)')
        .eq('profesor_id', user.id)
        .gte('class_date', toISODate(fromDate))
        .lte('class_date', toISODate(toDate))
      const map = {}
      ;(data || []).forEach((c) => {
        if (!map[c.class_date]) map[c.class_date] = []
        map[c.class_date].push(c)
      })
      setClassesMap(map)
    },
    [user],
  )

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  useEffect(() => {
    setLoading(true)
    let from, to
    if (view === 'dia') {
      from = cursor
      to = cursor
    } else if (view === 'semana') {
      from = startOfWeek(cursor)
      to = addDays(from, 6)
    } else {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
      to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    }
    loadClasses(from, to).then(() => setLoading(false))
  }, [view, cursor, loadClasses])

  function shift(delta) {
    if (view === 'dia') setCursor((c) => addDays(c, delta))
    else if (view === 'semana') setCursor((c) => addDays(c, delta * 7))
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  }

  function refreshAfterChange() {
    if (view === 'dia') loadClasses(cursor, cursor)
    else if (view === 'semana') {
      const from = startOfWeek(cursor)
      loadClasses(from, addDays(from, 6))
    } else {
      loadClasses(new Date(cursor.getFullYear(), cursor.getMonth(), 1), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))
    }
  }

  return (
    <div className="max-w-lg mx-auto px-5 py-6 fade-in">
      <Header backTo="/panel" backLabel="Panel" />

      <div className="grid grid-cols-3 card p-1 mb-4">
        {['mes', 'semana', 'dia'].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`py-2 rounded-xl text-sm font-semibold capitalize transition ${
              view === v ? 'bg-brand text-slate-900' : 'text-slate-400'
            }`}
          >
            {v === 'dia' ? 'Día' : v}
          </button>
        ))}
      </div>

      {view === 'dia' && showHint && (
        <div className="rounded-xl bg-brand/10 border border-brand/30 text-brand text-xs p-3 mb-4 flex items-start justify-between gap-2">
          <span>Acá se edita todo. Tocá un hueco y decime quién viene — el alumno se crea rápido y fácil, con nombre y categoría.</span>
          <button onClick={() => setShowHint(false)}><CloseIcon size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <button onClick={() => shift(-1)} className="btn-secondary p-2 rounded-full"><ChevronLeft /></button>
        <div className="text-center">
          <div className="font-bold">
            {view === 'dia' && (toISODate(cursor) === toISODate(new Date()) ? 'Hoy · ' : '')}
            {view === 'dia' && cursor.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
            {view === 'semana' && `${startOfWeek(cursor).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
            {view === 'mes' && monthLabel(cursor)}
          </div>
        </div>
        <button onClick={() => shift(1)} className="btn-secondary p-2 rounded-full"><ChevronRight /></button>
      </div>

      {view === 'dia' && (
        <DayView
          date={cursor}
          workingDays={workingDays}
          slots={slots}
          classes={classesMap[toISODate(cursor)] || []}
          loading={loading}
          onSlotClick={(time, existingClass) => setActiveSlot({ iso: toISODate(cursor), time, existingClass })}
        />
      )}

      {view === 'semana' && (
        <WeekView
          cursor={cursor}
          workingDays={workingDays}
          slots={slots}
          classesMap={classesMap}
          onSelectDay={(d) => {
            setCursor(d)
            setView('dia')
          }}
        />
      )}

      {view === 'mes' && (
        <MonthView
          cursor={cursor}
          classesMap={classesMap}
          onSelectDay={(d) => {
            setCursor(d)
            setView('dia')
          }}
        />
      )}

      {activeSlot && (
        <SlotModal
          slot={activeSlot}
          profile={profile}
          onClose={() => setActiveSlot(null)}
          onSaved={() => {
            setActiveSlot(null)
            refreshAfterChange()
          }}
        />
      )}
    </div>
  )
}

function DayView({ date, workingDays, slots, classes, loading, onSlotClick }) {
  const dayIdx = jsDayToIdx(date.getDay())
  const hours = computeHoursForDay(dayIdx, workingDays, slots)
  const byTime = {}
  classes.forEach((c) => {
    byTime[c.start_time?.slice(0, 5)] = c
  })

  if (!loading && hours.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-400 mt-4">
        Sin clases este día.
        <div className="mt-1 text-xs">Podés ajustar tu horario habitual en Configuración.</div>
      </div>
    )
  }

  return (
    <>
      <div className="text-xs text-slate-500 mb-1">{hours.length} huecos</div>
      <a href="/configuracion/horarios" className="text-brand text-xs font-semibold underline decoration-dotted">
        ¿Este día trabajás distinto? Ajustar solo este día
      </a>
      <div className="card divide-y divide-bg-border mt-3">
        {hours.map((h) => {
          const c = byTime[h]
          return (
            <button
              key={h}
              onClick={() => onSlotClick(h, c || null)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
            >
              <span className="text-slate-300 font-medium">{h}</span>
              {c ? (
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{c.students?.name || 'Alumno'}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${c.paid ? 'bg-brand/20 text-brand' : 'bg-amber-500/20 text-amber-400'}`}>
                    {c.paid ? 'Pagó' : 'Debe'}
                  </span>
                </span>
              ) : (
                <span className="text-slate-500 text-sm">Libre</span>
              )}
            </button>
          )
        })}
      </div>
    </>
  )
}

function WeekView({ cursor, workingDays, slots, classesMap, onSelectDay }) {
  const from = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const today = toISODate(new Date())

  return (
    <div className="card divide-y divide-bg-border mt-3">
      {days.map((d) => {
        const iso = toISODate(d)
        const dayIdx = jsDayToIdx(d.getDay())
        const hours = computeHoursForDay(dayIdx, workingDays, slots)
        const dayClasses = classesMap[iso] || []
        const isToday = iso === today
        return (
          <button
            key={iso}
            onClick={() => onSelectDay(d)}
            className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition hover:bg-white/5 ${isToday ? 'bg-brand/10' : ''}`}
          >
            <div className="w-14 shrink-0">
              <div className={`text-[10px] font-bold uppercase ${isToday ? 'text-brand' : 'text-slate-500'}`}>{isToday ? 'Hoy' : DAY_NAMES[dayIdx]}</div>
              <div className="text-lg font-bold">{d.getDate()}</div>
            </div>
            <div className="flex-1 text-sm text-slate-400">
              {hours.length === 0
                ? 'Sin clases'
                : `${dayClasses.length ? `${dayClasses.length} clase${dayClasses.length > 1 ? 's' : ''}` : 'Sin clases'} · ${hours.length - dayClasses.length} huecos`}
            </div>
            <ChevronRight className="text-slate-500" />
          </button>
        )
      })}
    </div>
  )
}

function MonthView({ cursor, classesMap, onSelectDay }) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startIdx = jsDayToIdx(first.getDay())
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startIdx; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const today = toISODate(new Date())

  return (
    <div className="card p-3 mt-3">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] text-slate-500 font-bold">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateObj = new Date(year, month, day)
          const iso = toISODate(dateObj)
          const count = (classesMap[iso] || []).length
          const isToday = iso === today
          return (
            <button
              key={i}
              onClick={() => onSelectDay(dateObj)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition hover:bg-white/5 ${
                isToday ? 'bg-brand text-slate-900 font-bold' : 'text-slate-200'
              }`}
            >
              {day}
              {count > 0 && !isToday && <span className="w-1 h-1 rounded-full bg-brand mt-0.5" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
