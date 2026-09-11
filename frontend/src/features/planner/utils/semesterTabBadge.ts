import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { readSemesterBadge, setSemesterBadge } from '../../../shared/utils/semesterBadgeState.ts'
import { LEGACY_PLANNER_ROUTE, ROUTES, semesterPath } from '../../routes'
import { getCurrentSemesterLabel } from './semesterLabels'

// One flag: a course was added to the current semester plan from outside its
// planner page. Only the current semester card (and the semester tab) show it.
export const SEMESTER_PLAN_CHANGED_EVENT = 'studyplanner:semester-plan-changed'
const BADGE_CHANGED_EVENT = 'studyplanner:semester-tab-badge-changed'

export function markSemesterBadge(): void {
  setSemesterBadge(true)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(BADGE_CHANGED_EVENT))
  }
}

function clearBadgeFlag(): void {
  setSemesterBadge(false)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(BADGE_CHANGED_EVENT))
  }
}

function isSemesterTabPath(pathname: string): boolean {
  return (
    pathname === ROUTES.planner
    || pathname === LEGACY_PLANNER_ROUTE
    || pathname.startsWith('/semester/')
  )
}

function useBadgeRevision(): void {
  const [, setRevision] = useState<number>(0)

  useEffect(() => {
    function syncBadge(): void {
      setRevision((currentValue) => currentValue + 1)
    }
    window.addEventListener(BADGE_CHANGED_EVENT, syncBadge)
    window.addEventListener(SEMESTER_PLAN_CHANGED_EVENT, syncBadge)
    return () => {
      window.removeEventListener(BADGE_CHANGED_EVENT, syncBadge)
      window.removeEventListener(SEMESTER_PLAN_CHANGED_EVENT, syncBadge)
    }
  }, [])
}

export function useSemesterTabBadge(): boolean {
  const location = useLocation()
  useBadgeRevision()

  // Opening the current semester plan resolves the notification; visiting the
  // hub alone does not, so the card badge stays visible there.
  useEffect(() => {
    if (location.pathname === semesterPath(getCurrentSemesterLabel()) && readSemesterBadge()) {
      clearBadgeFlag()
    }
  }, [location.pathname])

  return !isSemesterTabPath(location.pathname) && readSemesterBadge()
}

export function useSemesterCardBadge(): boolean {
  useBadgeRevision()
  return readSemesterBadge()
}
