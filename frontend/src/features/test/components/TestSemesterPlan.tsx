import { useParams } from 'react-router-dom'
import { SemesterPlanner } from '../../planner/components/SemesterPlanner'
import { RequireTestAuth } from './RequireTestAuth'

// Reuses the full schedule builder, locked to the URL semester and rendered in
// the colored-square + number mode instead of course titles.
function SemesterPlanInner() {
  const { label = '' } = useParams<{ label: string }>()
  return <SemesterPlanner initialSemesterLabel={label} renderMode="badge" />
}

export function TestSemesterPlan() {
  return (
    <RequireTestAuth>
      <SemesterPlanInner />
    </RequireTestAuth>
  )
}
