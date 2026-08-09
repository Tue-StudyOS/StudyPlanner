import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  BROWSER_STORAGE_REGISTRY,
} from '../../src/shared/utils/browserStorageRegistry.ts'

const frontendRoot = fileURLToPath(new URL('../..', import.meta.url))
const sourceRoot = resolve(frontendRoot, 'src')

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      return listSourceFiles(entryPath)
    }
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [entryPath] : []
  })
}

test('storage registry entries are complete and mirrored in operator documentation', () => {
  const ids = BROWSER_STORAGE_REGISTRY.map((entry) => entry.id)
  assert.equal(new Set(ids).size, ids.length)

  for (const entry of BROWSER_STORAGE_REGISTRY) {
    assert.ok(entry.key.length > 0)
    assert.ok(entry.owner.length > 0)
    assert.ok(entry.purpose.length > 0)
    assert.ok(entry.data.length > 0)
    assert.ok(entry.duration.length > 0)
    assert.equal(entry.necessary, true)
  }

  const inventory = readFileSync(
    resolve(frontendRoot, '../docs/privacy/browser-storage-inventory.md'),
    'utf8',
  )
  for (const id of ids) {
    assert.ok(inventory.includes(`| \`${id}\` |`))
  }
})

test('browser storage access stays in the reviewed modules and never uses inline keys', () => {
  const expectedStorageModules = [
    'features/auth/components/AuthProvider.tsx',
    'features/courses/components/Overview.tsx',
    'features/planner/utils/semesterTabBadge.ts',
    'features/theme/components/ThemeProvider.tsx',
    'features/transcript/components/Transcript.tsx',
    'main.tsx',
    'shared/hooks/usePersistedToggle.ts',
    'shared/utils/apiRequestLog.ts',
    'shared/utils/privateBrowserData.ts',
    'shared/utils/sessionCache.ts',
  ]

  const storageCallPattern = /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(/
  const inlineStorageKeyPattern = /(?:localStorage|sessionStorage)\.(?:getItem|setItem|removeItem)\(\s*['"]/
  const actualStorageModules = listSourceFiles(sourceRoot)
    .filter((filePath) => storageCallPattern.test(readFileSync(filePath, 'utf8')))
    .map((filePath) => relative(sourceRoot, filePath).replaceAll('\\', '/'))
    .sort()

  assert.deepEqual(actualStorageModules, expectedStorageModules)
  for (const filePath of listSourceFiles(sourceRoot)) {
    assert.doesNotMatch(readFileSync(filePath, 'utf8'), inlineStorageKeyPattern)
  }
})

test('initial HTML has no external font or script request', () => {
  const html = readFileSync(resolve(frontendRoot, 'index.html'), 'utf8')
  assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/i)
  assert.doesNotMatch(html, /<(?:script|link)[^>]+https?:\/\//i)
})
