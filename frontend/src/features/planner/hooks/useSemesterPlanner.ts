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
import { buildSemesterOptions, getCurrentSemesterLabel } from '../utils/semesterLabels'

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

interface UseSemesterPlannerResult {
  activeSemesterLabel: string
  semesterOptions: string[]
  savedPlans: SemesterPlanSummary[]
  plannedCourseIds: string[]
  savedPlan: SemesterPlan | null
  isEditing: boolean
  isLoadingPlanIndex: boolean
  isLoadingSemesterPlan: boolean
  isSavingSemesterPlan: boolean
  isDeletingSemesterPlan: boolean
  plannerError: string | null
  plannerMessage: string | null
  hasUnsavedChanges: boolean
  setActiveSemesterLabel: (semesterLabel: string) => void
  setPlannedCourseIds: (courseIds: string[]) => void
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
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [isLoadingPlanIndex, setIsLoadingPlanIndex] = useState<boolean>(false)
  const [isLoadingSemesterPlan, setIsLoadingSemesterPlan] = useState<boolean>(false)
  const [isSavingSemesterPlan, setIsSavingSemesterPlan] = useState<boolean>(false)
  const [isDeletingSemesterPlan, setIsDeletingSemesterPlan] = useState<boolean>(false)
  const [plannerError, setPlannerError] = useState<string | null>(null)
  const [plannerMessage, setPlannerMessage] = useState<string | null>(null)
  const [activeSemesterLabel, setActiveSemesterLabelState] = useState<string>(
    profileSemesterLabel || getCurrentSemesterLabel(),
  )

  const semesterOptions = useMemo(
    () =>
      buildSemesterOptions([
        activeSemesterLabel,
        profileSemesterLabel,
        ...savedPlans.map((semesterPlan) => semesterPlan.semesterLabel),
      ]),
    [activeSemesterLabel, profileSemesterLabel, savedPlans],
  )

  useEffect(() => {
    let isActive = true

    async function loadPlanIndex(): Promise<void> {
      if (!token) {
        if (isActive) {
          setSavedPlans([])
          setSavedPlan(null)
          setPlannedCourseIds([])
          setIsEditing(false)
          setPlannerError(null)
          setPlannerMessage(null)
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
        const nextSavedPlan = await fetchSemesterPlan(token, activeSemesterLabel)
        if (!isActive) {
          return
        }
        setSavedPlan(nextSavedPlan)
        setPlannedCourseIds(nextSavedPlan?.courseIds ?? [])
        setIsEditing(false)
      } catch (error) {
        if (isActive) {
          setSavedPlan(null)
          setPlannedCourseIds([])
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
  }, [activeSemesterLabel, token])

  const hasUnsavedChanges = useMemo(
    () => !areCourseIdsEqual(plannedCourseIds, savedPlan?.courseIds ?? []),
    [plannedCourseIds, savedPlan?.courseIds],
  )

  const setActiveSemesterLabel = (semesterLabel: string): void => {
    if (semesterLabel === activeSemesterLabel) {
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

    setPlannerMessage(null)
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
    setPlannerMessage(null)
    setPlannerError(null)
    setPlannedCourseIds(savedPlan?.courseIds ?? [])
    setIsEditing(true)
  }

  function cancelEditing(): void {
    setPlannerMessage(null)
    setPlannerError(null)
    setPlannedCourseIds(savedPlan?.courseIds ?? [])
    setIsEditing(false)
  }

  async function saveCurrentSemesterPlan(): Promise<void> {
    if (!token) {
      setPlannerError('Sign in to save a semester plan.')
      return
    }

    setIsSavingSemesterPlan(true)
    setPlannerError(null)
    setPlannerMessage(null)
    try {
      const nextSavedPlan = await saveSemesterPlan(token, activeSemesterLabel, {
        title: null,
        notes: null,
        courseIds: plannedCourseIds,
      })
      setSavedPlan(nextSavedPlan)
      setPlannedCourseIds(nextSavedPlan.courseIds)
      setIsEditing(false)
      await refreshSavedPlans()
      setPlannerMessage(`Saved your plan for ${activeSemesterLabel}.`)
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
    setPlannerMessage(null)
    try {
      await deleteSemesterPlan(token, activeSemesterLabel)
      setSavedPlan(null)
      setPlannedCourseIds([])
      setIsEditing(false)
      await refreshSavedPlans()
      setPlannerMessage(`Removed the saved plan for ${activeSemesterLabel}.`)
    } catch (error) {
      setPlannerError(normalizeErrorMessage(error))
    } finally {
      setIsDeletingSemesterPlan(false)
    }
  }

  return {
    activeSemesterLabel,
    semesterOptions,
    savedPlans,
    plannedCourseIds,
    savedPlan,
    isEditing,
    isLoadingPlanIndex,
    isLoadingSemesterPlan,
    isSavingSemesterPlan,
    isDeletingSemesterPlan,
    plannerError,
    plannerMessage,
    hasUnsavedChanges,
    setActiveSemesterLabel,
    setPlannedCourseIds,
    startEditing,
    cancelEditing,
    saveCurrentSemesterPlan,
    deleteCurrentSemesterPlan,
  }
}
