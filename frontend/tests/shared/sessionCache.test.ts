import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import {
  clearExpiredSessionCache,
  invalidateSessionCache,
  readSessionCache,
  writeSessionCache,
} from '../../src/shared/utils/sessionCache.ts'
import { clearObsoleteBrowserStorage } from '../../src/shared/utils/obsoleteBrowserStorage.ts'

class FakeSessionStorage {
  private readonly items = new Map<string, string>()

  get length(): number {
    return this.items.size
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

const originalWindow = globalThis.window

function installFakeWindow(): FakeSessionStorage {
  const storage = new FakeSessionStorage()
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage: storage },
    configurable: true,
  })
  return storage
}

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
  })
})

test('session cache reads values only for the matching user scope', () => {
  installFakeWindow()

  writeSessionCache('catalog:courses:language-test', ['course-a'], 'alice')

  assert.deepEqual(readSessionCache<string[]>('catalog:courses:language-test', 'alice'), ['course-a'])
  assert.equal(readSessionCache<string[]>('catalog:courses:language-test', 'bob'), null)
})

test('session cache expires entries by TTL', () => {
  installFakeWindow()

  writeSessionCache('catalog:courses:expired-test', ['stale'], 'public', -1)

  assert.equal(readSessionCache<string[]>('catalog:courses:expired-test'), null)
})

test('session cache invalidates mutation-sensitive prefixes per user', () => {
  installFakeWindow()

  writeSessionCache('private:progress:snapshot', { total: 10 }, 'alice')
  writeSessionCache('private:completed-courses', [{ id: 'course-a' }], 'alice')
  invalidateSessionCache('private:progress', 'alice')

  assert.equal(readSessionCache<{ total: number }>('private:progress:snapshot', 'alice'), null)
  assert.deepEqual(readSessionCache<Array<{ id: string }>>('private:completed-courses', 'alice'), [
    { id: 'course-a' },
  ])
})

test('boot cleanup removes legacy disk caches without restoring their values', () => {
  const storage = installFakeWindow()
  storage.setItem(
    'studyplanner.sessionCache.1.public.catalog:manual-schema-test',
    JSON.stringify({
      schemaVersion: 0,
      key: 'catalog:manual-schema-test',
      userKey: 'public',
      createdAt: Date.now(),
      expiresAt: Date.now() + 1000,
      value: ['stale'],
    }),
  )

  clearObsoleteBrowserStorage()

  assert.equal(readSessionCache<string[]>('catalog:manual-schema-test'), null)
  assert.equal(storage.length, 0)
})

test('cache writes stay in memory and cleanup expires them', () => {
  const storage = installFakeWindow()
  writeSessionCache('private:memory-only', { grade: 1 }, 'memory-test', 1000)
  assert.equal(storage.length, 0)
  assert.deepEqual(readSessionCache('private:memory-only', 'memory-test'), { grade: 1 })
  clearExpiredSessionCache(Date.now() + 2000)
  assert.equal(readSessionCache('private:memory-only', 'memory-test'), null)
})
