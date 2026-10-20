import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course, ScheduleSlot } from '../../src/features/courses/types.ts'
import { buildPlannerWeek, calendarMetadataExams, calendarPatternDates, calendarTimeBounds, calendarTimeRange, classifyCalendarSlot } from '../../src/features/planner/utils/plannerCalendar.ts'
import { addCalendarDays, initialCalendarWeek, parseCalendarDate, startOfCalendarWeek } from '../../src/features/planner/utils/plannerDates.ts'
import { buildPlannerBlocks, markPlannerBlockOverlaps } from '../../src/features/planner/utils/plannerFeedback.ts'
import { buildDayLayout } from '../../src/features/planner/utils/plannerDayLayout.ts'

function slot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return { day: 'Mo.', time: '10:00 - 12:00', room: 'Hall', type: 'Vorlesung', rhythm: 'wöchentlich', ...overrides }
}

function course(schedule: ScheduleSlot[] = []): Course {
  return {
    id: '42', number: 'INFO4656a', title: 'Calendar course', lecturer: '', room: '', types: [], ects: 6, sws: null,
    masterCats: [], weekdays: [], schedule, frequency: '', language: '', prerequisites: [], description: '', exams: [],
  }
}

function week(schedule: ScheduleSlot[], weekStart = '2026-09-28', extra = {}) {
  return buildPlannerWeek({ courses: [course(schedule)], semesterLabel: 'SS 2026', weekStart, ...extra })
}

function dates(scheduleSlot: ScheduleSlot, semester = 'SS 2026'): string[] {
  return calendarPatternDates(classifyCalendarSlot(scheduleSlot, semester))
}

test('strict ISO/German dates reject calendar overflow and support leap and two-digit years', () => {
  for (const text of ['2026-04-31', '31.04.26', '29.02.2026', '2026-2-01', '2026-02-29', 'TBA', '2026-01-01T00:00Z']) assert.equal(parseCalendarDate(text), null, text)
  assert.equal(parseCalendarDate('29.02.24'), '2024-02-29')
  assert.equal(parseCalendarDate('1.4.2026'), '2026-04-01')
  assert.equal(parseCalendarDate('2026-04-01'), '2026-04-01')
})

test('calendar semester boundaries and initial weeks use today only inside the selected semester', () => {
  for (const [semester, today, expected] of [
    ['SS 2026', '2026-04-01', '2026-03-30'], ['SS 2026', '2026-09-30', '2026-09-28'],
    ['SS 2026', '2026-03-31', '2026-03-30'], ['SS 2026', '2026-10-01', '2026-03-30'],
    ['WS 2026/27', '2027-01-03', '2026-12-28'], ['WS 2026/27', '2027-03-31', '2027-03-29'],
    ['WS 2026/27', '2027-04-01', '2026-09-28'], ['WS 2026/27', '2026-09-30', '2026-09-28'],
    ['WS 2026/27', '2026-10-01', '2026-09-28'],
  ]) assert.equal(initialCalendarWeek(semester, today), expected, `${semester}: ${today}`)
})

test('week navigation crosses years and both DST transitions without timezone drift', () => {
  const original = process.env.TZ
  try {
    for (const zone of ['Europe/Berlin', 'America/New_York', 'Pacific/Auckland']) {
      process.env.TZ = zone
      assert.equal(startOfCalendarWeek('2027-01-03'), '2026-12-28')
      assert.equal(addCalendarDays('2026-12-28', 7), '2027-01-04')
      assert.equal(addCalendarDays('2027-01-04', -7), '2026-12-28')
      assert.equal(addCalendarDays('2026-03-23', 7), '2026-03-30')
      assert.equal(addCalendarDays('2026-10-19', 7), '2026-10-26')
      assert.equal(initialCalendarWeek('SS 2026', '2026-05-03'), '2026-04-27')
      assert.equal(dates(slot())[0], '2026-04-13')
    }
  } finally {
    if (original === undefined) delete process.env.TZ
    else process.env.TZ = original
  }
})

test('weekly inclusive structured bounds, weekday alignment and exact cancellations', () => {
  const appointment = slot({ startsOn: '2026-09-14', endsOn: '2026-09-28', cancellationDates: ['2026-09-21'] })
  assert.deepEqual(dates(appointment), ['2026-09-14', '2026-09-28'])
  assert.equal(week([appointment]).blocks.length, 1)
  assert.equal(week([appointment], '2026-10-05').blocks.length, 0)
  assert.deepEqual(dates(slot({ startsOn: '2026-09-15', endsOn: '2026-09-28' })), ['2026-09-21', '2026-09-28'])
  assert.deepEqual(dates(slot({ startsOn: '2026-12-21', endsOn: '2026-12-28' }), 'WS 2026/27'), ['2026-12-21', '2026-12-28'])
})

