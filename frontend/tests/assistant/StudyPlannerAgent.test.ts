import assert from 'node:assert/strict'
import { test } from 'node:test'
import { StudyPlannerAgent } from '../../src/features/assistant/StudyPlannerAgent.ts'
import type { LlmProvider, LlmRequest, LlmResponse } from '../../src/features/assistant/types.ts'

class CapturingProvider implements LlmProvider {
  readonly id = 'capturing'
  readonly displayName = 'Capturing provider'
  request: LlmRequest | null = null

  async generate(request: LlmRequest): Promise<LlmResponse> {
    this.request = request
    return {
      message: { role: 'assistant', content: 'Calling a tool.' },
      toolCalls: [{ id: 'tool-call-1', name: 'echo', arguments: { text: 'hello' } }],
    }
  }
}

test('StudyPlannerAgent sends messages and tool definitions to the provider', async () => {
  const provider = new CapturingProvider()
  const agent = new StudyPlannerAgent({
    provider,
    tools: [
      {
        name: 'echo',
        description: 'Echo input.',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text'],
          additionalProperties: false,
        },
        handler: (input: unknown) => input,
      },
    ],
  })

  await agent.run({
    systemPrompt: 'You are a StudyPlanner assistant.',
    history: [{ role: 'assistant', content: 'Previous answer.' }],
    prompt: 'Repeat hello.',
  })

  assert.deepEqual(provider.request?.messages, [
    { role: 'system', content: 'You are a StudyPlanner assistant.' },
    { role: 'assistant', content: 'Previous answer.' },
    { role: 'user', content: 'Repeat hello.' },
  ])
  assert.deepEqual(provider.request?.tools, [
    {
      name: 'echo',
      description: 'Echo input.',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
        additionalProperties: false,
      },
    },
  ])
})

test('StudyPlannerAgent executes tool calls returned by the provider', async () => {
  const provider = new CapturingProvider()
  const agent = new StudyPlannerAgent({
    provider,
    tools: [
      {
        name: 'echo',
        description: 'Echo input.',
        parameters: { type: 'object', additionalProperties: true },
        handler: (input: unknown) => ({ echoed: input }),
      },
    ],
  })

  const result = await agent.run({ prompt: 'Repeat hello.' })

  assert.deepEqual(result.toolCalls, [
    { id: 'tool-call-1', name: 'echo', arguments: { text: 'hello' } },
  ])
  assert.deepEqual(result.toolResults, [
    {
      toolCallId: 'tool-call-1',
      toolName: 'echo',
      output: { echoed: { text: 'hello' } },
    },
  ])
})
