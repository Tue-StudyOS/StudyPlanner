import { useEffect, useMemo, useState } from 'react'
import type { MasterCat } from '../../courses'
import { useTranslation } from '../../i18n'
import type { TranscriptImportCandidate } from '../types'
import {
  acceptCandidateAsUebk,
  applyCatalogCourseMatch,
  resolveSectionRuleGroupCode,
  UEBK_AREA_CODE,
  updateTranscriptImportCandidate,
} from '../utils/buildTranscriptImportCandidates'
import { CatalogCoursePicker } from './CatalogCoursePicker'
import { CategoryToggle } from './CategoryToggle'
import { TrashIcon } from './icons'
import { StudyAreaAssignmentField } from './StudyAreaAssignmentField'
import { TranscriptGradeSelect } from './TranscriptGradeSelect'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  buildAssignableRegulationAreaOptions,
  buildFlexibleRegulationAreaOptions,
  buildRegulationAreaOptionByCode,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation'

const ALL_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

function cardClasses(hasIncomplete: boolean, isExpanded: boolean): string {
  if (!hasIncomplete) {
    return 'border-border bg-surface'
  }
  if (isExpanded) {
    return 'border-border bg-surface'
  }
  return 'border-danger/40 bg-danger-soft'
}

interface TranscriptImportRowProps {
  candidate: TranscriptImportCandidate
  studyProgramCode?: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  onChange: (candidate: TranscriptImportCandidate) => void
  onDiscard: () => void
}

