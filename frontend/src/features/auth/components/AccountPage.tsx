import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../shared/utils/api'
import { fetchRegulationVersions, fetchStudyPrograms } from '../api'
import { useAuth } from '../hooks/useAuth'
import type { RegulationVersionOption, StudyProgramOption } from '../types'
import { ROUTES } from '../../routes'

type AuthMode = 'login' | 'register'

function getCurrentSemester(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  if (month >= 4 && month <= 9) return `SS ${year}`
  const ws = month >= 10 ? year : year - 1
  return `WS ${ws}/${String(ws + 1).slice(-2)}`
}

function generateStartSemesters(count: number): string[] {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  let isSummer = month >= 4 && month <= 9
  let y = isSummer ? year : (month >= 10 ? year : year - 1)
  const list: string[] = []
  for (let i = 0; i < count; i++) {
    list.push(isSummer ? `SS ${y}` : `WS ${y}/${String(y + 1).slice(-2)}`)
    if (isSummer) {
      isSummer = false
    } else {
      y -= 1
      isSummer = true
    }
  }
  return list
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Something went wrong.'
}

function toSelectValue(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

export function AccountPage() {
  const { user, isAuthenticated, isLoadingSession, login, logout, register, saveProfile } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [identifier, setIdentifier] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [studyPrograms, setStudyPrograms] = useState<StudyProgramOption[]>([])
  const [regulationVersions, setRegulationVersions] = useState<RegulationVersionOption[]>([])
  const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(false)
  const [selectedStudyProgramId, setSelectedStudyProgramId] = useState<number | null>(null)
  const [selectedRegulationVersionId, setSelectedRegulationVersionId] = useState<number | null>(null)
  const [currentSemesterLabel, setCurrentSemesterLabel] = useState<string>('')

  useEffect(() => {
    if (!user) {
      setSelectedStudyProgramId(null)
      setSelectedRegulationVersionId(null)
      setCurrentSemesterLabel('')
      return
    }

    setSelectedStudyProgramId(user.profile.studyProgramId)
    setSelectedRegulationVersionId(user.profile.regulationVersionId)
    setCurrentSemesterLabel(user.profile.currentSemesterLabel ?? '')
  }, [user])

  useEffect(() => {
    let isActive = true

    async function loadOptions(): Promise<void> {
      setIsLoadingOptions(true)
      try {
        const [nextStudyPrograms, nextRegulationVersions] = await Promise.all([
          fetchStudyPrograms(),
          fetchRegulationVersions(),
        ])
        if (!isActive) {
          return
        }
        setStudyPrograms(nextStudyPrograms)
        setRegulationVersions(nextRegulationVersions)
      } catch (loadError) {
        if (!isActive) {
          return
        }
        setError(normalizeErrorMessage(loadError))
      } finally {
        if (isActive) {
          setIsLoadingOptions(false)
        }
      }
    }

    void loadOptions()

    return () => {
      isActive = false
    }
  }, [])

  const selectedStudyProgram = useMemo(
    () => studyPrograms.find((program) => program.id === selectedStudyProgramId) ?? null,
    [selectedStudyProgramId, studyPrograms],
  )

  useEffect(() => {
    if (!selectedStudyProgram) {
      return
    }

    if (
      selectedStudyProgram.defaultRegulationVersionCode &&
      regulationVersions.length > 0 &&
      selectedStudyProgramId !== user?.profile.studyProgramId
    ) {
      const defaultRegulation = regulationVersions.find(
        (version) => version.code === selectedStudyProgram.defaultRegulationVersionCode,
      )
      if (defaultRegulation) {
        setSelectedRegulationVersionId(defaultRegulation.id)
      }
    }
  }, [regulationVersions, selectedStudyProgram, selectedStudyProgramId, user?.profile.studyProgramId])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'register') {
        await register({ identifier, password })
        navigate(ROUTES.dashboard)
        return
      } else {
        await login({ identifier, password })
        navigate(ROUTES.dashboard)
        return
      }
      setPassword('')
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
      setMessage('Signed out successfully.')
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
      await saveProfile({
        studyProgramId: selectedStudyProgramId,
        regulationVersionId: selectedRegulationVersionId,
        currentSemesterLabel: currentSemesterLabel.trim() || null,
      })
      setMessage('Your study profile has been updated.')
    } catch (profileError) {
      setError(normalizeErrorMessage(profileError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Account
        </h1>
        <p className="text-[13.5px] text-fg-muted">
          Sign in to save favorites and personal study progress.
        </p>
      </div>

      {isLoadingSession ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading your account session...
        </div>
      ) : isAuthenticated && user ? (
        <div className="grid gap-4.5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
            <h2 className="mb-4 text-[14px] font-semibold text-fg">Signed in</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Display name
                </div>
                <div className="text-[13.5px] text-fg">{user.displayName}</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Email
                </div>
                <div className="text-[13.5px] text-fg">{user.email}</div>
              </div>
            </div>
          </section>

          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
            <h2 className="mb-4 text-[14px] font-semibold text-fg">Session actions</h2>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isSubmitting}
              className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign out
            </button>
          </section>

          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5 lg:col-span-2">
            <h2 className="mb-4 text-[14px] font-semibold text-fg">Study profile</h2>
            <form onSubmit={(event) => void handleProfileSave(event)} className="grid gap-3.5 lg:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Study program
                </span>
                <select
                  value={toSelectValue(selectedStudyProgramId)}
                  onChange={(event) =>
                    setSelectedStudyProgramId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  disabled={isLoadingOptions}
                  className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors focus:border-primary"
                >
                  <option value="">No study program selected</option>
                  {studyPrograms.map((studyProgram) => (
                    <option key={studyProgram.id} value={studyProgram.id}>
                      {studyProgram.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Regulation version
                </span>
                <select
                  value={toSelectValue(selectedRegulationVersionId)}
                  onChange={(event) =>
                    setSelectedRegulationVersionId(
                      event.target.value ? Number(event.target.value) : null,
                    )
                  }
                  disabled={isLoadingOptions}
                  className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors focus:border-primary"
                >
                  <option value="">Use default regulation</option>
                  {regulationVersions.map((regulationVersion) => (
                    <option key={regulationVersion.id} value={regulationVersion.id}>
                      {regulationVersion.regulationName} · {regulationVersion.versionLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Start semester
                </span>
                <select
                  value={currentSemesterLabel}
                  onChange={(event) => setCurrentSemesterLabel(event.target.value)}
                  className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors focus:border-primary"
                >
                  <option value="">Not specified</option>
                  {generateStartSemesters(20).map((sem) => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
              </label>

              <div className="lg:col-span-3 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="grid gap-0.5">
                  <p className="text-[12.5px] text-fg-muted">
                    {selectedStudyProgram?.defaultRegulationName && selectedStudyProgram?.defaultRegulationVersionLabel
                      ? `Default mapping: ${selectedStudyProgram.defaultRegulationName} ${selectedStudyProgram.defaultRegulationVersionLabel}`
                      : 'The backend will apply the default mapped regulation when available.'}
                  </p>
                  <p className="text-[12.5px] text-fg-muted">
                    Current semester (auto-detected): <span className="font-medium text-fg">{getCurrentSemester()}</span>
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || isLoadingOptions}
                  className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save study profile
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : (
        <div className="grid gap-4.5 lg:grid-cols-[0.72fr_1.28fr]">
          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-primary text-white'
                    : 'border border-border bg-transparent text-fg-mid'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                  mode === 'register'
                    ? 'bg-primary text-white'
                    : 'border border-border bg-transparent text-fg-mid'
                }`}
              >
                Register
              </button>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3.5">
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Email or username
                </span>
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  autoComplete="username"
                  className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
              </button>
            </form>
          </section>

          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
            <h2 className="mb-3 text-[14px] font-semibold text-fg">What you get with an account</h2>
            <ul className="grid gap-2 pl-5 text-[13.5px] leading-6 text-fg-mid">
              <li className="list-disc">Persist favorite courses across devices</li>
              <li className="list-disc">Store your selected study program and regulation</li>
              <li className="list-disc">Save completed courses and personal progress</li>
            </ul>
          </section>

          <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-semibold text-fg">Public study programs</h2>
                <p className="text-[12.5px] text-fg-muted">
                  Browsing the public catalog and study-program data does not require an account.
                </p>
              </div>
            </div>

            {isLoadingOptions ? (
              <div className="text-[13px] text-fg-muted">Loading public study-program data...</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {studyPrograms.map((studyProgram) => (
                  <div
                    key={studyProgram.id}
                    className="rounded-lg border border-border-light px-4 py-3"
                  >
                    <div className="text-[13px] font-semibold text-fg">{studyProgram.name}</div>
                    <div className="text-[12.5px] text-fg-mid">
                      {studyProgram.degree || 'Degree n/a'}
                      {studyProgram.poVersion ? ` · PO ${studyProgram.poVersion}` : ''}
                    </div>
                    <div className="text-[12px] text-fg-muted">
                      Default regulation:{' '}
                      {studyProgram.defaultRegulationName && studyProgram.defaultRegulationVersionLabel
                        ? `${studyProgram.defaultRegulationName} ${studyProgram.defaultRegulationVersionLabel}`
                        : 'not mapped yet'}
                    </div>
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
