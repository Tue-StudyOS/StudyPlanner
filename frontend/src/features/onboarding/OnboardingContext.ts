import { createContext } from 'react'

export interface OnboardingContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)
