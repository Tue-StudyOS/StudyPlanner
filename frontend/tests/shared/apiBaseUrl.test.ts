import assert from 'node:assert/strict'
import test from 'node:test'

import { getApiBaseUrl } from '../../src/shared/utils/apiBaseUrl.ts'

test('getApiBaseUrl returns empty string for deployed hosts (same-origin /api)', () => {
  const originalWindow = globalThis.window
  globalThis.window = {
    location: { hostname: 'studyplaner.pages.dev' },
  } as Window & typeof globalThis

  try {
    assert.equal(getApiBaseUrl(), '')
  } finally {
    globalThis.window = originalWindow
  }
})

test('getApiBaseUrl returns empty string for custom production domains', () => {
  const originalWindow = globalThis.window
  globalThis.window = {
    location: { hostname: 'studyos.example.edu' },
  } as Window & typeof globalThis

  try {
    assert.equal(getApiBaseUrl(), '')
  } finally {
    globalThis.window = originalWindow
  }
})

test('getApiBaseUrl falls back to the local Worker on localhost without env override', () => {
  const originalWindow = globalThis.window
  globalThis.window = {
    location: { hostname: 'localhost' },
  } as Window & typeof globalThis

  try {
    assert.equal(getApiBaseUrl(), 'http://localhost:8787')
  } finally {
    globalThis.window = originalWindow
  }
})
