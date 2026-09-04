import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { getAccessStatus } from './lib/access'
import RenewalBanner from './components/RenewalBanner'

import Login from './pages/Login'
import Home from './pages/Home'
import Panel from './pages/Panel'
import Calendar from './pages/Calendar'
import Students from './pages/Students'
import Caja from './pages/Caja'
import Stats from './pages/Stats'
import SettingsHome from './pages/settings/SettingsHome'
import ScheduleSettings from './pages/settings/ScheduleSettings'
import RatesSettings from './pages/settings/RatesSettings'
import NotificationsSettings from './pages/settings/NotificationsSettings'
import MessagesSettings from './pages/settings/MessagesSettings'
import DebtSettings from './pages/settings/DebtSettings'
import PlanSettings from './pages/settings/PlanSettings'
import Admin from './pages/Admin'
import Terms from './pages/legal/Terms'
import Privacy from './pages/legal/Privacy'

function useThemeSync() {
  const { profile } = useAuth()
  useEffect(() => {
    const root = document.documentElement
    const theme = profile?.theme || 'dark'
    const isDark =
      theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('light', !isDark)
    root.classList.toggle('dark', isDark)
    root.classList.remove('font-large', 'font-xlarge')
    if (profile?.font_size === 'large') root.classList.add('font-large')
    if (profile?.font_size === 'xlarge') root.classList.add('font-xlarge')
  }, [profile?.theme, profile?.font_size])
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <img src="/logo.png" alt="" className="w-14 h-14 rounded-xl object-cover animate-pulse" />
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { session, loading, profile, profileLoading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  if (profileLoading || !profile) return <FullScreenLoader />

  const access = getAccessStatus(profile)
  const isPlanPage = location.pathname === '/configuracion/plan'

  if (access.blocked && !isPlanPage) {
    return <Navigate to="/configuracion/plan" replace state={{ blocked: true, source: access.source }} />
  }

  return (
    <>
      {access.showWarning && !isPlanPage && <RenewalBanner daysLeft={access.daysLeft} source={access.source} />}
      {children}
    </>
  )
}

function AdminRoute({ children }) {
  const { profile } = useAuth()
  if (!profile?.unlimited_access) return <Navigate to="/configuracion" replace />
  return children
}

export default function App() {
  useThemeSync()
  const { session, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/panel" element={<ProtectedRoute><Panel /></ProtectedRoute>} />
      <Route path="/panel/calendario" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
      <Route path="/panel/alumnos" element={<ProtectedRoute><Students /></ProtectedRoute>} />
      <Route path="/panel/caja" element={<ProtectedRoute><Caja /></ProtectedRoute>} />
      <Route path="/panel/estadisticas" element={<ProtectedRoute><Stats /></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><SettingsHome /></ProtectedRoute>} />
      <Route path="/configuracion/horarios" element={<ProtectedRoute><ScheduleSettings /></ProtectedRoute>} />
      <Route path="/configuracion/tarifas" element={<ProtectedRoute><RatesSettings /></ProtectedRoute>} />
      <Route path="/configuracion/notificaciones" element={<ProtectedRoute><NotificationsSettings /></ProtectedRoute>} />
      <Route path="/configuracion/mensajes" element={<ProtectedRoute><MessagesSettings /></ProtectedRoute>} />
      <Route path="/configuracion/deuda" element={<ProtectedRoute><DebtSettings /></ProtectedRoute>} />
      <Route path="/configuracion/plan" element={<ProtectedRoute><PlanSettings /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><AdminRoute><Admin /></AdminRoute></ProtectedRoute>} />
      <Route path="/legal/terminos" element={<ProtectedRoute><Terms /></ProtectedRoute>} />
      <Route path="/legal/privacidad" element={<ProtectedRoute><Privacy /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
