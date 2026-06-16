import type {
  AssistantTool,
  AssistantToolDefinition,
  AssistantToolHandlerContext,
  AssistantToolResult,
} from './types.ts'

export class AssistantToolRegistry {
  private readonly tools = new Map<string, AssistantTool>()

  constructor(tools: AssistantTool[] = []) {
    tools.forEach((tool) => this.register(tool))
  }

  register(tool: AssistantTool): void {
    const normalizedName = tool.name.trim()
    if (normalizedName.length === 0) {
      throw new Error('Assistant tool name must not be empty.')
    }
    if (this.tools.has(normalizedName)) {
      throw new Error(`Assistant tool "${normalizedName}" is already registered.`)
    }
    this.tools.set(normalizedName, { ...tool, name: normalizedName })
  }

  listDefinitions(): AssistantToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => {
      const definition: AssistantToolDefinition = {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }
      if (tool.readOnly !== undefined) {
        definition.readOnly = tool.readOnly
      }
      if (tool.requiresConfirmation !== undefined) {
        definition.requiresConfirmation = tool.requiresConfirmation
      }
      return definition
    })
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  async execute(
    toolCallId: string,
    toolName: string,
    input: unknown,
    context: AssistantToolHandlerContext = {},
  ): Promise<AssistantToolResult> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Assistant tool "${toolName}" is not registered.`)
    }

    return {
      toolCallId,
      toolName,
      output: await tool.handler(input, context),
    }
  }
}
