import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import { appendApiRequestLog, clearApiRequestLog, readApiRequestLog } from '../../src/shared/utils/apiRequestLog.ts'
import { saveBrowserPreference } from '../../src/shared/utils/browserPreferences.ts'
import { clearObsoleteBrowserStorage } from '../../src/shared/utils/obsoleteBrowserStorage.ts'
import { readSemesterBadge, setSemesterBadge } from '../../src/shared/utils/semesterBadgeState.ts'
import { BROWSER_STORAGE_KEYS, buildTranscriptImportStorageKey } from '../../src/shared/utils/browserStorageRegistry.ts'

const originalWindow = globalThis.window
afterEach(() => {
  Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true })
  clearApiRequestLog()
  setSemesterBadge(false)
})

test('diagnostics and badges function without any browser-storage access', () => {
  Object.defineProperty(globalThis, 'window', {
    value: {
      get sessionStorage(): never { throw new Error('Unexpected storage access') },
      get localStorage(): never { throw new Error('Unexpected storage access') },
    },
    configurable: true,
  })
  for (let index = 0; index < 90; index += 1) {
    appendApiRequestLog({ timestamp: index, method: 'GET', url: '/api/courses', status: 500, message: 'Failure' })
  }
  const entries = readApiRequestLog()
  assert.equal(entries.length, 80)
  assert.equal(entries[0].timestamp, 89)
  entries[0].message = 'Changed copy'
  assert.equal(readApiRequestLog()[0].message, 'Failure')
  clearApiRequestLog()
  assert.deepEqual(readApiRequestLog(), [])
  setSemesterBadge(true)
  assert.equal(readSemesterBadge(), true)
  setSemesterBadge(false)
  assert.equal(readSemesterBadge(), false)
  assert.doesNotThrow(clearObsoleteBrowserStorage)
  assert.doesNotThrow(() => saveBrowserPreference('theme', 'dark'))
})

test('preference persistence writes only the supplied choice', () => {
  const writes: Array<[string, string]> = []
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: { setItem: (key: string, value: string): void => { writes.push([key, value]) } } },
    configurable: true,
  })
  assert.deepEqual(writes, [])
  saveBrowserPreference('theme', 'dark')
  assert.deepEqual(writes, [['theme', 'dark']])
})

test('startup removes obsolete storage while preserving import drafts and chosen preferences', () => {
  const sessionItems = new Map([
    ['studyplanner.sessionCache.1.alice.private:progress', 'old cache'],
    ['studyplanner.sessionCache.0.public.catalog', 'older cache'],
    [BROWSER_STORAGE_KEYS.apiRequestLog, 'old diagnostics'],
    [buildTranscriptImportStorageKey('alice'), 'unfinished import'],
    ['unrelated', 'keep'],
  ])
  const localItems = new Map([
    [BROWSER_STORAGE_KEYS.semesterTabBadge, '1'],
    [BROWSER_STORAGE_KEYS.theme, 'dark'],
  ])
  Object.defineProperty(globalThis, 'window', {
    value: {
      sessionStorage: {
        get length(): number { return sessionItems.size },
        key: (index: number): string | null => [...sessionItems.keys()][index] ?? null,
        removeItem: (key: string): void => { sessionItems.delete(key) },
      },
      localStorage: { removeItem: (key: string): void => { localItems.delete(key) } },
    },
    configurable: true,
  })
  clearObsoleteBrowserStorage()
  assert.deepEqual([...sessionItems], [[buildTranscriptImportStorageKey('alice'), 'unfinished import'], ['unrelated', 'keep']])
  assert.deepEqual([...localItems], [[BROWSER_STORAGE_KEYS.theme, 'dark']])
})
