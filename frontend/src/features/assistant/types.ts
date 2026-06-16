export type AssistantRole = 'system' | 'user' | 'assistant' | 'tool'

export interface AssistantMessage {
  role: AssistantRole
  content: string
  toolCallId?: string
  toolName?: string
}

export interface AssistantToolParameterSchema {
  type: 'object'
  properties?: Record<string, unknown>
  required?: string[]
  additionalProperties?: boolean
}

export interface AssistantToolDefinition {
  name: string
  description: string
  parameters: AssistantToolParameterSchema
  readOnly?: boolean
  requiresConfirmation?: boolean
}

export interface AssistantToolCall {
  id: string
  name: string
  arguments: unknown
}

export interface AssistantToolResult {
  toolCallId: string
  toolName: string
  output: unknown
}

export interface AssistantToolHandlerContext {
  signal?: AbortSignal
}

export type AssistantToolHandler = (
  input: unknown,
  context: AssistantToolHandlerContext,
) => Promise<unknown> | unknown

export interface AssistantTool extends AssistantToolDefinition {
  handler: AssistantToolHandler
}

export interface LlmRequest {
  messages: AssistantMessage[]
  tools: AssistantToolDefinition[]
  signal?: AbortSignal
}

export interface LlmResponse {
  message: AssistantMessage
  toolCalls?: AssistantToolCall[]
}

export interface LlmProvider {
  readonly id: string
  readonly displayName: string
  generate(request: LlmRequest): Promise<LlmResponse>
}

export interface AssistantRunInput {
  prompt: string
  systemPrompt?: string
  history?: AssistantMessage[]
  signal?: AbortSignal
}

export interface AssistantRunResult {
  message: AssistantMessage
  toolCalls: AssistantToolCall[]
  toolResults: AssistantToolResult[]
}
