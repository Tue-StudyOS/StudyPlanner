import { useMemo, useState } from 'react'
import { useTranscript } from '../../transcript'
import type { CompletedCourse } from '../../courses'

export function useCompletedCourses(): {
  semesters: string[]
  activeSemester: string
  setActiveSemester: (semester: string) => void
  courses: CompletedCourse[]
} {
  const { completedCourses } = useTranscript()

  const semesters = useMemo(
    () => [...new Set(completedCourses.map((course) => course.semester))].sort((a, b) =>
      b.localeCompare(a),
    ),
    [completedCourses],
  )

  const [selectedSemester, setSelectedSemester] = useState<string>('')
  const activeSemester = semesters.includes(selectedSemester) ? selectedSemester : (semesters[0] ?? '')
  const courses = completedCourses.filter((course) => course.semester === activeSemester)

  return { semesters, activeSemester, setActiveSemester: setSelectedSemester, courses }
}
