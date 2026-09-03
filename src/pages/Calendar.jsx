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
  monthLabel,
  formatMoneyShort,
  waLink,
  fillTemplate,
  categoryLabel,
  addMinutesToTime,
  sizeKeyFor,
  priceForSize,
  commissionForSize,
} from '../lib/helpers'
import Header from '../components/Header'
import { ChevronLeft, ChevronRight, CloseIcon, WhatsAppIcon, CalendarIcon } from '../components/Icons'
import SlotModal from '../components/SlotModal'

function computeHoursForDay(dayIdx, workingDays, slots) {
  const wd = workingDays.find((w) => w.day_of_week === dayIdx)
  if (!wd || !wd.enabled) return []
  const custom = slots.filter((s) => s.day_of_week === dayIdx)
  const applicable = custom.length ? custom : slots.filter((s) => s.day_of_week === null)
  const set = new Set(applicable.map((s) => s.start_time?.slice(0, 5)).filter(Boolean))
  return [...set].sort()
}

// Cada clase (o bloqueo manual) ocupa su horario de inicio + la duración configurada
// (end_time), así que un hueco que cae DENTRO de una clase o un bloqueo que ya empezó en
// un horario anterior no puede reservarse aparte: se muestra ocupado, en vez de "Libre".
// "ownActive" excluye las clases con status "cancelled" (alguien que canceló solo por hoy):
// esas no deben contar como que el hueco está ocupado ni seguir bloqueando los huecos
// siguientes — el hueco vuelve a estar libre para agendar a otra persona ese mismo día.
function buildOccupancy(hours, classes, blocks, defaultDuration) {
  const activeClasses = classes.filter((c) => c.status !== 'cancelled')
  const byTime = {}
  classes.forEach((c) => {
    const key = c.start_time?.slice(0, 5)
    if (!key) return
    if (!byTime[key]) byTime[key] = []
    byTime[key].push(c)
  })
  const blockByTime = {}
  ;(blocks || []).forEach((b) => {
    const key = b.start_time?.slice(0, 5)
    if (!key) return
    blockByTime[key] = b
  })

  function endOf(item) {
    const s = item.start_time?.slice(0, 5)
    return item.end_time ? item.end_time.slice(0, 5) : addMinutesToTime(s, defaultDuration)
  }

  return hours.map((h) => {
    if (blockByTime[h]) return { time: h, own: null, ownActive: [], ownBlock: blockByTime[h], coveredBy: null, coveredByBlock: null }
    if (byTime[h]) {
      const ownActive = byTime[h].filter((c) => c.status !== 'cancelled')
      return { time: h, own: byTime[h], ownActive, ownBlock: null, coveredBy: null, coveredByBlock: null }
    }

    const coveredByBlock = (blocks || []).find((b) => {
      const s = b.start_time?.slice(0, 5)
      if (!s) return false
      return s < h && h < endOf(b)
    })
    if (coveredByBlock) return { time: h, own: null, ownActive: [], ownBlock: null, coveredBy: null, coveredByBlock }

    const coveredBy = activeClasses.find((c) => {
      const s = c.start_time?.slice(0, 5)
      if (!s) return false
      return s < h && h < endOf(c)
    })
    return { time: h, own: null, ownActive: [], ownBlock: null, coveredBy: coveredBy || null, coveredByBlock: null }
  })
}

