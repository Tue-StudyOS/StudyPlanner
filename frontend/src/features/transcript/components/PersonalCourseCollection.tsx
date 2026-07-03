import { useState } from 'react'
import type { CompletedCourse } from '../../courses'
import { useTranslation } from '../../i18n'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { usePersistedToggle } from '../../../shared/hooks/usePersistedToggle'
import type { TranscriptImportCandidate } from '../types'
import { TrashIcon } from './icons'
import { TranscriptImportRow } from './TranscriptImportRow'

// Section collapse state is remembered per device so returning users keep their
// preferred layout instead of re-collapsing long lists every visit.
const CREDITED_COLLAPSE_KEY = 'studyplaner.transcript.collapse.credited'
const SAVED_ISSUES_COLLAPSE_KEY = 'studyplaner.transcript.collapse.savedIssues'

function CollapseToggle({
  label,
  count,
  isCollapsed,
  onToggle,
}: {
  label: string
  count: number
  isCollapsed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-expanded={!isCollapsed}
      onClick={onToggle}
      className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted transition-colors hover:text-fg"
    >
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={`h-3 w-3 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
      >
        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="truncate">{label}</span>
      <span className="text-fg-muted/70">({count})</span>
    </button>
  )
}

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
        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-hover hover:text-danger"
      >
        <TrashIcon />
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
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [isCreditedCollapsed, setIsCreditedCollapsed] = usePersistedToggle(CREDITED_COLLAPSE_KEY, false)
  const [isSavedIssuesCollapsed, setIsSavedIssuesCollapsed] = usePersistedToggle(SAVED_ISSUES_COLLAPSE_KEY, false)
  const hasContent = currentReviewCandidates.length > 0 || savedIssueCandidates.length > 0 || completedCourses.length > 0

  return (
    <section className="min-w-0 overflow-hidden rounded-[10px] border border-border bg-surface px-4 py-4 sm:px-5">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg">{t('transcript.personalTitle')}</div>
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
            {isEditing ? t('transcript.done') : t('transcript.edit')}
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={onClearAll}
              disabled={!hasContent || isBusy}
              className="rounded-md border border-primary/40 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('transcript.clearAll')}
            </button>
          ) : null}
        </div>
      </div>

      {!hasContent ? (
        <div className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-fg-muted">
          {t('transcript.empty')}
        </div>
      ) : (
        <div className="grid min-w-0 gap-3.5">
          {currentReviewCandidates.length > 0 ? (
            <div className="grid min-w-0 gap-2.5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                    {t('transcript.currentReview')}
                  </div>
                  <p className="mt-1 text-[11.5px] text-fg-muted">
                    {t('transcript.currentReviewHint', { ready: currentReviewImportableCount, total: currentReviewCandidates.length })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onImportCurrentReview}
                    disabled={isBusy || currentReviewImportableCount === 0}
                    className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('transcript.importReady')}{currentReviewImportableCount > 0 ? ` (${currentReviewImportableCount})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={onResetCurrentReview}
                    disabled={isBusy}
                    className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('transcript.resetReview')}
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

              {/* The primary import also sits at the bottom of the list, where
                  users look for it after editing the rows above. */}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light pt-2.5">
                <button
                  type="button"
                  onClick={onImportCurrentReview}
                  disabled={isBusy || currentReviewImportableCount === 0}
                  className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('transcript.importReady')}{currentReviewImportableCount > 0 ? ` (${currentReviewImportableCount})` : ''}
                </button>
              </div>
            </div>
          ) : null}

          {savedIssueCandidates.length > 0 ? (
            <div className="grid min-w-0 gap-2.5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <CollapseToggle
                    label={t('transcript.savedForLater')}
                    count={savedIssueCandidates.length}
                    isCollapsed={isSavedIssuesCollapsed}
                    onToggle={() => setIsSavedIssuesCollapsed(!isSavedIssuesCollapsed)}
                  />
                  <p className="mt-1 text-[11.5px] text-fg-muted">
                    {t('transcript.savedForLaterHint', { ready: savedIssueImportableCount, total: savedIssueCandidates.length })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onImportSavedIssues}
                    disabled={isBusy || savedIssueImportableCount === 0}
                    className="rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('transcript.importSaved')}{savedIssueImportableCount > 0 ? ` (${savedIssueImportableCount})` : ''}
                  </button>
                  <button
                    type="button"
                    onClick={onClearSavedIssues}
                    disabled={isBusy}
                    className="rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('transcript.clearSaved')}
                  </button>
                </div>
              </div>

              {!isSavedIssuesCollapsed
                ? savedIssueCandidates.map((candidate) => (
                    <TranscriptImportRow
                      key={candidate.id}
                      candidate={candidate}
                      studyProgramCode={studyProgramCode}
                      regulationRuleGroups={regulationRuleGroups}
                      onDiscard={() => onDiscardSavedIssueCandidate(candidate.id)}
                      onChange={onSavedIssueCandidateChange}
                    />
                  ))
                : null}
            </div>
          ) : null}

          {completedCourses.length > 0 ? (
            <div className="grid min-w-0 gap-2">
              <CollapseToggle
                label={t('transcript.credited')}
                count={completedCourses.length}
                isCollapsed={isCreditedCollapsed}
                onToggle={() => setIsCreditedCollapsed(!isCreditedCollapsed)}
              />
              {!isCreditedCollapsed
                ? completedCourses.map((course) => (
                    <CompletedCourseRow
                      key={course.id}
                      course={course}
                      onDelete={() => onDeleteCompleted(course.id)}
                    />
                  ))
                : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
