import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LEGACY_PLANNER_ROUTE, ROUTES, semesterPath } from '../../routes'
import { getCurrentSemesterLabel } from './semesterLabels'

// One flag: a course was added to the current semester plan from outside its
// planner page. Only the current semester card (and the semester tab) show it.
const BADGE_STORAGE_KEY = 'studyplanner.semesterTabBadge'
export const SEMESTER_PLAN_CHANGED_EVENT = 'studyplanner:semester-plan-changed'
const BADGE_CHANGED_EVENT = 'studyplanner:semester-tab-badge-changed'

function readBadgeFlag(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(BADGE_STORAGE_KEY) === '1'
}

export function markSemesterBadge(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(BADGE_STORAGE_KEY, '1')
  window.dispatchEvent(new Event(BADGE_CHANGED_EVENT))
}

function clearBadgeFlag(): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(BADGE_STORAGE_KEY)
  window.dispatchEvent(new Event(BADGE_CHANGED_EVENT))
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
    if (location.pathname === semesterPath(getCurrentSemesterLabel()) && readBadgeFlag()) {
      clearBadgeFlag()
    }
  }, [location.pathname])

  return !isSemesterTabPath(location.pathname) && readBadgeFlag()
}

export function useSemesterCardBadge(): boolean {
  useBadgeRevision()
  return readBadgeFlag()
}
