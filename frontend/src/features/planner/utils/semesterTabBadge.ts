import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LEGACY_PLANNER_ROUTE, ROUTES } from '../../routes'

const BADGE_STORAGE_KEY = 'studyplanner.semesterTabBadge'
export const SEMESTER_PLAN_CHANGED_EVENT = 'studyplanner:semester-plan-changed'
const BADGE_CHANGED_EVENT = 'studyplanner:semester-tab-badge-changed'

function readBadgeFlag(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(BADGE_STORAGE_KEY) === '1'
}

export function markSemesterTabBadge(): void {
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

export function useSemesterTabBadge(): boolean {
  const location = useLocation()
  const onPlannerTab =
    location.pathname === ROUTES.planner || location.pathname === LEGACY_PLANNER_ROUTE
  const [revision, setRevision] = useState<number>(0)

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

  useEffect(() => {
    if (onPlannerTab && readBadgeFlag()) {
      clearBadgeFlag()
    }
  }, [onPlannerTab])

  void revision
  return !onPlannerTab && readBadgeFlag()
}
