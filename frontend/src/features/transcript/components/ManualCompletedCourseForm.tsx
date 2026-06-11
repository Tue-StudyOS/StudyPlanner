import { useMemo, useState } from 'react'
import type { CompletedCourse, MasterCat } from '../../courses'
import type { TranscriptCoursePreview } from '../types'
import { normalizeText } from '../utils/buildTranscriptImportCandidates'
import { CatalogCoursePicker } from './CatalogCoursePicker'
import { CategoryToggle } from './CategoryToggle'
import { StudyAreaAssignmentField } from './StudyAreaAssignmentField'
import { TranscriptGradeSelect } from './TranscriptGradeSelect'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  buildAssignableRegulationAreaOptions,
  buildFlexibleRegulationAreaOptions,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation'

const ALL_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

function buildManualCompletedCoursePayload({
  selectedCourse,
  semester,
  grade,
  studyAreaCode,
  masterCat,
}: {
  selectedCourse: TranscriptCoursePreview
  semester: string
  grade: number | null
  studyAreaCode: string | null
  masterCat: MasterCat
}): CompletedCourse {
  const resolvedMasterCat = studyAreaCode ? studyAreaCodeToMasterCat(studyAreaCode) ?? masterCat : masterCat

  return {
    id: `manual-${selectedCourse.id ?? normalizeText(selectedCourse.title)}-${Date.now()}`,
    courseId: selectedCourse.id,
    courseNumber: selectedCourse.number,
    externalCourseCode: selectedCourse.number,
    title: selectedCourse.title,
    ects: selectedCourse.ects ?? 0,
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
  const [selectedCourse, setSelectedCourse] = useState<TranscriptCoursePreview | null>(null)
  const [semester, setSemester] = useState<string>(defaultSemester ?? '')
  const [grade, setGrade] = useState<number | null>(null)
  const [masterCat, setMasterCat] = useState<MasterCat>('INFO')
  const [studyAreaCode, setStudyAreaCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const flexibleAreaOptions = useMemo(
    () => buildFlexibleRegulationAreaOptions(regulationRuleGroups),
    [regulationRuleGroups],
  )

  const mappedAreaOptions = useMemo(
    () => buildAssignableRegulationAreaOptions(
      selectedCourse?.studyAreaOptions,
      studyProgramCode,
      regulationRuleGroups,
      selectedCourse?.masterCats ?? [masterCat],
    ),
    [masterCat, regulationRuleGroups, selectedCourse?.masterCats, selectedCourse?.studyAreaOptions, studyProgramCode],
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

  function resetForm(): void {
    setSelectedCourse(null)
    setSemester(defaultSemester ?? '')
    setGrade(null)
    setMasterCat('INFO')
    setStudyAreaCode(null)
    setError(null)
  }

  function handleCatalogCourseSelect(course: TranscriptCoursePreview): void {
    setSelectedCourse(course)
    setError(null)
  }

  async function handleSave(): Promise<void> {
    if (!selectedCourse) {
      setError('Choose a catalog course first.')
      return
    }

    if ((selectedCourse.ects ?? 0) <= 0) {
      setError('The selected course has no valid ECTS.')
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
        selectedCourse,
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
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="text-[14px] font-semibold text-fg">Add Completed Courses Manually</div>

      <div className="mt-4 grid min-h-0 flex-1 content-start gap-3.5 overflow-y-auto">
        <CatalogCoursePicker
          selectedCourse={selectedCourse}
          studyProgramCode={studyProgramCode}
          compact
          onSelect={handleCatalogCourseSelect}
        />

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
      </div>

      <div className="mt-3.5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={resetForm}
          className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Saving…' : 'Save completed course'}
        </button>
      </div>
    </div>
  )
}
