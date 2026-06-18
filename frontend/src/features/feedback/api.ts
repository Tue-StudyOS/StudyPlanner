import { fetchJson } from '../../shared/utils/api.ts'

interface SubmitFeedbackInput {
  rating: number
  message: string
  pagePath: string
  source: 'auto_prompt' | 'feedback_button'
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
  source,
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
      source,
    }),
  })
}
