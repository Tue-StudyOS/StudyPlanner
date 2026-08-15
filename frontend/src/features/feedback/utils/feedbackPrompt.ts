export const FEEDBACK_AUTO_PROMPT_DELAY_MS = 5 * 60 * 1000

let seenThisRuntime = false

export function markFeedbackPromptSeenThisRuntime(): void {
  seenThisRuntime = true
}

export function hasFeedbackPromptBeenSeenThisRuntime(): boolean {
  return seenThisRuntime
}

export function resetFeedbackPromptSeenThisRuntime(): void {
  seenThisRuntime = false
}

export function shouldScheduleFeedbackPrompt({
  hasSubmittedFeedback,
  hasSeenAutoPromptThisSession,
  isOnboardingOpen,
}: {
  hasSubmittedFeedback: boolean
  hasSeenAutoPromptThisSession: boolean
  isOnboardingOpen: boolean
}): boolean {
  return !hasSubmittedFeedback && !hasSeenAutoPromptThisSession && !isOnboardingOpen
}
