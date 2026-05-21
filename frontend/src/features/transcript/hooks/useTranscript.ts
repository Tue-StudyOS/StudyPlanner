import { useContext } from 'react'
import { TranscriptContext, type TranscriptContextValue } from '../TranscriptContext'

export function useTranscript(): TranscriptContextValue {
  const context = useContext(TranscriptContext)
  if (!context) throw new Error('useTranscript must be used within TranscriptProvider')
  return context
}
