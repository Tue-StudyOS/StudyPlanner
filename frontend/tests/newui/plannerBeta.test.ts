import assert from 'node:assert/strict'
import test from 'node:test'
import type { RegulationAreaOption } from '../../src/shared/utils/regulation.ts'
import {
  areaCodeForCategory,
  categoriesFromOptions,
} from '../../src/features/newui/utils/plannerCategory.ts'
import { formatTutorialSlotLabel } from '../../src/features/newui/utils/plannerFormat.ts'
import { isLectureOrTutorialBlock } from '../../src/features/newui/utils/timetableFilter.ts'

function option(overrides: Partial<RegulationAreaOption> & Pick<RegulationAreaOption, 'code' | 'masterCat'>): RegulationAreaOption {
  return {
    label: overrides.code,
    shortLabel: overrides.code,
    isFlexible: false,
    ...overrides,
  }
}

test('lists selectable categories from area options in canonical order', () => {
  const options = [
    option({ code: 'INFO-PRAK', masterCat: 'PRAK' }),
    option({ code: 'INFO-TECH', masterCat: 'TECH' }),
    option({ code: 'UEBK', masterCat: 'BASIS' }),
    option({ code: 'NONE', masterCat: null }),
  ]
  assert.deepEqual(categoriesFromOptions(options), ['TECH', 'PRAK', 'BASIS'])
})

test('resolves the area code for a target category', () => {
  const options = [
    option({ code: 'INFO-TECH', masterCat: 'TECH' }),
    option({ code: 'INFO-PRAK', masterCat: 'PRAK' }),
  ]
  assert.equal(areaCodeForCategory(options, 'PRAK'), 'INFO-PRAK')
  assert.equal(areaCodeForCategory(options, 'THEO'), null)
})

test('keeps only lectures and tutorials in the timetable', () => {
  assert.equal(isLectureOrTutorialBlock({ slotKind: 'weekly', slotType: '' }), true)
  assert.equal(isLectureOrTutorialBlock({ slotKind: 'weekly', slotType: 'Vorlesung' }), true)
  assert.equal(isLectureOrTutorialBlock({ slotKind: 'weekly', slotType: 'Übung' }), true)
  assert.equal(isLectureOrTutorialBlock({ slotKind: 'exam', slotType: 'Klausur' }), false)
  assert.equal(isLectureOrTutorialBlock({ slotKind: 'resit', slotType: 'Nachklausur' }), false)
  assert.equal(isLectureOrTutorialBlock({ slotKind: 'weekly', slotType: 'Seminar' }), false)
  assert.equal(isLectureOrTutorialBlock({ slotKind: 'weekly', slotType: 'Praktikum' }), false)
})

test('compacts tutorial labels to weekday and hour range', () => {
  assert.equal(formatTutorialSlotLabel('Mo · 14:00-16:00 · A101'), 'Mo 14-16')
  assert.equal(formatTutorialSlotLabel('Montag · 08:00 - 10:00 · B2'), 'Mo 8-10')
  assert.equal(formatTutorialSlotLabel('Do · 14:30-16:00'), 'Do 14:30-16')
})
