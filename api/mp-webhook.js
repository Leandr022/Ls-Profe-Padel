import { supabaseAdmin } from './_supabaseAdmin.js'
import { PLANS } from '../src/lib/plans.js'

// Mercado Pago llama a esta URL cuando cambia el estado de un pago.
// Confirmamos el pago consultando la API de MP (nunca confiamos en el body tal cual
// llega, porque cualquiera podría pegarle a esta URL) y, si está aprobado,
// extendemos plan_expires_at del profe que corresponda.
export default async function handler(req, res) {
  try {
    const accessToken = process.env.MP_ACCESS_TOKEN
    if (!accessToken) {
      res.status(500).json({ error: 'Falta MP_ACCESS_TOKEN' })
      return
    }

    const paymentId =
      req.body?.data?.id ||
      req.query['data.id'] ||
      req.query.id ||
      (req.body?.type === 'payment' ? req.body?.id : null)

    if (!paymentId) {
      // Notificaciones de otro tipo (merchant_order, etc.) — las ignoramos sin error.
      res.status(200).json({ ok: true, ignored: true })
      return
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!mpRes.ok) {
      res.status(200).json({ ok: true, note: 'No se pudo verificar el pago, se ignora.' })
      return
    }
    const payment = await mpRes.json()

    if (payment.status !== 'approved') {
      res.status(200).json({ ok: true, status: payment.status })
      return
    }

    const [userId, planKey] = String(payment.external_reference || '').split(':')
    const plan = PLANS.find((p) => p.key === planKey)
    if (!userId || !plan) {
      res.status(200).json({ ok: true, note: 'external_reference inválido.' })
      return
    }

    const admin = supabaseAdmin()

    // Idempotencia: si ya procesamos este pago, no volvemos a extender el vencimiento.
    const { data: existing } = await admin.from('profiles').select('plan_expires_at, last_payment_id').eq('id', userId).maybeSingle()
    if (!existing) {
      res.status(200).json({ ok: true, note: 'Usuario no encontrado.' })
      return
    }
    if (existing.last_payment_id === String(payment.id)) {
      res.status(200).json({ ok: true, note: 'Ya procesado.' })
      return
    }

    const now = Date.now()
    const currentExpiry = existing.plan_expires_at ? new Date(existing.plan_expires_at).getTime() : 0
    const base = currentExpiry > now ? currentExpiry : now // si renueva antes de que venza, se suma al tiempo que le queda
    const newExpiry = new Date(base + plan.durationDays * 86400000).toISOString()

    await admin
      .from('profiles')
      .update({
        plan: plan.key,
        plan_selected_at: new Date().toISOString(),
        plan_expires_at: newExpiry,
        last_payment_id: String(payment.id),
      })
      .eq('id', userId)

    res.status(200).json({ ok: true })
  } catch (err) {
    // Siempre devolvemos 200 para que Mercado Pago no reintente en loop por un error nuestro;
    // el detalle queda en los logs de Vercel para revisar.
    console.error('mp-webhook error', err)
    res.status(200).json({ ok: false, error: err.message })
  }
}
