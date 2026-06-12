import { useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import type { SupportedLanguage } from '../../i18n'
import { createTranslator, resolveAppLanguage, useTranslation } from '../../i18n'
import { fetchStudyPrograms } from '../api'
import type { StudyProgramOption } from '../types'
import { normalizeAuthErrorMessage } from '../utils/authErrors.ts'
import { generateStartSemesters, isStudySetupComplete } from '../utils/studySetup.ts'
import { useAuth } from '../hooks/useAuth'

function toSelectValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function normalizeErrorMessage(error: unknown): string {
  return normalizeAuthErrorMessage(error, {
    isLocalDevelopment:
      typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname),
  })
}

function StudySetupDialog({
  user,
  saveProfile,
}: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>
  saveProfile: ReturnType<typeof useAuth>['saveProfile']
}): JSX.Element {
  const { language } = useTranslation()
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramOption[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(false)
  const [draftLanguage, setDraftLanguage] = useState<SupportedLanguage>(() =>
    resolveAppLanguage(user.profile.appLanguage),
  )
  const [studyProgramId, setStudyProgramId] = useState<number | null>(user.profile.studyProgramId)
  const [semesterLabel, setSemesterLabel] = useState<string>(user.profile.currentSemesterLabel ?? '')
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const t = useMemo(() => createTranslator(draftLanguage || language), [draftLanguage, language])
  const startSemesters = useMemo(() => generateStartSemesters(), [])
  const canSave = Boolean(draftLanguage && studyProgramId && semesterLabel.trim())

  useEffect(() => {
    let isActive = true

    async function loadOptions(): Promise<void> {
      setIsLoadingOptions(true)
      setError(null)
      try {
        const nextStudyPrograms = await fetchStudyPrograms()
        if (!isActive) return
        setStudyPrograms(nextStudyPrograms)
      } catch (loadError) {
        if (!isActive) return
        setError(normalizeErrorMessage(loadError))
      } finally {
        if (isActive) setIsLoadingOptions(false)
      }
    }

    void loadOptions()
    return () => {
      isActive = false
    }
  }, [])

  async function handleSave(): Promise<void> {
    if (!canSave) {
      setError(t('setup.required'))
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      await saveProfile({
        studyProgramId,
        currentSemesterLabel: semesterLabel.trim(),
        appLanguage: draftLanguage,
      })
    } catch (saveError) {
      setError(normalizeErrorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass = 'w-full min-w-0 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary'

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/45" role="dialog" aria-modal="true">
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <div className="w-full max-w-[28rem] rounded-[14px] border border-border bg-surface px-6 py-6 shadow-2xl">
          <h2 className="text-[18px] font-semibold text-fg">{t('setup.title')}</h2>
          <p className="mt-1 text-[12.5px] leading-5 text-fg-muted">{t('setup.description')}</p>

          <div className="mt-4 grid gap-3.5">
            <label className="grid gap-1.5">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('setup.language')}
              </span>
              <select
                value={draftLanguage}
                onChange={(event) => setDraftLanguage(event.target.value as SupportedLanguage)}
                className={inputClass}
              >
                <option value="en">{t('language.en')}</option>
                <option value="de">{t('language.de')}</option>
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('setup.studyProgram')}
              </span>
              <select
                value={toSelectValue(studyProgramId)}
                onChange={(event) => setStudyProgramId(event.target.value ? Number(event.target.value) : null)}
                disabled={isLoadingOptions}
                className={inputClass}
              >
                <option value="">{t('setup.studyProgramPlaceholder')}</option>
                {studyPrograms.map((studyProgram) => (
                  <option key={studyProgram.id} value={studyProgram.id}>{studyProgram.name}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('setup.startSemester')}
              </span>
              <select
                value={semesterLabel}
                onChange={(event) => setSemesterLabel(event.target.value)}
                className={inputClass}
              >
                <option value="">{t('setup.startSemesterPlaceholder')}</option>
                {startSemesters.map((semester) => (
                  <option key={semester} value={semester}>{semester}</option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[12.5px] text-primary">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || isLoadingOptions || !canSave}
              className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? '…' : t('setup.saveAndContinue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function StudySetupGate(): JSX.Element | null {
  const { user, isAuthenticated, isLoadingSession, saveProfile } = useAuth()
  const shouldBlock = Boolean(
    isAuthenticated
      && user
      && !isLoadingSession
      && !isStudySetupComplete(user.profile),
  )

  if (!shouldBlock || !user) {
    return null
  }

  return <StudySetupDialog key={user.id} user={user} saveProfile={saveProfile} />
}
