import { useEffect, useState } from 'react'
import { fetchStudyPrograms } from '../../auth/api'
import type { StudyProgramOption } from '../../auth/types'
import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'
import { saveBrowserPreference } from '../../../shared/utils/browserPreferences.ts'
import { parseStoredStudyProgramId } from '../utils/catalogStudyProgram.ts'

function readStoredStudyProgramId(): number | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return parseStoredStudyProgramId(window.localStorage.getItem(BROWSER_STORAGE_KEYS.guestStudyProgramId))
  } catch {
    return null
  }
}

function writeStoredStudyProgramId(id: number | null): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    if (id === null) {
      window.localStorage.removeItem(BROWSER_STORAGE_KEYS.guestStudyProgramId)
      return
    }
    saveBrowserPreference(BROWSER_STORAGE_KEYS.guestStudyProgramId, String(id))
  } catch {
    // The in-memory choice still filters this visit when storage is blocked.
  }
}

export function useGuestStudyProgram(enabled: boolean): {
  studyPrograms: StudyProgramOption[]
  selectedStudyProgramId: number | null
  isLoadingStudyPrograms: boolean
  studyProgramsError: string | null
  setSelectedStudyProgramId: (studyProgramId: number | null) => void
} {
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramOption[]>([])
  const [selectedStudyProgramId, setSelectedStudyProgramIdState] = useState<number | null>(readStoredStudyProgramId)
  const [isLoadingStudyPrograms, setIsLoadingStudyPrograms] = useState<boolean>(enabled)
  const [studyProgramsError, setStudyProgramsError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let isActive = true

    async function loadStudyPrograms(): Promise<void> {
      setIsLoadingStudyPrograms(true)
      setStudyProgramsError(null)
      try {
        const programs = await fetchStudyPrograms()
        if (!isActive) {
          return
        }
        setStudyPrograms(programs)
        setSelectedStudyProgramIdState((current) => {
          if (current !== null && programs.some((program) => program.id === current)) {
            return current
          }
          writeStoredStudyProgramId(null)
          return null
        })
      } catch (loadError) {
        if (!isActive) {
          return
        }
        setStudyProgramsError(
          loadError instanceof Error ? loadError.message : 'Failed to load study programs.',
        )
      } finally {
        if (isActive) {
          setIsLoadingStudyPrograms(false)
        }
      }
    }

    void loadStudyPrograms()

    return () => {
      isActive = false
    }
  }, [enabled])

  function setSelectedStudyProgramId(studyProgramId: number | null): void {
    setSelectedStudyProgramIdState(studyProgramId)
    writeStoredStudyProgramId(studyProgramId)
  }

  return {
    studyPrograms,
    selectedStudyProgramId,
    isLoadingStudyPrograms,
    studyProgramsError,
    setSelectedStudyProgramId,
  }
}
