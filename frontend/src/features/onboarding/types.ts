import type { ComponentType } from 'react'

export interface OnboardingStep {
  id: string
  eyebrow: string
  title: string
  description: string
  bullets?: string[]
  Icon: ComponentType
  // Route to switch the background page to while this step is shown. Omit to stay
  // on the current page (e.g. the welcome step).
  route?: string
}
