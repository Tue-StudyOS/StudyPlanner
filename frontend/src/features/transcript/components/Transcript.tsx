import type { ChangeEvent, DragEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { StatItem } from '../../../shared/components/StatItem'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { useAuth } from '../../auth'
import { useCatalogCourses } from '../../courses'
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
  mergeReviewCandidates,
  toImportedCompletedCourse,
  toSavedIssue,
} from '../utils/transcriptReview'
import { parseTranscriptPdf } from '../utils/parseTranscriptPdf'
import { ManualCompletedCourseForm } from './ManualCompletedCourseForm'
import { PersonalCourseCollection } from './PersonalCourseCollection'
import { TranscriptUploadCard } from './TranscriptUploadCard'

const MAX_TRANSCRIPT_FILE_SIZE_BYTES = 10 * 1024 * 1024
const CATALOG_LIMIT = 200
const IMPORT_CANDIDATES_SESSION_KEY = 'transcript-import-candidates'

function restoreImportCandidates(): TranscriptImportCandidate[] {
  try {
    const raw = sessionStorage.getItem(IMPORT_CANDIDATES_SESSION_KEY)
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
  const restoredImportCandidates = useMemo<TranscriptImportCandidate[]>(() => restoreImportCandidates(), [])
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
    clearCompletedCoursesError,
  } = useTranscript()
  const { totalEcts, requiredEcts, progress, averageGrade } = useStudyStats()
  const {
    courses: baseCatalogCourses,
    isLoading: isLoadingCatalog,
    error: catalogError,
  } = useCatalogCourses('', CATALOG_LIMIT)

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

  const stats = [
    { label: 'Progress', value: `${progress} %` },
    { label: 'ECTS Earned', value: `${totalEcts} / ${requiredEcts}` },
    { label: 'Average grade', value: averageGrade !== null ? averageGrade.toFixed(2) : '–' },
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
      sessionStorage.setItem(IMPORT_CANDIDATES_SESSION_KEY, JSON.stringify(importCandidates))
    } else {
      sessionStorage.removeItem(IMPORT_CANDIDATES_SESSION_KEY)
    }
  }, [importCandidates])

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

      const { candidates: mergedCandidates, addedCount, duplicateCount } = mergeReviewCandidates(
        importCandidates,
        nextCandidates,
        savedIssueCandidates,
      )
      setImportCandidates(mergedCandidates)
      setImportPhase('parsed')

      if (addedCount === 0) {
        setImportNotice('All extracted rows are already waiting in your review or saved for later.')
        return
      }

      const messageParts = [
        importCandidates.length > 0
          ? `Added ${addedCount} new course(s) to the current review`
          : `Extracted ${addedCount} course(s)`,
      ]
      if (duplicateCount > 0) {
        messageParts.push(`${duplicateCount} duplicate row(s) were already waiting in review or saved for later`)
      }
      messageParts.push('Review, fix, or discard anything before importing')
      setImportNotice(`${messageParts.join(' · ')}.`)
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

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <TranscriptUploadCard
          isDragActive={isDragActive}
          disabled={isLoadingCatalog}
          phase={importPhase}
          error={importError}
          maxFileSizeLabel={`${Math.round(MAX_TRANSCRIPT_FILE_SIZE_BYTES / 1024 / 1024)} MB`}
          onBrowse={openFilePicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />

        <div className="grid min-w-0 grid-rows-[auto_1fr] gap-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3.5">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[10px] border border-border bg-surface px-3 py-3.5 sm:px-5 sm:py-4"
              >
                <StatItem label={stat.label} value={stat.value} />
              </div>
            ))}
          </div>

          <ManualCompletedCourseForm
            defaultSemester={user?.profile.currentSemesterLabel}
            studyProgramCode={user?.profile.studyProgramCode}
            regulationVersionCode={user?.profile.regulationVersionCode}
            regulationRuleGroups={regulationRuleGroups}
            isSaving={isSavingCompletedCourses}
            onSave={handleManualCourseAdd}
          />
        </div>
      </div>

      {(regulationVersionError || completedCoursesError || importNotice || issuesError || isSavingCompletedCourses || isSavingIssues || isLoadingIssues || isLoadingRegulationVersion) ? (
        <div className="grid gap-2">
          {regulationVersionError ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
              {regulationVersionError}
            </div>
          ) : null}

          {isLoadingRegulationVersion ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
              Loading your active regulation settings...
            </div>
          ) : null}

          {completedCoursesError ? (
            <div className="rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-primary">
              {completedCoursesError}
            </div>
          ) : null}

          {issuesError ? (
            <div className="rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-primary">
              {issuesError}
            </div>
          ) : null}

          {importNotice ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-mid">
              {importNotice}
            </div>
          ) : null}

          {isSavingCompletedCourses ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
              Saving your completed-course history...
            </div>
          ) : null}

          {isLoadingIssues || isSavingIssues ? (
            <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
              {isLoadingIssues ? 'Loading saved transcript issues...' : 'Saving transcript issues...'}
            </div>
          ) : null}
        </div>
      ) : null}

      <PersonalCourseCollection
        currentReviewCandidates={importCandidates}
        savedIssueCandidates={savedIssueCandidates}
        completedCourses={completedCourses}
        studyProgramCode={user?.profile.studyProgramCode}
        regulationRuleGroups={regulationRuleGroups}
        isBusy={isSavingIssues || importPhase === 'saving'}
        currentReviewImportableCount={importableReviewCandidateCount}
        savedIssueImportableCount={importableSavedIssueCount}
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

  return (
    <div className="overflow-x-hidden p-4 sm:p-8">
      <div className="mb-6" data-tour="transcript-page">
        <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Upload Transcript
        </h1>
      </div>

      {isAuthenticated ? (
        <AuthenticatedTranscript />
      ) : (
        <PersonalFeatureNotice
          title="Transcript and progress need your account"
          description="Your transcript, completed courses, and grade data are private. Sign in to upload or manage them while the public catalog remains accessible without login."
        />
      )}
    </div>
  )
}
