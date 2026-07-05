import type { CompletedCourse } from '../courses'

/** One semester column in the "Semesterverlauf" of the beta study-plan UI. */
export interface SemesterGroup {
  label: string
  courses: CompletedCourse[]
  totalEcts: number
  averageGrade: number | null
  /** Current or future semester — rendered as the open ("offen") column. */
  isOpen: boolean
}
