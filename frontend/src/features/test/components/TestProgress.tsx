import { Dashboard } from '../../dashboard/components/Dashboard'
import { RequireTestAuth } from './RequireTestAuth'

// Degree progress, reusing the main dashboard. Back navigation lives in TestLayout.
export function TestProgress() {
  return (
    <RequireTestAuth>
      <Dashboard />
    </RequireTestAuth>
  )
}
