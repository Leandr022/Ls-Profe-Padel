import { Link } from 'react-router-dom'
import { WarningIcon } from './Icons'

export default function RenewalBanner({ daysLeft, source }) {
  const label =
    daysLeft <= 0
      ? source === 'trial'
        ? 'Tu prueba gratuita terminó hoy'
        : 'Tu plan vence hoy'
      : daysLeft === 1
        ? source === 'trial'
          ? 'Te queda 1 día de prueba gratuita'
          : 'Te queda 1 día de tu plan'
        : source === 'trial'
          ? `Te quedan ${daysLeft} días de prueba gratuita`
          : `Te quedan ${daysLeft} días de tu plan`

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/30 text-amber-400 text-sm">
      <div className="max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto px-5 md:px-8 py-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-semibold">
          <WarningIcon size={14} />
          {label}
        </span>
        <Link to="/configuracion/plan" className="text-xs font-bold uppercase bg-amber-500/20 px-3 py-1.5 rounded-full shrink-0">
          Renovar
        </Link>
      </div>
    </div>
  )
}
