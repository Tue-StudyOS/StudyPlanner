import assert from 'node:assert/strict'
import test from 'node:test'
import { persistTranscriptImportCandidates } from '../../src/features/transcript/utils/transcriptImportSession.ts'
import type { TranscriptImportCandidate } from '../../src/features/transcript/types.ts'

const candidates = [{ id: 'candidate-1' }] as TranscriptImportCandidate[]

test('persists transcript review candidates for session restore', () => {
  let storedValue = ''
  const persisted = persistTranscriptImportCandidates(
    {
      sessionStorage: {
        setItem: (_key: string, value: string): void => {
          storedValue = value
        },
        removeItem: (): void => {},
      },
    },
    'review',
    candidates,
  )

  assert.equal(persisted, true)
  assert.equal(storedValue, JSON.stringify(candidates))
})

test('keeps the in-memory review when session storage quota is exhausted', () => {
  let removedKey = ''
  const persisted = persistTranscriptImportCandidates(
    {
      sessionStorage: {
        setItem: (): void => {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        },
        removeItem: (key: string): void => {
          removedKey = key
        },
      },
    },
    'review',
    candidates,
  )

  assert.equal(persisted, false)
  assert.equal(removedKey, 'review')
})

test('ignores browsers that block access to session storage', () => {
  const persisted = persistTranscriptImportCandidates(
    {
      get sessionStorage(): never {
        throw new DOMException('Storage blocked', 'SecurityError')
      },
    },
    'review',
    candidates,
  )

  assert.equal(persisted, false)
})
