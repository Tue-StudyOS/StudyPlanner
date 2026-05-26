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
  updateTranscriptImportCandidate,
} from '../utils/buildTranscriptImportCandidates'
import { parseTranscriptPdf } from '../utils/parseTranscriptPdf'
import { CloseIcon } from './icons'
import { ManualCompletedCourseForm } from './ManualCompletedCourseForm'
import { TranscriptImportRow } from './TranscriptImportRow'
import { TranscriptUploadCard } from './TranscriptUploadCard'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'

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

function toImportedCompletedCourse(candidate: TranscriptImportCandidate): CompletedCourse {
  return {
    id: `import-${candidate.id}`,
    courseId: candidate.courseId,
    courseNumber: candidate.courseNumber ?? undefined,
    externalCourseCode: candidate.courseNumber ?? undefined,
    title: candidate.matchedCourse?.title ?? candidate.title,
    ects: candidate.ects ?? 0,
    masterCat: candidate.masterCat,
    studyAreaCode: candidate.studyAreaCode,
    grade: candidate.grade,
    semester: candidate.semester,
    source: 'transcript_import',
  }
}

function toSavedIssue(issue: SavedTranscriptIssue): SavedTranscriptIssue {
  return {
    ...issue,
    candidate: updateTranscriptImportCandidate(issue.candidate, {}),
  }
}

function toSavedIssuePayload(candidate: TranscriptImportCandidate): SavedTranscriptIssue {
  return {
    id: candidate.id,
    candidate,
    updatedAtUnix: Date.now(),
  }
}

function mergeIssues(
  existingIssues: SavedTranscriptIssue[],
  nextCandidates: TranscriptImportCandidate[],
): SavedTranscriptIssue[] {
  const mergedById = new Map(existingIssues.map((issue) => [issue.id, issue]))
  nextCandidates.forEach((candidate) => {
    mergedById.set(candidate.id, toSavedIssuePayload(candidate))
  })
  return [...mergedById.values()].sort((left, right) => right.updatedAtUnix - left.updatedAtUnix)
}

function buildFailedImportCandidate(
  candidate: TranscriptImportCandidate,
  errorMessage: string,
): TranscriptImportCandidate {
  return updateTranscriptImportCandidate(candidate, {
    parseIssues: [...candidate.parseIssues, errorMessage],
  })
}

function buildImportNotice(params: {
  importedCount: number
  skippedDuplicateCount: number
  unresolvedCount: number
  issueSyncFailed: boolean
}): string {
  const messageParts = [`Imported ${params.importedCount} course(s)`]
  if (params.skippedDuplicateCount > 0) {
    messageParts.push(`${params.skippedDuplicateCount} duplicate row(s) already existed`)
  }
  if (params.unresolvedCount > 0) {
    messageParts.push(
      params.issueSyncFailed
        ? `${params.unresolvedCount} row(s) still need attention and stayed on this page`
        : `${params.unresolvedCount} row(s) still need attention and were saved for later`,
    )
  } else if (params.issueSyncFailed) {
    messageParts.push('the follow-up issue sync could not be completed right now')
  }
  return `${messageParts.join(' · ')}.`
}

