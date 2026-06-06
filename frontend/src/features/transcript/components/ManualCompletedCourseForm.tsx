import { useEffect, useMemo, useState } from 'react'
import type { CompletedCourse, MasterCat } from '../../courses'
import { fetchCatalogCourses } from '../../courses/api'
import type { TranscriptCoursePreview } from '../types'
import { normalizeText, toTranscriptCoursePreview } from '../utils/buildTranscriptImportCandidates'
import { CatalogCoursePicker } from './CatalogCoursePicker'
import { CategoryToggle } from './CategoryToggle'
import { StudyAreaAssignmentField } from './StudyAreaAssignmentField'
import { TranscriptGradeSelect } from './TranscriptGradeSelect'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  buildAssignableRegulationAreaOptions,
  buildFlexibleRegulationAreaOptions,
  buildRelevantCourseAreaOptions,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation'

const ALL_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']
const MIN_EXTERNAL_MATCH_QUERY_LENGTH = 2

function formatOptionalNumber(value: number | null): string {
  return value === null ? '' : String(value)
}

function parseOptionalNumber(value: string): number | null {
  return value.trim() ? Number(value) : null
}

function toExternalMatchCandidates(
  courses: TranscriptCoursePreview[],
  studyProgramCode: string | null | undefined,
  externalCode: string,
  externalTitle: string,
): TranscriptCoursePreview[] {
  const normalizedExternalCode = normalizeText(externalCode)
  const normalizedExternalTitle = normalizeText(externalTitle)

  return courses.filter((course) => {
    if (buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode).length === 0) {
      return false
    }

    const normalizedCourseNumber = normalizeText(course.number)
    const normalizedCourseTitle = normalizeText(course.title)
    const hasExactCodeMatch = Boolean(
      normalizedExternalCode && normalizedExternalCode === normalizedCourseNumber,
    )
    const hasExactTitleMatch = Boolean(
      normalizedExternalTitle && normalizedExternalTitle === normalizedCourseTitle,
    )
    return hasExactCodeMatch || hasExactTitleMatch
  })
}

function buildManualCompletedCoursePayload({
  selectedCourse,
  externalTitle,
  externalCourseCode,
  externalEcts,
  semester,
  grade,
  studyAreaCode,
  masterCat,
}: {
  selectedCourse: TranscriptCoursePreview | null
  externalTitle: string
  externalCourseCode: string
  externalEcts: number | null
  semester: string
  grade: number | null
  studyAreaCode: string | null
  masterCat: MasterCat
}): CompletedCourse {
  const effectiveTitle = selectedCourse?.title ?? externalTitle.trim()
  const effectiveNumber = selectedCourse?.number ?? (externalCourseCode.trim() || null)
  const effectiveEcts = selectedCourse?.ects ?? externalEcts ?? 0
  const resolvedMasterCat = studyAreaCode ? studyAreaCodeToMasterCat(studyAreaCode) ?? masterCat : masterCat

  return {
    id: `manual-${selectedCourse?.id ?? effectiveNumber ?? normalizeText(effectiveTitle)}-${Date.now()}`,
    courseId: selectedCourse?.id ?? null,
    courseNumber: selectedCourse?.number ?? undefined,
    externalCourseCode: selectedCourse ? selectedCourse.number : effectiveNumber ?? undefined,
    title: effectiveTitle,
    ects: effectiveEcts,
    masterCat: resolvedMasterCat,
    studyAreaCode,
    grade,
    semester: semester.trim(),
    source: 'manual',
  }
}

interface ManualCompletedCourseFormProps {
  defaultSemester: string | null | undefined
  studyProgramCode?: string | null
  regulationVersionCode?: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  isSaving: boolean
  onSave: (course: CompletedCourse) => Promise<boolean>
}

