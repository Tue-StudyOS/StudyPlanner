import { useMemo } from 'react'
import type { JSX, ReactNode } from 'react'
import { AssistantContext } from '../AssistantContext.ts'
import { StudyPlannerAgent } from '../StudyPlannerAgent.ts'
import { UnavailableLlmProvider } from '../providers/UnavailableLlmProvider.ts'
import type { AssistantTool, LlmProvider } from '../types.ts'

const DEFAULT_TOOLS: AssistantTool[] = []

interface AssistantProviderProps {
  children: ReactNode
  provider?: LlmProvider
  tools?: AssistantTool[]
}

export function AssistantProvider({ children, provider, tools = DEFAULT_TOOLS }: AssistantProviderProps): JSX.Element {
  const agent = useMemo(
    () =>
      new StudyPlannerAgent({
        provider: provider ?? new UnavailableLlmProvider(),
        tools,
      }),
    [provider, tools],
  )

  return <AssistantContext.Provider value={{ agent }}>{children}</AssistantContext.Provider>
}
