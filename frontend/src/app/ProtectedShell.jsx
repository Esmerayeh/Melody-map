import { Navigate, useLocation } from 'react-router-dom'
import useStore from '../store/useStore'
import AppShell from './AppShell'
import { RouteCrashBoundary, ProtectedRouteFallback } from './RouteFallbacks'

function ProtectedRoute({ children }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function ProtectedShell({ children }) {
  const location = useLocation()

  return (
    <ProtectedRoute>
      <RouteCrashBoundary resetKey={location.pathname} fallback={<ProtectedRouteFallback />}>
        <AppShell>{children}</AppShell>
      </RouteCrashBoundary>
    </ProtectedRoute>
  )
}
