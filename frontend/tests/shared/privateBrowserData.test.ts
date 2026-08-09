import assert from 'node:assert/strict'
import test, { afterEach } from 'node:test'
import {
  BROWSER_STORAGE_KEYS,
  buildTranscriptImportStorageKey,
} from '../../src/shared/utils/browserStorageRegistry.ts'
import { clearPrivateBrowserData } from '../../src/shared/utils/privateBrowserData.ts'
import { readSessionCache, writeSessionCache } from '../../src/shared/utils/sessionCache.ts'

class FakeStorage {
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

afterEach(() => {
  Object.defineProperty(globalThis, 'window', {
    value: originalWindow,
    configurable: true,
  })
})

test('logout cleanup removes only private data for the current account', () => {
  const sessionStorage = new FakeStorage()
  const localStorage = new FakeStorage()
  Object.defineProperty(globalThis, 'window', {
    value: { sessionStorage, localStorage },
    configurable: true,
  })

  writeSessionCache('private:progress:snapshot', { total: 10 }, 'alice')
  writeSessionCache('private:progress:snapshot', { total: 20 }, 'bob')
  writeSessionCache('catalog:courses', ['public-course'])
  sessionStorage.setItem(buildTranscriptImportStorageKey('alice'), 'private transcript')
  sessionStorage.setItem(buildTranscriptImportStorageKey('bob'), 'other transcript')
  sessionStorage.setItem(BROWSER_STORAGE_KEYS.apiRequestLog, 'private diagnostics')
  localStorage.setItem(BROWSER_STORAGE_KEYS.theme, 'dark')

  clearPrivateBrowserData('alice')

  assert.equal(readSessionCache('private:progress:snapshot', 'alice'), null)
  assert.deepEqual(readSessionCache('private:progress:snapshot', 'bob'), { total: 20 })
  assert.deepEqual(readSessionCache('catalog:courses'), ['public-course'])
  assert.equal(sessionStorage.getItem(buildTranscriptImportStorageKey('alice')), null)
  assert.equal(sessionStorage.getItem(buildTranscriptImportStorageKey('bob')), 'other transcript')
  assert.equal(sessionStorage.getItem(BROWSER_STORAGE_KEYS.apiRequestLog), null)
  assert.equal(localStorage.getItem(BROWSER_STORAGE_KEYS.theme), 'dark')
})

test('logout cleanup tolerates browsers that block session storage', () => {
  Object.defineProperty(globalThis, 'window', {
    value: {
      get sessionStorage(): never {
        throw new DOMException('Storage blocked', 'SecurityError')
      },
    },
    configurable: true,
  })

  assert.doesNotThrow(() => clearPrivateBrowserData('alice'))
})
