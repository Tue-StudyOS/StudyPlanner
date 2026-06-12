import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../../../shared/utils/api'
import { invalidateSessionCache, readSessionCache, writeSessionCache } from '../../../shared/utils/sessionCache.ts'
import { useAuth } from '../../auth'
import { fetchSemesterPlan, fetchSemesterPlans, saveSemesterPlan } from '../api'
import type { SemesterPlan, SemesterPlanSummary } from '../types'
import {
  buildSemesterOptions,
  getCurrentSemesterLabel,
  getRelativeSemesterLabel,
} from '../utils/semesterLabels'

const AUTO_SAVE_DEBOUNCE_MS = 900

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Failed to synchronize your semester plan.'
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}

function areAssignmentsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  return leftKeys.every((key) => left[key] === right[key])
}

interface UseSemesterPlannerResult {
  activeSemesterLabel: string
  semesterOptions: string[]
  savedPlans: SemesterPlanSummary[]
  plannedCourseIds: string[]
  hiddenSlotIds: string[]
  planAssignments: Record<string, string>
  savedPlan: SemesterPlan | null
  isLoadingPlanIndex: boolean
  isLoadingSemesterPlan: boolean
  isSavingSemesterPlan: boolean
  plannerError: string | null
  hasUnsavedChanges: boolean
  setActiveSemesterLabel: (semesterLabel: string) => void
  setPlannedCourseIds: (courseIds: string[]) => void
  setHiddenSlotIds: (slotIds: string[]) => void
  setAssignment: (courseId: string, areaCode: string | null) => void
  setAssignments: (assignments: Record<string, string>) => void
}

/**
 * Owns the semester plan state with automatic persistence: every change is
 * debounce-saved to the account — there is no edit mode, no drafts, and no
 * explicit save or delete action.
 */
