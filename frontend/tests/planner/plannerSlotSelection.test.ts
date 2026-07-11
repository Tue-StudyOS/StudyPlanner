import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Course } from '../../src/features/courses/index.ts'
import {
  applyDefaultTutorialSlotSelection,
  buildTutorialSlotSelectLayout,
  defaultHiddenTutorialSlotIds,
  formatPlannerSlotRoom,
  getTutorialSlotOptions,
  hiddenSlotIdsForTutorialSelection,
  isTutorialLikeSlotType,
  resolveVisibleTutorialSlotId,
} from '../../src/features/planner/utils/plannerSlotSelection.ts'

const sampleCourse: Course = {
  id: 'c1',
  number: 'INFO1234',
  title: 'Sample',
  lecturer: '',
  room: '',
  types: ['Übung'],
  ects: 6,
  sws: null,
  masterCats: [],
  weekdays: [],
  schedule: [
    { day: 'Monday', time: '10:00 - 12:00', room: 'A1', type: 'Übung' },
    { day: 'Wednesday', time: '14:00 - 16:00', room: 'B2', type: 'Tutorium' },
    { day: '12.07.2026', time: '10:00 - 12:00', room: 'Exam', type: 'Exam' },
  ],
  frequency: '',
  language: 'German',
  prerequisites: [],
  description: '',
  exams: [],
}

describe('plannerSlotSelection', () => {
  it('detects tutorial-like slot types', () => {
    assert.equal(isTutorialLikeSlotType('Übung'), true)
    assert.equal(isTutorialLikeSlotType('Plenarübung'), true)
    assert.equal(isTutorialLikeSlotType('Vorlesung'), false)
  })

  it('treats combined lecture/tutorial types as lecture', () => {
    assert.equal(isTutorialLikeSlotType('Vorlesung/Übung'), false)
    assert.equal(isTutorialLikeSlotType('Lecture/Exercise'), false)
  })

  it('lists weekly tutorial slots with separate weekday, time, and room values', () => {
    const options = getTutorialSlotOptions(sampleCourse)
    assert.equal(options.length, 2)
    assert.equal(options[0]?.slotId, 'c1:0')
    assert.equal(options[0]?.dayLabel, 'Mon')
    assert.equal(options[0]?.time, '10:00 - 12:00')
    assert.equal(options[0]?.room, 'A1')
    assert.equal(options[0]?.timeLabel, '10:00–12:00')
    assert.equal(options[0]?.label, 'Mon 10:00–12:00 A1')
    assert.equal(options[1]?.slotId, 'c1:1')
    assert.equal(options[1]?.label, 'Wed 14:00–16:00 B2')
  })

  it('uses one compact format for weekday, time, and room', () => {
    const options = getTutorialSlotOptions({
      ...sampleCourse,
      schedule: [
        sampleCourse.schedule[0],
        { ...sampleCourse.schedule[1], time: '9:00 - 10:00' },
      ],
    })

    assert.deepEqual(options.map((option) => option.label), [
      'Mon 10:00–12:00 A1',
      'Wed 09:00–10:00 B2',
    ])
  })

  it('keeps the room number but removes parenthetical details only from the picker', () => {
    const course = {
      ...sampleCourse,
      schedule: [
        { ...sampleCourse.schedule[0], room: 'C423 (Gebäude C, 4. Stock)' },
      ],
    }

    assert.equal(formatPlannerSlotRoom('C423 (Gebäude C, 4. Stock)'), 'C423')
    assert.equal(formatPlannerSlotRoom('Hörsaal N06'), 'Hörsaal N06')
    assert.equal(getTutorialSlotOptions(course)[0]?.room, 'C423')
    assert.equal(course.schedule[0].room, 'C423 (Gebäude C, 4. Stock)')
  })

  it('sizes every dropdown from the longest visible column values on the page', () => {
    const secondCourse = {
      ...sampleCourse,
      id: 'c2',
      schedule: [
        { day: 'Friday', time: '9:00 - 10:00', room: 'Seminarraum C423', type: 'Tutorium' },
        { day: 'Thursday', time: '11:00 - 12:00', room: 'C424', type: 'Tutorium' },
      ],
    }

    assert.deepEqual(buildTutorialSlotSelectLayout([sampleCourse, secondCourse]), {
      dayWidthCh: 3,
      timeWidthCh: 11,
      roomWidthCh: 'Seminarraum C423'.length,
    })
  })

  it('hides unselected tutorial slots', () => {
    const options = getTutorialSlotOptions(sampleCourse)
    const hidden = hiddenSlotIdsForTutorialSelection(
      options.map((option) => option.slotId),
      'c1:0',
    )
    assert.deepEqual(hidden, ['c1:1'])
  })

  it('defaults to keeping the first tutorial slot visible', () => {
    const options = getTutorialSlotOptions(sampleCourse)
    assert.deepEqual(defaultHiddenTutorialSlotIds(options), ['c1:1'])
    assert.deepEqual(applyDefaultTutorialSlotSelection([sampleCourse], []), ['c1:1'])
  })

  it('keeps an explicitly selected tutorial instead of restoring the first', () => {
    assert.deepEqual(applyDefaultTutorialSlotSelection([sampleCourse], ['c1:0']), ['c1:0'])
  })

  it('resolves the visible tutorial slot from hidden ids', () => {
    const options = getTutorialSlotOptions(sampleCourse)
    assert.equal(resolveVisibleTutorialSlotId(options, ['c1:1']), 'c1:0')
  })
})
