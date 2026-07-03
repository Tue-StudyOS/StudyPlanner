import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Course } from '../../src/features/courses/index.ts'
import {
  defaultHiddenTutorialSlotIds,
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
    assert.equal(isTutorialLikeSlotType('Vorlesung'), false)
  })

  it('lists weekly tutorial slots only', () => {
    const options = getTutorialSlotOptions(sampleCourse)
    assert.equal(options.length, 2)
    assert.equal(options[0]?.slotId, 'c1:0')
    assert.equal(options[1]?.slotId, 'c1:1')
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
  })

  it('resolves the visible tutorial slot from hidden ids', () => {
    const options = getTutorialSlotOptions(sampleCourse)
    assert.equal(resolveVisibleTutorialSlotId(options, ['c1:1']), 'c1:0')
  })
})
