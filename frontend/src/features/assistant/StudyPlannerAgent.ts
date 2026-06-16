import { AssistantToolRegistry } from './ToolRegistry.ts'
import type {
  AssistantMessage,
  AssistantRunInput,
  AssistantRunResult,
  AssistantTool,
  LlmProvider,
} from './types.ts'

export interface StudyPlannerAgentOptions {
  provider: LlmProvider
  tools?: AssistantTool[]
  registry?: AssistantToolRegistry
}

export class StudyPlannerAgent {
  readonly provider: LlmProvider
  readonly tools: AssistantToolRegistry

  constructor(options: StudyPlannerAgentOptions) {
    this.provider = options.provider
    this.tools = options.registry ?? new AssistantToolRegistry(options.tools ?? [])
  }

  async run(input: AssistantRunInput): Promise<AssistantRunResult> {
    const messages = buildMessages(input)
    const response = await this.provider.generate({
      messages,
      tools: this.tools.listDefinitions(),
      signal: input.signal,
    })
    const toolCalls = response.toolCalls ?? []
    const toolResults = await Promise.all(
      toolCalls.map((toolCall) =>
        this.tools.execute(toolCall.id, toolCall.name, toolCall.arguments, {
          signal: input.signal,
        }),
      ),
    )

    return {
      message: response.message,
      toolCalls,
      toolResults,
    }
  }
}

function buildMessages(input: AssistantRunInput): AssistantMessage[] {
  const messages: AssistantMessage[] = []
  if (input.systemPrompt?.trim()) {
    messages.push({ role: 'system', content: input.systemPrompt.trim() })
  }
  messages.push(...(input.history ?? []))
  messages.push({ role: 'user', content: input.prompt })
  return messages
}
