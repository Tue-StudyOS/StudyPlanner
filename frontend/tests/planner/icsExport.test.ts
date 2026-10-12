import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCourseIcs, buildSemesterPlanIcs, downloadCalendarIcs, getCourseExportTutorialOptions } from '../../src/features/planner/utils/icsExport.ts'
import type { Course } from '../../src/features/courses/types.ts'

function buildCourse(overrides: Partial<Course>): Course {
  return {
    id: '42',
    number: 'INFM1010',
    title: 'Machine Learning (Vorlesung)',
    periodLabel: 'Sommer 2026',
    lecturer: 'Prof. Dr. Example',
    room: 'A104',
    types: ['Vorlesung'],
    ects: 6,
    sws: 4,
    masterCats: [],
    weekdays: [],
    schedule: [
      { day: 'Mo.', time: '10:00 - 12:00', room: 'A104', type: 'Vorlesung' },
      { day: 'Do.', time: '14:00 - 16:00', room: 'B201', type: 'Übung' },
    ],
    frequency: '',
    language: '',
    prerequisites: [],
    description: '',
    exams: [{ type: 'Klausur', date: '2026-07-28', duration: '90 min' }],
    ...overrides,
  }
}

test('builds weekly events inside the lecture period', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [buildCourse({})],
    hiddenSlotIds: [],
  })

  assert.ok(ics)
  assert.match(ics, /BEGIN:VCALENDAR/)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260413T100000/)
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260725T215959Z/)
  // The Thursday slot starts in the first lecture week as well.
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260416T140000/)
  // The title is cleaned and the slot type appended.
  assert.match(ics, /SUMMARY:Machine Learning \(Vorlesung\)/)
  assert.match(ics, /LOCATION:A104/)
})

test('skips hidden slots and unparseable times', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [
      buildCourse({
        schedule: [
          { day: 'Mo.', time: '10:00 - 12:00', room: 'A104', type: 'Vorlesung' },
          { day: 'TBA', time: 'TBA', room: 'TBA', type: 'Vorlesung' },
        ],
      }),
    ],
    hiddenSlotIds: ['42:0'],
  })

  assert.ok(ics)
  assert.doesNotMatch(ics, /DTSTART;TZID/)
})

test('single-date schedule slots become one-off events instead of weekly ones', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [
      buildCourse({
        exams: [],
        schedule: [{ day: '28.07.2026', time: '10:00 - 12:00', room: 'Hörsaal 1', type: 'Vorlesung' }],
      }),
    ],
    hiddenSlotIds: [],
  })

  assert.ok(ics)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260728T100000/)
  assert.doesNotMatch(ics, /RRULE/)
})

test('uses ALMA recurrence bounds, cancellation dates, and ignores administrative slots', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'WS 2025/26',
    courses: [
      buildCourse({
        exams: [],
        schedule: [
          {
            id: '123',
            day: '14.10.2025 - 03.02.2026',
            time: '14:00 - 16:00',
            room: 'N06',
            type: 'Vorlesung',
            startsOn: '2025-10-14',
            endsOn: '2026-02-03',
            cancellationDates: ['2025-12-23'],
          },
          {
            id: '124',
            day: '18.02.2026',
            time: '08:00 - 18:00',
            room: 'A104',
            type: 'Klausurkorrektur',
            calendarRelevant: false,
          },
        ],
      }),
    ],
    hiddenSlotIds: [],
  })

  assert.ok(ics)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20251014T140000/)
  assert.match(ics, /UNTIL=20260203T215959Z/)
  assert.match(ics, /EXDATE;TZID=Europe\/Berlin:20251223T140000/)
  assert.doesNotMatch(ics, /Klausurkorrektur/)
})

test('exam dates become single all-day events', () => {
  const ics = buildSemesterPlanIcs({
    semesterLabel: 'SS 2026',
    courses: [buildCourse({})],
    hiddenSlotIds: [],
  })

  assert.ok(ics)
  assert.match(ics, /DTSTART;VALUE=DATE:20260728/)
  assert.match(ics, /SUMMARY:Machine Learning – Klausur/)
})

test('returns null for unparseable semester labels', () => {
  assert.equal(
    buildSemesterPlanIcs({ semesterLabel: 'nope', courses: [], hiddenSlotIds: [] }),
    null,
  )
})

