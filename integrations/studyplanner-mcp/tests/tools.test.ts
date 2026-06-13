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

test('MCP catalog tools expose search, resolve, and detail', () => {
  assert.deepEqual(
    STUDYPLANNER_MCP_TOOLS.map((tool) => tool.name),
    ['studyplanner_search_courses', 'studyplanner_resolve_course', 'studyplanner_get_course_detail'],
  )
})

test('studyplanner_search_courses forwards structured filters', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init })
    return jsonResponse({ courses: [], count: 0, truncated: false })
  }

  await callStudyPlannerTool(
    'studyplanner_search_courses',
    { query: 'ml', ects: { min: 6 }, weekdays: ['Monday'], termTypes: ['summer'] },
    { baseUrl: 'https://studyplanner.example', fetchImpl },
  )

  const body = JSON.parse(String(requests[0].init?.body))
  assert.deepEqual(body.ects, { min: 6 })
  assert.deepEqual(body.weekdays, ['Monday'])
  assert.deepEqual(body.termTypes, ['summer'])
})

test('studyplanner_resolve_course posts the course number to the resolve endpoint', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init })
    return jsonResponse({ match: { courseId: 7 }, candidates: [], count: 0 })
  }

  const result = await callStudyPlannerTool(
    'studyplanner_resolve_course',
    { courseNumber: 'INFM1234', titleHint: 'Machine' },
    { baseUrl: 'https://studyplanner.example', fetchImpl },
  )

  assert.equal(requests[0].url, 'https://studyplanner.example/api/ai/catalog/resolve-course')
  assert.equal(requests[0].init?.method, 'POST')
  assert.match(result.content[0].text, /"courseId": 7/)

  await assert.rejects(
    () => callStudyPlannerTool('studyplanner_resolve_course', {}, { fetchImpl }),
    /courseNumber is required/,
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
