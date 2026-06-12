import type { Course } from '../types'

export const COURSE_TYPE_FILTERS = [
  { value: 'lecture', label: 'Lecture', keywords: ['vorlesung', 'lecture'] },
  {
    value: 'seminar',
    label: 'Seminar',
    keywords: ['seminar', 'proseminar', 'hauptseminar', 'oberseminar', 'blockseminar'],
  },
  {
    value: 'exercise',
    label: 'Exercise',
    keywords: ['übung', 'uebung', 'exercise', 'tutorial', 'tutorium'],
  },
  {
    value: 'practical',
    label: 'Practical / Project',
    keywords: ['praktikum', 'practical', 'projekt', 'project', 'lab'],
  },
  {
    value: 'colloquium',
    label: 'Colloquium / Talk',
    keywords: ['kolloquium', 'colloquium', 'vortrag', 'talk', 'ringvorlesung'],
  },
] as const

export type CourseTypeFilterValue = (typeof COURSE_TYPE_FILTERS)[number]['value']

function courseTypeTexts(course: Pick<Course, 'types' | 'courseType'>): string[] {
  return [...course.types, course.courseType ?? '']
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
}

export function courseMatchesTypeFilter(
  course: Pick<Course, 'types' | 'courseType'>,
  selectedTypes: CourseTypeFilterValue[],
): boolean {
  if (selectedTypes.length === 0) {
    return true
  }
  const typeTexts = courseTypeTexts(course)
  return selectedTypes.some((selected) => {
    const filter = COURSE_TYPE_FILTERS.find((candidate) => candidate.value === selected)
    if (!filter) {
      return false
    }
    return typeTexts.some((text) => filter.keywords.some((keyword) => text.includes(keyword)))
  })
}
