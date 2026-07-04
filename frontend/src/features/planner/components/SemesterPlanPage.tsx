import { useParams } from 'react-router-dom'
import { SemesterPlanner } from './SemesterPlanner'

export function SemesterPlanPage() {
  const { label = '' } = useParams<{ label: string }>()
  const semesterLabel = decodeURIComponent(label)
  return <SemesterPlanner initialSemesterLabel={semesterLabel} />
}
