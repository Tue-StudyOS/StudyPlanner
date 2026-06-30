import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLearningPlatformLinks,
  isLearningPlatformLink,
} from '../../src/features/courses/utils/learningPlatformLinks.ts'

test('isLearningPlatformLink only keeps Moodle and ILIAS links with URLs', () => {
  assert.equal(isLearningPlatformLink({ platform: 'moodle', url: 'https://moodle.test', label: '' }), true)
  assert.equal(isLearningPlatformLink({ platform: ' ILIAS ', url: 'https://ilias.test', label: '' }), true)
  assert.equal(isLearningPlatformLink({ platform: 'alma', url: 'https://alma.test', label: '' }), false)
  assert.equal(isLearningPlatformLink({ platform: 'moodle', url: ' ', label: '' }), false)
})

test('buildLearningPlatformLinks dedupes external rows and adds ILIAS metadata fallback', () => {
  const links = buildLearningPlatformLinks(
    [
      { platform: 'moodle', url: 'https://moodle.test/course/1', label: 'Moodle Course' },
      { platform: 'Moodle', url: 'https://moodle.test/course/1', label: 'Duplicate' },
      { platform: 'alma', url: 'https://alma.test/course/1', label: 'Alma Course' },
    ],
    {
      refId: '123',
      title: 'ILIAS Course',
      url: 'https://ilias.test/course/1',
    },
  )

  assert.deepEqual(links, [
    { platform: 'moodle', url: 'https://moodle.test/course/1', label: 'Moodle Course' },
    { platform: 'ilias', url: 'https://ilias.test/course/1', label: 'ILIAS Course' },
  ])
})

test('buildLearningPlatformLinks does not duplicate ILIAS metadata link', () => {
  const links = buildLearningPlatformLinks(
    [{ platform: 'ilias', url: 'https://ilias.test/course/1', label: 'Existing ILIAS' }],
    {
      refId: '123',
      title: 'ILIAS Course',
      url: 'https://ilias.test/course/1',
    },
  )

  assert.deepEqual(links, [
    { platform: 'ilias', url: 'https://ilias.test/course/1', label: 'Existing ILIAS' },
  ])
})
