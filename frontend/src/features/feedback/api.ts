import { getApiBaseUrl } from '../../shared/utils/apiBaseUrl.ts'

interface SubmitFeedbackInput {
  rating: number
  message: string
}

export async function submitFeedback({
  rating,
  message,
}: SubmitFeedbackInput): Promise<void> {
  // Bypass authenticated API diagnostics so even a failed submission has no account side channel.
  const response = await fetch(`${getApiBaseUrl()}/api/feedback`, {
    method: 'POST',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rating,
      message,
    }),
  })
  if (!response.ok) {
    throw new Error(response.status === 429
      ? 'Too many feedback submissions. Please try again later.'
      : 'Feedback could not be sent. Please try again later.')
  }
}
