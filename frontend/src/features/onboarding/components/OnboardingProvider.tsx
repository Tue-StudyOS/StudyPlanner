import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { useAuth } from '../../auth'
import { isStudySetupComplete } from '../../auth/utils/studySetup.ts'
import { OnboardingContext } from '../OnboardingContext'
import { TourOverlay } from './TourOverlay'

interface OnboardingProviderProps {
  children: ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps): JSX.Element {
  const { user, saveProfile } = useAuth()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const autoOpenedUserIdRef = useRef<string | null>(null)

  // Auto-open the guide once per StudyPlanner user, but only after the required
  // language/PO setup is complete. Completion is stored in the user settings so
  // it does not restart on another browser.
  useEffect(() => {
    if (!user || !isStudySetupComplete(user.profile) || user.profile.onboardingTourCompleted) {
      return
    }
    if (autoOpenedUserIdRef.current === user.id) {
      return
    }
    autoOpenedUserIdRef.current = user.id
    setIsOpen(true)
  }, [user])

  const markCompleted = useCallback((): void => {
    if (!user || user.profile.onboardingTourCompleted) {
      return
    }
    void saveProfile({
      studyProgramId: user.profile.studyProgramId,
      currentSemesterLabel: user.profile.currentSemesterLabel,
      appLanguage: user.profile.appLanguage,
      onboardingTourCompleted: true,
    })
  }, [saveProfile, user])

  const open = useCallback((): void => {
    setActiveStepId(null)
    setIsOpen(true)
  }, [])
  const close = useCallback((): void => {
    setIsOpen(false)
    setActiveStepId(null)
    markCompleted()
  }, [markCompleted])

  return (
    <OnboardingContext.Provider value={{ isOpen, activeStepId, open, close }}>
      {children}
      {isOpen ? <TourOverlay onClose={close} onStepChange={setActiveStepId} /> : null}
    </OnboardingContext.Provider>
  )
}
