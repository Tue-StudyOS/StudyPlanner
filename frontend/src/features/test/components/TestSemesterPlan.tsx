import { useParams } from 'react-router-dom'
import { SemesterPlanner } from '../../planner/components/SemesterPlanner'
import { RequireTestAuth } from './RequireTestAuth'

function SemesterPlanInner() {
  const { label = '' } = useParams<{ label: string }>()
  return <SemesterPlanner initialSemesterLabel={label} readOnly />
}

export function TestSemesterPlan() {
  return (
    <RequireTestAuth>
      <SemesterPlanInner />
    </RequireTestAuth>
  )
}
