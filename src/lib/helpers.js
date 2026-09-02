export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const DAY_NAMES_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const CURRENCIES = ['ARS', 'UYU', 'MXN', 'USD', 'CLP']
export const CATEGORIES = ['8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra']
export const GENDERS = [
  { key: 'Damas', label: 'Damas' },
  { key: 'Caballeros', label: 'Caballeros' },
]
export const LEVEL_MODS = [
  { key: '+', label: 'Alta +' },
  { key: '-', label: 'Baja -' },
]
export const PERIODS = ['Mañana', 'Tarde', 'Noche']

export function categoryLabel(category, level) {
  if (!category) return ''
  return `${category}${level || ''}`
}

export function jsDayToIdx(jsDay) {
  // JS: 0=domingo..6=sábado -> nuestro: 0=lunes..6=domingo
  return jsDay === 0 ? 6 : jsDay - 1
}

export function formatMoney(amount, currency = 'ARS') {
  const n = Number(amount || 0)
  const formatted = n.toLocaleString('es-AR', { maximumFractionDigits: 0 })
  return `$${formatted} ${currency}`
}

export function formatMoneyShort(amount) {
  const n = Number(amount || 0)
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

export function toISODate(d) {
  const yr = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${yr}-${mo}-${da}`
}

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function startOfWeek(date) {
  const idx = jsDayToIdx(date.getDay())
  return addDays(date, -idx)
}

export function addMinutesToTime(time, minutes) {
  if (!time) return time
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + Number(minutes || 0)
  const hh = String(Math.floor(((total % 1440) + 1440) % 1440 / 60)).padStart(2, '0')
  const mm = String(((total % 60) + 60) % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function timeSlots(startTime, endTime, stepMinutes = 60) {
  const slots = []
  if (!startTime || !endTime) return slots
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let cur = sh * 60 + sm
  const end = eh * 60 + em
  while (cur < end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0')
    const m = String(cur % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
    cur += stepMinutes
  }
  return slots
}

export function groupSizeLabel(size) {
  return {
    individual: 'Individual',
    duo: 'Dúo',
    trio: 'Trío',
    grupo4: 'Grupo de 4',
    mensual: 'Mensual',
  }[size] || size
}

export function monthLabel(date) {
  const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function waLink(phone, text) {
  const clean = (phone || '').replace(/[^\d]/g, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`
}

export function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? `{${key}}`))
}
