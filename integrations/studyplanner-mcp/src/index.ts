import { handleMcpJsonRpcPayload } from './protocol.ts'

export interface Env {
  STUDYPLANNER_AI_BASE_URL?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version',
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function emptyResponse(status = 204): Response {
  return new Response(null, { status, headers: CORS_HEADERS })
}

async function handleMcpPost(request: Request, env: Env): Promise<Response> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return jsonResponse(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Invalid JSON body.' },
      },
      400,
    )
  }

  const responsePayload = await handleMcpJsonRpcPayload(payload, {
    studyPlannerAiBaseUrl: env.STUDYPLANNER_AI_BASE_URL,
  })
  if (responsePayload === null) {
    return emptyResponse(202)
  }
  return jsonResponse(responsePayload)
}

function sseEndpointResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode('event: endpoint\n'))
      controller.enqueue(encoder.encode('data: /mcp\n\n'))
      controller.close()
    },
  })

  return new Response(body, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return emptyResponse()
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: 'studyplanner-mcp',
        transport: 'streamable-http',
        mcpEndpoint: '/mcp',
        tools: ['studyplanner_search_courses', 'studyplanner_get_course_detail'],
      })
    }

    if (url.pathname === '/sse' && request.method === 'GET') {
      return sseEndpointResponse()
    }

    if ((url.pathname === '/mcp' || url.pathname === '/messages') && request.method === 'POST') {
      return await handleMcpPost(request, env)
    }

    return jsonResponse({ error: 'not_found', message: 'Use POST /mcp for MCP JSON-RPC requests.' }, 404)
  },
}
