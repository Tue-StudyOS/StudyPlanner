import { createContext } from 'react'

export interface OnboardingContextValue {
  isOpen: boolean
  activeStepId: string | null
  open: () => void
  close: () => void
}

export const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)
