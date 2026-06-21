export const FEEDBACK_AUTO_PROMPT_DELAY_MS = 5 * 60 * 1000

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
