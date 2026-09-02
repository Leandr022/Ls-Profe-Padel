import { RENEWAL_WARNING_DAYS } from './plans'

const TRIAL_DAYS = 30
const DAY_MS = 86400000

// Calcula el estado de acceso del profe a partir de su perfil:
// - unlimited_access=true (vos, el dueño de la app) -> nunca se bloquea.
// - si eligió un plan (plan_expires_at seteado) -> se rige por ese vencimiento.
// - si todavía no eligió plan -> se rige por los 30 días de prueba gratuita.
export function getAccessStatus(profile) {
  if (!profile) return { blocked: false, source: 'loading', daysLeft: null, showWarning: false }

  if (profile.unlimited_access) {
    return { blocked: false, source: 'unlimited', daysLeft: null, showWarning: false }
  }

  if (profile.plan_expires_at) {
    const msLeft = new Date(profile.plan_expires_at).getTime() - Date.now()
    const daysLeft = Math.ceil(msLeft / DAY_MS)
    return {
      blocked: msLeft <= 0,
      source: 'plan',
      daysLeft,
      showWarning: msLeft > 0 && daysLeft <= RENEWAL_WARNING_DAYS,
    }
  }

  const started = profile.trial_started_at ? new Date(profile.trial_started_at).getTime() : Date.now()
  const daysLeft = TRIAL_DAYS - Math.floor((Date.now() - started) / DAY_MS)
  return {
    blocked: daysLeft <= 0,
    source: 'trial',
    daysLeft,
    showWarning: daysLeft > 0 && daysLeft <= RENEWAL_WARNING_DAYS,
  }
}
