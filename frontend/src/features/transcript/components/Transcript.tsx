import type { ChangeEvent, DragEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PageShell } from '../../../shared/components/PageShell'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { StatItem } from '../../../shared/components/StatItem'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { useOnboarding } from '../../onboarding'
import {
  TOUR_PLANNER_RULE_GROUPS,
  TOUR_TRANSCRIPT_COMPLETED_COURSES,
  TOUR_TRANSCRIPT_IMPORT_CANDIDATES,
  TOUR_TRANSCRIPT_STATS,
  isTranscriptTourStep,
} from '../../onboarding/utils/tourPreviewData.ts'
import { ALL_CATALOG_PERIODS, useCatalogCourses } from '../../courses'
import type { CompletedCourse } from '../../courses'
import {
  fetchTranscriptIssues,
  saveTranscriptIssues,
} from '../api'
import { useStudyStats } from '../hooks/useStudyStats'
import { useTranscript } from '../hooks/useTranscript'
import type {
  SavedTranscriptIssue,
  TranscriptImportCandidate,
  TranscriptImportPhase,
} from '../types'
import {
  buildTranscriptImportCandidates,
  canImportTranscriptCandidate,
} from '../utils/buildTranscriptImportCandidates'
import {
  buildFailedImportCandidate,
  buildImportNotice,
  buildReviewCandidateKey,
  mergeIssues,
  toImportedCompletedCourse,
  toSavedIssue,
} from '../utils/transcriptReview'
import { parseTranscriptPdf } from '../utils/parseTranscriptPdf'
import { ManualCompletedCourseForm } from './ManualCompletedCourseForm'
import { PersonalCourseCollection } from './PersonalCourseCollection'
import { TranscriptUploadCard } from './TranscriptUploadCard'

const MAX_TRANSCRIPT_FILE_SIZE_BYTES = 10 * 1024 * 1024
const CATALOG_LIMIT = 1000
const IMPORT_CANDIDATES_SESSION_CACHE_VERSION = 'v2'

function buildImportCandidatesSessionKey(username: string | null | undefined): string {
  return `transcript-import-candidates.${IMPORT_CANDIDATES_SESSION_CACHE_VERSION}.${username ?? 'anonymous'}`
}

