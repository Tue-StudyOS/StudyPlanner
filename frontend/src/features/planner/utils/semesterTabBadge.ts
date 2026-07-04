import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LEGACY_PLANNER_ROUTE, ROUTES, semesterPath } from '../../routes'

const BADGE_STORAGE_KEY = 'studyplanner.semesterTabBadge'
const PER_SEMESTER_BADGE_PREFIX = 'studyplanner.semesterBadge.'
export const SEMESTER_PLAN_CHANGED_EVENT = 'studyplanner:semester-plan-changed'
const BADGE_CHANGED_EVENT = 'studyplanner:semester-tab-badge-changed'

function readBadgeFlag(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(BADGE_STORAGE_KEY) === '1'
}

function semesterBadgeKey(semesterLabel: string): string {
  return `${PER_SEMESTER_BADGE_PREFIX}${semesterLabel}`
}

export function hasSemesterBadge(semesterLabel: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return window.localStorage.getItem(semesterBadgeKey(semesterLabel)) === '1'
}

export function markSemesterBadge(semesterLabel: string): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(semesterBadgeKey(semesterLabel), '1')
  window.localStorage.setItem(BADGE_STORAGE_KEY, '1')
  window.dispatchEvent(new Event(BADGE_CHANGED_EVENT))
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

function clearSemesterBadge(semesterLabel: string): void {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(semesterBadgeKey(semesterLabel))
  window.dispatchEvent(new Event(BADGE_CHANGED_EVENT))
}

function isSemesterTabPath(pathname: string): boolean {
  return (
    pathname === ROUTES.planner
    || pathname === LEGACY_PLANNER_ROUTE
    || pathname.startsWith('/semester/')
  )
}

export function useSemesterTabBadge(): boolean {
  const location = useLocation()
  const onSemesterTab = isSemesterTabPath(location.pathname)
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
    if (onSemesterTab && readBadgeFlag()) {
      clearBadgeFlag()
    }
  }, [onSemesterTab])

  void revision
  return !onSemesterTab && readBadgeFlag()
}

export function useSemesterCardBadge(semesterLabel: string): boolean {
  const location = useLocation()
  const [revision, setRevision] = useState<number>(0)
  const semesterDetailPath = semesterPath(semesterLabel)

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
    if (location.pathname === semesterDetailPath && hasSemesterBadge(semesterLabel)) {
      clearSemesterBadge(semesterLabel)
    }
  }, [location.pathname, semesterDetailPath, semesterLabel])

  void revision
  return hasSemesterBadge(semesterLabel)
}
