import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'
import { LEGACY_PLANNER_ROUTE, ROUTES, semesterPath } from '../../routes'
import { getCurrentSemesterLabel } from './semesterLabels'

// One flag: a course was added to the current semester plan from outside its
// planner page. Only the current semester card (and the semester tab) show it.
export const SEMESTER_PLAN_CHANGED_EVENT = 'studyplanner:semester-plan-changed'
const BADGE_CHANGED_EVENT = 'studyplanner:semester-tab-badge-changed'

function readBadgeFlag(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.localStorage.getItem(BROWSER_STORAGE_KEYS.semesterTabBadge) === '1'
  } catch {
    return false
  }
}

export function markSemesterBadge(): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(BROWSER_STORAGE_KEYS.semesterTabBadge, '1')
  } catch {
    // The badge event still updates the current tab when storage is unavailable.
  }
  window.dispatchEvent(new Event(BADGE_CHANGED_EVENT))
}

function clearBadgeFlag(): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.removeItem(BROWSER_STORAGE_KEYS.semesterTabBadge)
  } catch {
    // The in-memory event still clears the currently rendered badge.
  }
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
