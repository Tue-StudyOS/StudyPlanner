import { useEffect, useMemo, useState } from 'react'
import { CompletedBadge } from '../../../shared/components/CompletedBadge'
import { CloseIcon } from '../../../shared/components/icons'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import { getEffectiveRuleGroupCapacity, studyAreaCodeToMasterCat } from '../../../shared/utils/regulation'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import { useTranscript } from '../../transcript'
import { StudyAreaAssignmentField } from '../../transcript/components/StudyAreaAssignmentField'
import { normalizeCompletedCourseKey } from '../../transcript/utils/completedCourseKeys'
import {
  getPlannerCourseAreaOptions,
  resolveAutomaticPlannerAssignments,
  type PlannerAssignmentAreaState,
} from '../utils/plannerAssignments'

const FALLBACK_MASTER_CAT: MasterCat = 'INFO'

interface SemesterCompletionDialogProps {
  semesterLabel: string
  plannedCourses: Course[]
  planAssignments: Record<string, string>
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  onClose: () => void
  onSuccess: (message: string) => void
}

interface CompletionCourseRow {
  course: Course
  areaOptions: RegulationAreaOption[]
  selectedAreaCode: string | null
  isAreaLocked: boolean
  isDuplicate: boolean
  duplicateCourse: CompletedCourse | null
  needsAreaChoice: boolean
}

function buildPlannedCompletedCourse(
  course: Course,
  semesterLabel: string,
  studyAreaCode: string | null,
): CompletedCourse {
  const fallbackMasterCat = course.masterCats[0] ?? FALLBACK_MASTER_CAT

  return {
    id: `planner-${semesterLabel}-${course.id}`,
    courseId: course.id,
    courseNumber: course.number,
    externalCourseCode: course.number,
    title: course.title,
    ects: course.ects ?? 0,
    masterCat: studyAreaCode ? studyAreaCodeToMasterCat(studyAreaCode) ?? fallbackMasterCat : fallbackMasterCat,
    studyAreaCode,
    grade: null,
    semester: semesterLabel,
    source: 'planner_completion',
  }
}

function buildCompletedCourseLookup(completedCourses: CompletedCourse[]): Map<string, CompletedCourse> {
  const lookup = new Map<string, CompletedCourse>()

  completedCourses.forEach((course) => {
    if (course.courseId && !lookup.has(course.courseId)) {
      lookup.set(course.courseId, course)
    }
    if (course.courseNumber && !lookup.has(course.courseNumber)) {
      lookup.set(course.courseNumber, course)
    }
    if (course.externalCourseCode && !lookup.has(course.externalCourseCode)) {
      lookup.set(course.externalCourseCode, course)
    }
  })

  return lookup
}

function buildResultNotice(params: {
  semesterLabel: string
  importedCount: number
  skippedDuplicateCount: number
  failedCount: number
}): string {
  const messageParts: string[] = []

  if (params.importedCount > 0) {
    messageParts.push(`Added ${params.importedCount} completed course(s) for ${params.semesterLabel}`)
  } else {
    messageParts.push(`No new courses were added for ${params.semesterLabel}`)
  }

  if (params.skippedDuplicateCount > 0) {
    messageParts.push(`${params.skippedDuplicateCount} duplicate course(s) were skipped`)
  }

  if (params.failedCount > 0) {
    messageParts.push(`${params.failedCount} course(s) still need attention`)
  }

  return `${messageParts.join(' · ')}.`
}

function formatDuplicateSubtitle(course: CompletedCourse): string {
  const parts = [
    course.courseNumber ?? course.externalCourseCode ?? null,
    course.semester || null,
    course.grade !== null ? `Grade ${course.grade.toFixed(1)}` : null,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0))

  return parts.join(' · ')
}

function resolveSelectedAreaCode(
  course: Course,
  areaOptions: RegulationAreaOption[],
  planAssignments: Record<string, string>,
  assignmentDrafts: Record<string, string>,
): string | null {
  const draftedAreaCode = assignmentDrafts[course.id]
  if (draftedAreaCode && areaOptions.some((option) => option.code === draftedAreaCode)) {
    return draftedAreaCode
  }

  const plannedAreaCode = planAssignments[course.id]
  if (plannedAreaCode && areaOptions.some((option) => option.code === plannedAreaCode)) {
    return plannedAreaCode
  }

  return areaOptions.length === 1 ? areaOptions[0].code : null
}

