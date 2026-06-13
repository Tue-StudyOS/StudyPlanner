import assert from 'node:assert/strict'
import test from 'node:test'
import { STUDYPLANNER_APP_RESOURCE_URI } from '../src/appResources.ts'
import { handleMcpJsonRpcPayload } from '../src/protocol.ts'

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200 })
}

test('MCP initialize returns server capabilities without requiring auth', async () => {
  const response = await handleMcpJsonRpcPayload({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {},
  })

  assert.equal(Array.isArray(response), false)
  assert.deepEqual(response && 'result' in response ? response.result : null, {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
    },
    serverInfo: { name: 'studyplanner-mcp', version: '0.1.0' },
    instructions:
      'Use these read-only StudyPlanner tools for public course catalog search and detail lookup. No personal data or write actions are available.',
    studyPlannerAiBaseUrl: 'https://studyplanner-api.ben-tischberger.workers.dev',
  })
})

test('MCP tools/list returns the public catalog tools', async () => {
  const response = await handleMcpJsonRpcPayload({ jsonrpc: '2.0', id: 'tools', method: 'tools/list' })
  const result = response && !Array.isArray(response) && 'result' in response
    ? response.result as {
      tools: Array<{
        name: string
        annotations?: { readOnlyHint?: boolean }
        _meta?: Record<string, unknown>
      }>
    }
    : null

  assert.deepEqual(result?.tools.map((tool) => tool.name), [
    'studyplanner_search_courses',
    'studyplanner_resolve_course',
    'studyplanner_get_course_detail',
  ])
  assert.equal(result?.tools[0]._meta?.['openai/outputTemplate'], STUDYPLANNER_APP_RESOURCE_URI)
  assert.equal(result?.tools[0].annotations?.readOnlyHint, true)
})

test('MCP resources expose the ChatGPT App component template', async () => {
  const listResponse = await handleMcpJsonRpcPayload({ jsonrpc: '2.0', id: 'resources', method: 'resources/list' })
  const listResult = listResponse && !Array.isArray(listResponse) && 'result' in listResponse
    ? listResponse.result as { resources: Array<{ uri: string; mimeType: string }> }
    : null

  assert.equal(listResult?.resources[0]?.uri, STUDYPLANNER_APP_RESOURCE_URI)
  assert.equal(listResult?.resources[0]?.mimeType, 'text/html+skybridge')

  const readResponse = await handleMcpJsonRpcPayload({
    jsonrpc: '2.0',
    id: 'read-resource',
    method: 'resources/read',
    params: { uri: STUDYPLANNER_APP_RESOURCE_URI },
  })
  const readResult = readResponse && !Array.isArray(readResponse) && 'result' in readResponse
    ? readResponse.result as { contents: Array<{ text: string }> }
    : null

  assert.match(readResult?.contents[0]?.text ?? '', /StudyPlanner catalog/)
})

test('MCP tools/call maps tool output into MCP text content', async () => {
  const fetchImpl: typeof fetch = async () => jsonResponse({ courses: [], count: 0, truncated: false })
  const response = await handleMcpJsonRpcPayload(
    {
      jsonrpc: '2.0',
      id: 'call',
      method: 'tools/call',
      params: { name: 'studyplanner_search_courses', arguments: { query: 'compiler' } },
    },
    { studyPlannerAiBaseUrl: 'https://studyplanner.example', fetchImpl },
  )
  const result = response && !Array.isArray(response) && 'result' in response
    ? response.result as {
      content: Array<{ type: string; text: string }>
      structuredContent?: { count?: number }
      _meta?: { appResourceUri?: string }
    }
    : null

  assert.equal(result?.content[0].type, 'text')
  assert.match(result?.content[0].text ?? '', /"count": 0/)
  assert.equal(result?.structuredContent?.count, 0)
  assert.equal(result?._meta?.appResourceUri, STUDYPLANNER_APP_RESOURCE_URI)
})

test('MCP notifications do not produce a JSON-RPC response', async () => {
  const response = await handleMcpJsonRpcPayload({ jsonrpc: '2.0', method: 'notifications/initialized' })

  assert.equal(response, null)
})
