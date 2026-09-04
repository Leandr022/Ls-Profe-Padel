import { supabaseAdmin } from './_supabaseAdmin.js'
import { getAccessStatus } from '../src/lib/access.js'
import { planLabel, RENEWAL_WARNING_DAYS } from '../src/lib/plans.js'

const DAY_MS = 86400000
const TRIAL_DAYS = 30

// Corre una vez por día (ver vercel.json -> crons). Revisa a todos los profes que no
// son el dueño (unlimited_access=false) y, a los que les queda poco de plan o de
// prueba gratuita, les manda un mail avisando — sin que vos tengas que hacer nada.
// No repite el aviso hasta que vuelva a estar por vencer (por ejemplo, después de
// que renueven y les corramos la fecha).
export default async function handler(req, res) {
  try {
    // Protección simple: si configuraste CRON_SECRET en Vercel, solo corre si viene ese secreto.
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const auth = req.headers.authorization || ''
      if (auth !== `Bearer ${cronSecret}`) {
        res.status(401).json({ error: 'No autorizado.' })
        return
      }
    }

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) {
      res.status(500).json({ error: 'Falta RESEND_API_KEY en las variables de entorno de Vercel.' })
      return
    }
    const fromAddress = process.env.RESEND_FROM || 'ProfePadel <onboarding@resend.dev>'
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`

    const admin = supabaseAdmin()
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, email, full_name, plan, plan_expires_at, trial_started_at, unlimited_access, renewal_notice_sent_at')
      .eq('unlimited_access', false)

    if (error) throw error

    const results = []
    for (const profile of profiles || []) {
      const access = getAccessStatus(profile)
      if (!access.showWarning) continue // ya vencido, o todavía le queda de sobra

      // Base de la fecha de vencimiento (plan o prueba), para saber si ya le avisamos
      // de ESTE vencimiento en particular (si renueva, la base cambia y se puede avisar de nuevo).
      const expiryBasis = profile.plan_expires_at
        ? new Date(profile.plan_expires_at).getTime()
        : (profile.trial_started_at ? new Date(profile.trial_started_at).getTime() : Date.now()) + TRIAL_DAYS * DAY_MS
      const windowStart = expiryBasis - RENEWAL_WARNING_DAYS * DAY_MS

      const alreadySent = profile.renewal_notice_sent_at && new Date(profile.renewal_notice_sent_at).getTime() >= windowStart
      if (alreadySent) continue
      if (!profile.email) continue

      const firstName = (profile.full_name || 'Profe').split(' ')[0]
      const isTrial = access.source === 'trial'
      const subject = isTrial ? 'Tu prueba gratuita de ProfePadel está por terminar' : 'Tu plan de ProfePadel está por vencer'
      const daysText = access.daysLeft <= 0 ? 'hoy' : access.daysLeft === 1 ? 'en 1 día' : `en ${access.daysLeft} días`
      const planText = isTrial ? 'tu prueba gratuita' : `tu plan ${planLabel(profile.plan) || profile.plan}`

      const html = `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
          <h2 style="margin: 0 0 12px;">Hola ${firstName} 👋</h2>
          <p style="font-size: 15px; line-height: 1.5;">
            Te escribimos porque ${planText} de <strong>ProfePadel</strong> vence ${daysText}.
            Para no perder acceso a tu calendario, tus alumnos y tu caja, renovalo cuando quieras desde la app.
          </p>
          <p style="margin: 24px 0;">
            <a href="${appUrl}/configuracion/plan" style="background:#3b82f6;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block;">
              Renovar mi plan →
            </a>
          </p>
          <p style="font-size: 13px; color: #666;">Si ya renovaste, ignorá este mensaje.</p>
        </div>
      `

      const sendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({ from: fromAddress, to: profile.email, subject, html }),
      })

      if (sendRes.ok) {
        await admin.from('profiles').update({ renewal_notice_sent_at: new Date().toISOString() }).eq('id', profile.id)
        results.push({ email: profile.email, sent: true })
      } else {
        const detail = await sendRes.text()
        results.push({ email: profile.email, sent: false, error: detail })
      }
    }

    res.status(200).json({ ok: true, checked: (profiles || []).length, notified: results.filter((r) => r.sent).length, results })
  } catch (err) {
    console.error('cron-renewal-emails error', err)
    res.status(500).json({ ok: false, error: err.message })
  }
}
