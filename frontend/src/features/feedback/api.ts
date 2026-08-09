import { fetchJson } from '../../shared/utils/api.ts'

interface SubmitFeedbackInput {
  rating: number
  message: string
  pagePath: string
}

interface SubmitFeedbackResponse {
  feedback: {
    id: number
    rating: number
    createdAtUnix: number | null
  }
}

export async function submitFeedback({
  rating,
  message,
  pagePath,
}: SubmitFeedbackInput): Promise<SubmitFeedbackResponse> {
  return await fetchJson<SubmitFeedbackResponse>('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rating,
      message,
      pagePath,
      source: 'feedback_button',
    }),
  })
}
