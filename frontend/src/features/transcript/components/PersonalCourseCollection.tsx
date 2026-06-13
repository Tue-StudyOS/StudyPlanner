import { useState } from 'react'
import type { CompletedCourse } from '../../courses'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import type { TranscriptImportCandidate } from '../types'
import { CloseIcon } from '../../../shared/components/icons'
import { TranscriptImportRow } from './TranscriptImportRow'

function formatCompletedSubtitle(course: CompletedCourse): string {
  const parts = [
    course.courseNumber ?? course.externalCourseCode ?? null,
    course.ects ? `${course.ects} ECTS` : null,
    course.semester || null,
    course.grade !== null ? `Note ${course.grade.toFixed(1)}` : null,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0))
  return parts.join(' · ')
}

function CompletedCourseRow({
  course,
  onDelete,
}: {
  course: CompletedCourse
  onDelete: () => void
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-[10px] border border-border-light bg-surface-hover/30 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-fg-mid">{course.title}</div>
        <div className="mt-1 truncate text-[11.5px] text-fg-muted">{formatCompletedSubtitle(course)}</div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${course.title} from your personal courses`}
        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-hover hover:text-primary"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

export function PersonalCourseCollection({
  currentReviewCandidates,
  savedIssueCandidates,
  completedCourses,
  studyProgramCode,
  regulationRuleGroups,
  isBusy,
  currentReviewImportableCount,
  savedIssueImportableCount,
  onCurrentReviewCandidateChange,
  onSavedIssueCandidateChange,
  onDiscardCurrentReviewCandidate,
  onDiscardSavedIssueCandidate,
  onImportCurrentReview,
  onImportSavedIssues,
  onResetCurrentReview,
  onClearSavedIssues,
  onDeleteCompleted,
  onClearAll,
}: {
  currentReviewCandidates: TranscriptImportCandidate[]
  savedIssueCandidates: TranscriptImportCandidate[]
  completedCourses: CompletedCourse[]
  studyProgramCode?: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  isBusy?: boolean
  currentReviewImportableCount: number
  savedIssueImportableCount: number
  onCurrentReviewCandidateChange: (candidate: TranscriptImportCandidate) => void
  onSavedIssueCandidateChange: (candidate: TranscriptImportCandidate) => void
  onDiscardCurrentReviewCandidate: (candidateId: string) => void
  onDiscardSavedIssueCandidate: (candidateId: string) => void
  onImportCurrentReview: () => void
  onImportSavedIssues: () => void
  onResetCurrentReview: () => void
  onClearSavedIssues: () => void
  onDeleteCompleted: (completedCourseId: string) => void
  onClearAll: () => void
}) {
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const hasContent = currentReviewCandidates.length > 0 || savedIssueCandidates.length > 0 || completedCourses.length > 0

  return (
    <section className="min-w-0 overflow-hidden rounded-[10px] border border-border bg-surface px-4 py-4 sm:px-5">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg">Personal Courses</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsEditing((value) => !value)}
            className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              isEditing
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-fg hover:bg-surface-hover'
            }`}
          >
            {isEditing ? 'Done' : 'Edit'}
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onClearAll}
              disabled={!hasContent || isBusy}
              className="rounded-md border border-primary/40 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear all
            </button>
          ) : null}
        </div>
      </div>

      {!hasContent ? (
        <div className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-fg-muted">
          Import a transcript or add a completed course manually to build your personal courses.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3.5">
          {currentReviewCandidates.length > 0 ? (
            <div className="grid min-w-0 gap-2.5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                    Current review
                  </div>
                  <p className="mt-1 text-[11.5px] text-fg-muted">
                    Ready now: {currentReviewImportableCount}/{currentReviewCandidates.length} row(s). Rows stay here until you import, discard, or reset them.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onImportCurrentReview}
                    disabled={isBusy || currentReviewImportableCount === 0}
                    className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Import ready rows{currentReviewImportableCount > 0 ? ` (${currentReviewImportableCount})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={onResetCurrentReview}
                    disabled={isBusy}
                    className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reset review
                  </button>
                </div>
              </div>

              {currentReviewCandidates.map((candidate) => (
                <TranscriptImportRow
                  key={candidate.id}
                  candidate={candidate}
                  studyProgramCode={studyProgramCode}
                  regulationRuleGroups={regulationRuleGroups}
                  onDiscard={() => onDiscardCurrentReviewCandidate(candidate.id)}
                  onChange={onCurrentReviewCandidateChange}
                />
              ))}
            </div>
          ) : null}

          {savedIssueCandidates.length > 0 ? (
            <div className="grid min-w-0 gap-2.5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    Saved for later
                  </div>
                  <p className="mt-1 text-[11.5px] text-fg-muted">
                    Ready now: {savedIssueImportableCount}/{savedIssueCandidates.length} row(s). These rows stay in your account until you import or discard them.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onImportSavedIssues}
                    disabled={isBusy || savedIssueImportableCount === 0}
                    className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Import ready saved rows{savedIssueImportableCount > 0 ? ` (${savedIssueImportableCount})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={onClearSavedIssues}
                    disabled={isBusy}
                    className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Clear saved rows
                  </button>
                </div>
              </div>

              {savedIssueCandidates.map((candidate) => (
                <TranscriptImportRow
                  key={candidate.id}
                  candidate={candidate}
                  studyProgramCode={studyProgramCode}
                  regulationRuleGroups={regulationRuleGroups}
                  onDiscard={() => onDiscardSavedIssueCandidate(candidate.id)}
                  onChange={onSavedIssueCandidateChange}
                />
              ))}
            </div>
          ) : null}

          {completedCourses.length > 0 ? (
            <div className="grid min-w-0 gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Credited
              </div>
              {completedCourses.map((course) => (
                <CompletedCourseRow
                  key={course.id}
                  course={course}
                  onDelete={() => onDeleteCompleted(course.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
