import { useContext } from 'react'
import { AssistantContext, type AssistantContextValue } from '../AssistantContext.ts'

export function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext)
  if (!context) {
    throw new Error('useAssistant must be used within AssistantProvider')
  }
  return context
}
