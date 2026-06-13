import {
  readStudyPlannerAppResource,
  STUDYPLANNER_APP_HTTP_PATH,
  STUDYPLANNER_APP_RESOURCE_URI,
} from './appResources.ts'
import { handleMcpJsonRpcPayload } from './protocol.ts'

export interface Env {
  STUDYPLANNER_AI_BASE_URL?: string
  // Service binding to the StudyPlanner API worker. Same-account workers.dev
  // subrequests fail with 404, so the MCP worker reaches the AI facade through
  // this binding instead of a public-URL round trip.
  STUDYPLANNER_API?: { fetch: typeof fetch }
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

function htmlResponse(html: string, maxAge = 300): Response {
  return new Response(html, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  })
}

const PRIVACY_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Privacy Policy – StudyPlanner AI Integration</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:680px;margin:48px auto;padding:0 20px;line-height:1.6;color:#111}
    h1{font-size:1.4rem;margin-bottom:.25rem}
    h2{font-size:1rem;margin-top:2rem}
    .muted{color:#6b7280;font-size:.875rem}
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="muted">StudyPlanner AI Integration &mdash; last updated 2026-06-14</p>

  <h2>What this integration does</h2>
  <p>The StudyPlanner GPT Action and MCP server provide read-only access to a public university course catalog. You can search courses, look up details, and resolve course numbers. No account, login, or personal information is required.</p>

  <h2>Data collected</h2>
  <p>This integration collects <strong>no personal data</strong>. Requests contain only the search terms or course identifiers you type. No names, email addresses, IP addresses, cookies, or session tokens are stored or logged by this service.</p>

  <h2>Data sharing</h2>
  <p>Search queries are forwarded to the StudyPlanner backend API to retrieve public catalog data. No data is sold, shared with third parties, or used for advertising.</p>

  <h2>Third-party services</h2>
  <p>The integration is hosted on Cloudflare Workers. Cloudflare may process request metadata (IP, timestamp) in accordance with <a href="https://www.cloudflare.com/privacypolicy/" rel="noreferrer noopener">Cloudflare's privacy policy</a>. ChatGPT or Claude interactions are governed by OpenAI's and Anthropic's respective privacy policies.</p>

  <h2>Contact</h2>
  <p>For questions, contact <a href="mailto:ben.tischberger@gmail.com">ben.tischberger@gmail.com</a>.</p>
</body>
</html>`

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

  const apiBinding = env.STUDYPLANNER_API
  const responsePayload = await handleMcpJsonRpcPayload(payload, {
    studyPlannerAiBaseUrl: env.STUDYPLANNER_AI_BASE_URL,
    fetchImpl: apiBinding ? (input, init) => apiBinding.fetch(input, init) : undefined,
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
        tools: [
          'studyplanner_search_courses',
          'studyplanner_resolve_course',
          'studyplanner_get_course_detail',
        ],
        appResourceUri: STUDYPLANNER_APP_RESOURCE_URI,
        appPreviewPath: STUDYPLANNER_APP_HTTP_PATH,
      })
    }

    if (url.pathname === '/sse' && request.method === 'GET') {
      return sseEndpointResponse()
    }

    if (url.pathname === '/privacy' && request.method === 'GET') {
      return htmlResponse(PRIVACY_HTML, 86400)
    }

    if (url.pathname === STUDYPLANNER_APP_HTTP_PATH && request.method === 'GET') {
      const resource = readStudyPlannerAppResource(STUDYPLANNER_APP_RESOURCE_URI)
      return resource ? htmlResponse(resource.text) : jsonResponse({ error: 'app_resource_not_found' }, 404)
    }

    if ((url.pathname === '/mcp' || url.pathname === '/messages') && request.method === 'POST') {
      return await handleMcpPost(request, env)
    }

    return jsonResponse({ error: 'not_found', message: 'Use POST /mcp for MCP JSON-RPC requests.' }, 404)
  },
}
