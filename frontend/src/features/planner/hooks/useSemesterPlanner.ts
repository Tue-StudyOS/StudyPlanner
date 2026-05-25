import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../../../shared/utils/api'
import { useAuth } from '../../auth'
import {
  deleteSemesterPlan,
  fetchSemesterPlan,
  fetchSemesterPlans,
  saveSemesterPlan,
} from '../api'
import type { SemesterPlan, SemesterPlanSummary } from '../types'
import {
  buildSemesterOptions,
  getCurrentSemesterLabel,
  getRelativeSemesterLabel,
} from '../utils/semesterLabels'

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Failed to synchronize your semester plan.'
}

function areCourseIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((courseId, index) => courseId === right[index])
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
  planAssignments: Record<string, string>
  savedPlan: SemesterPlan | null
  isEditing: boolean
  isLoadingPlanIndex: boolean
  isLoadingSemesterPlan: boolean
  isSavingSemesterPlan: boolean
  isDeletingSemesterPlan: boolean
  plannerError: string | null
  hasUnsavedChanges: boolean
  setActiveSemesterLabel: (semesterLabel: string) => void
  setPlannedCourseIds: (courseIds: string[]) => void
  setAssignment: (courseId: string, areaCode: string | null) => void
  startEditing: () => void
  cancelEditing: () => void
  saveCurrentSemesterPlan: () => Promise<void>
  deleteCurrentSemesterPlan: () => Promise<void>
}

export function useSemesterPlanner(): UseSemesterPlannerResult {
  const { token, user } = useAuth()
  const profileSemesterLabel = user?.profile.currentSemesterLabel ?? null
  const [savedPlans, setSavedPlans] = useState<SemesterPlanSummary[]>([])
  const [savedPlan, setSavedPlan] = useState<SemesterPlan | null>(null)
  const [plannedCourseIds, setPlannedCourseIds] = useState<string[]>([])
  const [planAssignments, setPlanAssignments] = useState<Record<string, string>>({})
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [isLoadingPlanIndex, setIsLoadingPlanIndex] = useState<boolean>(false)
  const [isLoadingSemesterPlan, setIsLoadingSemesterPlan] = useState<boolean>(false)
  const [isSavingSemesterPlan, setIsSavingSemesterPlan] = useState<boolean>(false)
  const [isDeletingSemesterPlan, setIsDeletingSemesterPlan] = useState<boolean>(false)
  const [plannerError, setPlannerError] = useState<string | null>(null)
  const currentSemesterLabel = getCurrentSemesterLabel()
  const latestSelectableSemesterLabel = getRelativeSemesterLabel(currentSemesterLabel, 1)
  const [activeSemesterLabel, setActiveSemesterLabelState] = useState<string>(
    profileSemesterLabel || currentSemesterLabel,
  )

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
          setPlanAssignments({})
          setIsEditing(false)
          setPlannerError(null)
          setIsLoadingPlanIndex(false)
          setIsLoadingSemesterPlan(false)
        }
        return
      }

      setIsLoadingPlanIndex(true)
      try {
        const nextSavedPlans = await fetchSemesterPlans(token)
        if (!isActive) {
          return
        }
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
  }, [token])

  useEffect(() => {
    let isActive = true

    async function loadSemesterPlan(): Promise<void> {
      if (!token) {
        return
      }

      setIsLoadingSemesterPlan(true)
      setPlannerError(null)
      try {
        const nextSavedPlan = await fetchSemesterPlan(token, normalizedActiveSemesterLabel)
        if (!isActive) {
          return
        }
        setSavedPlan(nextSavedPlan)
        setPlannedCourseIds(nextSavedPlan?.courseIds ?? [])
        setPlanAssignments(nextSavedPlan?.courseAssignments ?? {})
        setIsEditing(false)
      } catch (error) {
        if (isActive) {
          setSavedPlan(null)
          setPlannedCourseIds([])
          setPlanAssignments({})
          setIsEditing(false)
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
  }, [normalizedActiveSemesterLabel, token])

  const hasUnsavedChanges = useMemo(
    () =>
      !areCourseIdsEqual(plannedCourseIds, savedPlan?.courseIds ?? []) ||
      !areAssignmentsEqual(planAssignments, savedPlan?.courseAssignments ?? {}),
    [plannedCourseIds, savedPlan?.courseIds, planAssignments, savedPlan?.courseAssignments],
  )

  const setActiveSemesterLabel = (semesterLabel: string): void => {
    if (semesterLabel === normalizedActiveSemesterLabel) {
      return
    }

    if (
      isEditing &&
      hasUnsavedChanges &&
      typeof window !== 'undefined' &&
      !window.confirm('Discard your unsaved planner changes for the current semester?')
    ) {
      return
    }

    setPlannerError(null)
    setActiveSemesterLabelState(semesterLabel)
  }

  async function refreshSavedPlans(): Promise<void> {
    if (!token) {
      return
    }
    const nextSavedPlans = await fetchSemesterPlans(token)
    setSavedPlans(nextSavedPlans)
  }

  function startEditing(): void {
    setPlannerError(null)
    setPlannedCourseIds(savedPlan?.courseIds ?? [])
    setPlanAssignments(savedPlan?.courseAssignments ?? {})
    setIsEditing(true)
  }

  function cancelEditing(): void {
    setPlannerError(null)
    setPlannedCourseIds(savedPlan?.courseIds ?? [])
    setPlanAssignments(savedPlan?.courseAssignments ?? {})
    setIsEditing(false)
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

  async function saveCurrentSemesterPlan(): Promise<void> {
    if (!token) {
      setPlannerError('Sign in to save a semester plan.')
      return
    }

    setIsSavingSemesterPlan(true)
    setPlannerError(null)
    try {
      const nextSavedPlan = await saveSemesterPlan(token, normalizedActiveSemesterLabel, {
        title: null,
        notes: null,
        courseIds: plannedCourseIds,
        courseAssignments: planAssignments,
      })
      setSavedPlan(nextSavedPlan)
      setPlannedCourseIds(nextSavedPlan.courseIds)
      setPlanAssignments(nextSavedPlan.courseAssignments)
      setIsEditing(false)
      await refreshSavedPlans()
    } catch (error) {
      setPlannerError(normalizeErrorMessage(error))
    } finally {
      setIsSavingSemesterPlan(false)
    }
  }

  async function deleteCurrentSemesterPlan(): Promise<void> {
    if (!token) {
      setPlannerError('Sign in to delete a semester plan.')
      return
    }

    setIsDeletingSemesterPlan(true)
    setPlannerError(null)
    try {
      await deleteSemesterPlan(token, normalizedActiveSemesterLabel)
      setSavedPlan(null)
      setPlannedCourseIds([])
      setIsEditing(false)
      await refreshSavedPlans()
    } catch (error) {
      setPlannerError(normalizeErrorMessage(error))
    } finally {
      setIsDeletingSemesterPlan(false)
    }
  }

  return {
    activeSemesterLabel: normalizedActiveSemesterLabel,
    semesterOptions,
    savedPlans,
    plannedCourseIds,
    planAssignments,
    savedPlan,
    isEditing,
    isLoadingPlanIndex,
    isLoadingSemesterPlan,
    isSavingSemesterPlan,
    isDeletingSemesterPlan,
    plannerError,
    hasUnsavedChanges,
    setActiveSemesterLabel,
    setPlannedCourseIds,
    setAssignment,
    startEditing,
    cancelEditing,
    saveCurrentSemesterPlan,
    deleteCurrentSemesterPlan,
  }
}
