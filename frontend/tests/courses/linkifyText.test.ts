import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildLinkedTextSegments } from '../../src/features/courses/utils/linkifyText.ts'

describe('buildLinkedTextSegments', () => {
  it('links explicit ALMA anchor labels in preserved text', () => {
    assert.deepEqual(
      buildLinkedTextSegments('Empfehlung Anmeldung über MOODLE', [
        {
          label: 'Anmeldung über MOODLE',
          url: 'https://moodle.zdv.uni-tuebingen.de/course/view.php?id=123',
        },
      ]),
      [
        { kind: 'text', text: 'Empfehlung ' },
        {
          kind: 'link',
          text: 'Anmeldung über MOODLE',
          url: 'https://moodle.zdv.uni-tuebingen.de/course/view.php?id=123',
        },
      ],
    )
  })

  it('links plain https urls and keeps trailing punctuation outside the link', () => {
    assert.deepEqual(
      buildLinkedTextSegments('Webseite: https://example.org/course?id=1. Danach Text.'),
      [
        { kind: 'text', text: 'Webseite: ' },
        { kind: 'link', text: 'https://example.org/course?id=1', url: 'https://example.org/course?id=1' },
        { kind: 'text', text: '. Danach Text.' },
      ],
    )
  })

  it('prefers explicit links over plain url matches when ranges overlap', () => {
    assert.deepEqual(
      buildLinkedTextSegments('Open https://example.org/course', [
        { label: 'https://example.org/course', url: 'https://tracked.example.org' },
      ]),
      [
        { kind: 'text', text: 'Open ' },
        { kind: 'link', text: 'https://example.org/course', url: 'https://tracked.example.org' },
      ],
    )
  })
})