test('documented September block expands Mon/Tue/Wed only, not future Mondays or April', () => {
  const block = slot({ day: 'Mo.', rhythm: 'Blockveranstaltung', startsOn: '2026-09-28', endsOn: '2026-09-30', time: '09:00 - 15:00' })
  assert.deepEqual(dates(block), ['2026-09-28', '2026-09-29', '2026-09-30'])
  assert.deepEqual(week([block]).blocks.map((item) => item.day), ['Monday', 'Tuesday', 'Wednesday'])
  assert.equal(week([block], '2026-04-13').blocks.length, 0)
  assert.equal(week([block], '2026-10-05').blocks.length, 0)
  assert.equal(new Set(week([block]).blocks.map((item) => item.blockId)).size, 3)
  assert.equal(new Set(week([block]).blocks.map((item) => item.slotId)).size, 1)
})

test('winter blocks extend into March and only explicit weekend blocks include Saturday/Sunday', () => {
  const block = slot({ rhythm: 'Blockveranstaltung', startsOn: '2027-02-22', endsOn: '2027-03-05' })
  assert.equal(dates(block, 'WS 2026/27').length, 10)
  const weekend = slot({ rhythm: 'Blockveranstaltung + Sa und So', startsOn: '2027-02-19', endsOn: '2027-02-21' })
  assert.deepEqual(dates(weekend, 'WS 2026/27'), ['2027-02-19', '2027-02-20', '2027-02-21'])
  assert.deepEqual(dates({ ...weekend, rhythm: 'Blockveranstaltung' }, 'WS 2026/27'), ['2027-02-19'])
  assert.deepEqual(dates({ ...weekend, cancellationDates: ['2027-02-20'] }, 'WS 2026/27'), ['2027-02-19', '2027-02-21'])
})

test('fortnightly anchors first actual weekday, not week parity across New Year', () => {
  assert.deepEqual(dates(slot({ rhythm: '14-täglich', day: 'Fr.', startsOn: '2026-12-25', endsOn: '2027-01-22', cancellationDates: ['2027-01-08'] }), 'WS 2026/27'), ['2026-12-25', '2027-01-22'])
  assert.deepEqual(dates(slot({ rhythm: '14-tägig', day: 'Fr.', startsOn: '2026-12-24', endsOn: '2027-01-09' }), 'WS 2026/27'), ['2026-12-25', '2027-01-08'])
})

test('single dates, equal structured bounds and weekend appointments appear only once', () => {
  for (const single of [
    slot({ rhythm: 'Einzeltermin', day: '2026-10-03' }),
    slot({ rhythm: undefined, day: 'am 03.10.26' }),
    slot({ day: 'Mo.', startsOn: '2026-10-03', endsOn: '2026-10-03' }),
  ]) {
    assert.deepEqual(dates(single), ['2026-10-03'])
    assert.equal(week([single]).blocks[0]?.day, 'Saturday')
    assert.equal(week([single], '2026-10-05').blocks.length, 0)
    assert.deepEqual(dates({ ...single, cancellationDates: ['2026-10-03'] }), [])
  }
})

test('structured dates are authoritative; strict day ranges are fallback only', () => {
  assert.deepEqual(dates(slot({ day: '28.09.2026 - 30.09.2026', rhythm: 'Blockveranstaltung' })), ['2026-09-28', '2026-09-29', '2026-09-30'])
  assert.deepEqual(dates(slot({ day: '2026-09-28 - 2026-09-30', rhythm: 'Blockveranstaltung' })), ['2026-09-28', '2026-09-29', '2026-09-30'])
  assert.deepEqual(dates(slot({ day: '31.04.2026', startsOn: '2026-09-28', endsOn: '2026-09-28' })), ['2026-09-28'])
  assert.deepEqual(dates(slot({ day: '01.04.2026 - 30.04.2026', startsOn: '2026-09-28', endsOn: '2026-10-05' })), ['2026-09-28', '2026-10-05'])
  for (const invalid of [
    slot({ startsOn: '2026-04-31', endsOn: '2026-09-30' }),
    slot({ startsOn: '2026-09-30', endsOn: '2026-09-28' }),
    slot({ day: '31.04.2026 - 30.09.2026' }),
  ]) {
    assert.deepEqual(dates(invalid), [])
    assert.equal(week([invalid]).unresolved.length, 1)
  }
})

test('unknown rhythms, block dates and missing times never invent weekly or midnight events', () => {
  for (const unknown of [slot({ rhythm: 'wird noch bekanntgegeben' }), slot({ rhythm: 'mystery' }), slot({ rhythm: 'Blockveranstaltung' }), slot({ day: 'TBA' }), slot({ time: 'TBA' })]) {
    assert.equal(week([unknown], '2026-04-13').blocks.length, 0)
    assert.equal(week([unknown], '2026-04-13').unresolved.length, 1)
  }
  const untimed = week([slot({ day: '2026-09-28', time: 'TBA' })])
  assert.equal(untimed.dateItems.length, 1)
  assert.equal(untimed.blocks.length, 0)
  const datedUnknown = week([slot({ rhythm: 'unknown', startsOn: '2026-09-28', endsOn: '2026-09-30' })])
  assert.equal(datedUnknown.blocks.length, 0)
  assert.match(datedUnknown.dateItems[0].label, /unresolved/)
  assert.equal(week([slot({ rhythm: 'unknown', startsOn: '2026-09-28', endsOn: '2026-09-30', cancellationDates: ['2026-09-28'] })]).dateItems.length, 0)
  for (const invalidTime of ['24:00 - 25:00', '10:65 - 12:00', '12:00 - 10:00', '00:00 - 00:00', '-01:00 - 02:00', 'maybe 10:00 - 12:00']) assert.equal(calendarTimeRange(invalidTime), null)
})