export function TranscriptImportRow({
  candidate,
  studyProgramCode,
  regulationRuleGroups,
  onChange,
  onDiscard,
}: TranscriptImportRowProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState<boolean>(false)
  const displayTitle = candidate.matchedCourse?.title ?? candidate.title
  const displayNumber = candidate.matchedCourse?.number ?? candidate.courseNumber ?? t('transcript.row.catalogRequired')
  const gradeText = candidate.grade === null
    ? t('transcript.row.noGrade')
    : `${t('transcript.row.grade')} ${candidate.grade.toFixed(1)}`
  const semesterText = candidate.semester.trim() || t('transcript.row.semesterMissing')
  const hasActiveRegulation = regulationRuleGroups.length > 0
  const mappedAreaOptions = useMemo(
    () =>
      buildAssignableRegulationAreaOptions(
        candidate.matchedCourse?.studyAreaOptions,
        studyProgramCode,
        regulationRuleGroups,
        candidate.matchedCourse?.masterCats ?? [candidate.masterCat],
      ),
    [candidate.masterCat, candidate.matchedCourse?.masterCats, candidate.matchedCourse?.studyAreaOptions, regulationRuleGroups, studyProgramCode],
  )
  const flexibleAreaOptions = useMemo(
    () => buildFlexibleRegulationAreaOptions(regulationRuleGroups),
    [regulationRuleGroups],
  )
  // The official transcript section is the authoritative regulation placement, so
  // surface that area (including the compulsory part) even when the catalog has
  // no mapping that would otherwise expose it.
  const sectionAreaOption = useMemo(
    () =>
      candidate.matchedCourse
        ? buildRegulationAreaOptionByCode(
            regulationRuleGroups,
            resolveSectionRuleGroupCode(candidate.sourceSection, regulationRuleGroups),
          )
        : null,
    [candidate.matchedCourse, candidate.sourceSection, regulationRuleGroups],
  )
  const isAreaLocked = mappedAreaOptions.length === 1
  const areaOptions = useMemo(() => {
    const baseAreaOptions = mappedAreaOptions.length > 0 ? mappedAreaOptions : flexibleAreaOptions
    if (isAreaLocked || !sectionAreaOption || baseAreaOptions.some((option) => option.code === sectionAreaOption.code)) {
      return baseAreaOptions
    }
    return [...baseAreaOptions, sectionAreaOption]
  }, [flexibleAreaOptions, isAreaLocked, mappedAreaOptions, sectionAreaOption])
  const canAssignAsUebk = !hasActiveRegulation || flexibleAreaOptions.some(
    (option) => option.code.trim().toUpperCase() === UEBK_AREA_CODE,
  )
  const isAcceptedAsUebk = !candidate.matchedCourse && candidate.studyAreaCode === UEBK_AREA_CODE
  const isMissingCatalogCourse = !candidate.matchedCourse && !isAcceptedAsUebk
  const isMissingSemester = !candidate.semester.trim()
  const hasAssignmentIssue = Boolean(
    hasActiveRegulation
    && candidate.matchedCourse
    && !isMissingSemester
    && areaOptions.length > 1
    && !candidate.studyAreaCode,
  )
  const hasIncomplete = isMissingCatalogCourse || isMissingSemester || hasAssignmentIssue

  useEffect(() => {
    if (isAreaLocked) {
      const lockedAreaCode = mappedAreaOptions[0].code
      if (candidate.studyAreaCode !== lockedAreaCode) {
        onChange(
          updateTranscriptImportCandidate(candidate, {
            studyAreaCode: lockedAreaCode,
            masterCat: studyAreaCodeToMasterCat(lockedAreaCode) ?? candidate.masterCat,
          }),
        )
      }
      return
    }

    if (
      candidate.studyAreaCode
      && candidate.studyAreaCode !== UEBK_AREA_CODE
      && !areaOptions.some((option) => option.code === candidate.studyAreaCode)
    ) {
      onChange(updateTranscriptImportCandidate(candidate, { studyAreaCode: null }))
    }
  }, [areaOptions, candidate, candidate.masterCat, candidate.studyAreaCode, isAreaLocked, mappedAreaOptions, onChange])

  return (
    <div className={`min-w-0 overflow-hidden rounded-[10px] border px-3.5 py-3 ${cardClasses(hasIncomplete, isExpanded)}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-fg">{displayTitle}</div>
            <div className="mt-1 text-[11px] text-fg-muted">
              {displayNumber} · {candidate.ects ?? '–'} ECTS
            </div>
            <div className="mt-1 text-[11.5px] text-fg-muted">
              {gradeText} · {semesterText}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {isConfirmingDiscard ? (
            <>
              <button
                type="button"
                onClick={onDiscard}
                className="rounded-md border border-danger/40 bg-danger-soft px-2 py-1 text-[11px] font-medium text-danger transition-colors hover:opacity-90"
              >
                {t('common.remove')}
              </button>
              <button
                type="button"
                onClick={() => setIsConfirmingDiscard(false)}
                className="rounded-md border border-border px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-surface-hover"
              >
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfirmingDiscard(true)}
              aria-label={`Remove ${displayTitle} from transcript review`}
              title={`Remove ${displayTitle} from transcript review`}
              className="flex items-center justify-center rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-hover hover:text-danger"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-2.5 grid min-w-0 gap-2.5 border-t border-border-light pt-2.5">
          {candidate.extractedTitle !== displayTitle ? (
            <div className="text-[11px] text-fg-muted">{t('transcript.row.extractedTitle', { title: candidate.extractedTitle })}</div>
          ) : null}

          <div className={`${isMissingCatalogCourse ? 'rounded-[10px] border border-danger/40 bg-danger-soft p-2' : ''}`}>
            <CatalogCoursePicker
              selectedCourse={candidate.matchedCourse}
              suggestedCourses={candidate.matchOptions}
              studyProgramCode={studyProgramCode}
              compact
              onSelect={(course) => onChange(applyCatalogCourseMatch(candidate, course))}
            />
          </div>

          {canAssignAsUebk ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border-light bg-surface-hover/30 px-3 py-2">
              <span className="min-w-0 flex-1 text-[11.5px] text-fg-muted">
                {isAcceptedAsUebk
                  ? t('transcript.row.uebkAccepted')
                  : candidate.matchedCourse
                    ? t('transcript.row.uebkReplaceOrAccept')
                    : t('transcript.row.uebkAcceptNew')}
              </span>
              {!isAcceptedAsUebk ? (
                <button
                  type="button"
                  onClick={() => onChange(acceptCandidateAsUebk(candidate))}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-[11.5px] font-medium text-fg transition-colors hover:bg-surface-hover"
                >
                  {t('transcript.row.acceptUebk')}
                </button>
              ) : null}
            </div>
          ) : candidate.matchedCourse ? (
            <div className="rounded-[10px] border border-border-light bg-surface-hover/30 px-3 py-2 text-[11.5px] text-fg-muted">
              {t('transcript.row.uebkUnavailable')}
            </div>
          ) : null}

          <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,7rem)_minmax(0,1.4fr)]">
            <label className="grid gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('transcript.row.semester')}
              </span>
              <input
                type="text"
                value={candidate.semester}
                onChange={(event) =>
                  onChange(updateTranscriptImportCandidate(candidate, { semester: event.target.value }))
                }
                placeholder={t('transcript.row.semesterPlaceholder')}
                className={`rounded-md border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-fg-mid ${isMissingSemester ? 'border-danger/60' : 'border-border'}`}
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('transcript.row.grade')}
              </span>
              <TranscriptGradeSelect
                value={candidate.grade}
                onChange={(grade) =>
                  onChange(
                    updateTranscriptImportCandidate(candidate, {
                      grade,
                    }),
                  )
                }
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-fg-mid"
              />
            </label>

            {hasActiveRegulation ? (
              <StudyAreaAssignmentField
                value={candidate.studyAreaCode}
                options={areaOptions}
                locked={isAreaLocked}
                disabled={areaOptions.length === 0}
                size="compact"
                tone={hasAssignmentIssue ? 'error' : 'default'}
                onChange={(nextStudyAreaCode) => {
                  onChange(
                    updateTranscriptImportCandidate(candidate, {
                      studyAreaCode: nextStudyAreaCode || null,
                      masterCat: studyAreaCodeToMasterCat(nextStudyAreaCode) ?? candidate.masterCat,
                    }),
                  )
                }}
              />
            ) : null}
          </div>

          {!hasActiveRegulation ? (
            <div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('transcript.row.category')}
              </div>
              <div className="flex flex-wrap gap-1">
                {ALL_CATEGORIES.map((cat) => (
                  <CategoryToggle
                    key={cat}
                    cat={cat}
                    active={cat === candidate.masterCat}
                    onClick={() => onChange(updateTranscriptImportCandidate(candidate, { masterCat: cat }))}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
