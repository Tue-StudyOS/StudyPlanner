import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth'
import { TEST_ROUTES } from '../../routes'

// Guards "/test/personal/*" sub-routes: signed-out visitors are sent back to the
// personal entry (which shows the sign-in card).
export function RequireTestAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoadingSession } = useAuth()
  if (isLoadingSession) {
    return <div className="p-8 text-[13px] text-fg-muted">…</div>
  }
  if (!isAuthenticated) {
    return <Navigate to={TEST_ROUTES.personal} replace />
  }
  return <>{children}</>
}
