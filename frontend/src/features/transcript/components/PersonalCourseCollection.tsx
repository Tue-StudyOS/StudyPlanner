import { useMemo, useState, type ReactNode } from 'react'
import type { CompletedCourse } from '../../courses'
import { useTranslation } from '../../i18n'
import type { CreditPolicy, RegulationRuleGroup } from '../../../shared/utils/regulation'
import { projectPlannerCredits } from '../../../shared/utils/creditProjection.ts'
import { usePersistedToggle } from '../../../shared/hooks/usePersistedToggle'
import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'
import type { TranscriptImportCandidate } from '../types'
import {
  buildCompletedCourseAreaOptions,
  completedCourseAreaLabel,
} from '../utils/completedCourseAreaOptions.ts'
import { StudyAreaAssignmentField } from './StudyAreaAssignmentField'
import { TrashIcon } from './icons'
import { TranscriptImportRow } from './TranscriptImportRow'

// Section collapse state is remembered per device so returning users keep their
// preferred layout instead of re-collapsing long lists every visit.
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

function CollapsibleSection({
  label,
  count,
  hint,
  isCollapsed,
  onToggle,
  actions,
  children,
}: {
  label: string
  count: number
  hint?: string
  isCollapsed: boolean
  onToggle: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-hover/15 px-3.5 py-3.5 sm:px-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <CollapseToggle
            label={label}
            count={count}
            isCollapsed={isCollapsed}
            onToggle={onToggle}
          />
          {hint ? <p className="mt-1 text-[11.5px] text-fg-muted">{hint}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {!isCollapsed ? <div className="mt-3 grid min-w-0 gap-2.5">{children}</div> : null}
    </div>
  )
}


function formatCreditReviewReason(reason: string): string {
  const labels: Record<string, string> = {
    duplicate_achievement: 'Doppelter Leistungsnachweis',
    duplicate_conflicting_grades: 'Doppelte Nachweise mit abweichenden Noten',
    assignment_needs_review: 'Zuordnung muss geprüft werden',
    course_not_eligible_for_area: 'Kurs ist dem Bereich laut PO nicht zugeordnet',
    course_eligibility_unverified: 'PO-Berechtigung des Kurses ist nicht bestätigt',
    compulsory_module_unverified: 'Pflichtmodul nicht verifiziert',
    module_area_mismatch: 'Modul und Prüfungsbereich stimmen nicht überein',
    module_credit_limit_exceeded: 'Modul-ECTS-Limit überschritten',
    alternative_slot_credits_capped: 'Alternativmodul ist bereits ausgeschöpft',
    completion_component_already_included: 'Abschlusskomponente ist im Gesamtabschluss enthalten',
    module_component_already_included: 'Komponente ist im Gesamtmodul enthalten',
    focus_area_excluded_by_basis_admission: 'FOKUS ist bei erklärter BASIS-Zulassung ausgeschlossen',
    basis_area_requires_admission_declaration: 'BASIS erfordert die Zulassungs-Erklärung',
    area_not_in_regulation: 'Bereich ist nicht Teil der aktiven PO',
    seminar_count_limit_exceeded: 'Seminaranzahl laut PO überschritten',
    seminar_area_limit_exceeded: 'Seminar-ECTS-Limit überschritten',
    practical_area_limit_exceeded: 'Praktikums-ECTS-Limit überschritten',
  }
  return labels[reason] ?? 'PO-Anrechnung muss geprüft werden'
}

function formatCompletedSubtitle(course: CompletedCourse): string {
  const parts = [
    course.courseNumber ?? course.externalCourseCode ?? null,
    course.ects ? `${course.ects} ECTS recorded` : null,
    course.semester || null,
    course.grade !== null ? `Note ${String(course.grade)}` : null,
    typeof course.degreeCountedEcts === 'number'
      ? `${course.degreeCountedEcts} ECTS toward degree`
      : null,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0))
  return parts.join(' · ')
}

