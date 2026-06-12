import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SupportedLanguage } from '../../i18n'
import { useTranslation } from '../../i18n'
import { getCurrentSemesterLabel } from '../../planner/utils/semesterLabels'
import { ROUTES } from '../../routes'
import { fetchStudyPrograms } from '../api'
import { useAuth } from '../hooks/useAuth'
import type { StudyProgramOption } from '../types'
import { normalizeAuthErrorMessage } from '../utils/authErrors.ts'
import { generateStartSemesters } from '../utils/studySetup.ts'

type AuthMode = 'login' | 'register'

function normalizeErrorMessage(error: unknown): string {
  return normalizeAuthErrorMessage(error, {
    isLocalDevelopment:
      typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname),
  })
}

function toSelectValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

export function AccountPage() {
  const { user, isAuthenticated, isLoadingSession, login, logout, register, saveProfile, updateCredentials } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [identifier, setIdentifier] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramOption[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(false)
  const [draftStudyProgramId, setDraftStudyProgramId] = useState<number | null | undefined>(undefined)
  const [draftCurrentSemesterLabel, setDraftCurrentSemesterLabel] = useState<string | undefined>(undefined)
  const [draftAppLanguage, setDraftAppLanguage] = useState<SupportedLanguage | undefined>(undefined)
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false)
  const [profileSaveState, setProfileSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [lastFailedProfileKey, setLastFailedProfileKey] = useState<string | null>(null)

  const [credCurrentPassword, setCredCurrentPassword] = useState<string>('')
  const [credNewIdentifier, setCredNewIdentifier] = useState<string>('')
  const [credNewPassword, setCredNewPassword] = useState<string>('')
  const [credConfirmPassword, setCredConfirmPassword] = useState<string>('')

  useEffect(() => {
    let isActive = true
    async function loadOptions(): Promise<void> {
      setIsLoadingOptions(true)
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

  const selectedStudyProgramId =
    draftStudyProgramId !== undefined ? draftStudyProgramId : (user?.profile.studyProgramId ?? null)
  const currentSemesterLabel = draftCurrentSemesterLabel ?? (user?.profile.currentSemesterLabel ?? '')
  const selectedAppLanguage = draftAppLanguage ?? user?.profile.appLanguage ?? 'en'
  const profileDraftKey = JSON.stringify({
    studyProgramId: selectedStudyProgramId,
    currentSemesterLabel,
    appLanguage: selectedAppLanguage,
  })
  const latestProfileDraftRef = useRef<{
    studyProgramId: number | null
    currentSemesterLabel: string
    appLanguage: SupportedLanguage
  }>({
    studyProgramId: selectedStudyProgramId,
    currentSemesterLabel,
    appLanguage: selectedAppLanguage,
  })

  const isProfileDirty = Boolean(
    user && (
      selectedStudyProgramId !== (user.profile.studyProgramId ?? null)
      || currentSemesterLabel !== (user.profile.currentSemesterLabel ?? '')
      || selectedAppLanguage !== (user.profile.appLanguage ?? 'en')
    ),
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'register') {
        await register({ identifier, password })
        setDraftStudyProgramId(undefined)
        setDraftCurrentSemesterLabel(undefined)
        setDraftAppLanguage(undefined)
        setProfileSaveState('idle')
        setProfileError(null)
        setLastFailedProfileKey(null)
        navigate(ROUTES.planner)
        return
      }
      await login({ identifier, password })
      setDraftStudyProgramId(undefined)
      setDraftCurrentSemesterLabel(undefined)
      setDraftAppLanguage(undefined)
      setProfileSaveState('idle')
      setProfileError(null)
      setLastFailedProfileKey(null)
      navigate(ROUTES.planner)
    } catch (submitError) {
      setError(normalizeErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout(): Promise<void> {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      await logout()
      setDraftStudyProgramId(undefined)
      setDraftCurrentSemesterLabel(undefined)
      setDraftAppLanguage(undefined)
      setProfileSaveState('idle')
      setProfileError(null)
      setLastFailedProfileKey(null)
      navigate(ROUTES.planner)
    } catch (logoutError) {
      setError(normalizeErrorMessage(logoutError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCredentialsSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (credNewPassword && credNewPassword !== credConfirmPassword) {
      setError(t('account.passwordMismatch'))
      return
    }
    if (!credNewIdentifier.trim() && !credNewPassword) {
      setError(t('account.credentialsEmpty'))
      return
    }
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      await updateCredentials({
        currentPassword: credCurrentPassword,
        ...(credNewIdentifier.trim() ? { identifier: credNewIdentifier.trim() } : {}),
        ...(credNewPassword ? { newPassword: credNewPassword } : {}),
      })
      setCredCurrentPassword('')
      setCredNewIdentifier('')
      setCredNewPassword('')
      setCredConfirmPassword('')
      setMessage(t('account.credentialsUpdated'))
    } catch (credError) {
      setError(normalizeErrorMessage(credError))
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {
    latestProfileDraftRef.current = {
      studyProgramId: selectedStudyProgramId,
      currentSemesterLabel,
      appLanguage: selectedAppLanguage,
    }
  }, [currentSemesterLabel, selectedAppLanguage, selectedStudyProgramId])

  useEffect(() => {
    if (profileSaveState !== 'saved') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setProfileSaveState('idle')
    }, 1800)

    return () => window.clearTimeout(timeoutId)
  }, [profileSaveState])

  useEffect(() => {
    if (
      !isAuthenticated
      || !user
      || isLoadingOptions
      || isSavingProfile
      || !isProfileDirty
      || lastFailedProfileKey === profileDraftKey
    ) {
      return
    }

    const snapshot = latestProfileDraftRef.current
    const snapshotKey = profileDraftKey
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setIsSavingProfile(true)
        try {
          await saveProfile({
            studyProgramId: snapshot.studyProgramId,
            currentSemesterLabel: snapshot.currentSemesterLabel.trim() || null,
            appLanguage: snapshot.appLanguage,
          })
          const latestSnapshot = latestProfileDraftRef.current
          if (
            latestSnapshot.studyProgramId === snapshot.studyProgramId
            && latestSnapshot.currentSemesterLabel === snapshot.currentSemesterLabel
            && latestSnapshot.appLanguage === snapshot.appLanguage
          ) {
            setDraftStudyProgramId(undefined)
            setDraftCurrentSemesterLabel(undefined)
            setDraftAppLanguage(undefined)
          }
          setLastFailedProfileKey(null)
          setProfileError(null)
          setProfileSaveState('saved')
        } catch (profileSaveError) {
          setLastFailedProfileKey(snapshotKey)
          setProfileSaveState('idle')
          setProfileError(normalizeErrorMessage(profileSaveError))
        } finally {
          setIsSavingProfile(false)
        }
      })()
    }, 500)

    return () => window.clearTimeout(timeoutId)
  }, [
    isAuthenticated,
    isLoadingOptions,
    isProfileDirty,
    isSavingProfile,
    lastFailedProfileKey,
    profileDraftKey,
    saveProfile,
    user,
  ])

  const startSemesters = generateStartSemesters()
  const inputClass = 'w-full min-w-0 rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary'

  return (
    <div className="mx-auto w-full min-w-0 max-w-[64rem] p-4 pb-6 sm:p-8 sm:pt-6">
      {error ? (
        <div className="pointer-events-none fixed inset-x-4 top-[calc(1rem+env(safe-area-inset-top,0px))] z-50 flex justify-center sm:justify-end">
          <div
            role="alert"
            aria-live="assertive"
            className="pointer-events-auto w-full max-w-xl rounded-[10px] border border-primary/30 bg-surface px-4 py-3 text-[13px] text-primary shadow-lg"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 break-words">{error}</div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="shrink-0 rounded-md border border-primary/20 px-2.5 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`mb-6 min-w-0 ${!isAuthenticated && !isLoadingSession ? 'mx-auto max-w-[28rem] text-center' : ''}`}>
        <h1 className="mb-0.75 text-[22px] font-semibold tracking-[-0.01em] text-fg">
          {t('account.title')}
        </h1>
        <p className="max-w-[32rem] text-[13.5px] text-fg-muted">
          {t('account.subtitle')}
        </p>
      </div>

      {isLoadingSession ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {t('account.loadingSession')}
        </div>
      ) : isAuthenticated && user ? (
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] border border-border bg-surface px-5 py-3 text-[13px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.signedInAs')}</span>
            <span className="break-words font-medium text-fg">{user.displayName}</span>
            <span className="hidden text-fg-muted sm:inline">·</span>
            <span className="break-all text-fg-muted">{user.email}</span>
          </div>

          <div className="grid min-w-0 gap-3 lg:grid-cols-2">
            <section className="min-w-0 flex flex-col rounded-[10px] border border-border bg-surface px-5 py-4">
              <h2 className="mb-3 text-[13.5px] font-semibold text-fg">{t('account.updateCredentials')}</h2>
              <form onSubmit={(event) => void handleCredentialsSave(event)} className="flex min-w-0 flex-1 flex-col gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.newIdentifier')}</span>
                  <input
                    type="text"
                    value={credNewIdentifier}
                    onChange={(event) => setCredNewIdentifier(event.target.value)}
                    placeholder={user.email}
                    autoComplete="username"
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.newPassword')}</span>
                  <input
                    type="password"
                    value={credNewPassword}
                    onChange={(event) => setCredNewPassword(event.target.value)}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </label>
                {credNewPassword ? (
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.confirmNewPassword')}</span>
                    <input
                      type="password"
                      value={credConfirmPassword}
                      onChange={(event) => setCredConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      className={inputClass}
                    />
                  </label>
                ) : null}
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.currentPassword')}</span>
                  <input
                    type="password"
                    value={credCurrentPassword}
                    onChange={(event) => setCredCurrentPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className={inputClass}
                  />
                </label>
                <div className="mt-auto flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !credCurrentPassword}
                    className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t('account.updateCredentialsButton')}
                  </button>
                </div>
              </form>
            </section>

            <section className="min-w-0 flex flex-col rounded-[10px] border border-border bg-surface px-5 py-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[13.5px] font-semibold text-fg">{t('account.studyProfile')}</h2>
                <div className="text-[12px] text-fg-muted">
                  {isSavingProfile || profileSaveState === 'saving'
                    ? t('account.changesSaving')
                    : profileSaveState === 'saved'
                      ? t('account.changesSaved')
                      : t('account.changesAuto')}
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('setup.language')}</span>
                  <select
                    value={selectedAppLanguage}
                    onChange={(event) => {
                      setProfileError(null)
                      setProfileSaveState('saving')
                      setLastFailedProfileKey(null)
                      setDraftAppLanguage(event.target.value as SupportedLanguage)
                    }}
                    className={inputClass}
                  >
                    <option value="en">{t('language.en')}</option>
                    <option value="de">{t('language.de')}</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.studyProgram')}</span>
                  <select
                    value={toSelectValue(selectedStudyProgramId)}
                    onChange={(event) => {
                      setProfileError(null)
                      setProfileSaveState('saving')
                      setLastFailedProfileKey(null)
                      setDraftStudyProgramId(event.target.value ? Number(event.target.value) : null)
                    }}
                    disabled={isLoadingOptions}
                    className={inputClass}
                  >
                    <option value="">{t('account.noStudyProgram')}</option>
                    {studyPrograms.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    {t('account.startSemester')}
                    <span className="ml-2 font-normal normal-case text-fg-muted">(current: {getCurrentSemesterLabel()})</span>
                  </span>
                  <select
                    value={currentSemesterLabel}
                    onChange={(event) => {
                      setProfileError(null)
                      setProfileSaveState('saving')
                      setLastFailedProfileKey(null)
                      setDraftCurrentSemesterLabel(event.target.value)
                    }}
                    className={inputClass}
                  >
                    <option value="">{t('account.notSpecified')}</option>
                    {startSemesters.map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </label>
                {profileError ? (
                  <div className="rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[12px] text-primary">
                    {profileError}
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
              className="rounded-md bg-primary px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t('account.signOut')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[28rem]">
          <section className="min-w-0 rounded-[10px] border border-border bg-surface px-6 py-5.5">
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setMessage(null)
                  setMode('login')
                }}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${mode === 'login' ? 'bg-primary text-white' : 'border border-border bg-transparent text-fg-mid'}`}
              >
                {t('account.signIn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setMessage(null)
                  setMode('register')
                }}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${mode === 'register' ? 'bg-primary text-white' : 'border border-border bg-transparent text-fg-mid'}`}
              >
                {t('account.register')}
              </button>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3.5">
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.identifier')}</span>
                <input type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" className={inputClass} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.password')}</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={inputClass} />
              </label>
              {mode === 'register' ? (
                <p className="text-[12px] text-fg-muted">
                  {t('account.registerSetupHint')}
                </p>
              ) : null}
              <button type="submit" disabled={isSubmitting} className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? t('common.pleaseWait') : mode === 'register' ? t('account.createAccount') : t('account.signIn')}
              </button>
            </form>
          </section>
        </div>
      )}

      {message ? (
        <div className="mt-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-mid">
          {message}
        </div>
      ) : null}


    </div>
  )
}