function restoreImportCandidates(username: string | null | undefined): TranscriptImportCandidate[] {
  try {
    const raw = sessionStorage.getItem(buildImportCandidatesSessionKey(username))
    return raw ? (JSON.parse(raw) as TranscriptImportCandidate[]) : []
  } catch {
    return []
  }
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function AuthenticatedTranscript() {
  const { user, token } = useAuth()
  const { t } = useTranslation()
  const { isOpen: isOnboardingOpen, activeStepId } = useOnboarding()
  const importCandidatesSessionKey = useMemo(() => buildImportCandidatesSessionKey(user?.username), [user?.username])
  const restoredImportCandidates = useMemo<TranscriptImportCandidate[]>(() => restoreImportCandidates(user?.username), [user?.username])
  const [importCandidates, setImportCandidates] = useState<TranscriptImportCandidate[]>(restoredImportCandidates)
  const [persistedIssues, setPersistedIssues] = useState<SavedTranscriptIssue[]>([])
  const [importPhase, setImportPhase] = useState<TranscriptImportPhase>(() =>
    restoredImportCandidates.length > 0 ? 'parsed' : 'idle',
  )
  const [importError, setImportError] = useState<string | null>(null)
  const [importNotice, setImportNotice] = useState<string | null>(null)
  const [issuesError, setIssuesError] = useState<string | null>(null)
  const [isLoadingIssues, setIsLoadingIssues] = useState<boolean>(false)
  const [isSavingIssues, setIsSavingIssues] = useState<boolean>(false)
  const [isDragActive, setIsDragActive] = useState<boolean>(false)
  const [issueDraftDirty, setIssueDraftDirty] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const {
    regulationVersion,
    isLoadingRegulationVersion,
    regulationVersionError,
  } = useRegulationVersion(user?.profile.regulationVersionCode)
  const {
    completedCourses,
    isSavingCompletedCourses,
    completedCoursesError,
    addCompletedCourse,
    importCompletedCourses,
    removeCourse,
    removeTranscriptImports,
    clearCompletedCoursesError,
  } = useTranscript()
  const { totalEcts, requiredEcts, progress, averageGrade } = useStudyStats()
  const {
    courses: baseCatalogCourses,
    isLoading: isLoadingCatalog,
    error: catalogError,
  } = useCatalogCourses('', CATALOG_LIMIT, ALL_CATALOG_PERIODS)

  const regulationRuleGroups = regulationVersion?.ruleGroups ?? []
  const savedIssueCandidates = useMemo(
    () => persistedIssues.map((issue) => issue.candidate),
    [persistedIssues],
  )
  const importableReviewCandidateCount = useMemo(
    () => importCandidates.filter((candidate) => canImportTranscriptCandidate(candidate)).length,
    [importCandidates],
  )
  const importableSavedIssueCount = useMemo(
    () => savedIssueCandidates.filter((candidate) => canImportTranscriptCandidate(candidate)).length,
    [savedIssueCandidates],
  )

  const isTranscriptTourPreview = isOnboardingOpen && isTranscriptTourStep(activeStepId)
  const displayStats = isTranscriptTourPreview ? TOUR_TRANSCRIPT_STATS : { totalEcts, requiredEcts, progress, averageGrade }
  const displayImportCandidates = isTranscriptTourPreview ? TOUR_TRANSCRIPT_IMPORT_CANDIDATES : importCandidates
  const displaySavedIssueCandidates = isTranscriptTourPreview ? [] : savedIssueCandidates
  const displayCompletedCourses = isTranscriptTourPreview ? TOUR_TRANSCRIPT_COMPLETED_COURSES : completedCourses
  const displayRegulationRuleGroups = isTranscriptTourPreview ? TOUR_PLANNER_RULE_GROUPS : regulationRuleGroups
  const displayStudyProgramCode = isTranscriptTourPreview ? 'TOUR' : user?.profile.studyProgramCode
  const displayRegulationVersionCode = isTranscriptTourPreview ? 'tour-preview' : user?.profile.regulationVersionCode
  const displayImportPhase = isTranscriptTourPreview ? 'parsed' : importPhase
  const displayImportError = isTranscriptTourPreview ? null : importError
  const displayImportNotice = isTranscriptTourPreview ? null : importNotice
  const displayIsBusy = isTranscriptTourPreview ? false : isSavingIssues || importPhase === 'saving'
  const displayIsSavingCompletedCourses = isTranscriptTourPreview ? false : isSavingCompletedCourses
  const displayCompletedCoursesError = isTranscriptTourPreview ? null : completedCoursesError
  const displayRegulationVersionError = isTranscriptTourPreview ? null : regulationVersionError
  const displayIssuesError = isTranscriptTourPreview ? null : issuesError
  const displayIsLoadingRegulationVersion = isTranscriptTourPreview ? false : isLoadingRegulationVersion
  const displayIsLoadingIssues = isTranscriptTourPreview ? false : isLoadingIssues
  const displayIsSavingIssues = isTranscriptTourPreview ? false : isSavingIssues
  const displayImportableReviewCandidateCount = isTranscriptTourPreview
    ? TOUR_TRANSCRIPT_IMPORT_CANDIDATES.filter((candidate) => canImportTranscriptCandidate(candidate)).length
    : importableReviewCandidateCount
  const displayImportableSavedIssueCount = isTranscriptTourPreview ? 0 : importableSavedIssueCount

  const stats = [
    { label: t('transcript.progress'), value: `${displayStats.progress} %` },
    { label: t('transcript.ectsEarned'), value: `${displayStats.totalEcts} / ${displayStats.requiredEcts}` },
    { label: t('transcript.averageGrade'), value: displayStats.averageGrade !== null ? displayStats.averageGrade.toFixed(2) : '–' },
  ]

  useEffect(() => {
    let isActive = true

    async function loadTranscriptIssues(): Promise<void> {
      if (!token) {
        if (isActive) {
          setPersistedIssues([])
          setIssuesError(null)
          setIsLoadingIssues(false)
          setIssueDraftDirty(false)
        }
        return
      }

      setIsLoadingIssues(true)
      setIssuesError(null)
      try {
        const transcriptIssues = await fetchTranscriptIssues(token)
        if (!isActive) {
          return
        }
        const restoredReviewKeys = new Set(
          restoredImportCandidates.map((candidate) => buildReviewCandidateKey(candidate)),
        )
        setPersistedIssues(
          transcriptIssues
            .map(toSavedIssue)
            .filter((issue) => !restoredReviewKeys.has(buildReviewCandidateKey(issue.candidate))),
        )
        setIssueDraftDirty(false)
      } catch (error) {
        if (isActive) {
          setPersistedIssues([])
          setIssuesError(error instanceof Error ? error.message : 'Failed to load saved transcript issues.')
        }
      } finally {
        if (isActive) {
          setIsLoadingIssues(false)
        }
      }
    }

    void loadTranscriptIssues()

    return () => {
      isActive = false
    }
  }, [restoredImportCandidates, token])

  useEffect(() => {
    if (importCandidates.length > 0) {
      sessionStorage.setItem(importCandidatesSessionKey, JSON.stringify(importCandidates))
    } else {
      sessionStorage.removeItem(importCandidatesSessionKey)
    }
  }, [importCandidates, importCandidatesSessionKey])

  const persistTranscriptIssues = useCallback(async (nextIssues: SavedTranscriptIssue[]): Promise<boolean> => {
    if (!token) {
      setIssuesError('Sign in to keep transcript issues in your account.')
      return false
    }

    setIsSavingIssues(true)
    setIssuesError(null)
    try {
      const savedIssues = await saveTranscriptIssues(token, {
        transcriptIssues: nextIssues.map((issue) => ({ id: issue.id, candidate: issue.candidate })),
      })
      setPersistedIssues(savedIssues.map(toSavedIssue))
      setIssueDraftDirty(false)
      return true
    } catch (error) {
      setIssuesError(error instanceof Error ? error.message : 'Failed to save transcript issues.')
      return false
    } finally {
      setIsSavingIssues(false)
    }
  }, [token])

  useEffect(() => {
    if (!token || !issueDraftDirty) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void persistTranscriptIssues(persistedIssues)
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [issueDraftDirty, persistTranscriptIssues, persistedIssues, token])

  async function handleManualCourseAdd(course: CompletedCourse): Promise<boolean> {
    clearCompletedCoursesError()
    setImportNotice(null)
    const result = await addCompletedCourse(course)
    if (!result.saved) {
      return false
    }

    setImportNotice(`Added ${course.title} to your completed courses.`)
    return true
  }

  async function handleTranscriptFile(file: File): Promise<void> {
    clearCompletedCoursesError()
    setImportNotice(null)
    setImportError(null)

    if (!isPdfFile(file)) {
      setImportPhase(importCandidates.length > 0 ? 'parsed' : 'failed')
      setImportError('Only PDF transcripts are supported right now.')
      return
    }

    if (file.size > MAX_TRANSCRIPT_FILE_SIZE_BYTES) {
      setImportPhase(importCandidates.length > 0 ? 'parsed' : 'failed')
      setImportError(
        `The selected file is too large. Please keep transcript PDFs below ${Math.round(MAX_TRANSCRIPT_FILE_SIZE_BYTES / 1024 / 1024)} MB.`,
      )
      return
    }

    if (isLoadingCatalog) {
      setImportPhase(importCandidates.length > 0 ? 'parsed' : 'failed')
      setImportError('The course catalog is still loading. Please wait a moment and try the import again.')
      return
    }

    if (catalogError) {
      setImportPhase(importCandidates.length > 0 ? 'parsed' : 'failed')
      setImportError(
        `The course catalog could not be loaded, so transcript matching is unavailable right now. ${catalogError}`,
      )
      return
    }

    setImportPhase('validating')

    try {
      setImportPhase('parsing')
      const parsedEntries = await parseTranscriptPdf(file)
      if (parsedEntries.length === 0) {
        throw new Error(
          'No transcript rows could be extracted from this PDF. Please verify the format or add courses manually below.',
        )
      }

      const nextCandidates = buildTranscriptImportCandidates(parsedEntries, baseCatalogCourses, {
        studyProgramCode: user?.profile.studyProgramCode,
        regulationRuleGroups,
      })
      if (nextCandidates.length === 0) {
        throw new Error('No transcript rows could be prepared for review. Please add courses manually below.')
      }

      // The newest upload is the source of truth: it replaces the current
      // review, saved-for-later rows, and previously imported transcript data.
      setImportCandidates(nextCandidates)
      setImportPhase('parsed')
      setPersistedIssues([])
      if (persistedIssues.length > 0) {
        void persistTranscriptIssues([])
      }
      await removeTranscriptImports()

      setImportNotice(
        `Extracted ${nextCandidates.length} course(s) — this upload replaces your previous transcript import. Review, fix, or discard anything before importing.`,
      )
    } catch (error) {
      setImportPhase(importCandidates.length > 0 ? 'parsed' : 'failed')
      setImportError(error instanceof Error ? error.message : 'The selected PDF could not be parsed.')
    }
  }

  const importCandidateBatch = useCallback(async (
    candidates: TranscriptImportCandidate[],
    source: 'review' | 'issues',
  ): Promise<void> => {
    clearCompletedCoursesError()
    setImportError(null)
    setImportNotice(null)

    if (candidates.length === 0) {
      setImportError('There are no transcript rows to import.')
      return
    }

    const blockingCandidates = candidates.filter((candidate) => !canImportTranscriptCandidate(candidate))
    const importableCandidates = candidates.filter((candidate) => canImportTranscriptCandidate(candidate))

    if (importableCandidates.length === 0) {
      setImportError(
        'No transcript rows are ready to import yet. Complete the missing course match, semester, grade, and regulation area first.',
      )
      return
    }

    setImportPhase('saving')
    const importResult = await importCompletedCourses(
      importableCandidates.map((candidate) => ({
        id: candidate.id,
        course: toImportedCompletedCourse(candidate),
      })),
    )

    if (importResult === null) {
      setImportPhase(importCandidates.length > 0 ? 'parsed' : 'idle')
      return
    }

    const failedImportMessages = new Map(importResult.failed.map((item) => [item.id, item.message]))
    const remainingIssueCandidates = [
      ...blockingCandidates,
      ...importableCandidates
        .filter((candidate) => failedImportMessages.has(candidate.id))
        .map((candidate) =>
          buildFailedImportCandidate(
            candidate,
            failedImportMessages.get(candidate.id) ?? 'Saving this course failed. Please review it again.',
          ),
        ),
    ]

    const baseIssues = source === 'issues'
      ? persistedIssues.filter((issue) => !candidates.some((candidate) => candidate.id === issue.id))
      : persistedIssues
    const nextPersistedIssues = mergeIssues(baseIssues, remainingIssueCandidates)
    const savedIssues = await persistTranscriptIssues(nextPersistedIssues)

    if (savedIssues) {
      if (source === 'review') {
        setImportCandidates([])
      }
    } else if (source === 'review') {
      setImportCandidates(remainingIssueCandidates)
    }

    if (source === 'review') {
      setImportPhase(savedIssues ? 'idle' : remainingIssueCandidates.length > 0 ? 'parsed' : 'idle')
    } else {
      setImportPhase(importCandidates.length > 0 ? 'parsed' : 'idle')
    }
    setImportNotice(
      buildImportNotice({
        importedCount: importResult.imported.length,
        skippedDuplicateCount: importResult.skippedDuplicates.length,
        unresolvedCount: remainingIssueCandidates.length,
        issueSyncFailed: !savedIssues,
      }),
    )
  }, [clearCompletedCoursesError, importCandidates, importCompletedCourses, persistTranscriptIssues, persistedIssues])

  function openFilePicker(): void {
    fileInputRef.current?.click()
  }

  function updateImportCandidateById(nextCandidate: TranscriptImportCandidate): void {
    setImportCandidates((previousCandidates) =>
      previousCandidates.map((candidate) =>
        candidate.id === nextCandidate.id ? nextCandidate : candidate,
      ),
    )
  }

  function updatePersistedIssueCandidate(nextCandidate: TranscriptImportCandidate): void {
    setPersistedIssues((previousIssues) =>
      previousIssues.map((issue) =>
        issue.id === nextCandidate.id
          ? { ...issue, candidate: nextCandidate, updatedAtUnix: Date.now() }
          : issue,
      ),
    )
    setIssueDraftDirty(true)
  }

  function discardImportCandidate(candidateId: string): void {
    setImportCandidates((previousCandidates) => {
      const nextCandidates = previousCandidates.filter((candidate) => candidate.id !== candidateId)
      if (nextCandidates.length === 0) {
        setImportPhase('idle')
        setImportNotice(null)
        setImportError(null)
      }
      return nextCandidates
    })
  }

  async function discardPersistedIssue(candidateId: string): Promise<void> {
    const nextIssues = persistedIssues.filter((issue) => issue.id !== candidateId)
    await persistTranscriptIssues(nextIssues)
  }

  function resetImportReview(): void {
    setImportCandidates([])
    setImportPhase('idle')
    setImportError(null)
    setImportNotice(null)
  }

  async function clearPersistedIssues(): Promise<void> {
    await persistTranscriptIssues([])
  }

  async function handleClearAll(): Promise<void> {
    resetImportReview()
    await clearPersistedIssues()
    if (completedCourses.length > 0) {
      for (const course of completedCourses) {
        await removeCourse(course.id)
      }
    }
  }

  function handleImportCurrentReview(): void {
    void importCandidateBatch(importCandidates, 'review')
  }

  function handleImportSavedIssues(): void {
    void importCandidateBatch(savedIssueCandidates, 'issues')
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextFile = event.target.files?.[0]
    if (nextFile) {
      void handleTranscriptFile(nextFile)
    }
    event.target.value = ''
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault()
    setIsDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault()
    setIsDragActive(false)
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault()
    setIsDragActive(false)
    const nextFile = event.dataTransfer.files?.[0]
    if (nextFile) {
      void handleTranscriptFile(nextFile)
    }
  }

  return (
    <div className="min-w-0 grid gap-4 overflow-x-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-[10px] border border-border bg-surface px-3 py-3.5 sm:px-5 sm:py-4"
          >
            <StatItem label={stat.label} value={stat.value} />
          </div>
        ))}
      </div>

      {/* Upload card and manual form share one row and stretch to the same
          height, so the two entry points read as equal-weight options. */}
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="min-w-0 aspect-square" data-tour="transcript-upload">
          <TranscriptUploadCard
            isDragActive={isDragActive}
            disabled={isLoadingCatalog}
            phase={displayImportPhase}
            error={displayImportError}
            maxFileSizeLabel={`${Math.round(MAX_TRANSCRIPT_FILE_SIZE_BYTES / 1024 / 1024)} MB`}
            onBrowse={openFilePicker}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        </div>

        <ManualCompletedCourseForm
          defaultSemester={isTranscriptTourPreview ? 'SS 2026' : user?.profile.currentSemesterLabel}
          studyProgramCode={displayStudyProgramCode}
          regulationVersionCode={displayRegulationVersionCode}
          regulationRuleGroups={displayRegulationRuleGroups}
          isLoadingRegulationVersion={isTranscriptTourPreview ? false : isLoadingRegulationVersion}
          isSaving={displayIsSavingCompletedCourses}
          onSave={handleManualCourseAdd}
        />
      </div>

      {(displayRegulationVersionError || displayCompletedCoursesError || displayImportNotice || displayIssuesError || displayIsSavingCompletedCourses || displayIsSavingIssues || displayIsLoadingIssues || displayIsLoadingRegulationVersion) ? (
        <div className="grid gap-2">
          {displayRegulationVersionError ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
              {displayRegulationVersionError}
            </div>
          ) : null}

          {displayIsLoadingRegulationVersion ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
              Loading your active regulation settings...
            </div>
          ) : null}

          {displayCompletedCoursesError ? (
            <div className="rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-primary">
              {displayCompletedCoursesError}
            </div>
          ) : null}

          {displayIssuesError ? (
            <div className="rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-primary">
              {displayIssuesError}
            </div>
          ) : null}

          {displayImportNotice ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-mid">
              {displayImportNotice}
            </div>
          ) : null}

          {displayIsSavingCompletedCourses ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
              Saving your completed-course history...
            </div>
          ) : null}

          {displayIsLoadingIssues || displayIsSavingIssues ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
              {displayIsLoadingIssues ? 'Loading saved transcript issues...' : 'Saving transcript issues...'}
            </div>
          ) : null}
        </div>
      ) : null}

      <PersonalCourseCollection
        currentReviewCandidates={displayImportCandidates}
        savedIssueCandidates={displaySavedIssueCandidates}
        completedCourses={displayCompletedCourses}
        studyProgramCode={displayStudyProgramCode}
        regulationRuleGroups={displayRegulationRuleGroups}
        isBusy={displayIsBusy}
        currentReviewImportableCount={displayImportableReviewCandidateCount}
        savedIssueImportableCount={displayImportableSavedIssueCount}
        onCurrentReviewCandidateChange={updateImportCandidateById}
        onSavedIssueCandidateChange={updatePersistedIssueCandidate}
        onDiscardCurrentReviewCandidate={discardImportCandidate}
        onDiscardSavedIssueCandidate={(candidateId) => void discardPersistedIssue(candidateId)}
        onImportCurrentReview={handleImportCurrentReview}
        onImportSavedIssues={handleImportSavedIssues}
        onResetCurrentReview={resetImportReview}
        onClearSavedIssues={() => void clearPersistedIssues()}
        onDeleteCompleted={(completedCourseId) => void removeCourse(completedCourseId)}
        onClearAll={() => void handleClearAll()}
      />

    </div>
  )
}

export function Transcript() {
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()

  return (
    <PageShell>
      <div className="mb-6" data-tour="transcript-page">
        <h1 className="mb-0.75 text-[22px] font-semibold tracking-[-0.01em] text-fg">
          {t('transcript.title')}
        </h1>
      </div>

      {isAuthenticated ? (
        <AuthenticatedTranscript />
      ) : (
        <PersonalFeatureNotice
          title={t('transcript.guestTitle')}
          description={t('transcript.guestDescription')}
        />
      )}
    </PageShell>
  )
}
