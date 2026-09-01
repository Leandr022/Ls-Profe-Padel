// Configuración de planes de ProfePadel.
// Hoy vive acá, hardcodeada — el día que exista un panel de admin,
// esto se reemplaza por una tabla `plans` editable y este archivo
// pasa a ser solo el tipo/fallback. La forma de cada plan (key, label,
// price, originalPrice, period, perMonth, savingsVsMonthly, badge,
// highlight) está pensada para mapear 1 a 1 con esa futura tabla.

export const PLANS = [
  {
    key: 'mensual',
    label: 'Mensual',
    price: 19900,
    originalPrice: 25000,
    period: 'por mes',
    perMonth: null,
    savingsVsMonthly: null,
    badge: null,
    highlight: false,
  },
  {
    key: 'trimestral',
    label: 'Trimestral',
    price: 45000,
    originalPrice: 60000,
    period: 'cada 3 meses',
    perMonth: 15000,
    savingsVsMonthly: 14700,
    badge: '-25%',
    highlight: true,
    tag: 'Más elegido',
  },
  {
    key: 'anual',
    label: 'Anual',
    price: 139000,
    originalPrice: 180000,
    period: 'por año',
    perMonth: 11600,
    savingsVsMonthly: 99800,
    badge: '-42%',
    highlight: false,
  },
]

export const CURRENCY_LABELS = {
  ARS: 'Pesos argentinos',
  UYU: 'Pesos uruguayos',
  MXN: 'Pesos mexicanos',
  USD: 'Dólares',
  CLP: 'Pesos chilenos',
}

export function planLabel(key) {
  return PLANS.find((p) => p.key === key)?.label || null
}