test('course export includes lectures and exams but omits every tutorial alternative', () => {
  const course = buildCourse({
    schedule: [
      { id: 'lecture', day: 'Mo.', time: '10:00 - 12:00', room: 'A104', type: 'Vorlesung' },
      { day: 'Di.', time: '08:00 - 10:00', room: 'Tutorial A', type: 'Übung' },
      { day: 'Mi.', time: '08:00 - 10:00', room: 'Tutorial B', type: 'Course', groupType: 'Tutorial' },
      { day: 'Do.', time: '08:00 - 10:00', room: 'Tutorial C', type: 'Course', groupTitle: 'Tutorium 3' },
      { day: '01.07.2026', time: '08:00 - 10:00', room: 'One-off tutorial', type: 'Exercise' },
      { day: '02.07.2026', time: '08:00 - 10:00', room: 'Office', type: 'Klausurkorrektur', calendarRelevant: false },
    ],
  })
  const ics = buildCourseIcs(course)
  assert.ok(ics)
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260413T100000/)
  assert.match(ics, /DTSTART;VALUE=DATE:20260728/)
  assert.doesNotMatch(ics, /Tutorial|tutorial|Office/)
  // Keep event identities compatible with exporting the full semester.
  const semesterIcs = buildSemesterPlanIcs({ semesterLabel: 'SS 2026', courses: [course], hiddenSlotIds: [] })
  const lectureUid = ics.match(/UID:([^\r\n]+)/)?.[1]
  assert.ok(lectureUid)
  assert.ok(semesterIcs?.includes(`UID:${lectureUid}`))
})

test('course export uses its catalog semester and retains recurrence bounds and cancellations', () => {
  const ics = buildCourseIcs(buildCourse({
    periodLabel: 'Winter 2025/26',
    schedule: [{
      day: 'Di.', time: '14:00 - 16:00', room: 'N06', type: 'Vorlesung/Übung',
      startsOn: '2025-10-14', endsOn: '2026-02-03', cancellationDates: ['2025-12-23'],
    }],
    exams: [],
  }))
  assert.ok(ics)
  assert.match(ics, /X-WR-CALNAME:StudyPlanner WS 2025\/26/)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20251014T140000/)
  assert.match(ics, /UNTIL=20260203T215959Z/)
  assert.match(ics, /EXDATE;TZID=Europe\/Berlin:20251223T140000/)
})

test('course export accepts planner semester labels as well as raw ALMA period labels', () => {
  for (const periodLabel of ['SS 2026', 'Sommer 2026', 'WS 2025/26', 'Winter 2025/26']) {
    assert.ok(buildCourseIcs(buildCourse({ periodLabel })), periodLabel)
  }
})

test('course export includes timed exams only once and keeps other published exam dates', () => {
  const ics = buildCourseIcs(buildCourse({
    schedule: [{ day: '28.07.2026', time: '10:00 - 11:30', room: 'Exam hall', type: 'Klausur' }],
    exams: [
      { type: 'Klausur', date: '2026-07-28', duration: '90 min' },
      { type: 'Nachklausur', date: '15.09.2026', duration: '90 min' },
    ],
  }))
  assert.ok(ics)
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2)
  assert.match(ics, /DTSTART;TZID=Europe\/Berlin:20260728T100000/)
  assert.match(ics, /LOCATION:Exam hall/)
  assert.doesNotMatch(ics, /DTSTART;VALUE=DATE:20260728/)
  assert.match(ics, /DTSTART;VALUE=DATE:20260915/)
})

test('course export avoids guessing semesters or downloading empty calendars', () => {
  assert.equal(buildCourseIcs(buildCourse({ periodLabel: undefined })), null)
  assert.equal(buildCourseIcs(buildCourse({ periodLabel: 'unknown' })), null)
  assert.equal(buildCourseIcs(buildCourse({ schedule: [], exams: [] })), null)
  assert.equal(buildCourseIcs(buildCourse({
    schedule: [{ day: 'Mo.', time: '10:00 - 12:00', room: 'A104', type: 'Tutorium' }], exams: [],
  })), null)
  assert.equal(buildCourseIcs(buildCourse({
    schedule: [{ day: 'TBA', time: 'TBA', room: 'TBA', type: 'Vorlesung' }],
    exams: [{ type: 'Klausur', date: 'TBA', duration: 'TBA' }],
  })), null)
})