export default function Calendar() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState('dia')
  const [cursor, setCursor] = useState(new Date())
  const [workingDays, setWorkingDays] = useState([])
  const [slots, setSlots] = useState([])
  const [classesMap, setClassesMap] = useState({}) // iso -> [{...class, students:{name}}]
  const [blocksMap, setBlocksMap] = useState({}) // iso -> [{...schedule_blocks row}]
  const [fixedSlots, setFixedSlots] = useState([]) // todos los horarios fijos del profe (student_fixed_slots)
  const [rates, setRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSlot, setActiveSlot] = useState(null) // { iso, dayIdx, time, existingClass }
  const [showHint, setShowHint] = useState(true)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerMonth, setPickerMonth] = useState(cursor)
  const [pickerSelected, setPickerSelected] = useState(cursor)
  const [pickerDots, setPickerDots] = useState(new Set())

  const loadSchedule = useCallback(async () => {
    if (!user) return
    const [{ data: wd }, { data: sl }, { data: fx }, { data: rt }] = await Promise.all([
      supabase.from('working_days').select('*').eq('profesor_id', user.id),
      supabase.from('schedule_slots').select('*').eq('profesor_id', user.id),
      supabase.from('student_fixed_slots').select('*').eq('profesor_id', user.id),
      supabase.from('rates').select('*').eq('profesor_id', user.id).maybeSingle(),
    ])
    setWorkingDays(wd || [])
    setSlots(sl || [])
    setFixedSlots(fx || [])
    setRates(rt || null)
  }, [user])

  // Los "horarios fijos" (student_fixed_slots) son la REGLA (ej: Jona todos los lunes a las
  // 18:00); las filas reales en `classes` son la ocurrencia de cada semana. Para que el profe
  // no tenga que volver a cargar la clase semana a semana, cada vez que se mira un rango de
  // fechas creamos automáticamente las clases que falten para esa regla (solo hacia adelante,
  // nunca en el pasado, y respetando bloqueos y horarios ya deshabilitados).
  const materializeFixedSlots = useCallback(
    async (fromDate, toDate, map, bmap) => {
      if (!fixedSlots.length || !rates) return
      const todayIso = toISODate(new Date())
      const defaultDuration = profile?.class_duration_minutes || 60
      const toInsert = []

      for (let d = new Date(fromDate); toISODate(d) <= toISODate(toDate); d = addDays(d, 1)) {
        const iso = toISODate(d)
        if (iso < todayIso) continue
        const dIdx = jsDayToIdx(d.getDay())
        const dayFixed = fixedSlots.filter((f) => f.day_of_week === dIdx)
        if (!dayFixed.length) continue

        const hoursForDay = computeHoursForDay(dIdx, workingDays, slots)
        const byTime = {}
        dayFixed.forEach((f) => {
          const t = f.start_time?.slice(0, 5)
          if (!t || !hoursForDay.includes(t)) return
          if (!byTime[t]) byTime[t] = []
          byTime[t].push(f)
        })

        const dayBlocks = bmap[iso] || []
        Object.entries(byTime).forEach(([time, group]) => {
          const blocked = dayBlocks.some((b) => {
            const s = b.start_time?.slice(0, 5)
            const e = b.end_time ? b.end_time.slice(0, 5) : addMinutesToTime(s, defaultDuration)
            return s === time || (s < time && time < e)
          })
          if (blocked) return

          const existingForSlot = (map[iso] || []).filter((c) => c.start_time?.slice(0, 5) === time)
          // Un alumno con una fila "cancelled" ya tiene una decisión tomada para hoy — no se
          // recrea, pero tampoco cuenta para el tamaño del grupo del resto.
          const existingStudentIds = new Set(existingForSlot.map((c) => c.student_id))
          const activeExisting = existingForSlot.filter((c) => c.status !== 'cancelled')
          const missing = group.filter((f) => !existingStudentIds.has(f.student_id))
          if (!missing.length) return

          const totalCount = activeExisting.length + missing.length
          const size = sizeKeyFor(totalCount)
          const price = priceForSize(rates, size)
          const commission = commissionForSize(rates, size) / totalCount
          missing.forEach((f) => {
            toInsert.push({
              profesor_id: user.id,
              student_id: f.student_id,
              class_date: iso,
              start_time: time,
              end_time: addMinutesToTime(time, defaultDuration),
              status: 'scheduled',
              price,
              commission,
            })
          })
        })
      }

      if (!toInsert.length) return
      const { data: inserted } = await supabase
        .from('classes')
        .insert(toInsert)
        .select('*, students(id, name, phone, category, category_level)')
      ;(inserted || []).forEach((c) => {
        if (!map[c.class_date]) map[c.class_date] = []
        map[c.class_date].push(c)
      })
    },
    [user, fixedSlots, rates, workingDays, slots, profile],
  )

  const loadClasses = useCallback(
    async (fromDate, toDate) => {
      if (!user) return
      const [{ data }, { data: blockData }] = await Promise.all([
        supabase
          .from('classes')
          .select('*, students(id, name, phone, category, category_level)')
          .eq('profesor_id', user.id)
          .gte('class_date', toISODate(fromDate))
          .lte('class_date', toISODate(toDate)),
        supabase
          .from('schedule_blocks')
          .select('*')
          .eq('profesor_id', user.id)
          .gte('block_date', toISODate(fromDate))
          .lte('block_date', toISODate(toDate)),
      ])
      const map = {}
      ;(data || []).forEach((c) => {
        if (!map[c.class_date]) map[c.class_date] = []
        map[c.class_date].push(c)
      })
      const bmap = {}
      ;(blockData || []).forEach((b) => {
        if (!bmap[b.block_date]) bmap[b.block_date] = []
        bmap[b.block_date].push(b)
      })

      await materializeFixedSlots(fromDate, toDate, map, bmap)

      setClassesMap(map)
      setBlocksMap(bmap)
    },
    [user, materializeFixedSlots],
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

  // Carga qué días del mes que se está mostrando en el selector de fecha tienen algo cargado
  // (clase o bloqueo), para pintar el puntito — solo mientras el selector está abierto.
  useEffect(() => {
    if (!showDatePicker || !user) return
    const first = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1)
    const last = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 0)
    Promise.all([
      supabase
        .from('classes')
        .select('class_date')
        .eq('profesor_id', user.id)
        .gte('class_date', toISODate(first))
        .lte('class_date', toISODate(last))
        .not('status', 'eq', 'cancelled'),
      supabase
        .from('schedule_blocks')
        .select('block_date')
        .eq('profesor_id', user.id)
        .gte('block_date', toISODate(first))
        .lte('block_date', toISODate(last)),
    ]).then(([{ data: cls }, { data: blk }]) => {
      const set = new Set()
      ;(cls || []).forEach((c) => set.add(c.class_date))
      ;(blk || []).forEach((b) => set.add(b.block_date))
      setPickerDots(set)
    })
  }, [showDatePicker, pickerMonth, user])

  function openDatePicker() {
    setPickerMonth(cursor)
    setPickerSelected(cursor)
    setShowDatePicker(true)
  }

  function goToPicked() {
    if (!pickerSelected) return
    setCursor(pickerSelected)
    setShowDatePicker(false)
  }

  function goToTodayFromPicker() {
    const t = new Date()
    setCursor(t)
    setShowDatePicker(false)
  }

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

  const today = new Date()
  const isTodayInView =
    view === 'dia'
      ? toISODate(cursor) === toISODate(today)
      : view === 'semana'
        ? toISODate(startOfWeek(cursor)) <= toISODate(today) && toISODate(today) <= toISODate(addDays(startOfWeek(cursor), 6))
        : cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth()

  return (
    <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 py-6 md:px-8 fade-in">
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
          <span>Acá se edita todo. Tocá un hueco y decime quién viene, o bloqueálo si tenés que faltar por algún motivo.</span>
          <button onClick={() => setShowHint(false)}><CloseIcon size={14} /></button>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <button onClick={() => shift(-1)} className="btn-secondary p-2 rounded-full"><ChevronLeft /></button>
        <div className="text-center relative">
          <div className="flex items-center justify-center gap-1.5">
            <div className="font-bold">
              {view === 'dia' && (toISODate(cursor) === toISODate(new Date()) ? 'Hoy · ' : '')}
              {view === 'dia' && cursor.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
              {view === 'semana' && `${startOfWeek(cursor).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}`}
              {view === 'mes' && monthLabel(cursor)}
            </div>
            <button
              onClick={() => (showDatePicker ? setShowDatePicker(false) : openDatePicker())}
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${showDatePicker ? 'bg-brand/15 border border-brand text-brand' : 'card text-brand'}`}
              title="Elegir fecha"
            >
              <CalendarIcon size={15} />
            </button>
          </div>
          {!isTodayInView && (
            <button onClick={() => setCursor(new Date())} className="text-brand text-xs font-semibold underline decoration-dotted mt-0.5">
              Volver a hoy
            </button>
          )}

          {showDatePicker && (
            <DatePickerPopup
              month={pickerMonth}
              selected={pickerSelected}
              dots={pickerDots}
              onShiftMonth={(d) => setPickerMonth((m) => new Date(m.getFullYear(), m.getMonth() + d, 1))}
              onPick={setPickerSelected}
              onToday={goToTodayFromPicker}
              onConfirm={goToPicked}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        </div>
        <button onClick={() => shift(1)} className="btn-secondary p-2 rounded-full"><ChevronRight /></button>
      </div>

      {view === 'dia' && (
        <DayView
          date={cursor}
          workingDays={workingDays}
          slots={slots}
          classes={classesMap[toISODate(cursor)] || []}
          blocks={blocksMap[toISODate(cursor)] || []}
          loading={loading}
          defaultDuration={profile?.class_duration_minutes || 60}
          onSlotClick={(time, existingClasses, block) =>
            setActiveSlot({ iso: toISODate(cursor), time, dayIdx: jsDayToIdx(cursor.getDay()), existingClasses, block })
          }
        />
      )}

      {view === 'semana' && (
        <WeekView
          cursor={cursor}
          workingDays={workingDays}
          slots={slots}
          classesMap={classesMap}
          blocksMap={blocksMap}
          defaultDuration={profile?.class_duration_minutes || 60}
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

function DayView({ date, workingDays, slots, classes, blocks, loading, defaultDuration, onSlotClick }) {
  const dayIdx = jsDayToIdx(date.getDay())
  const hours = computeHoursForDay(dayIdx, workingDays, slots)
  const occupancy = buildOccupancy(hours, classes, blocks, defaultDuration)
  const freeCount = occupancy.filter((o) => !o.ownActive?.length && !o.ownBlock && !o.coveredBy && !o.coveredByBlock).length

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
      <div className="text-xs text-slate-500 mb-1">{freeCount} huecos libres de {hours.length}</div>
      <a href="/configuracion/horarios" className="text-brand text-xs font-semibold underline decoration-dotted">
        ¿Este día trabajás distinto? Ajustar solo este día
      </a>
      <div className="card divide-y divide-bg-border mt-3">
        {occupancy.map(({ time: h, own, ownActive, ownBlock, coveredBy, coveredByBlock }) => {
          const allRows = own || []
          const activeRows = ownActive || []
          const allPaid = activeRows.length > 0 && activeRows.every((c) => c.paid)

          if (ownBlock) {
            return (
              <button
                key={h}
                onClick={() => onSlotClick(h, [], ownBlock)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
              >
                <span className="text-slate-300 font-medium">{h}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-400 text-sm truncate">{ownBlock.reason || 'Bloqueado'}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 bg-slate-500/20 text-slate-400">🔒 Bloqueado</span>
                </span>
              </button>
            )
          }

          if (coveredByBlock) {
            const startTime = coveredByBlock.start_time?.slice(0, 5)
            return (
              <button
                key={h}
                onClick={() => onSlotClick(startTime, [], coveredByBlock)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
              >
                <span className="text-slate-500 font-medium">{h}</span>
                <span className="text-slate-500 text-sm flex items-center gap-1.5">
                  🔒 Bloqueado
                  <span className="text-[10px] font-bold uppercase bg-bg-card border border-bg-border px-1.5 py-0.5 rounded-full text-slate-400">
                    desde {startTime}
                  </span>
                </span>
              </button>
            )
          }

          if (coveredBy) {
            const startTime = coveredBy.start_time?.slice(0, 5)
            return (
              <button
                key={h}
                onClick={() => onSlotClick(startTime, classes.filter((c) => c.start_time?.slice(0, 5) === startTime))}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
              >
                <span className="text-slate-500 font-medium">{h}</span>
                <span className="text-slate-500 text-sm flex items-center gap-1.5">
                  Ocupado
                  <span className="text-[10px] font-bold uppercase bg-bg-card border border-bg-border px-1.5 py-0.5 rounded-full text-slate-400">
                    {coveredBy.students?.name || 'clase'} desde {startTime}
                  </span>
                </span>
              </button>
            )
          }

          return (
            <button
              key={h}
              onClick={() => onSlotClick(h, allRows)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition"
            >
              <span className="text-slate-300 font-medium">{h}</span>
              {activeRows.length > 0 ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold truncate">
                    {activeRows.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && ', '}
                        {c.students?.name || 'Alumno'}
                        {c.students?.category && <span className="text-slate-400 font-normal"> / {categoryLabel(c.students.category, c.students.category_level)}</span>}
                      </span>
                    ))}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${allPaid ? 'bg-brand/20 text-brand' : 'bg-amber-500/20 text-amber-400'}`}>
                    {allPaid ? 'Pagó' : 'Debe'}
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

function WeekView({ cursor, workingDays, slots, classesMap, blocksMap, defaultDuration, onSelectDay }) {
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
        const activeDayClasses = dayClasses.filter((c) => c.status !== 'cancelled')
        const dayBlocks = blocksMap[iso] || []
        const occupancy = buildOccupancy(hours, dayClasses, dayBlocks, defaultDuration)
        const freeHuecos = occupancy.filter((o) => !o.ownActive?.length && !o.ownBlock && !o.coveredBy && !o.coveredByBlock).length
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
                : `${activeDayClasses.length ? `${activeDayClasses.length} alumno${activeDayClasses.length > 1 ? 's' : ''}` : 'Sin clases'} · ${freeHuecos} huecos libres`}
            </div>
            <ChevronRight className="text-slate-500" />
          </button>
        )
      })}
    </div>
  )
}

