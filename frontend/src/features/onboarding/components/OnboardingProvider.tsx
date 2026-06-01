import { useCallback, useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { useAuth } from '../../auth'
import { OnboardingContext } from '../OnboardingContext'
import { OnboardingModal } from './OnboardingModal'

interface OnboardingProviderProps {
  children: ReactNode
}

function seenStorageKey(userId: number): string {
  return `studyplanner.onboarding.seen.${userId}`
}

export function OnboardingProvider({ children }: OnboardingProviderProps): JSX.Element {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState<boolean>(false)

  // Auto-open the guide once per user on their first login, then remember it so
  // it never reappears automatically. Reopening stays available via the ? icon.
  // The user arrives asynchronously from the auth session, so syncing to it in an
  // effect is the intended pattern here; the localStorage guard keeps it idempotent.
  useEffect(() => {
    if (!user) return
    const key = seenStorageKey(user.id)
    if (localStorage.getItem(key) !== 'true') {
      localStorage.setItem(key, 'true')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync to async auth state
      setIsOpen(true)
    }
  }, [user])

  const open = useCallback((): void => setIsOpen(true), [])
  const close = useCallback((): void => setIsOpen(false), [])

  return (
    <OnboardingContext.Provider value={{ isOpen, open, close }}>
      {children}
      {isOpen ? <OnboardingModal onClose={close} /> : null}
    </OnboardingContext.Provider>
  )
}
