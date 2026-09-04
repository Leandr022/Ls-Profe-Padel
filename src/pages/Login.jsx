import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signInWithGoogle, signInWithPassword, signUpWithPassword } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!email.trim() || !password) {
      setError('Completá tu email y contraseña.')
      return
    }
    setLoading(true)
    if (mode === 'signup') {
      const { error } = await signUpWithPassword(email.trim(), password, fullName.trim())
      setLoading(false)
      if (error) {
        setError(traducirError(error.message))
        return
      }
      setInfo('Cuenta creada. Si tu proyecto pide confirmación, revisá tu email para activar la cuenta y después iniciá sesión.')
      setMode('signin')
    } else {
      const { error } = await signInWithPassword(email.trim(), password)
      setLoading(false)
      if (error) setError(traducirError(error.message))
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <img src="/logo.png" alt="LsPadelPro" className="w-24 h-24 rounded-2xl object-cover mb-6 shadow-lg" />
      <h1 className="text-2xl font-extrabold mb-1">
        LsPadel<span className="text-gradient">Pro</span>
      </h1>
      <p className="text-slate-400 text-sm mb-8 max-w-xs">
        Organizá tu semana de clases, tus alumnos y tus cobros en un solo lugar.
      </p>

      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-3 bg-white text-slate-800 font-semibold rounded-full px-6 py-3.5 shadow-lg active:scale-[0.98] transition w-full max-w-xs justify-center"
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 35.4 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 39.7 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.6 5.4C41.4 36 44 30.6 44 24c0-1.4-.1-2.7-.4-3.5z"/>
        </svg>
        Continuar con Google
      </button>

      <div className="flex items-center gap-3 w-full max-w-xs my-6">
        <div className="h-px bg-bg-border flex-1" />
        <span className="text-xs text-slate-500">o con tu email</span>
        <div className="h-px bg-bg-border flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3 text-left">
        {mode === 'signup' && (
          <input className="input" placeholder="Tu nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        )}
        <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <div className="text-xs text-red-400 font-medium">{error}</div>}
        {info && <div className="text-xs text-brand font-medium">{info}</div>}

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Un momento...' : mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === 'signup' ? 'signin' : 'signup')
          setError('')
          setInfo('')
        }}
        className="text-xs text-slate-400 mt-4"
      >
        {mode === 'signup' ? '¿Ya tenés cuenta? ' : '¿Todavía no tenés cuenta? '}
        <span className="text-brand font-semibold">{mode === 'signup' ? 'Iniciar sesión' : 'Crear una'}</span>
      </button>

      <p className="text-slate-600 text-xs mt-8 max-w-xs">
        Al continuar aceptás los Términos y condiciones y la Política de privacidad de LsPadelPro.
      </p>
    </div>
  )
}

function traducirError(msg) {
  if (!msg) return 'Ocurrió un error. Probá de nuevo.'
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (msg.includes('User already registered')) return 'Ese email ya tiene una cuenta. Iniciá sesión.'
  if (msg.includes('Password should be at least')) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (msg.includes('Unable to validate email address')) return 'Ese email no es válido.'
  return msg
}
