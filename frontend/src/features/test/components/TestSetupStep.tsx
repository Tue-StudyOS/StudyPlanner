import { useEffect, useMemo, useState } from 'react'
import type { SupportedLanguage } from '../../i18n'
import { createTranslator, resolveAppLanguage, useTranslation } from '../../i18n'
import { fetchStudyPrograms } from '../../auth/api'
import type { StudyProgramOption } from '../../auth/types'
import { normalizeAuthErrorMessage } from '../../auth/utils/authErrors.ts'
import { generateStartSemesters } from '../../auth/utils/studySetup.ts'
import { useAuth } from '../../auth'
import { TEST_INPUT_CLASS, TEST_PRIMARY_BUTTON_CLASS } from './testStyles'

function toSelectValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

function normalizeErrorMessage(error: unknown): string {
  return normalizeAuthErrorMessage(error, {
    isLocalDevelopment:
      typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname),
  })
}

// Inline study setup (language, examination regulation, start semester). Mirrors
// StudySetupGate's fields but flows inline inside the "/test" wizard rather than
// as a blocking modal, and advances via onComplete after a successful save.
export function TestSetupStep({ onComplete }: { onComplete: () => void }) {
  const { user, saveProfile } = useAuth()
  const { language } = useTranslation()
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramOption[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(false)
  const [draftLanguage, setDraftLanguage] = useState<SupportedLanguage>(() =>
    resolveAppLanguage(user?.profile.appLanguage),
  )
  const [studyProgramId, setStudyProgramId] = useState<number | null>(user?.profile.studyProgramId ?? null)
  const [semesterLabel, setSemesterLabel] = useState<string>(user?.profile.currentSemesterLabel ?? '')
  const [isSaving, setIsSaving] = useState(false)
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
    return () => { isActive = false }
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
      onComplete()
    } catch (saveError) {
      setError(normalizeErrorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[28rem] px-4 py-10">
      <div className="w-full rounded-[14px] border border-border bg-surface px-6 py-6">
        <h2 className="text-[18px] font-semibold text-fg">{t('setup.title')}</h2>
        <p className="mt-1 text-[12.5px] leading-5 text-fg-muted">{t('setup.description')}</p>

        <div className="mt-4 grid gap-3.5">
          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('setup.language')}</span>
            <select value={draftLanguage} onChange={(event) => setDraftLanguage(event.target.value as SupportedLanguage)} className={TEST_INPUT_CLASS}>
              <option value="en">{t('language.en')}</option>
              <option value="de">{t('language.de')}</option>
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('setup.studyProgram')}</span>
            <select
              value={toSelectValue(studyProgramId)}
              onChange={(event) => setStudyProgramId(event.target.value ? Number(event.target.value) : null)}
              disabled={isLoadingOptions}
              className={TEST_INPUT_CLASS}
            >
              <option value="">{t('setup.studyProgramPlaceholder')}</option>
              {studyPrograms.map((studyProgram) => (
                <option key={studyProgram.id} value={studyProgram.id}>{studyProgram.name}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('setup.startSemester')}</span>
            <select value={semesterLabel} onChange={(event) => setSemesterLabel(event.target.value)} className={TEST_INPUT_CLASS}>
              <option value="">{t('setup.startSemesterPlaceholder')}</option>
              {startSemesters.map((semester) => (
                <option key={semester} value={semester}>{semester}</option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[12.5px] text-primary">{error}</div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => void handleSave()} disabled={isSaving || isLoadingOptions || !canSave} className={TEST_PRIMARY_BUTTON_CLASS}>
            {isSaving ? '…' : t('setup.saveAndContinue')}
          </button>
        </div>
      </div>
    </div>
  )
}
