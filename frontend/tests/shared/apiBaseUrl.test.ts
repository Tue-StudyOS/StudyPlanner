import assert from 'node:assert/strict'
import test from 'node:test'

import { getApiBaseUrl, resolveApiBaseUrl } from '../../src/shared/utils/apiBaseUrl.ts'

const PRODUCTION_API_BASE_URL = 'https://studyplanner-api.ben-tischberger.workers.dev'

test('resolveApiBaseUrl keeps deployed hosts same-origin even when a Worker URL is configured', () => {
  assert.equal(resolveApiBaseUrl('studyplaner.pages.dev', `${PRODUCTION_API_BASE_URL}/`), '')
  assert.equal(resolveApiBaseUrl('preview.studyplaner.pages.dev', PRODUCTION_API_BASE_URL), '')
})

test('resolveApiBaseUrl keeps custom production domains same-origin', () => {
  assert.equal(resolveApiBaseUrl('studyos.example.edu', PRODUCTION_API_BASE_URL), '')
})

test('resolveApiBaseUrl uses the configured origin only on localhost', () => {
  assert.equal(resolveApiBaseUrl('localhost', `${PRODUCTION_API_BASE_URL}/`), PRODUCTION_API_BASE_URL)
  assert.equal(resolveApiBaseUrl('127.0.0.1', PRODUCTION_API_BASE_URL), PRODUCTION_API_BASE_URL)
})

test('getApiBaseUrl returns empty string for deployed hosts', () => {
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
