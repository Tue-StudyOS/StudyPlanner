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

const PLANNER_DRAFT_STORAGE_PREFIX = 'studyplaner.semesterPlannerDraft'

interface SemesterPlannerDraft {
  courseIds: string[]
  hiddenSlotIds: string[]
  courseAssignments: Record<string, string>
}

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

function buildDraftStorageKey(userId: string | number | null | undefined, semesterLabel: string): string | null {
  if (userId === null || userId === undefined || !semesterLabel) {
    return null
  }
  return `${PLANNER_DRAFT_STORAGE_PREFIX}:${String(userId)}:${semesterLabel}`
}

function readDraft(key: string | null): SemesterPlannerDraft | null {
  if (!key || typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(key)
    if (!rawValue) {
      return null
    }
    const parsedValue = JSON.parse(rawValue) as Partial<SemesterPlannerDraft>
    if (!Array.isArray(parsedValue.courseIds)) {
      return null
    }
    return {
      courseIds: parsedValue.courseIds.filter((value): value is string => typeof value === 'string'),
      hiddenSlotIds: Array.isArray(parsedValue.hiddenSlotIds)
        ? parsedValue.hiddenSlotIds.filter((value): value is string => typeof value === 'string')
        : [],
      courseAssignments: parsedValue.courseAssignments && typeof parsedValue.courseAssignments === 'object'
        ? Object.fromEntries(
            Object.entries(parsedValue.courseAssignments).filter(
              (entry): entry is [string, string] => typeof entry[1] === 'string',
            ),
          )
        : {},
    }
  } catch {
    return null
  }
}

function writeDraft(key: string | null, draft: SemesterPlannerDraft): void {
  if (!key || typeof window === 'undefined') {
    return
  }
  window.sessionStorage.setItem(key, JSON.stringify(draft))
}

function clearDraft(key: string | null): void {
  if (!key || typeof window === 'undefined') {
    return
  }
  window.sessionStorage.removeItem(key)
}

interface UseSemesterPlannerResult {
  activeSemesterLabel: string
  semesterOptions: string[]
  savedPlans: SemesterPlanSummary[]
  plannedCourseIds: string[]
  hiddenSlotIds: string[]
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
  setHiddenSlotIds: (slotIds: string[]) => void
  setAssignment: (courseId: string, areaCode: string | null) => void
  setAssignments: (assignments: Record<string, string>) => void
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
  const [hiddenSlotIds, setHiddenSlotIds] = useState<string[]>([])
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
  const draftStorageKey = buildDraftStorageKey(user?.id, normalizedActiveSemesterLabel)

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
        const draft = readDraft(buildDraftStorageKey(user?.id, normalizedActiveSemesterLabel))
        if (draft) {
          setPlannedCourseIds(draft.courseIds)
          setHiddenSlotIds(draft.hiddenSlotIds)
          setPlanAssignments(draft.courseAssignments)
          setIsEditing(true)
        } else {
          setPlannedCourseIds(nextSavedPlan?.courseIds ?? [])
          setHiddenSlotIds(nextSavedPlan?.hiddenSlotIds ?? [])
          setPlanAssignments(nextSavedPlan?.courseAssignments ?? {})
          setIsEditing(false)
        }
      } catch (error) {
        if (isActive) {
          setSavedPlan(null)
          setPlannedCourseIds([])
          setHiddenSlotIds([])
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
  }, [normalizedActiveSemesterLabel, token, user?.id])

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

  const setActiveSemesterLabel = (semesterLabel: string): void => {
    if (semesterLabel === normalizedActiveSemesterLabel) {
      return
    }

    setPlannerError(null)
    setActiveSemesterLabelState(semesterLabel)
  }

  useEffect(() => {
    if (!isEditing) {
      return
    }
    if (!hasUnsavedChanges) {
      clearDraft(draftStorageKey)
      return
    }
    writeDraft(draftStorageKey, {
      courseIds: plannedCourseIds,
      hiddenSlotIds,
      courseAssignments: planAssignments,
    })
  }, [
    draftStorageKey,
    hasUnsavedChanges,
    hiddenSlotIds,
    isEditing,
    planAssignments,
    plannedCourseIds,
  ])

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
    setHiddenSlotIds(savedPlan?.hiddenSlotIds ?? [])
    setPlanAssignments(savedPlan?.courseAssignments ?? {})
    setIsEditing(true)
  }

  function cancelEditing(): void {
    setPlannerError(null)
    setPlannedCourseIds(savedPlan?.courseIds ?? [])
    setHiddenSlotIds(savedPlan?.hiddenSlotIds ?? [])
    setPlanAssignments(savedPlan?.courseAssignments ?? {})
    setIsEditing(false)
    clearDraft(draftStorageKey)
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
        hiddenSlotIds,
        courseAssignments: planAssignments,
      })
      setSavedPlan(nextSavedPlan)
      setPlannedCourseIds(nextSavedPlan.courseIds)
      setHiddenSlotIds(nextSavedPlan.hiddenSlotIds)
      setPlanAssignments(nextSavedPlan.courseAssignments)
      setIsEditing(false)
      clearDraft(draftStorageKey)
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
      setHiddenSlotIds([])
      setPlanAssignments({})
      setIsEditing(false)
      clearDraft(draftStorageKey)
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
    hiddenSlotIds,
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
    setHiddenSlotIds,
    setAssignment,
    setAssignments,
    startEditing,
    cancelEditing,
    saveCurrentSemesterPlan,
    deleteCurrentSemesterPlan,
  }
}
