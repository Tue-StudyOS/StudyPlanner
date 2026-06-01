import type { ComponentType } from 'react'

export interface OnboardingStep {
  id: string
  eyebrow: string
  title: string
  description: string
  bullets?: string[]
  Icon: ComponentType
}