export function ManualCompletedCourseForm({
  defaultSemester,
  studyProgramCode,
  regulationVersionCode,
  regulationRuleGroups,
  isSaving,
  onSave,
}: ManualCompletedCourseFormProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [mode, setMode] = useState<'catalog' | 'external'>('catalog')
  const [selectedCourse, setSelectedCourse] = useState<TranscriptCoursePreview | null>(null)
  const [matchedExternalCourse, setMatchedExternalCourse] = useState<TranscriptCoursePreview | null>(null)
  const [externalMatchOptions, setExternalMatchOptions] = useState<TranscriptCoursePreview[]>([])
  const [isLoadingExternalMatches, setIsLoadingExternalMatches] = useState<boolean>(false)
  const [externalTitle, setExternalTitle] = useState<string>('')
  const [externalCourseCode, setExternalCourseCode] = useState<string>('')
  const [externalEcts, setExternalEcts] = useState<number | null>(null)
  const [semester, setSemester] = useState<string>(defaultSemester ?? '')
  const [grade, setGrade] = useState<number | null>(null)
  const [masterCat, setMasterCat] = useState<MasterCat>('INFO')
  const [studyAreaCode, setStudyAreaCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const flexibleAreaOptions = useMemo(
    () => buildFlexibleRegulationAreaOptions(regulationRuleGroups),
    [regulationRuleGroups],
  )

  const selectedExternalMatchId = matchedExternalCourse?.id ?? null
  const effectiveCourse = mode === 'catalog' ? selectedCourse : matchedExternalCourse
  const mappedAreaOptions = useMemo(
    () => buildAssignableRegulationAreaOptions(
      effectiveCourse?.studyAreaOptions,
      studyProgramCode,
      regulationRuleGroups,
      effectiveCourse?.masterCats ?? [masterCat],
    ),
    [effectiveCourse?.masterCats, effectiveCourse?.studyAreaOptions, masterCat, regulationRuleGroups, studyProgramCode],
  )
  const hasActiveRegulation = Boolean(regulationVersionCode && regulationRuleGroups.length > 0)
  const areaOptions = mappedAreaOptions.length > 0 ? mappedAreaOptions : flexibleAreaOptions
  const isAreaLocked = mappedAreaOptions.length === 1
  const resolvedStudyAreaCode = isAreaLocked
    ? mappedAreaOptions[0].code
    : mappedAreaOptions.length > 1
      ? (mappedAreaOptions.some((option) => option.code === studyAreaCode) ? studyAreaCode : null)
      : (studyAreaCode && flexibleAreaOptions.some((option) => option.code === studyAreaCode) ? studyAreaCode : null)
  const resolvedMasterCat = resolvedStudyAreaCode
    ? studyAreaCodeToMasterCat(resolvedStudyAreaCode) ?? masterCat
    : masterCat

  useEffect(() => {
    let isActive = true

    async function loadExternalMatchOptions(): Promise<void> {
      if (mode !== 'external') {
        if (isActive) {
          setMatchedExternalCourse(null)
          setExternalMatchOptions([])
          setIsLoadingExternalMatches(false)
        }
        return
      }

      const query = externalCourseCode.trim() || externalTitle.trim()
      if (!regulationVersionCode || query.length < MIN_EXTERNAL_MATCH_QUERY_LENGTH) {
        if (isActive) {
          setMatchedExternalCourse(null)
          setExternalMatchOptions([])
          setIsLoadingExternalMatches(false)
        }
        return
      }

      setIsLoadingExternalMatches(true)
      try {
        const nextCourses = await fetchCatalogCourses(query, 12)
        if (!isActive) {
          return
        }
        const nextMatchOptions = toExternalMatchCandidates(
          nextCourses.map((course) => toTranscriptCoursePreview(course, studyProgramCode)),
          studyProgramCode,
          externalCourseCode,
          externalTitle,
        )
        setExternalMatchOptions(nextMatchOptions)
        setMatchedExternalCourse(nextMatchOptions.length === 1 ? nextMatchOptions[0] : null)
      } catch (matchError) {
        if (!isActive) {
          return
        }
        setMatchedExternalCourse(null)
        setExternalMatchOptions([])
        setError(
          matchError instanceof Error ? matchError.message : 'Failed to verify the external course against the active regulation.',
        )
      } finally {
        if (isActive) {
          setIsLoadingExternalMatches(false)
        }
      }
    }

    void loadExternalMatchOptions()

    return () => {
      isActive = false
    }
  }, [externalCourseCode, externalTitle, mode, regulationVersionCode, studyProgramCode])

  function resetForm(): void {
    setMode('catalog')
    setSelectedCourse(null)
    setMatchedExternalCourse(null)
    setExternalMatchOptions([])
    setExternalTitle('')
    setExternalCourseCode('')
    setExternalEcts(null)
    setSemester(defaultSemester ?? '')
    setGrade(null)
    setMasterCat('INFO')
    setStudyAreaCode(null)
    setError(null)
  }

  function openForm(): void {
    setIsOpen(true)
    setSemester(defaultSemester ?? '')
  }

  function handleCatalogCourseSelect(course: TranscriptCoursePreview): void {
    setSelectedCourse(course)
    setError(null)
  }

  async function handleSave(): Promise<void> {
    const resolvedCourse = effectiveCourse
    const resolvedTitle = resolvedCourse?.title ?? externalTitle.trim()
    const resolvedEcts = resolvedCourse?.ects ?? externalEcts

    if (!resolvedCourse && !resolvedTitle) {
      setError('Choose a catalog course or enter an external course title first.')
      return
    }

    if (resolvedEcts === null || resolvedEcts <= 0) {
      setError('Provide valid ECTS for this completed course.')
      return
    }

    if (!semester.trim()) {
      setError('Enter the semester for this completed course.')
      return
    }

    if (hasActiveRegulation && areaOptions.length > 0 && !resolvedStudyAreaCode) {
      setError('Select a compatible regulation area before saving this course.')
      return
    }

    const saved = await onSave(
      buildManualCompletedCoursePayload({
        selectedCourse: resolvedCourse,
        externalTitle,
        externalCourseCode,
        externalEcts,
        semester,
        grade,
        studyAreaCode: resolvedStudyAreaCode,
        masterCat: resolvedMasterCat,
      }),
    )
    if (!saved) {
      return
    }

    resetForm()
    setIsOpen(false)
  }

  return (
    <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-fg">Add completed courses manually</div>
          <p className="mt-1 text-[12.5px] text-fg-muted">
            Add a catalog course or external course and place it in a compatible regulation area.
          </p>
        </div>
        {!isOpen ? (
          <button
            type="button"
            onClick={openForm}
            className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            Add course manually
          </button>
        ) : null}
      </div>

      {isOpen ? (
        <div className="mt-4 grid gap-3.5">
          <div className="flex flex-wrap rounded-md border border-border bg-surface-hover/40 p-1">
            {[
              ['catalog', 'Catalog course'],
              ['external', 'External course'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setMode(value as 'catalog' | 'external')
                  setError(null)
                }}
                className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  mode === value ? 'bg-primary text-white' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'catalog' ? (
            <CatalogCoursePicker
              selectedCourse={selectedCourse}
              studyProgramCode={studyProgramCode}
              compact
              onSelect={handleCatalogCourseSelect}
            />
          ) : (
            <div className="grid gap-3.5 rounded-[10px] border border-border-light bg-surface-hover/25 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    Course title
                  </span>
                  <input
                    type="text"
                    value={externalTitle}
                    onChange={(event) => setExternalTitle(event.target.value)}
                    placeholder="e.g. Data Ethics"
                    className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    Course code
                  </span>
                  <input
                    type="text"
                    value={externalCourseCode}
                    onChange={(event) => setExternalCourseCode(event.target.value)}
                    placeholder="optional"
                    className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
                  />
                </label>
              </div>

              <label className="grid gap-1 sm:max-w-[14rem]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  ECTS
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={formatOptionalNumber(externalEcts)}
                  onChange={(event) => setExternalEcts(parseOptionalNumber(event.target.value))}
                  placeholder="required"
                  className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
                />
              </label>

              {regulationVersionCode ? (
                <div className="grid gap-2">
                  <div className="text-[12px] text-fg-muted">
                    Exact regulation matching checks the active examination regulation by course code or exact normalized title.
                  </div>
                  {isLoadingExternalMatches ? (
                    <div className="text-[12.5px] text-fg-muted">Checking the active regulation...</div>
                  ) : matchedExternalCourse ? (
                    <div className="rounded-lg border border-border bg-surface px-4 py-3">
                      <div className="text-[13px] font-semibold text-fg">Matched regulation course</div>
                      <div className="mt-1 text-[12px] text-fg-muted">
                        {matchedExternalCourse.title} · {matchedExternalCourse.number || 'Catalog course'}
                      </div>
                    </div>
                  ) : externalMatchOptions.length > 1 ? (
                    <div className="grid gap-2">
                      <div className="text-[12px] text-fg-muted">
                        Multiple exact regulation matches were found. Choose the right one before saving.
                      </div>
                      {externalMatchOptions.map((course) => (
                        <button
                          key={course.id}
                          type="button"
                          onClick={() => setMatchedExternalCourse(course)}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            selectedExternalMatchId === course.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border-light hover:bg-surface-hover'
                          }`}
                        >
                          <div className="text-[12.5px] font-semibold text-fg">{course.title}</div>
                          <div className="text-[12px] text-fg-muted">{course.number || 'Catalog course'}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12.5px] text-fg-muted">
                      No exact regulation course match detected. The course can still be saved as an external entry.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Semester
              </span>
              <input
                type="text"
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                placeholder="e.g. WS 24/25"
                className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Grade
              </span>
              <TranscriptGradeSelect
                value={grade}
                onChange={setGrade}
                className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
              />
            </label>
          </div>

          {hasActiveRegulation ? (
            <StudyAreaAssignmentField
              value={resolvedStudyAreaCode}
              options={areaOptions}
              locked={isAreaLocked}
              size="compact"
              tone={hasActiveRegulation && areaOptions.length > 1 && !resolvedStudyAreaCode ? 'error' : 'default'}
              helpText={
                mappedAreaOptions.length > 1
                  ? 'Choose the regulation area that should receive this course.'
                  : mappedAreaOptions.length === 1
                    ? 'This area is fixed by your active examination regulation.'
                    : 'Choose one compatible elective area from your active regulation.'
              }
              onChange={setStudyAreaCode}
            />
          ) : (
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Category
              </div>
              <div className="flex flex-wrap gap-1">
                {ALL_CATEGORIES.map((cat) => (
                  <CategoryToggle
                    key={cat}
                    cat={cat}
                    active={cat === resolvedMasterCat}
                    onClick={() => setMasterCat(cat)}
                  />
                ))}
              </div>
            </div>
          )}

          {error ? (
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-[12.5px] text-primary">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setIsOpen(false)
              }}
              className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving…' : 'Save completed course'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
