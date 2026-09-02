import { getUserFromRequest } from './_supabaseAdmin.js'
import { PLANS } from '../src/lib/plans.js'

// Crea una preferencia de pago (Checkout Pro) en Mercado Pago para que el profe
// pague el plan elegido. Devuelve la URL a la que hay que redirigirlo.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    res.status(500).json({ error: 'Falta MP_ACCESS_TOKEN en las variables de entorno de Vercel.' })
    return
  }

  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      res.status(401).json({ error: 'No autenticado.' })
      return
    }

    const { planKey } = req.body || {}
    const plan = PLANS.find((p) => p.key === planKey)
    if (!plan) {
      res.status(400).json({ error: 'Plan inválido.' })
      return
    }

    const origin = process.env.APP_URL || `https://${req.headers.host}`
    const currencyId = process.env.MP_CURRENCY || 'ARS'

    const preference = {
      items: [
        {
          title: `ProfePadel - Plan ${plan.label}`,
          quantity: 1,
          unit_price: Number(plan.price),
          currency_id: currencyId,
        },
      ],
      // "userId:planKey" — así el webhook sabe a quién y qué plan activarle sin
      // tener que confiar en nada que mande el navegador en ese momento.
      external_reference: `${user.id}:${plan.key}`,
      back_urls: {
        success: `${origin}/configuracion/plan?pago=exito`,
        failure: `${origin}/configuracion/plan?pago=error`,
        pending: `${origin}/configuracion/plan?pago=pendiente`,
      },
      auto_return: 'approved',
      notification_url: `${origin}/api/mp-webhook`,
    }

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preference),
    })

    const data = await mpRes.json()
    if (!mpRes.ok) {
      res.status(502).json({ error: 'Mercado Pago rechazó la preferencia.', detail: data })
      return
    }

    res.status(200).json({ init_point: data.init_point || data.sandbox_init_point })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error inesperado.' })
  }
}
