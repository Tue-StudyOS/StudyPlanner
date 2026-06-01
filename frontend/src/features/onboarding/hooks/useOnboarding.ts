import { useContext } from 'react'
import { OnboardingContext, type OnboardingContextValue } from '../OnboardingContext'

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return context
}