function formatCompletedSubtitle(course: CompletedCourse): string {
  const parts = [
    course.courseNumber ?? course.externalCourseCode ?? null,
    course.ects ? `${course.ects} ECTS` : null,
    course.semester || null,
    course.grade !== null ? `Note ${course.grade.toFixed(1)}` : null,
    course.studyAreaCode ?? null,
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
        aria-label={`Remove ${course.title} from your personal course collection`}
        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-hover hover:text-primary"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

function PersonalCourseCollection({
  pendingCandidates,
  completedCourses,
  studyProgramCode,
  regulationRuleGroups,
  isBusy,
  onCandidateChange,
  onDiscardCandidate,
  onDeleteCompleted,
  onClearAll,
}: {
  pendingCandidates: TranscriptImportCandidate[]
  completedCourses: CompletedCourse[]
  studyProgramCode?: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  isBusy?: boolean
  onCandidateChange: (candidate: TranscriptImportCandidate) => void
  onDiscardCandidate: (candidateId: string) => void
  onDeleteCompleted: (completedCourseId: string) => void
  onClearAll: () => void
}) {
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const hasContent = pendingCandidates.length > 0 || completedCourses.length > 0

  return (
    <section className="min-w-0 overflow-hidden rounded-[10px] border border-border bg-surface px-4 py-4 sm:px-5">
      <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg">Personal course collection</div>
          <p className="mt-1 text-[11.5px] text-fg-muted">
            {pendingCandidates.length} need{pendingCandidates.length === 1 ? 's' : ''} attention · {completedCourses.length} credited
          </p>
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
          Import a transcript or add a completed course manually to build your personal course collection.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          {pendingCandidates.length > 0 ? (
            <div className="grid min-w-0 gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                Needs attention
              </div>
              {pendingCandidates.map((candidate) => (
                <TranscriptImportRow
                  key={candidate.id}
                  candidate={candidate}
                  studyProgramCode={studyProgramCode}
                  regulationRuleGroups={regulationRuleGroups}
                  onDiscard={() => onDiscardCandidate(candidate.id)}
                  onChange={onCandidateChange}
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

function AuthenticatedTranscript() {
  const { user, token } = useAuth()
  const [importCandidates, setImportCandidates] = useState<TranscriptImportCandidate[]>(restoreImportCandidates)
  const [persistedIssues, setPersistedIssues] = useState<SavedTranscriptIssue[]>([])
  const [importPhase, setImportPhase] = useState<TranscriptImportPhase>(() =>
    restoreImportCandidates().length > 0 ? 'parsed' : 'idle',
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
        setPersistedIssues(transcriptIssues.map(toSavedIssue))
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
  }, [token])

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
      void (async () => {
        setIsSavingIssues(true)
        setIssuesError(null)
        try {
          const savedIssues = await saveTranscriptIssues(token, {
            transcriptIssues: persistedIssues.map((issue) => ({ id: issue.id, candidate: issue.candidate })),
          })
          setPersistedIssues(savedIssues.map(toSavedIssue))
          setIssueDraftDirty(false)
        } catch (error) {
          setIssuesError(error instanceof Error ? error.message : 'Failed to save transcript issues.')
        } finally {
          setIsSavingIssues(false)
        }
      })()
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [issueDraftDirty, persistedIssues, token])

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
      setImportPhase('failed')
      setImportCandidates([])
      setImportError('Only PDF transcripts are supported right now.')
      return
    }

    if (file.size > MAX_TRANSCRIPT_FILE_SIZE_BYTES) {
      setImportPhase('failed')
      setImportCandidates([])
      setImportError(
        `The selected file is too large. Please keep transcript PDFs below ${Math.round(MAX_TRANSCRIPT_FILE_SIZE_BYTES / 1024 / 1024)} MB.`,
      )
      return
    }

    if (isLoadingCatalog) {
      setImportPhase('failed')
      setImportCandidates([])
      setImportError('The course catalog is still loading. Please wait a moment and try the import again.')
      return
    }

    if (catalogError) {
      setImportPhase('failed')
      setImportCandidates([])
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

      setImportCandidates(nextCandidates)
      setImportPhase('parsed')
      setImportNotice(`Extracted ${nextCandidates.length} course(s). Review, fix, or discard anything before importing.`)
    } catch (error) {
      setImportPhase('failed')
      setImportCandidates([])
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

    setImportPhase('saving')
    const blockingCandidates = candidates.filter((candidate) => !canImportTranscriptCandidate(candidate))
    const importableCandidates = candidates.filter((candidate) => canImportTranscriptCandidate(candidate))

    const importResult = importableCandidates.length === 0
      ? {
          imported: [],
          skippedDuplicates: [],
          failed: [],
        }
      : await importCompletedCourses(
          importableCandidates.map((candidate) => ({
            id: candidate.id,
            course: toImportedCompletedCourse(candidate),
          })),
        )

    if (importResult === null) {
      setImportPhase('idle')
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

    setImportPhase('idle')
    setImportNotice(
      buildImportNotice({
        importedCount: importResult.imported.length,
        skippedDuplicateCount: importResult.skippedDuplicates.length,
        unresolvedCount: remainingIssueCandidates.length,
        issueSyncFailed: !savedIssues,
      }),
    )
  }, [clearCompletedCoursesError, importCompletedCourses, persistTranscriptIssues, persistedIssues])

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

  const pendingCandidates = useMemo<TranscriptImportCandidate[]>(
    () => [...importCandidates, ...savedIssueCandidates],
    [importCandidates, savedIssueCandidates],
  )

  function handlePendingCandidateChange(nextCandidate: TranscriptImportCandidate): void {
    const isFromImportBatch = importCandidates.some((candidate) => candidate.id === nextCandidate.id)
    if (isFromImportBatch) {
      updateImportCandidateById(nextCandidate)
    } else {
      updatePersistedIssueCandidate(nextCandidate)
    }
  }

  function handlePendingCandidateDiscard(candidateId: string): void {
    const isFromImportBatch = importCandidates.some((candidate) => candidate.id === candidateId)
    if (isFromImportBatch) {
      discardImportCandidate(candidateId)
    } else {
      void discardPersistedIssue(candidateId)
    }
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

  useEffect(() => {
    if (importPhase === 'saving' || isSavingIssues) {
      return
    }
    const validImportCandidates = importCandidates.filter((candidate) =>
      canImportTranscriptCandidate(candidate),
    )
    if (validImportCandidates.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void importCandidateBatch(validImportCandidates, 'review')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [importCandidateBatch, importCandidates, importPhase, isSavingIssues])

  useEffect(() => {
    if (importPhase === 'saving' || isSavingIssues || issueDraftDirty) {
      return
    }
    const validIssueCandidates = savedIssueCandidates.filter((candidate) =>
      canImportTranscriptCandidate(candidate),
    )
    if (validIssueCandidates.length === 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void importCandidateBatch(validIssueCandidates, 'issues')
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [importCandidateBatch, importPhase, isSavingIssues, issueDraftDirty, savedIssueCandidates])

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

        <div className="grid min-w-0 gap-4">
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
        pendingCandidates={pendingCandidates}
        completedCourses={completedCourses}
        studyProgramCode={user?.profile.studyProgramCode}
        regulationRuleGroups={regulationRuleGroups}
        isBusy={isSavingIssues || importPhase === 'saving'}
        onCandidateChange={handlePendingCandidateChange}
        onDiscardCandidate={handlePendingCandidateDiscard}
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
      <div className="mb-6">
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
