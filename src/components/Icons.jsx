// Íconos lineales simples (SVG inline, sin dependencias externas)
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const CalendarIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)
export const UsersIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <circle cx="12" cy="8" r="3.3" />
    <path d="M5.5 20c1-3.5 3.7-5.5 6.5-5.5s5.5 2 6.5 5.5" />
  </svg>
)
export const CashIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 6v0M18 18v0" />
  </svg>
)
export const ChartIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <path d="M4 20V10M12 20V4M20 20v-7" />
  </svg>
)
export const BellIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z" />
    <path d="M10 19a2 2 0 004 0" />
  </svg>
)
export const WhatsAppIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} fill="currentColor" className={p.className}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.87.51 3.63 1.4 5.14L2 22l5.12-1.5a9.87 9.87 0 004.92 1.32h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2zm5.79 14.15c-.24.68-1.4 1.31-1.93 1.38-.5.07-1.12.1-1.8-.11a16.5 16.5 0 01-1.65-.6c-2.9-1.25-4.8-4.16-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.2 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .9 2.14.07.15.12.32.02.51-.1.19-.15.31-.29.48-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.23 1.6 2 1.11.98 2.04 1.29 2.33 1.44.29.14.46.12.63-.07.17-.19.72-.83.91-1.12.19-.28.39-.24.65-.14.27.09 1.68.79 1.97.93.29.15.48.22.55.34.07.13.07.72-.17 1.4z" />
  </svg>
)
export const CheckCircleIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.3l2.3 2.3 4.7-5" />
  </svg>
)
export const WarningIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <path d="M12 3.5L21.5 20h-19L12 3.5z" />
    <path d="M12 9.5v4.5M12 17v0" />
  </svg>
)
export const SettingsIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </svg>
)
export const PlusIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
export const ChevronRight = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...base} className={p.className}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)
export const ChevronLeft = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...base} className={p.className}>
    <path d="M15 19l-7-7 7-7" />
  </svg>
)
export const CloseIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...base} className={p.className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const RacketIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <circle cx="9" cy="9" r="6" />
    <path d="M13.5 13.5L20 20" />
  </svg>
)
export const ChevronDown = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 16} height={p.size || 16} {...base} className={p.className}>
    <path d="M5 9l7 7 7-7" />
  </svg>
)
export const LockIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 018 0v4" />
  </svg>
)
export const TrophyIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 20} height={p.size || 20} {...base} className={p.className}>
    <path d="M7 4h10v4a5 5 0 01-10 0V4z" />
    <path d="M7 5H4v1a4 4 0 004 4M17 5h3v1a4 4 0 01-4 4" />
    <path d="M10 15v3M14 15v3M8 21h8" />
  </svg>
)
