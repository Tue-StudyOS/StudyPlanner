import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FEEDBACK_AUTO_PROMPT_DELAY_MS,
  shouldScheduleFeedbackPrompt,
} from '../../src/features/feedback/utils/feedbackPrompt.ts'

test('feedback prompt waits five minutes before auto-opening', () => {
  assert.equal(FEEDBACK_AUTO_PROMPT_DELAY_MS, 5 * 60 * 1000)
})

test('feedback prompt is skipped after submission, prior prompt, or during onboarding', () => {
  assert.equal(
    shouldScheduleFeedbackPrompt({
      hasSubmittedFeedback: false,
      hasSeenAutoPromptThisSession: false,
      isOnboardingOpen: false,
    }),
    true,
  )
  assert.equal(
    shouldScheduleFeedbackPrompt({
      hasSubmittedFeedback: true,
      hasSeenAutoPromptThisSession: false,
      isOnboardingOpen: false,
    }),
    false,
  )
  assert.equal(
    shouldScheduleFeedbackPrompt({
      hasSubmittedFeedback: false,
      hasSeenAutoPromptThisSession: true,
      isOnboardingOpen: false,
    }),
    false,
  )
  assert.equal(
    shouldScheduleFeedbackPrompt({
      hasSubmittedFeedback: false,
      hasSeenAutoPromptThisSession: false,
      isOnboardingOpen: true,
    }),
    false,
  )
})
