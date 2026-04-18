import { Navigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/model/useAuthStore'

export default function RequireAuth() {
  const isLoggedIn = useAuthStore(s => s.isLoggedIn)
  const location   = useLocation()

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
