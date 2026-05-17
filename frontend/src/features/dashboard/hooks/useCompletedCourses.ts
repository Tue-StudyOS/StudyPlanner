import { useState } from 'react'
import { useCourses } from '../../courses'
import type { CompletedCourse } from '../../courses'

export function useCompletedCourses(): {
  semesters: string[]
  activeSemester: string
  setActiveSemester: (semester: string) => void
  courses: CompletedCourse[]
} {
  const { completedCourses } = useCourses()

  const semesters = [...new Set(completedCourses.map((c) => c.semester))].sort((a, b) =>
    b.localeCompare(a),
  )

  const [activeSemester, setActiveSemester] = useState(semesters[0] ?? '')

  const courses = completedCourses.filter((c) => c.semester === activeSemester)

  return { semesters, activeSemester, setActiveSemester, courses }
}
