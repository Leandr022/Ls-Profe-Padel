import { Link } from 'react-router-dom'
import Header from '../components/Header'
import { CalendarIcon, UsersIcon, CashIcon, ChartIcon, ChevronRight } from '../components/Icons'

const items = [
  { to: '/panel/calendario', title: 'Mi calendario', desc: 'Tu semana: clases, huecos y faltas', Icon: CalendarIcon },
  { to: '/panel/alumnos', title: 'Alumnos', desc: 'Fichas, categorías y notas', Icon: UsersIcon },
  { to: '/panel/caja', title: 'Caja', desc: 'Facturado y cobrado del mes', Icon: CashIcon },
  { to: '/panel/estadisticas', title: 'Estadísticas', desc: 'Resumen del mes y comparación', Icon: ChartIcon },
]

export default function Panel() {
  return (
    <div className="max-w-lg mx-auto px-5 py-6 fade-in">
      <Header backTo="/" backLabel="Inicio" />
      <h1 className="text-xl font-extrabold mb-0.5">Panel Profe</h1>
      <p className="text-slate-400 text-sm mb-6">Tu espacio de trabajo</p>

      <div className="space-y-3">
        {items.map(({ to, title, desc, Icon }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 p-4 hover:border-brand/40 transition">
            <Icon className="text-slate-400" size={22} />
            <div className="flex-1">
              <div className="font-bold">{title}</div>
              <div className="text-xs text-slate-400">{desc}</div>
            </div>
            <ChevronRight className="text-slate-500" />
          </Link>
        ))}
      </div>
    </div>
  )
}
