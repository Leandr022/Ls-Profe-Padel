import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <img src="/logo.png" alt="ProfePadel" className="w-24 h-24 rounded-2xl object-cover mb-6 shadow-lg" />
      <h1 className="text-2xl font-extrabold mb-1">
        Profe<span className="text-brand">Padel</span>
      </h1>
      <p className="text-slate-400 text-sm mb-10 max-w-xs">
        Organizá tu semana de clases, tus alumnos y tus cobros en un solo lugar.
      </p>
      <button
        onClick={signInWithGoogle}
        className="flex items-center gap-3 bg-white text-slate-800 font-semibold rounded-full px-6 py-3.5 shadow-lg active:scale-[0.98] transition"
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 35.4 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.5 39.7 16.2 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.6 5.4C41.4 36 44 30.6 44 24c0-1.4-.1-2.7-.4-3.5z"/>
        </svg>
        Continuar con Google
      </button>
      <p className="text-slate-600 text-xs mt-8 max-w-xs">
        Al continuar aceptás los Términos y condiciones y la Política de privacidad de ProfePadel.
      </p>
    </div>
  )
}