test('individual export selects one tutorial or all without changing lectures', () => {
  const course = buildCourse({ schedule: [
    { id: 'lecture', day: 'Mo.', time: '10:00 - 12:00', room: 'Lecture', type: 'Vorlesung' },
    { id: 'a', day: 'Di.', time: '08:00 - 10:00', room: 'Tutorial A', type: 'Exercise', groupType: 'Vorlesung/Übung', cancellationDates: ['2026-05-26'] },
    { id: 'b', day: 'Mi.', time: '08:00 - 10:00', room: 'Tutorial B', type: 'Course', groupType: 'Tutorial' },
  ], exams: [] })
  const options = getCourseExportTutorialOptions(course)
  assert.equal(options.length, 2)
  const one = buildCourseIcs(course, { tutorialSlotIds: [options[0].id] })
  assert.ok(one)
  assert.equal((one.match(/BEGIN:VEVENT/g) ?? []).length, 2)
  assert.match(one, /LOCATION:Lecture/)
  assert.match(one, /LOCATION:Tutorial A/)
  assert.doesNotMatch(one, /Tutorial B/)
  assert.match(one, /EXDATE;TZID=Europe\/Berlin:20260526T080000/)
  const all = buildCourseIcs(course, { tutorialSlotIds: 'all' })
  assert.equal((all?.match(/BEGIN:VEVENT/g) ?? []).length, 3)
  assert.equal((buildCourseIcs(course, { tutorialSlotIds: [] })?.match(/BEGIN:VEVENT/g) ?? []).length, 1)
})

test('exam and resit choices filter both timed appointments and metadata', () => {
  const course = buildCourse({ schedule: [
    { day: '28.07.2026', time: '10:00 - 12:00', room: 'Main exam', type: 'Klausur' },
    { day: '15.09.2026', time: '10:00 - 12:00', room: 'Resit', type: 'Nachklausur' },
  ], exams: [
    { date: '2026-07-28', type: 'Klausur', duration: '' },
    { date: '2026-09-15', type: 'Nachklausur', duration: '' },
  ] })
  const mainOnly = buildCourseIcs(course, { includeExams: true, includeResits: false })
  assert.ok(mainOnly)
  assert.match(mainOnly, /20260728/)
  assert.doesNotMatch(mainOnly, /20260915/)
  const resitOnly = buildCourseIcs(course, { includeExams: false, includeResits: true })
  assert.ok(resitOnly)
  assert.match(resitOnly, /20260915/)
  assert.doesNotMatch(resitOnly, /20260728/)
  assert.equal(buildCourseIcs(course, { includeExams: false, includeResits: false }), null)
})

test('tutorial-only courses can export a selection and ignore non-calendar slots', () => {
  const course = buildCourse({ schedule: [
    { id: 'a', day: 'Mo.', time: '10:00 - 12:00', room: 'A', type: 'Tutorial' },
    { id: 'b', day: 'Mo.', time: '10:00 - 12:00', room: 'B', type: 'Tutorial', calendarRelevant: false },
  ], exams: [] })
  assert.equal(getCourseExportTutorialOptions(course).length, 1)
  assert.equal(buildCourseIcs(course), null)
  assert.ok(buildCourseIcs(course, { tutorialSlotIds: 'all' }))
  assert.doesNotMatch(buildCourseIcs(course, { tutorialSlotIds: 'all' }) ?? '', /LOCATION:B/)
})

test('calendar download preserves the filename and content and releases the object URL', async (context) => {
  let downloadedBlob: Blob | null = null
  let clicked = false
  const revoked: string[] = []
  const anchor = { href: '', download: '', click: (): void => { clicked = true } }
  context.mock.method(URL, 'createObjectURL', (blob: Blob): string => {
    downloadedBlob = blob
    return 'blob:calendar'
  })
  context.mock.method(URL, 'revokeObjectURL', (url: string): void => { revoked.push(url) })
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: (tag: string): typeof anchor => {
      assert.equal(tag, 'a')
      return anchor
    },
  } })
  context.after(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  downloadCalendarIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR', 'course.ics')
  assert.ok(clicked)
  assert.equal(anchor.href, 'blob:calendar')
  assert.equal(anchor.download, 'course.ics')
  assert.equal((downloadedBlob as Blob | null)?.type, 'text/calendar;charset=utf-8')
  assert.equal(await (downloadedBlob as Blob | null)?.text(), 'BEGIN:VCALENDAR\r\nEND:VCALENDAR')
  assert.deepEqual(revoked, ['blob:calendar'])
})