test('published academic time qualifiers remain timed appointments with their original labels', () => {
  for (const time of ['10:00 - 12:00 c.t.', '10:00 - 12:00 s.t.', '10:00 – 12:00 Uhr c.t.', '10:00 - 12:00 ct']) {
    assert.deepEqual(calendarTimeRange(time), { startMinutes: 600, endMinutes: 720 })
    const result = week([slot({ time })], '2026-04-13')
    assert.equal(result.blocks.length, 1)
    assert.equal(result.blocks[0].label, time)
    assert.deepEqual(result.dateItems, [])
    assert.deepEqual(result.unresolved, [])
  }
})

test('date-only exams dedupe matching scheduled types, preserve distinct same-day exams, hidden/cancelled exams stay hidden', () => {
  const planned = course([slot({ id: 'exam', type: 'Klausur', day: '28.09.2026', cancellationDates: ['2026-09-28'] })])
  planned.exams = [
    { type: 'Exam', date: '2026-09-28', duration: '90 min' },
    { type: 'Oral exam', date: '2026-09-28', duration: '20 min' },
    { type: 'Oral exam', date: '2026-09-28', duration: '20 min' },
    { type: 'Nachklausur', date: '2026-10-03', duration: '' },
  ]
  assert.equal(calendarMetadataExams(planned, 'SS 2026').length, 2)
  const result = buildPlannerWeek({ courses: [planned], semesterLabel: 'SS 2026', weekStart: '2026-09-28', hiddenSlotIds: ['42:appointment:exam'] })
  assert.equal(result.blocks.length, 0)
  assert.deepEqual(result.dateItems.map((item) => item.date), ['2026-09-28', '2026-10-03'])
  assert.match(result.dateItems[0].label, /Oral exam/)
  const generic = course([slot({ type: 'Course', day: '28.09.2026' })])
  generic.exams = [{ type: 'Klausur', date: '2026-09-28', duration: '' }]
  assert.deepEqual(calendarMetadataExams(generic, 'SS 2026'), [])
})

test('stable and source legacy selection IDs filter before expansion without shifting source indices', () => {
  const schedule = [slot({ calendarRelevant: false }), slot({ id: 'a', sourceCourseId: 'old', sourceIndex: 8 }), slot({ id: 'b' })]
  for (const hidden of ['42:appointment:a', '42:1', 'old:8']) {
    const result = week(schedule, '2026-04-13', { hiddenSlotIds: [hidden] })
    assert.deepEqual(result.blocks.map((item) => item.slotId), ['42:appointment:b'])
    assert.equal(markPlannerBlockOverlaps(result.blocks)[0].hasOverlap, false)
  }
})

test('manual weekday slots use teaching fallback, keep membership in empty weeks and ignore orphan slots', () => {
  const manualSlots = [
    { id: 'm', courseId: '42', day: 'Monday' as const, time: '07:00 - 08:00' },
    { id: 'orphan', courseId: 'missing', day: 'Monday' as const, time: '10:00 - 12:00' },
  ]
  const result = week([], '2026-04-13', { manualSlots })
  assert.equal(result.blocks.length, 1)
  assert.equal(result.blocks[0].isManual, true)
  assert.equal(week([], '2026-04-20', { manualSlots }).blocks.length, 1)
  assert.equal(week([], '2026-04-13', { manualSlots, hiddenSlotIds: ['manual:m'] }).blocks.length, 0)
  const empty = week([], '2026-09-28', { manualSlots })
  assert.equal(empty.blocks.length, 0)
  assert.deepEqual(empty.courseIds, ['42'])
  assert.deepEqual(empty.unresolved, [])
})

test('early/late events remain uncut and reusable day layout supports weekend blocks', () => {
  const result = week([slot({ day: '03.10.2026', time: '06:30 - 07:30' }), slot({ day: '04.10.2026', time: '21:00 - 23:30' })])
  assert.deepEqual(calendarTimeBounds(result.blocks), { startHour: 6, endHour: 24 })
  assert.equal(buildDayLayout(result.blocks).visibleBlocks.length, 2)
  assert.equal(result.blocks[1].endMinutes, 1410)
  // Timeless mini-grids/filter/dialog consumers keep their established behavior.
  assert.equal(buildPlannerBlocks([course([slot({ day: '03.10.2026' })])]).length, 0)
})