function CompletedCourseRow({
  course,
  regulationRuleGroups,
  isEditing,
  isSaving,
  areaLabel,
  onDelete,
  onStudyAreaChange,
}: {
  course: CompletedCourse
  regulationRuleGroups: RegulationRuleGroup[]
  isEditing: boolean
  isSaving: boolean
  areaLabel: string
  onDelete: () => void
  onStudyAreaChange: (studyAreaCode: string) => void
}) {
  const { t } = useTranslation()
  const areaOptions = useMemo(
    () => buildCompletedCourseAreaOptions(course, regulationRuleGroups),
    [course, regulationRuleGroups],
  )
  const canChangeArea = areaOptions.length > 1
  const assignedAreaLabel = completedCourseAreaLabel(course, regulationRuleGroups)
  const selectedAreaCode = areaOptions.find(
    (option) => option.code.trim().toUpperCase() === (course.studyAreaCode ?? '').trim().toUpperCase(),
  )?.code ?? course.studyAreaCode ?? null

  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-[10px] border border-border-light bg-surface-hover/30 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-fg-mid">{course.title}</div>
        <div className="mt-1 break-words text-[11.5px] text-fg-muted">{formatCompletedSubtitle(course)}</div>
        {course.isAdditionalAchievement ? (
          <div className="mt-1 break-words text-[11.5px] text-fg-muted">Additional achievement · not counted toward degree</div>
        ) : null}
        {course.creditReviewReasons?.length ? (
          <div role="status" className="mt-1 break-words text-[11.5px] text-danger">
            {course.creditReviewReasons.map(formatCreditReviewReason).join(' · ')}
          </div>
        ) : null}
        {course.assignmentNeedsReview ? (
          <div role="status" className="mt-1 break-words text-[11.5px] text-danger">
            {t('transcript.assignmentNeedsReview')}
          </div>
        ) : null}
        {assignedAreaLabel && !course.assignmentNeedsReview && !(isEditing && canChangeArea) ? (
          <div className="mt-1 break-words text-[11.5px] text-fg-muted">{assignedAreaLabel}</div>
        ) : null}
        {isEditing && canChangeArea ? (
          <div className="mt-2.5 max-w-full sm:max-w-sm">
            <StudyAreaAssignmentField
              label={areaLabel}
              value={course.assignmentNeedsReview ? null : selectedAreaCode}
              options={areaOptions}
              locked={false}
              disabled={isSaving}
              size="compact"
              optionLabel="full"
              onChange={onStudyAreaChange}
            />
          </div>
        ) : null}
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
  creditPolicy,
  mscInfoBasisAdmissionConfirmed,
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
  isSavingCompleted,
  onDeleteCompleted,
  onChangeCompletedArea,
  onClearAll,
}: {
  currentReviewCandidates: TranscriptImportCandidate[]
  savedIssueCandidates: TranscriptImportCandidate[]
  completedCourses: CompletedCourse[]
  studyProgramCode?: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  creditPolicy?: CreditPolicy | null
  mscInfoBasisAdmissionConfirmed?: boolean
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
  isSavingCompleted?: boolean
  onDeleteCompleted: (completedCourseId: string) => void
  onChangeCompletedArea: (completedCourseId: string, studyAreaCode: string) => void
  onClearAll: () => void
}) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [isCreditedCollapsed, setIsCreditedCollapsed] = usePersistedToggle(BROWSER_STORAGE_KEYS.transcriptCreditedCollapsed, false)
  const [isSavedIssuesCollapsed, setIsSavedIssuesCollapsed] = usePersistedToggle(BROWSER_STORAGE_KEYS.transcriptSavedIssuesCollapsed, false)
  const [isCurrentReviewCollapsed, setIsCurrentReviewCollapsed] = usePersistedToggle(BROWSER_STORAGE_KEYS.transcriptCurrentReviewCollapsed, false)
  const hasContent = currentReviewCandidates.length > 0 || savedIssueCandidates.length > 0 || completedCourses.length > 0
  const requiredModuleProgress = studyProgramCode && creditPolicy
    ? projectPlannerCredits({
      programCode: studyProgramCode,
      policy: creditPolicy,
      completedCourses,
      assignedCourses: [],
      mscInfoBasisAdmissionConfirmed,
    }).moduleProgress
    : []

  return (
    <section className="min-w-0 overflow-hidden rounded-[10px] border border-border bg-surface px-4 py-4 sm:px-5">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg">{t('transcript.personalTitle')}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (!isEditing) {
                setIsCreditedCollapsed(false)
              }
              setIsEditing((value) => !value)
            }}
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

      {requiredModuleProgress.length > 0 ? (
        <p className="mb-3 text-[11.5px] text-fg-muted">
          {t('transcript.requiredModulesStatus', {
            complete: requiredModuleProgress.filter((module) => module.isFulfilled).length,
            total: requiredModuleProgress.length,
          })}
        </p>
      ) : null}

      {!hasContent ? (
        <div className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-fg-muted">
          {t('transcript.empty')}
        </div>
      ) : (
        <div className="grid min-w-0 gap-3.5">
          {currentReviewCandidates.length > 0 ? (
            <CollapsibleSection
              label={t('transcript.currentReview')}
              count={currentReviewCandidates.length}
              hint={t('transcript.currentReviewHint', { ready: currentReviewImportableCount, total: currentReviewCandidates.length })}
              isCollapsed={isCurrentReviewCollapsed}
              onToggle={() => setIsCurrentReviewCollapsed(!isCurrentReviewCollapsed)}
              actions={(
                <>
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
                </>
              )}
            >
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
            </CollapsibleSection>
          ) : null}

          {savedIssueCandidates.length > 0 ? (
            <CollapsibleSection
              label={t('transcript.savedForLater')}
              count={savedIssueCandidates.length}
              hint={t('transcript.savedForLaterHint', { ready: savedIssueImportableCount, total: savedIssueCandidates.length })}
              isCollapsed={isSavedIssuesCollapsed}
              onToggle={() => setIsSavedIssuesCollapsed(!isSavedIssuesCollapsed)}
              actions={(
                <>
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
                </>
              )}
            >
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
            </CollapsibleSection>
          ) : null}

          {completedCourses.length > 0 ? (
            <CollapsibleSection
              label={t('transcript.credited')}
              count={completedCourses.length}
              isCollapsed={isCreditedCollapsed}
              onToggle={() => setIsCreditedCollapsed(!isCreditedCollapsed)}
            >
              {completedCourses.map((course) => (
                <CompletedCourseRow
                  key={course.id}
                  course={course}
                  regulationRuleGroups={regulationRuleGroups}
                  isEditing={isEditing}
                  isSaving={Boolean(isSavingCompleted)}
                  areaLabel={t('transcript.manual.area')}
                  onDelete={() => onDeleteCompleted(course.id)}
                  onStudyAreaChange={(studyAreaCode) => onChangeCompletedArea(course.id, studyAreaCode)}
                />
              ))}
            </CollapsibleSection>
          ) : null}
        </div>
      )}
    </section>
  )
}
