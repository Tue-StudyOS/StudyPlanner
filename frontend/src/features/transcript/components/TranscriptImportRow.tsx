import { useState } from 'react'
import type { MasterCat } from '../../courses'
import type { TranscriptImportCandidate } from '../types'
import { applyCatalogCourseMatch, updateTranscriptImportCandidate } from '../utils/buildTranscriptImportCandidates'
import { CatalogCoursePicker } from './CatalogCoursePicker'
import { CategoryToggle } from './CategoryToggle'
import { EditIcon, TrashIcon } from './icons'

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
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'unmatched':
      return 'border-slate-200 bg-slate-100 text-slate-700'
    case 'invalid':
      return 'border-rose-200 bg-rose-50 text-rose-700'
  }
}

function cardClasses(status: TranscriptImportCandidate['status']): string {
  switch (status) {
    case 'matched':
      return 'border-border bg-surface'
    case 'uncertain':
      return 'border-amber-200 bg-amber-50/40'
    case 'unmatched':
      return 'border-slate-300 bg-slate-50/50'
    case 'invalid':
      return 'border-rose-200 bg-rose-50/40'
  }
}

function statusLabel(status: TranscriptImportCandidate['status']): string {
  switch (status) {
    case 'matched':
      return 'Ready'
    case 'uncertain':
      return 'Needs review'
    case 'unmatched':
      return 'Catalog course missing'
    case 'invalid':
      return 'Needs fixes'
  }
}

interface TranscriptImportRowProps {
  candidate: TranscriptImportCandidate
  studyProgramCode?: string | null
  onChange: (candidate: TranscriptImportCandidate) => void
  onDiscard: () => void
}

export function TranscriptImportRow({
  candidate,
  studyProgramCode,
  onChange,
  onDiscard,
}: TranscriptImportRowProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const displayTitle = candidate.matchedCourse?.title ?? candidate.title
  const displayNumber = candidate.matchedCourse?.number ?? candidate.courseNumber ?? 'Catalog course required'

  return (
    <div className={`rounded-[10px] border px-5 py-4.5 ${cardClasses(candidate.status)}`}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-fg">{displayTitle}</div>
              <div className="mt-1 text-[12px] text-fg-muted">
                {formatGrade(candidate.grade)} · {formatSemester(candidate.semester)}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-[14px] font-semibold text-fg">{candidate.ects ?? '–'} ECTS</div>
              <div className="text-[12px] text-fg-muted">{displayNumber}</div>
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
        <div className="mt-4 grid gap-3.5 border-t border-border-light pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] ${statusClasses(candidate.status)}`}
            >
              {statusLabel(candidate.status)}
            </span>
            <span className="text-[11px] text-fg-muted">
              Page {candidate.sourcePage}
              {candidate.sourceSection ? ` · ${candidate.sourceSection}` : ''}
            </span>
          </div>

          <div className="text-[12.5px] text-fg-mid">{candidate.statusDetail}</div>

          {candidate.extractedTitle !== displayTitle ? (
            <div className="text-[12px] text-fg-muted">Extracted title: {candidate.extractedTitle}</div>
          ) : null}

          {candidate.validationIssues.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700">
              {candidate.validationIssues.join(' ')}
            </div>
          ) : null}

          {candidate.validationIssues.length === 0 && candidate.parseIssues.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-700">
              {candidate.parseIssues.join(' ')}
            </div>
          ) : null}

          <CatalogCoursePicker
            selectedCourse={candidate.matchedCourse}
            suggestedCourses={candidate.matchOptions}
            studyProgramCode={studyProgramCode}
            onSelect={(course) => onChange(applyCatalogCourseMatch(candidate, course))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Semester
              </span>
              <input
                type="text"
                value={candidate.semester}
                onChange={(event) =>
                  onChange(updateTranscriptImportCandidate(candidate, { semester: event.target.value }))
                }
                placeholder="e.g. WS 2024/25"
                className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
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
                className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
              />
            </label>
          </div>

          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
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
        </div>
      ) : null}
    </div>
  )
}