function DatePickerPopup({ month, selected, dots, onShiftMonth, onPick, onToday, onConfirm, onClose }) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const first = new Date(year, m, 1)
  const startIdx = jsDayToIdx(first.getDay())
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startIdx; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayIso = toISODate(new Date())
  const selectedIso = selected ? toISODate(selected) : null

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 card p-3.5 z-40 w-72 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2.5">
          <button onClick={() => onShiftMonth(-1)} className="btn-secondary p-1.5 rounded-lg"><ChevronLeft size={14} /></button>
          <div className="font-bold text-sm">{monthLabel(month)}</div>
          <button onClick={() => onShiftMonth(1)} className="btn-secondary p-1.5 rounded-lg"><ChevronRight size={14} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] text-slate-500 font-bold">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const dateObj = new Date(year, m, day)
            const iso = toISODate(dateObj)
            const isToday = iso === todayIso
            const isSelected = iso === selectedIso
            return (
              <button
                key={i}
                onClick={() => onPick(dateObj)}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-xs transition ${
                  isToday ? 'bg-brand text-white font-bold' : isSelected ? 'ring-2 ring-brand text-slate-100 font-bold' : 'text-slate-200 hover:bg-white/5'
                }`}
              >
                {day}
                {dots.has(iso) && !isToday && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-brand" />}
              </button>
            )
          })}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={onToday} className="btn-secondary flex-1 text-xs py-2">Hoy</button>
          <button onClick={onConfirm} disabled={!selected} className="btn-primary flex-1 text-xs py-2">
            Ir al {selected ? selected.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '...'}
          </button>
        </div>
      </div>
    </>
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
