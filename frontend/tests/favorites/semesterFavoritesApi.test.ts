import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchFavoriteCourseIds, saveFavoriteCourseIds } from '../../src/features/favorites/api.ts'
import { syncInterestedSemesterPlan } from '../../src/features/planner/utils/syncInterestedSemesterPlan.ts'
import type { SemesterPlan } from '../../src/features/planner/types.ts'

const semesterLabel = 'WS 2026/27'
const favorites = { semesterLabel, favoriteCourseIds: ['42', '142'], favoriteCourseGroups: [['42', '142']], count: 1 }
const basePlan: SemesterPlan = {
  semesterLabel,
  title: 'Keep my title',
  notes: 'Keep my notes',
  courseIds: ['99'],
  courseAssignments: { '99': 'INFO-INFO' },
  hiddenSlotIds: ['99:0'],
  manualSlots: [{ id: 'manual-99', courseId: '99', day: 'Monday', time: '10:00' }],
  courseCount: 1,
  createdAtUnix: 1,
  updatedAtUnix: 1,
}

function stubFetch(
  response: (url: string, init?: RequestInit) => object,
): () => void {
  const original = globalThis.fetch
  globalThis.fetch = async (input, init) => new Response(JSON.stringify(response(String(input), init)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  return () => { globalThis.fetch = original }
}

test('Interested GET and PUT explicitly carry the selected semester', async (context) => {
  const requests: { url: string; init?: RequestInit }[] = []
  context.after(stubFetch((url, init) => {
    requests.push({ url, init })
    return favorites
  }))
  assert.deepEqual(await fetchFavoriteCourseIds(semesterLabel), favorites)
  assert.deepEqual(await saveFavoriteCourseIds('csrf', semesterLabel, ['42']), favorites)
  assert.ok(requests[0].url.endsWith('/api/me/favorites?semesterLabel=WS%202026%2F27'))
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), { semesterLabel, favoriteCourseIds: ['42'] })
  assert.equal(new Headers(requests[1].init?.headers).get('X-CSRF-Token'), 'csrf')
})

test('adding a star updates only its selected semester and preserves manual appointments', async (context) => {
  const requests: { url: string; init?: RequestInit }[] = []
  context.after(stubFetch((url, init) => {
    requests.push({ url, init })
    return { semesterPlan: basePlan }
  }))
  await syncInterestedSemesterPlan('csrf', 'alice', semesterLabel, ['42'], true)
  assert.equal(requests.length, 2)
  assert.ok(requests.every(({ url }) => url.endsWith('/api/me/semester-plans/WS%202026%2F27')))
  const payload = JSON.parse(String(requests[1].init?.body))
  assert.deepEqual(payload.courseIds, ['99', '42'])
  assert.deepEqual(payload.manualSlots, basePlan.manualSlots)
  assert.deepEqual(payload.hiddenSlotIds, basePlan.hiddenSlotIds)
  assert.equal(payload.notes, basePlan.notes)
  assert.equal(payload.title, basePlan.title)
})

test('removing a star drops period aliases only in the selected plan', async (context) => {
  let savedBody: Partial<SemesterPlan> | null = null
  context.after(stubFetch((_url, init) => {
    if (init?.method === 'PUT') {
      savedBody = JSON.parse(String(init.body))
    }
    return { semesterPlan: {
      ...basePlan,
      courseIds: ['99', '142'],
      hiddenSlotIds: ['99:0', '142:0'],
      manualSlots: [...basePlan.manualSlots!, { id: 'manual-142', courseId: '142', day: 'Tuesday', time: '12:00' }],
      courseAssignments: { '99': 'INFO-INFO', '142': 'INFO-PRAK' },
    } }
  }))
  await syncInterestedSemesterPlan('csrf', 'alice', semesterLabel, ['42', '142'], false)
  assert.ok(savedBody)
  assert.deepEqual(savedBody.courseIds, ['99'])
  assert.deepEqual(savedBody.hiddenSlotIds, ['99:0'])
  assert.deepEqual(savedBody.manualSlots, basePlan.manualSlots)
  assert.deepEqual(savedBody.courseAssignments, { '99': 'INFO-INFO' })
})

test('loading an empty new plan does not import other semesters or persist an empty plan', async (context) => {
  let calls = 0
  context.after(stubFetch(() => {
    calls += 1
    return { semesterPlan: null }
  }))
  await syncInterestedSemesterPlan('csrf', 'alice', semesterLabel, ['42'], false)
  assert.equal(calls, 1)
})
