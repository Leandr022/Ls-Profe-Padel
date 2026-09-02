import { createClient } from '@supabase/supabase-js'

// Cliente de Supabase con la service role key: SOLO se usa en funciones serverless
// (nunca llega al navegador). Sirve para validar el token del usuario que llama
// y, en el webhook, para actualizar el plan sin depender de las políticas RLS.
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Faltan las variables de entorno SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en Vercel.')
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

// Verifica el JWT que manda el frontend (el access_token de la sesión de Supabase)
// y devuelve el usuario autenticado, o null si el token no es válido.
export async function getUserFromRequest(req) {
  const auth = req.headers.authorization || req.headers.Authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.slice('Bearer '.length)
  const admin = supabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}
