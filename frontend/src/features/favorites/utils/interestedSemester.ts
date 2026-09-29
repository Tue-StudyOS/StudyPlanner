import { getPlanningSemesterLabel } from '../../courses/utils/catalogOffering.ts'
import { parseSemesterLabel } from '../../planner/utils/semesterLabels.ts'

export function resolveInterestedSemester(
  pathname: string,
  search: string = '',
  now: Date = new Date(),
): string {
  const detailMatch = pathname.match(/^\/semester\/([^/]+)\/?$/)
  let selectedLabel = new URLSearchParams(search).get('semester')
  if (detailMatch) {
    try {
      selectedLabel = decodeURIComponent(detailMatch[1])
    } catch {
      selectedLabel = null
    }
  } else if (!/^\/catalog(?:\/|$)/.test(pathname)) {
    selectedLabel = null
  }
  const semester = parseSemesterLabel(selectedLabel)
  if (!semester) {
    return getPlanningSemesterLabel(now)
  }
  return semester.term === 'SS'
    ? `SS ${semester.year}`
    : `WS ${semester.year}/${String(semester.year + 1).slice(-2)}`
}

export function interestedCatalogPath(semesterLabel: string): string {
  return `/catalog?semester=${encodeURIComponent(semesterLabel)}`
}