export function useSemesterPlanner(): UseSemesterPlannerResult {
  const { token, user } = useAuth()
  const userCacheKey = user?.username ?? 'anonymous'
  const profileSemesterLabel = user?.profile.currentSemesterLabel ?? null
  const [savedPlans, setSavedPlans] = useState<SemesterPlanSummary[]>([])
  const [savedPlan, setSavedPlan] = useState<SemesterPlan | null>(null)
  const [plannedCourseIds, setPlannedCourseIds] = useState<string[]>([])
  const [hiddenSlotIds, setHiddenSlotIds] = useState<string[]>([])
  const [planAssignments, setPlanAssignments] = useState<Record<string, string>>({})
  const [isLoadingPlanIndex, setIsLoadingPlanIndex] = useState<boolean>(false)
  const [isLoadingSemesterPlan, setIsLoadingSemesterPlan] = useState<boolean>(false)
  const [isSavingSemesterPlan, setIsSavingSemesterPlan] = useState<boolean>(false)
  const [plannerError, setPlannerError] = useState<string | null>(null)
  const currentSemesterLabel = getCurrentSemesterLabel()
  const latestSelectableSemesterLabel = getRelativeSemesterLabel(currentSemesterLabel, 1)
  // The current semester is always the default; older plans stay reachable
  // through the minimal switcher.
  const [activeSemesterLabel, setActiveSemesterLabelState] = useState<string>(currentSemesterLabel)

  const semesterOptions = useMemo(
    () =>
      buildSemesterOptions(
        [
          activeSemesterLabel,
          profileSemesterLabel,
          ...savedPlans.map((semesterPlan) => semesterPlan.semesterLabel),
        ],
        currentSemesterLabel,
        profileSemesterLabel,
        latestSelectableSemesterLabel,
      ),
    [
      activeSemesterLabel,
      currentSemesterLabel,
      latestSelectableSemesterLabel,
      profileSemesterLabel,
      savedPlans,
    ],
  )

  const normalizedActiveSemesterLabel = semesterOptions.includes(activeSemesterLabel)
    ? activeSemesterLabel
    : (semesterOptions.at(-1) ?? activeSemesterLabel)

  useEffect(() => {
    let isActive = true

    async function loadPlanIndex(): Promise<void> {
      if (!token) {
        if (isActive) {
          setSavedPlans([])
          setSavedPlan(null)
          setPlannedCourseIds([])
          setHiddenSlotIds([])
          setPlanAssignments({})
          setPlannerError(null)
          setIsLoadingPlanIndex(false)
          setIsLoadingSemesterPlan(false)
        }
        return
      }

      const cachedSavedPlans = readSessionCache<SemesterPlanSummary[]>('private:planner:index', userCacheKey)
      if (cachedSavedPlans) {
        setSavedPlans(cachedSavedPlans)
      }
      setIsLoadingPlanIndex(!cachedSavedPlans)
      try {
        const nextSavedPlans = await fetchSemesterPlans(token)
        if (!isActive) {
          return
        }
        writeSessionCache('private:planner:index', nextSavedPlans, userCacheKey)
        setSavedPlans(nextSavedPlans)
      } catch (error) {
        if (isActive) {
          setPlannerError(normalizeErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoadingPlanIndex(false)
        }
      }
    }

    void loadPlanIndex()

    return () => {
      isActive = false
    }
  }, [token, userCacheKey])

  useEffect(() => {
    let isActive = true

    async function loadSemesterPlan(): Promise<void> {
      if (!token) {
        return
      }

      const planCacheKey = `private:planner:plan:${normalizedActiveSemesterLabel}`
      const cachedSemesterPlan = readSessionCache<SemesterPlan | null>(planCacheKey, userCacheKey)
      if (cachedSemesterPlan !== null) {
        setSavedPlan(cachedSemesterPlan)
        setPlannedCourseIds(cachedSemesterPlan.courseIds)
        setHiddenSlotIds(cachedSemesterPlan.hiddenSlotIds)
        setPlanAssignments(cachedSemesterPlan.courseAssignments)
      }
      setIsLoadingSemesterPlan(cachedSemesterPlan === null)
      setPlannerError(null)
      try {
        const nextSavedPlan = await fetchSemesterPlan(token, normalizedActiveSemesterLabel)
        if (!isActive) {
          return
        }
        writeSessionCache(planCacheKey, nextSavedPlan, userCacheKey)
        setSavedPlan(nextSavedPlan)
        setPlannedCourseIds(nextSavedPlan?.courseIds ?? [])
        setHiddenSlotIds(nextSavedPlan?.hiddenSlotIds ?? [])
        setPlanAssignments(nextSavedPlan?.courseAssignments ?? {})
      } catch (error) {
        if (isActive) {
          setSavedPlan(null)
          setPlannedCourseIds([])
          setHiddenSlotIds([])
          setPlanAssignments({})
          setPlannerError(normalizeErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsLoadingSemesterPlan(false)
        }
      }
    }

    void loadSemesterPlan()

    return () => {
      isActive = false
    }
  }, [normalizedActiveSemesterLabel, token, userCacheKey])

  const hasUnsavedChanges = useMemo(
    () =>
      !areStringArraysEqual(plannedCourseIds, savedPlan?.courseIds ?? []) ||
      !areStringArraysEqual(hiddenSlotIds, savedPlan?.hiddenSlotIds ?? []) ||
      !areAssignmentsEqual(planAssignments, savedPlan?.courseAssignments ?? {}),
    [
      hiddenSlotIds,
      planAssignments,
      plannedCourseIds,
      savedPlan?.courseAssignments,
      savedPlan?.courseIds,
      savedPlan?.hiddenSlotIds,
    ],
  )

  async function persistPlan(semesterLabel: string): Promise<void> {
    if (!token) {
      return
    }

    setIsSavingSemesterPlan(true)
    setPlannerError(null)
    try {
      const nextSavedPlan = await saveSemesterPlan(token, semesterLabel, {
        title: null,
        notes: null,
        courseIds: plannedCourseIds,
        hiddenSlotIds,
        courseAssignments: planAssignments,
      })
      setSavedPlan((currentSavedPlan) =>
        // A semester switch can race the save response; only adopt the result
        // when the response still belongs to the selected semester.
        semesterLabel === nextSavedPlan.semesterLabel ? nextSavedPlan : currentSavedPlan,
      )
      writeSessionCache(`private:planner:plan:${semesterLabel}`, nextSavedPlan, userCacheKey)
      const nextSavedPlans = await fetchSemesterPlans(token)
      writeSessionCache('private:planner:index', nextSavedPlans, userCacheKey)
      invalidateSessionCache('private:progress', userCacheKey)
      setSavedPlans(nextSavedPlans)
    } catch (error) {
      setPlannerError(normalizeErrorMessage(error))
    } finally {
      setIsSavingSemesterPlan(false)
    }
  }

  const persistRef = useRef<{ hasUnsavedChanges: boolean; persist: () => void }>({
    hasUnsavedChanges: false,
    persist: () => {},
  })
  useEffect(() => {
    persistRef.current = {
      hasUnsavedChanges,
      persist: () => void persistPlan(normalizedActiveSemesterLabel),
    }
  })

  useEffect(() => {
    if (!token || !hasUnsavedChanges || isLoadingSemesterPlan) {
      return
    }
    const timeoutId = window.setTimeout(
      () => void persistPlan(normalizedActiveSemesterLabel),
      AUTO_SAVE_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasUnsavedChanges,
    hiddenSlotIds,
    isLoadingSemesterPlan,
    normalizedActiveSemesterLabel,
    planAssignments,
    plannedCourseIds,
    token,
  ])

  // Flush a pending change when the planner unmounts so quick navigation
  // never loses the last edit.
  useEffect(
    () => () => {
      if (persistRef.current.hasUnsavedChanges) {
        persistRef.current.persist()
      }
    },
    [],
  )

  const setActiveSemesterLabel = (semesterLabel: string): void => {
    if (semesterLabel === normalizedActiveSemesterLabel) {
      return
    }

    // Save synchronously before switching so the debounce window cannot drop
    // the last change of the previous semester.
    if (persistRef.current.hasUnsavedChanges) {
      persistRef.current.persist()
    }
    setPlannerError(null)
    setActiveSemesterLabelState(semesterLabel)
  }

  function setAssignment(courseId: string, areaCode: string | null): void {
    setPlanAssignments((prev) => {
      if (!areaCode) {
        const next = { ...prev }
        delete next[courseId]
        return next
      }
      return { ...prev, [courseId]: areaCode }
    })
  }

  function setAssignments(assignments: Record<string, string>): void {
    setPlanAssignments(assignments)
  }

  return {
    activeSemesterLabel: normalizedActiveSemesterLabel,
    semesterOptions,
    savedPlans,
    plannedCourseIds,
    hiddenSlotIds,
    planAssignments,
    savedPlan,
    isLoadingPlanIndex,
    isLoadingSemesterPlan,
    isSavingSemesterPlan,
    plannerError,
    hasUnsavedChanges,
    setActiveSemesterLabel,
    setPlannedCourseIds,
    setHiddenSlotIds,
    setAssignment,
    setAssignments,
  }
}
