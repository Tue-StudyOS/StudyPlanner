import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildIliasMetadataRows,
  hasIliasMetadata,
} from '../../src/features/courses/utils/illiasMetadata.ts'

const LABELS = {
  availability: 'Availability',
  deadline: 'Deadline',
  instructors: 'Instructors',
  maxParticipants: 'Limit',
  registration: 'Registration',
}

test('buildIliasMetadataRows keeps only populated public metadata', () => {
  const rows = buildIliasMetadataRows(
    {
      refId: '123',
      title: 'ILIAS Course',
      url: 'https://example.test',
      registration: 'Join request',
      deadline: '30.06.2026',
      maxParticipants: 20,
      availability: '',
      instructors: ['Ada Lovelace', 'Grace Hopper'],
    },
    LABELS,
  )

  assert.deepEqual(rows, [
    { key: 'registration', label: 'Registration', value: 'Join request' },
    { key: 'deadline', label: 'Deadline', value: '30.06.2026' },
    { key: 'maxParticipants', label: 'Limit', value: '20' },
    { key: 'instructors', label: 'Instructors', value: 'Ada Lovelace, Grace Hopper' },
  ])
})

test('hasIliasMetadata requires visible metadata or a link', () => {
  assert.equal(hasIliasMetadata(null), false)
  assert.equal(hasIliasMetadata({ refId: '1', title: '', url: '' }), false)
  assert.equal(hasIliasMetadata({ refId: '1', title: '', url: 'https://example.test' }), true)
  assert.equal(hasIliasMetadata({ refId: '1', title: '', url: '', maxParticipants: 15 }), true)
})
