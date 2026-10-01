import { NavLink } from 'react-router-dom'
import { HomeIcon, CalendarIcon, UsersIcon, CashIcon, ChartIcon } from './Icons'

const TABS = [
  { to: '/', label: 'Inicio', Icon: HomeIcon, end: true },
  { to: '/panel/calendario', label: 'Calendario', Icon: CalendarIcon },
  { to: '/panel/alumnos', label: 'Alumnos', Icon: UsersIcon },
  { to: '/panel/caja', label: 'Caja', Icon: CashIcon },
  { to: '/panel/estadisticas', label: 'Más', Icon: ChartIcon },
]

// Barra fija de navegación entre las secciones principales — así no hace falta pasar
// siempre por Panel Profe para ir de una sección a otra. Se muestra en las pantallas
// de uso diario; en Configuración y sus subpáginas se oculta para no competir con el
// botón de "Volver".
export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-panel/90 backdrop-blur-md border-t border-bg-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto grid grid-cols-5">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition ${
                isActive ? 'text-brand' : 'text-slate-500'
              }`
            }
          >
            <Icon size={19} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
