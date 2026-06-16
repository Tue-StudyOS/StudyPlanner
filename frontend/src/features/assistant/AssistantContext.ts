import { createContext } from 'react'
import type { StudyPlannerAgent } from './StudyPlannerAgent.ts'

export interface AssistantContextValue {
  agent: StudyPlannerAgent
}

export const AssistantContext = createContext<AssistantContextValue | null>(null)
