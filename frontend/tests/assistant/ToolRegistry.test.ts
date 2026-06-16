import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AssistantToolRegistry } from '../../src/features/assistant/ToolRegistry.ts'

test('AssistantToolRegistry exposes tool definitions without handlers', async () => {
  const registry = new AssistantToolRegistry([
    {
      name: 'echo',
      description: 'Echo input.',
      parameters: { type: 'object', additionalProperties: true },
      handler: (input: unknown) => input,
    },
  ])

  assert.deepEqual(registry.listDefinitions(), [
    {
      name: 'echo',
      description: 'Echo input.',
      parameters: { type: 'object', additionalProperties: true },
    },
  ])
})

test('AssistantToolRegistry executes registered tools', async () => {
  const registry = new AssistantToolRegistry([
    {
      name: 'echo',
      description: 'Echo input.',
      parameters: { type: 'object', additionalProperties: true },
      handler: (input: unknown) => ({ input }),
    },
  ])

  const result = await registry.execute('call-1', 'echo', { text: 'hello' })

  assert.deepEqual(result, {
    toolCallId: 'call-1',
    toolName: 'echo',
    output: { input: { text: 'hello' } },
  })
})

test('AssistantToolRegistry rejects duplicate tools', () => {
  const registry = new AssistantToolRegistry([
    {
      name: 'echo',
      description: 'Echo input.',
      parameters: { type: 'object' },
      handler: (input: unknown) => input,
    },
  ])

  assert.throws(
    () =>
      registry.register({
        name: 'echo',
        description: 'Duplicate.',
        parameters: { type: 'object' },
        handler: (input: unknown) => input,
      }),
    /already registered/,
  )
})
