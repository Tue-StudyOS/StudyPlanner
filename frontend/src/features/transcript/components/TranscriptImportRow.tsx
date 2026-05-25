import { useEffect, useMemo, useState } from 'react'
import type { MasterCat } from '../../courses'
import type { TranscriptImportCandidate } from '../types'
import { applyCatalogCourseMatch, updateTranscriptImportCandidate } from '../utils/buildTranscriptImportCandidates'
import { CatalogCoursePicker } from './CatalogCoursePicker'
import { CategoryToggle } from './CategoryToggle'
import { EditIcon, TrashIcon } from './icons'
import { StudyAreaAssignmentField } from './StudyAreaAssignmentField'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  buildAssignableRegulationAreaOptions,
  buildFlexibleRegulationAreaOptions,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation'

const ALL_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

function formatOptionalNumber(value: number | null): string {
  return value === null ? '' : String(value)
}

function formatGrade(value: number | null): string {
  return value === null ? 'No grade' : `Grade ${value.toFixed(1)}`
}

function formatSemester(value: string): string {
  return value.trim() || 'Semester missing'
}

function statusClasses(status: TranscriptImportCandidate['status']): string {
  switch (status) {
    case 'matched':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'uncertain':
      return 'border-slate-300 bg-slate-100 text-slate-700'
    case 'unmatched':
      return 'border-rose-200 bg-rose-50 text-rose-700'
    case 'invalid':
      return 'border-rose-200 bg-rose-50 text-rose-700'
  }
}

function cardClasses(candidate: TranscriptImportCandidate, hasAssignmentIssue: boolean): string {
  if (candidate.status === 'matched' && !hasAssignmentIssue) {
    return 'border-border bg-surface'
  }
  if (candidate.status === 'uncertain') {
    return 'border-slate-300 bg-slate-50/70'
  }
  return 'border-rose-200 bg-rose-50/40'
}

function statusLabel(status: TranscriptImportCandidate['status']): string {
  switch (status) {
    case 'matched':
      return 'Ready'
    case 'uncertain':
      return 'Needs match'
    case 'unmatched':
      return 'Catalog course missing'
    case 'invalid':
      return 'Needs fixes'
  }
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
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const displayTitle = candidate.matchedCourse?.title ?? candidate.title
  const displayNumber = candidate.matchedCourse?.number ?? candidate.courseNumber ?? 'Catalog course required'
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
  const areaOptions = mappedAreaOptions.length > 0 ? mappedAreaOptions : flexibleAreaOptions
  const isAreaLocked = mappedAreaOptions.length === 1
  const hasAssignmentIssue = hasActiveRegulation && areaOptions.length > 1 && !candidate.studyAreaCode

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

    if (candidate.studyAreaCode && !areaOptions.some((option) => option.code === candidate.studyAreaCode)) {
      onChange(updateTranscriptImportCandidate(candidate, { studyAreaCode: null }))
    }
  }, [areaOptions, candidate, candidate.masterCat, candidate.studyAreaCode, isAreaLocked, mappedAreaOptions, onChange])

  return (
    <div className={`rounded-[10px] border px-3.5 py-3 ${cardClasses(candidate, hasAssignmentIssue)}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${statusClasses(candidate.status)}`}
            >
              {statusLabel(candidate.status)}
            </span>
            <span className="text-[11px] text-fg-muted">
              Page {candidate.sourcePage}
              {candidate.sourceSection ? ` · ${candidate.sourceSection}` : ''}
            </span>
          </div>

          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-fg">{displayTitle}</div>
              <div className="mt-1 text-[11px] text-fg-muted">
                {displayNumber} · {candidate.ects ?? '–'} ECTS
              </div>
              <div className={`mt-1 text-[11.5px] ${hasAssignmentIssue || candidate.status === 'invalid' || candidate.status === 'unmatched' ? 'text-rose-700' : 'text-fg-muted'}`}>
                {formatGrade(candidate.grade)} · {formatSemester(candidate.semester)}
                {candidate.studyAreaCode ? ` · ${candidate.studyAreaCode}` : hasAssignmentIssue ? ' · Regulation area missing' : ''}
              </div>
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded((currentValue) => !currentValue)}
            aria-label={isExpanded ? `Close editor for ${displayTitle}` : `Edit ${displayTitle}`}
            className="flex items-center justify-center rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <EditIcon />
          </button>
          <button
            type="button"
            onClick={onDiscard}
            aria-label={`Discard ${displayTitle} from transcript review`}
            className="flex items-center justify-center rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-hover hover:text-primary"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-2.5 grid gap-2.5 border-t border-border-light pt-2.5">
          <div className={`rounded-[10px] border px-3 py-2 text-[11.5px] ${hasAssignmentIssue || candidate.validationIssues.length > 0 || candidate.status === 'unmatched' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-border-light bg-surface text-fg-muted'}`}>
            {candidate.validationIssues[0] ?? candidate.statusDetail}
          </div>

          {candidate.extractedTitle !== displayTitle ? (
            <div className="text-[11px] text-fg-muted">Extracted title: {candidate.extractedTitle}</div>
          ) : null}

          <CatalogCoursePicker
            selectedCourse={candidate.matchedCourse}
            suggestedCourses={candidate.matchOptions}
            studyProgramCode={studyProgramCode}
            compact
            onSelect={(course) => onChange(applyCatalogCourseMatch(candidate, course))}
          />

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <label className="grid gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Semester
              </span>
              <input
                type="text"
                value={candidate.semester}
                onChange={(event) =>
                  onChange(updateTranscriptImportCandidate(candidate, { semester: event.target.value }))
                }
                placeholder="e.g. WS 2024/25"
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Grade
              </span>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={formatOptionalNumber(candidate.grade)}
                onChange={(event) =>
                  onChange(
                    updateTranscriptImportCandidate(candidate, {
                      grade: event.target.value.trim() ? Number(event.target.value) : null,
                    }),
                  )
                }
                placeholder="optional"
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
              />
            </label>
          </div>

          {hasActiveRegulation ? (
            <StudyAreaAssignmentField
              value={candidate.studyAreaCode}
              options={areaOptions}
              locked={isAreaLocked}
              size="compact"
              tone={hasAssignmentIssue ? 'error' : 'default'}
              helpText={
                mappedAreaOptions.length > 1
                  ? 'Choose what this course should count toward.'
                  : mappedAreaOptions.length === 1
                    ? 'Fixed by your active examination regulation.'
                    : 'Choose one compatible elective area.'
              }
              onChange={(nextStudyAreaCode) =>
                onChange(
                  updateTranscriptImportCandidate(candidate, {
                    studyAreaCode: nextStudyAreaCode,
                    masterCat: studyAreaCodeToMasterCat(nextStudyAreaCode) ?? candidate.masterCat,
                  }),
                )
              }
            />
          ) : (
            <div>
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Category
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
          )}
        </div>
      ) : null}
    </div>
  )
}
