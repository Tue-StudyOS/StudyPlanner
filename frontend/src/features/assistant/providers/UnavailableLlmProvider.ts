import type { LlmProvider, LlmRequest, LlmResponse } from '../types.ts'

export class UnavailableLlmProvider implements LlmProvider {
  readonly id = 'unavailable'
  readonly displayName = 'No LLM provider configured'

  async generate(request: LlmRequest): Promise<LlmResponse> {
    void request
    throw new Error('No LLM provider is configured for the StudyPlanner assistant.')
  }
}
