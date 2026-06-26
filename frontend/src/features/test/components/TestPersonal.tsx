import { useState } from 'react'
import { useAuth } from '../../auth'
import { isStudySetupComplete } from '../../auth/utils/studySetup.ts'
import { TestAuthStep } from './TestAuthStep'
import { TestSetupStep } from './TestSetupStep'
import { TestTranscriptStep } from './TestTranscriptStep'
import { TestPersonalHub } from './TestPersonalHub'

function PersonalLoading() {
  return <div className="p-8 text-[13px] text-fg-muted">…</div>
}

// First-run wizard for the "/test" surface: auth -> setup -> transcript -> hub.
// Returning, set-up users land directly on the hub. The transcript step only
// appears right after completing setup in the same session.
export function TestPersonal() {
  const { isAuthenticated, isLoadingSession, user } = useAuth()
  const [showTranscriptStep, setShowTranscriptStep] = useState(false)

  if (isLoadingSession) {
    return <PersonalLoading />
  }
  if (!isAuthenticated || !user) {
    return <TestAuthStep />
  }
  if (!isStudySetupComplete(user.profile)) {
    return <TestSetupStep onComplete={() => setShowTranscriptStep(true)} />
  }
  if (showTranscriptStep) {
    return <TestTranscriptStep onDone={() => setShowTranscriptStep(false)} />
  }
  return <TestPersonalHub />
}
