import { useMemo, useState } from 'react'
import type { CompletedCourse, MasterCat } from '../../courses'
import type { TranscriptCoursePreview } from '../types'
import { normalizeText } from '../utils/buildTranscriptImportCandidates'
import { buildCustomCompletedCourse, parsePositiveEcts } from '../utils/customCompletedCourse.ts'
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
import {
  buildManualSemesterOptions,
  getManualSemesterDefault,
} from '../utils/manualSemesterOptions.ts'
import { useTranslation } from '../../i18n'

const ALL_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

type ManualEntryMode = 'catalog' | 'custom'

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
  isLoadingRegulationVersion?: boolean
  isSaving: boolean
  onSave: (course: CompletedCourse) => Promise<boolean>
}

export function ManualCompletedCourseForm({
  defaultSemester,
  studyProgramCode,
  regulationVersionCode,
  regulationRuleGroups,
  isLoadingRegulationVersion = false,
  isSaving,
  onSave,
}: ManualCompletedCourseFormProps) {
  const { t } = useTranslation()
  const semesterOptions = useMemo(() => buildManualSemesterOptions(defaultSemester), [defaultSemester])
  const [entryMode, setEntryMode] = useState<ManualEntryMode>('catalog')
  const [selectedCourse, setSelectedCourse] = useState<TranscriptCoursePreview | null>(null)
  const [customTitle, setCustomTitle] = useState<string>('')
  const [customEcts, setCustomEcts] = useState<string>('')
  const [customCode, setCustomCode] = useState<string>('')
  const [semester, setSemester] = useState<string>(() =>
    getManualSemesterDefault(defaultSemester, semesterOptions),
  )
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
  const catalogAreaOptions = mappedAreaOptions.length > 0 ? mappedAreaOptions : flexibleAreaOptions
  const isCatalogAreaLocked = mappedAreaOptions.length === 1
  const isCustomAreaLocked = flexibleAreaOptions.length === 1
  const resolvedCatalogStudyAreaCode = isCatalogAreaLocked
    ? mappedAreaOptions[0].code
    : mappedAreaOptions.length > 1
      ? (mappedAreaOptions.some((option) => option.code === studyAreaCode) ? studyAreaCode : null)
      : (studyAreaCode && flexibleAreaOptions.some((option) => option.code === studyAreaCode) ? studyAreaCode : null)
  const resolvedCustomStudyAreaCode = isCustomAreaLocked
    ? flexibleAreaOptions[0].code
    : (studyAreaCode && flexibleAreaOptions.some((option) => option.code === studyAreaCode) ? studyAreaCode : null)
  const resolvedStudyAreaCode = entryMode === 'custom' ? resolvedCustomStudyAreaCode : resolvedCatalogStudyAreaCode
  const resolvedMasterCat = resolvedStudyAreaCode
    ? studyAreaCodeToMasterCat(resolvedStudyAreaCode) ?? masterCat
    : masterCat
  const shouldWarnMissingArea = Boolean(
    hasActiveRegulation
    && semester.trim()
    && (entryMode === 'custom' ? flexibleAreaOptions.length > 1 : Boolean(selectedCourse) && catalogAreaOptions.length > 1)
    && !resolvedStudyAreaCode,
  )

  function resetForm(): void {
    setSelectedCourse(null)
    setCustomTitle('')
    setCustomEcts('')
    setCustomCode('')
    setSemester(getManualSemesterDefault(defaultSemester, semesterOptions))
    setGrade(null)
    setMasterCat('INFO')
    setStudyAreaCode(null)
    setError(null)
  }

  function switchEntryMode(nextMode: ManualEntryMode): void {
    setEntryMode(nextMode)
    setStudyAreaCode(null)
    setError(null)
  }

  function handleCatalogCourseSelect(course: TranscriptCoursePreview): void {
    setSelectedCourse(course)
    setStudyAreaCode(null)
    setError(null)
  }

  async function handleSave(): Promise<void> {
    if (!semester.trim()) {
      setError('Select the semester for this completed course.')
      return
    }

    if (entryMode === 'custom') {
      const title = customTitle.trim()
      const ects = parsePositiveEcts(customEcts)
      if (!title) {
        setError(t('transcript.manual.missingTitle'))
        return
      }
      if (ects === null) {
        setError(t('transcript.manual.missingEcts'))
        return
      }
      if (hasActiveRegulation && flexibleAreaOptions.length > 0 && !resolvedCustomStudyAreaCode) {
        setError(t('transcript.manual.missingArea'))
        return
      }

      const saved = await onSave(
        buildCustomCompletedCourse({
          title,
          ects,
          externalCourseCode: customCode,
          semester,
          grade,
          studyAreaCode: resolvedCustomStudyAreaCode,
          masterCat: resolvedMasterCat,
        }),
      )
      if (saved) {
        resetForm()
      }
      return
    }

    if (!selectedCourse) {
      setError('Choose a catalog course first.')
      return
    }

    if ((selectedCourse.ects ?? 0) <= 0) {
      setError('The selected course has no valid ECTS.')
      return
    }

    if (hasActiveRegulation && catalogAreaOptions.length > 0 && !resolvedCatalogStudyAreaCode) {
      setError('Select a compatible regulation area before saving this course.')
      return
    }

    const saved = await onSave(
      buildManualCompletedCoursePayload({
        selectedCourse,
        semester,
        grade,
        studyAreaCode: resolvedCatalogStudyAreaCode,
        masterCat: resolvedMasterCat,
      }),
    )
    if (!saved) {
      return
    }

    resetForm()
  }

  const areaField = isLoadingRegulationVersion ? (
    <div className="rounded-md border border-border-light bg-surface-hover/25 px-2.5 py-1.5 text-[12px] text-fg-muted lg:self-end">
      Loading regulation...
    </div>
  ) : hasActiveRegulation ? (
    <StudyAreaAssignmentField
      label={t('transcript.manual.area')}
      value={resolvedStudyAreaCode}
      options={entryMode === 'custom' ? flexibleAreaOptions : catalogAreaOptions}
      locked={entryMode === 'custom' ? isCustomAreaLocked : isCatalogAreaLocked}
      size="compact"
      optionLabel="full"
      tone={shouldWarnMissingArea ? 'error' : 'default'}
      onChange={setStudyAreaCode}
    />
  ) : null

  return (
    <div className={`flex flex-col rounded-[10px] border border-border bg-surface px-4 py-4.5 sm:px-6 sm:py-5.5 ${entryMode === 'catalog' ? 'lg:h-[24rem] lg:min-h-0 lg:overflow-hidden' : 'lg:min-h-[24rem]'}`}>
      <div className="shrink-0 text-[14px] font-semibold text-fg">Add Completed Courses Manually</div>

      <div className="mt-3 flex flex-wrap gap-1" role="group" aria-label={t('transcript.manual.mode')}>
        <button
          type="button"
          aria-pressed={entryMode === 'catalog'}
          onClick={() => switchEntryMode('catalog')}
          className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors ${entryMode === 'catalog' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-fg hover:bg-surface-hover'}`}
        >
          {t('transcript.manual.catalogMode')}
        </button>
        <button
          type="button"
          aria-pressed={entryMode === 'custom'}
          onClick={() => switchEntryMode('custom')}
          className={`rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors ${entryMode === 'custom' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-fg hover:bg-surface-hover'}`}
        >
          {t('transcript.manual.customMode')}
        </button>
      </div>

      <div className="mt-4 grid content-start gap-3.5 lg:min-h-0 lg:flex-1">
        {entryMode === 'catalog' ? (
          <CatalogCoursePicker
            selectedCourse={selectedCourse}
            studyProgramCode={studyProgramCode}
            compact
            onSelect={handleCatalogCourseSelect}
          />
        ) : (
          <div className="grid gap-3">
            <p className="text-[12px] text-fg-muted">{t('transcript.manual.customHint')}</p>
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('transcript.manual.title')}
              </span>
              <input
                type="text"
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                placeholder={t('transcript.manual.titlePlaceholder')}
                className="w-full min-w-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  {t('transcript.manual.ects')}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={customEcts}
                  onChange={(event) => setCustomEcts(event.target.value)}
                  placeholder="6"
                  className="w-full min-w-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
                />
              </label>
              <label className="grid min-w-0 gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  {t('transcript.manual.code')}
                </span>
                <input
                  type="text"
                  value={customCode}
                  onChange={(event) => setCustomCode(event.target.value)}
                  placeholder={t('transcript.manual.codePlaceholder')}
                  className="w-full min-w-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
                />
              </label>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid min-w-0 gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Semester
            </span>
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              className="w-full min-w-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
            >
              {semesterOptions.map((semesterOption) => (
                <option key={semesterOption} value={semesterOption}>
                  {semesterOption}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Grade
            </span>
            <TranscriptGradeSelect
              value={grade}
              onChange={setGrade}
              className="w-full min-w-0 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
            />
          </label>

          {areaField}
        </div>

        {!isLoadingRegulationVersion && !hasActiveRegulation ? (
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
        ) : null}

        {error ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-[12.5px] text-primary">
            {error}
          </div>
        ) : null}
      </div>

      <div className="mt-3.5 flex shrink-0 flex-wrap justify-end gap-2">
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
