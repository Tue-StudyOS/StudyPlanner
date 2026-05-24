import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../shared/utils/api'
import { MoonIcon, SunIcon } from '../../layout/components/icons'
import { ROUTES } from '../../routes'
import { useTheme } from '../../theme'
import { fetchStudyPrograms } from '../api'
import { useAuth } from '../hooks/useAuth'
import type { StudyProgramOption } from '../types'

type AuthMode = 'login' | 'register'

const EARLIEST_SEMESTER = 'WS 2021/22'

function getCurrentSemester(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (month >= 4 && month <= 9) return `SS ${year}`
  const ws = month >= 10 ? year : year - 1
  return `WS ${ws}/${String(ws + 1).slice(-2)}`
}

function generateStartSemesters(): string[] {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  let isSummer = month >= 4 && month <= 9
  let y = isSummer ? year : (month >= 10 ? year : year - 1)
  const list: string[] = []
  while (true) {
    const sem = isSummer ? `SS ${y}` : `WS ${y}/${String(y + 1).slice(-2)}`
    list.push(sem)
    if (sem === EARLIEST_SEMESTER) break
    if (isSummer) {
      isSummer = false
    } else {
      y -= 1
      isSummer = true
    }
    if (y < 2015) break
  }
  return list
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}

function toSelectValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

