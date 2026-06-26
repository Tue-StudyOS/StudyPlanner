import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { normalizeAuthErrorMessage } from '../../auth/utils/authErrors.ts'
import { TEST_INPUT_CLASS, TEST_PRIMARY_BUTTON_CLASS } from './testStyles'

type AuthMode = 'login' | 'register'

function normalizeErrorMessage(error: unknown): string {
  return normalizeAuthErrorMessage(error, {
    isLocalDevelopment:
      typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname),
  })
}

// Compact sign-in/register card. Unlike AccountPage it does not navigate away on
// success: the parent TestPersonal re-renders authenticated and advances the flow.
export function TestAuthStep() {
  const { login, register } = useAuth()
  const { t } = useTranslation()
  const [mode, setMode] = useState<AuthMode>('login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      if (mode === 'register') {
        await register({ identifier, password })
      } else {
        await login({ identifier, password })
      }
    } catch (submitError) {
      setError(normalizeErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[28rem] px-4 py-10">
      <section className="min-w-0 rounded-[14px] border border-border bg-surface px-6 py-5.5">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => { setError(null); setMode('login') }}
            className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${mode === 'login' ? 'bg-primary text-white' : 'border border-border bg-transparent text-fg-mid'}`}
          >
            {t('account.signIn')}
          </button>
          <button
            type="button"
            onClick={() => { setError(null); setMode('register') }}
            className={`rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${mode === 'register' ? 'bg-primary text-white' : 'border border-border bg-transparent text-fg-mid'}`}
          >
            {t('account.register')}
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-3.5">
          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.identifier')}</span>
            <input type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} required autoComplete="username" className={TEST_INPUT_CLASS} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{t('account.password')}</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} className={TEST_INPUT_CLASS} />
          </label>
          {mode === 'register' ? (
            <p className="text-[12px] text-fg-muted">{t('account.registerSetupHint')}</p>
          ) : null}
          {error ? (
            <div className="rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[12.5px] text-primary">{error}</div>
          ) : null}
          <button type="submit" disabled={isSubmitting} className={TEST_PRIMARY_BUTTON_CLASS}>
            {isSubmitting ? t('common.pleaseWait') : mode === 'register' ? t('account.createAccount') : t('account.signIn')}
          </button>
        </form>
      </section>
    </div>
  )
}
