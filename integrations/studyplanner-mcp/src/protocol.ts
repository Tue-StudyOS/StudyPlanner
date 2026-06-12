import { resolveStudyPlannerBaseUrl } from './client.ts'
import { callStudyPlannerTool, STUDYPLANNER_MCP_TOOLS, type McpToolResult } from './tools.ts'

export const MCP_PROTOCOL_VERSION = '2024-11-05'
export const MCP_SERVER_NAME = 'studyplanner-mcp'
export const MCP_SERVER_VERSION = '0.1.0'

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
  }
}

export interface McpRequestContext {
  studyPlannerAiBaseUrl?: string
  fetchImpl?: typeof fetch
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function isNotification(request: JsonRpcRequest): boolean {
  return request.id === undefined
}

function resultResponse(id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, result }
}

function errorResponse(id: JsonRpcRequest['id'], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function initializeResult(context: McpRequestContext): Record<string, unknown> {
  return {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    instructions:
      'Use these read-only StudyPlanner tools for public course catalog search and detail lookup. No personal data or write actions are available.',
    studyPlannerAiBaseUrl: resolveStudyPlannerBaseUrl(context.studyPlannerAiBaseUrl),
  }
}

async function handleToolCall(params: unknown, context: McpRequestContext): Promise<McpToolResult> {
  const objectParams = asObject(params)
  const toolName = objectParams.name
  if (typeof toolName !== 'string' || toolName.length === 0) {
    throw new Error('tools/call requires a tool name.')
  }
  return await callStudyPlannerTool(toolName, objectParams.arguments, {
    baseUrl: context.studyPlannerAiBaseUrl,
    fetchImpl: context.fetchImpl,
  })
}

async function handleSingleMcpRequest(
  request: JsonRpcRequest,
  context: McpRequestContext,
): Promise<JsonRpcResponse | null> {
  if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return errorResponse(request.id, -32600, 'Invalid JSON-RPC request.')
  }

  if (request.method.startsWith('notifications/')) {
    return null
  }

  try {
    if (request.method === 'initialize') {
      return resultResponse(request.id, initializeResult(context))
    }

    if (request.method === 'ping') {
      return resultResponse(request.id, {})
    }

    if (request.method === 'tools/list') {
      return resultResponse(request.id, { tools: STUDYPLANNER_MCP_TOOLS })
    }

    if (request.method === 'tools/call') {
      return resultResponse(request.id, await handleToolCall(request.params, context))
    }

    return errorResponse(request.id, -32601, `Unknown MCP method: ${request.method}`)
  } catch (error) {
    return errorResponse(
      request.id,
      -32000,
      error instanceof Error ? error.message : 'StudyPlanner MCP tool call failed.',
    )
  }
}

export async function handleMcpJsonRpcPayload(
  payload: unknown,
  context: McpRequestContext = {},
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(payload)) {
    const responses = (
      await Promise.all(payload.map((request) => handleSingleMcpRequest(asObject(request), context)))
    ).filter((response): response is JsonRpcResponse => response !== null)
    return responses.length > 0 ? responses : null
  }

  return await handleSingleMcpRequest(asObject(payload), context)
}
