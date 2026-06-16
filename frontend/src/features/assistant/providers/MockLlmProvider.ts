import type { LlmProvider, LlmRequest, LlmResponse } from '../types.ts'

export class MockLlmProvider implements LlmProvider {
  readonly id = 'mock'
  readonly displayName = 'Mock LLM provider'

  private readonly response: LlmResponse

  constructor(response: LlmResponse = { message: { role: 'assistant', content: '' } }) {
    this.response = response
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    void request
    return this.response
  }
}
