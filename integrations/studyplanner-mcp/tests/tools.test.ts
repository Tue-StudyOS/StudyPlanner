import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveStudyPlannerBaseUrl } from '../src/client.ts'
import { callStudyPlannerTool, STUDYPLANNER_MCP_TOOLS } from '../src/tools.ts'

function jsonResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('MCP catalog tools expose search and detail only', () => {
  assert.deepEqual(
    STUDYPLANNER_MCP_TOOLS.map((tool) => tool.name),
    ['studyplanner_search_courses', 'studyplanner_get_course_detail'],
  )
})

test('resolveStudyPlannerBaseUrl trims configured URLs and falls back to the deployed API', () => {
  assert.equal(resolveStudyPlannerBaseUrl('https://example.com///'), 'https://example.com')
  assert.equal(resolveStudyPlannerBaseUrl('').startsWith('https://studyplanner-api.'), true)
})

test('studyplanner_search_courses calls the public AI search endpoint', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init })
    return jsonResponse({ courses: [{ courseId: 42, title: 'AI' }], count: 1, truncated: false })
  }

  const result = await callStudyPlannerTool(
    'studyplanner_search_courses',
    { query: 'AI', limit: 5, periodId: 'all' },
    { baseUrl: 'https://studyplanner.example', fetchImpl },
  )

  assert.equal(requests[0].url, 'https://studyplanner.example/api/ai/catalog/search')
  assert.equal(requests[0].init?.method, 'POST')
  assert.match(result.content[0].text, /"courseId": 42/)
})

test('studyplanner_get_course_detail validates and forwards course ids', async () => {
  const requests: string[] = []
  const fetchImpl: typeof fetch = async (url) => {
    requests.push(String(url))
    return jsonResponse({ courseId: 42, title: 'AI' })
  }

  await assert.rejects(
    () => callStudyPlannerTool('studyplanner_get_course_detail', { courseId: 'nope' }, { fetchImpl }),
    /courseId must be a positive integer/,
  )

  const result = await callStudyPlannerTool(
    'studyplanner_get_course_detail',
    { courseId: 42 },
    { baseUrl: 'https://studyplanner.example', fetchImpl },
  )

  assert.equal(requests[0], 'https://studyplanner.example/api/ai/catalog/courses/42')
  assert.match(result.content[0].text, /"title": "AI"/)
})