export function AccountPage() {
  const { user, isAuthenticated, isLoadingSession, login, logout, register, saveProfile, updateCredentials } = useAuth()
  const { isDark, toggleTheme } = useTheme()
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
    return () => { isActive = false }
  }, [])

  const selectedStudyProgramId =
    draftStudyProgramId !== undefined ? draftStudyProgramId : (user?.profile.studyProgramId ?? null)
  const currentSemesterLabel = draftCurrentSemesterLabel ?? (user?.profile.currentSemesterLabel ?? '')

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'register') {
        await register({ identifier, password, studyProgramId: selectedStudyProgramId, currentSemesterLabel: currentSemesterLabel.trim() || null })
        setDraftStudyProgramId(undefined)
        setDraftCurrentSemesterLabel(undefined)
        navigate(ROUTES.dashboard)
        return
      }
      await login({ identifier, password })
      setDraftStudyProgramId(undefined)
      setDraftCurrentSemesterLabel(undefined)
      navigate(ROUTES.dashboard)
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
      navigate(ROUTES.dashboard)
    } catch (logoutError) {
      setError(normalizeErrorMessage(logoutError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      await saveProfile({ studyProgramId: selectedStudyProgramId, currentSemesterLabel: currentSemesterLabel.trim() || null })
      setDraftStudyProgramId(undefined)
      setDraftCurrentSemesterLabel(undefined)
      setMessage('Study profile updated.')
    } catch (profileError) {
      setError(normalizeErrorMessage(profileError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCredentialsSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (credNewPassword && credNewPassword !== credConfirmPassword) {
      setError('New passwords do not match.')
      return
    }
    if (!credNewIdentifier.trim() && !credNewPassword) {
      setError('Enter a new email/username or a new password to update.')
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
      setMessage('Credentials updated.')
    } catch (credError) {
      setError(normalizeErrorMessage(credError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const startSemesters = generateStartSemesters()
  const inputClass = 'rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary'

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
            Account
          </h1>
          <p className="text-[13.5px] text-fg-muted">
            Sign in to save favorites and personal study progress.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-[13px] text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          {isDark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>

      {isLoadingSession ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading your account session...
        </div>
      ) : isAuthenticated && user ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 rounded-[10px] border border-border bg-surface px-5 py-3 text-[13px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Signed in as</span>
            <span className="font-medium text-fg">{user.displayName}</span>
            <span className="text-fg-muted">·</span>
            <span className="text-fg-muted">{user.email}</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="flex flex-col rounded-[10px] border border-border bg-surface px-5 py-4">
              <h2 className="mb-3 text-[13.5px] font-semibold text-fg">Study profile</h2>
              <form onSubmit={(event) => void handleProfileSave(event)} className="flex flex-1 flex-col gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Study program</span>
                  <select
                    value={toSelectValue(selectedStudyProgramId)}
                    onChange={(event) => setDraftStudyProgramId(event.target.value ? Number(event.target.value) : null)}
                    disabled={isLoadingOptions}
                    className={inputClass}
                  >
                    <option value="">No study program selected</option>
                    {studyPrograms.map((sp) => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                    Start semester
                    <span className="ml-2 font-normal normal-case text-fg-muted">(current: {getCurrentSemester()})</span>
                  </span>
                  <select
                    value={currentSemesterLabel}
                    onChange={(event) => setDraftCurrentSemesterLabel(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not specified</option>
                    {startSemesters.map((sem) => (
                      <option key={sem} value={sem}>{sem}</option>
                    ))}
                  </select>
                </label>
                <div className="mt-auto flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || isLoadingOptions}
                    className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save study profile
                  </button>
                </div>
              </form>
            </section>

            <section className="flex flex-col rounded-[10px] border border-border bg-surface px-5 py-4">
              <h2 className="mb-3 text-[13.5px] font-semibold text-fg">Update credentials</h2>
              <form onSubmit={(event) => void handleCredentialsSave(event)} className="flex flex-1 flex-col gap-3">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">New email / username</span>
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
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">New password</span>
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
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Confirm new password</span>
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
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Current password</span>
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
                    className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Update credentials
                  </button>
                </div>
              </form>
            </section>
          </div>

          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
              className="rounded-md bg-primary px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4.5 lg:grid-cols-[0.72fr_1.28fr]">
          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${mode === 'login' ? 'bg-primary text-white' : 'border border-border bg-transparent text-fg-mid'}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${mode === 'register' ? 'bg-primary text-white' : 'border border-border bg-transparent text-fg-mid'}`}
              >
                Register
              </button>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3.5">
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Email or username</span>
                <input type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" className={inputClass} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={inputClass} />
              </label>
              {mode === 'register' ? (
                <>
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Study program</span>
                    <select value={toSelectValue(selectedStudyProgramId)} onChange={(event) => setDraftStudyProgramId(event.target.value ? Number(event.target.value) : null)} disabled={isLoadingOptions} className={inputClass}>
                      <option value="">Select a study program incl. PO</option>
                      {studyPrograms.map((sp) => (<option key={sp.id} value={sp.id}>{sp.name}</option>))}
                    </select>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Start semester</span>
                    <select value={currentSemesterLabel} onChange={(event) => setDraftCurrentSemesterLabel(event.target.value)} className={inputClass}>
                      <option value="">Select your start semester</option>
                      {startSemesters.map((sem) => (<option key={sem} value={sem}>{sem}</option>))}
                    </select>
                  </label>
                </>
              ) : null}
              <button type="submit" disabled={isSubmitting} className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmitting ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </section>

          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
            <h2 className="mb-3 text-[14px] font-semibold text-fg">What you get with an account</h2>
            <ul className="grid gap-2 pl-5 text-[13.5px] leading-6 text-fg-mid">
              <li className="list-disc">Persist favorite courses across devices</li>
              <li className="list-disc">Store your study program incl. PO and your start semester</li>
              <li className="list-disc">Save completed courses and personal progress</li>
            </ul>
          </section>

          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5 lg:col-span-2">
            <div className="mb-4">
              <h2 className="text-[14px] font-semibold text-fg">Public study programs</h2>
              <p className="text-[12.5px] text-fg-muted">Browsing the public catalog does not require an account.</p>
            </div>
            {isLoadingOptions ? (
              <div className="text-[13px] text-fg-muted">Loading...</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {studyPrograms.map((sp) => (
                  <div key={sp.id} className="rounded-lg border border-border-light px-4 py-3">
                    <div className="text-[13px] font-semibold text-fg">{sp.name}</div>
                    <div className="text-[12.5px] text-fg-mid">
                      {sp.degree || 'Degree n/a'}{sp.totalEcts ? ` · ${sp.totalEcts} ECTS` : ''}
                    </div>
                    {sp.subject ? <div className="text-[12px] text-fg-muted">{sp.subject}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {message ? (
        <div className="mt-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-mid">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {error}
        </div>
      ) : null}
    </div>
  )
}