function CompletionCourseCard({
  row,
  selected,
  errorMessage,
  onToggle,
  onSelectArea,
}: {
  row: CompletionCourseRow
  selected: boolean
  errorMessage: string | null
  onToggle: () => void
  onSelectArea: (areaCode: string) => void
}) {
  return (
    <div
      className={`grid gap-3 rounded-[12px] border px-4 py-4 ${
        row.isDuplicate
          ? 'border-[#86c99a]/40 bg-[#e8f5ec]/45 dark:border-[#2d6b3f] dark:bg-[#0f2e1a]/40'
          : selected && (row.needsAreaChoice || errorMessage)
            ? 'border-primary/30 bg-primary/5'
            : selected
              ? 'border-border bg-surface'
              : 'border-border-light bg-surface-hover/25 opacity-70'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={row.isDuplicate}
          onChange={onToggle}
          aria-label={`Select ${row.course.title}`}
          className="mt-1 h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="break-words text-[13px] font-semibold text-fg">{row.course.title}</div>
              <div className="mt-1 break-words text-[12px] text-fg-muted">
                {row.course.number} · {row.course.ects ?? '–'} ECTS
              </div>
            </div>

            {row.isDuplicate ? (
              <div className="max-w-full">
                <CompletedBadge grade={row.duplicateCourse?.grade} semester={row.duplicateCourse?.semester} />
              </div>
            ) : null}
          </div>

          {row.isDuplicate && row.duplicateCourse ? (
            <div className="mt-2 text-[12px] text-fg-muted">
              Already credited: {formatDuplicateSubtitle(row.duplicateCourse)}
            </div>
          ) : null}
        </div>
      </div>

      {selected && !row.isDuplicate && row.areaOptions.length > 1 ? (
        <StudyAreaAssignmentField
          value={row.selectedAreaCode}
          options={row.areaOptions}
          locked={row.isAreaLocked}
          size="compact"
          tone={row.needsAreaChoice || errorMessage ? 'error' : 'default'}
          helpText={
            row.needsAreaChoice
              ? 'This course can count toward multiple regulation areas. Choose the area that should receive it.'
              : 'Review or adjust the regulation area before importing the course.'
          }
          onChange={onSelectArea}
        />
      ) : null}

      {!row.isDuplicate && errorMessage ? (
        <div className="rounded-[10px] border border-primary/30 bg-primary/5 px-3 py-2 text-[12px] text-primary">
          {errorMessage}
        </div>
      ) : null}
    </div>
  )
}

export function SemesterCompletionDialog({
  semesterLabel,
  plannedCourses,
  planAssignments,
  studyProgramCode,
  regulationRuleGroups,
  onClose,
  onSuccess,
}: SemesterCompletionDialogProps) {
  const {
    completedCourses,
    completedCoursesError,
    isSavingCompletedCourses,
    importCompletedCourses,
    clearCompletedCoursesError,
  } = useTranscript()
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({})
  const [localError, setLocalError] = useState<string | null>(null)
  const [courseErrors, setCourseErrors] = useState<Record<string, string>>({})
  const [resultNotice, setResultNotice] = useState<string | null>(null)

  const duplicateKeys = useMemo(
    () => new Set(completedCourses.map(normalizeCompletedCourseKey)),
    [completedCourses],
  )
  const completedCourseLookup = useMemo(
    () => buildCompletedCourseLookup(completedCourses),
    [completedCourses],
  )
  const courseRows = useMemo<CompletionCourseRow[]>(() =>
    plannedCourses.map((course) => {
      const areaOptions = getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups)
      const selectedAreaCode = resolveSelectedAreaCode(
        course,
        areaOptions,
        planAssignments,
        assignmentDrafts,
      )
      const completionCourse = buildPlannedCompletedCourse(course, semesterLabel, selectedAreaCode)
      const isDuplicate = duplicateKeys.has(normalizeCompletedCourseKey(completionCourse))
      const duplicateCourse = completedCourseLookup.get(course.id) ?? completedCourseLookup.get(course.number) ?? null

      return {
        course,
        areaOptions,
        selectedAreaCode,
        isAreaLocked: areaOptions.length === 1,
        isDuplicate,
        duplicateCourse,
        needsAreaChoice: areaOptions.length > 1 && !selectedAreaCode,
      }
    }),
  [assignmentDrafts, completedCourseLookup, duplicateKeys, planAssignments, plannedCourses, regulationRuleGroups, semesterLabel, studyProgramCode])
  const selectableCourseIds = useMemo(
    () => courseRows.filter((row) => !row.isDuplicate).map((row) => row.course.id),
    [courseRows],
  )
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(() => selectableCourseIds)
  const selectedRows = useMemo(
    () => courseRows.filter((row) => selectedCourseIds.includes(row.course.id) && !row.isDuplicate),
    [courseRows, selectedCourseIds],
  )
  const blockingSelectionCount = selectedRows.filter((row) => row.needsAreaChoice).length

  useEffect(() => {
    clearCompletedCoursesError()
  }, [clearCompletedCoursesError])

  function handleClose(): void {
    clearCompletedCoursesError()
    onClose()
  }

  function toggleCourse(courseId: string): void {
    setLocalError(null)
    setResultNotice(null)
    setCourseErrors((previousValue) => {
      const nextValue = { ...previousValue }
      delete nextValue[courseId]
      return nextValue
    })
    setSelectedCourseIds((previousValue) =>
      previousValue.includes(courseId)
        ? previousValue.filter((selectedCourseId) => selectedCourseId !== courseId)
        : [...previousValue, courseId],
    )
  }

  function updateAssignment(courseId: string, areaCode: string): void {
    setAssignmentDrafts((previousValue) => ({
      ...previousValue,
      [courseId]: areaCode,
    }))
    setLocalError(null)
    setResultNotice(null)
    setCourseErrors((previousValue) => {
      const nextValue = { ...previousValue }
      delete nextValue[courseId]
      return nextValue
    })
  }

  // Distributes regulation areas over the selected courses, respecting area
  // capacities minus what already-credited courses and fixed choices occupy.
  function handleAutoAssign(): void {
    const openRows = selectedRows.filter((row) => !row.isAreaLocked && row.areaOptions.length > 1)
    if (openRows.length === 0) {
      return
    }

    const creditedEctsByArea = new Map<string, number>()
    completedCourses.forEach((course) => {
      if (!course.studyAreaCode) {
        return
      }
      creditedEctsByArea.set(
        course.studyAreaCode,
        (creditedEctsByArea.get(course.studyAreaCode) ?? 0) + course.ects,
      )
    })

    const openRowIds = new Set(openRows.map((row) => row.course.id))
    const fixedEctsByArea = new Map<string, number>()
    selectedRows.forEach((row) => {
      if (openRowIds.has(row.course.id) || !row.selectedAreaCode) {
        return
      }
      fixedEctsByArea.set(
        row.selectedAreaCode,
        (fixedEctsByArea.get(row.selectedAreaCode) ?? 0) + (row.course.ects ?? 0),
      )
    })

    const areas: PlannerAssignmentAreaState[] = regulationRuleGroups
      .filter((ruleGroup) => ruleGroup.code.trim().toUpperCase() !== 'THESIS')
      .map((ruleGroup) => ({
        code: ruleGroup.code,
        capacityEcts: getEffectiveRuleGroupCapacity(ruleGroup),
        creditedEcts: creditedEctsByArea.get(ruleGroup.code) ?? 0,
        plannedEcts: fixedEctsByArea.get(ruleGroup.code) ?? 0,
      }))

    const assignments = resolveAutomaticPlannerAssignments({
      candidates: openRows.map((row, index) => ({
        course: row.course,
        index,
        options: row.areaOptions,
      })),
      areas,
      regulationRuleGroups,
      studyProgramCode,
    })

    if (assignments.size === 0) {
      setLocalError('No automatic assignment was possible — the compatible areas are already at capacity.')
      return
    }

    setAssignmentDrafts((previousValue) => ({
      ...previousValue,
      ...Object.fromEntries(
        [...assignments.entries()].map(([courseId, assignment]) => [courseId, assignment.areaCode]),
      ),
    }))
    setLocalError(null)
    setResultNotice(null)
    setCourseErrors({})
  }

  async function handleImport(): Promise<void> {
    clearCompletedCoursesError()
    setLocalError(null)
    setResultNotice(null)

    if (selectedRows.length === 0) {
      setLocalError('Select at least one planned course to add it to your completed-course history.')
      return
    }

    const nextCourseErrors: Record<string, string> = {}
    selectedRows.forEach((row) => {
      if (row.needsAreaChoice) {
        nextCourseErrors[row.course.id] = 'Choose the regulation area before saving this course.'
      }
    })
    if (Object.keys(nextCourseErrors).length > 0) {
      setCourseErrors(nextCourseErrors)
      setLocalError('Review the highlighted regulation assignments before saving the selected courses.')
      return
    }

    const selectedCountLabel = selectedRows.length === 1 ? 'this planned course' : `${selectedRows.length} planned courses`
    if (
      typeof window !== 'undefined'
      && !window.confirm(`Add ${selectedCountLabel} from ${semesterLabel} to your completed courses?`)
    ) {
      return
    }

    const importResult = await importCompletedCourses(
      selectedRows.map((row) => ({
        id: row.course.id,
        course: buildPlannedCompletedCourse(row.course, semesterLabel, row.selectedAreaCode),
      })),
    )
    if (importResult === null) {
      setLocalError('Saving the selected planned courses failed. Please review the error message and try again.')
      return
    }

    const failedCourseErrors = Object.fromEntries(importResult.failed.map((item) => [item.id, item.message]))
    setCourseErrors(failedCourseErrors)

    const nextResultNotice = buildResultNotice({
      semesterLabel,
      importedCount: importResult.imported.length,
      skippedDuplicateCount: importResult.skippedDuplicates.length,
      failedCount: importResult.failed.length,
    })

    if (importResult.failed.length > 0) {
      setResultNotice(nextResultNotice)
      setLocalError('Some selected courses still need attention before they can be saved.')
      setSelectedCourseIds(importResult.failed.map((item) => item.id))
      return
    }

    onSuccess(nextResultNotice)
    handleClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 px-3 py-3 sm:px-6 sm:py-6" onClick={handleClose}>
      <div
        className="mx-auto flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-fg">Mark Planned Courses as Completed</div>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              Move all or selected planned courses from {semesterLabel} into your completed-course history without re-entering them manually.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {plannedCourses.length === 0 ? (
            <div className="rounded-[12px] border border-dashed border-border px-5 py-8 text-center text-[13px] text-fg-muted">
              No planned courses are saved for this semester yet.
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleAutoAssign}
                  disabled={blockingSelectionCount === 0}
                  title="Distribute regulation areas automatically, based on remaining capacity and your already credited courses"
                  className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Auto-assign areas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCourseIds(selectableCourseIds)}
                  disabled={selectableCourseIds.length === 0}
                  className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Select all eligible
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCourseIds([])}
                  disabled={selectedCourseIds.length === 0}
                  className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Clear selection
                </button>
              </div>

              {localError ? (
                <div className="rounded-[12px] border border-primary/30 bg-primary/5 px-4 py-3 text-[12.5px] text-primary">
                  {localError}
                </div>
              ) : null}

              {resultNotice ? (
                <div className="rounded-[12px] border border-border bg-surface-hover/20 px-4 py-3 text-[12.5px] text-fg">
                  {resultNotice}
                </div>
              ) : null}

              {completedCoursesError ? (
                <div className="rounded-[12px] border border-primary/30 bg-primary/5 px-4 py-3 text-[12.5px] text-primary">
                  {completedCoursesError}
                </div>
              ) : null}

              <div className="grid gap-3">
                {courseRows.map((row) => (
                  <CompletionCourseCard
                    key={row.course.id}
                    row={row}
                    selected={selectedCourseIds.includes(row.course.id)}
                    errorMessage={courseErrors[row.course.id] ?? null}
                    onToggle={() => toggleCourse(row.course.id)}
                    onSelectArea={(areaCode) => updateAssignment(row.course.id, areaCode)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-5">
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] text-fg-muted">
              Duplicate courses stay visible here and will not be imported again.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={plannedCourses.length === 0 || selectedRows.length === 0 || isSavingCompletedCourses}
                className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingCompletedCourses ? 'Saving...' : `Add ${selectedRows.length} completed course${selectedRows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
