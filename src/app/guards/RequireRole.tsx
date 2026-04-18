import { useLocation, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/features/auth/model/useAuthStore'
import styles from './RequireRole.module.scss'

export default function RequireRole() {
  const location      = useLocation()
  const canAccess     = useAuthStore(s => s.canAccessRoute)
  const user          = useAuthStore(s => s.user)
  const logout        = useAuthStore(s => s.logout)

  if (!canAccess(location.pathname)) {
    return (
      <div className={styles.denied}>
        <div className={styles.icon}>🔒</div>
        <div className={styles.title}>Access restricted</div>
        <div className={styles.desc}>
          Your role <strong>{user?.role.replace(/_/g, ' ')}</strong> does not have
          permission to view this page.
        </div>
        <div className={styles.actions}>
          <button
            className="btn btn-ghost"
            onClick={() => window.history.back()}
          >
            ← Go back
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
