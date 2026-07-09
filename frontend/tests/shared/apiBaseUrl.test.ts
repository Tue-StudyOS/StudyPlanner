import assert from 'node:assert/strict'
import test from 'node:test'

import { getApiBaseUrl, resolveApiBaseUrl } from '../../src/shared/utils/apiBaseUrl.ts'

const PRODUCTION_API_BASE_URL = 'https://studyplanner-api.ben-tischberger.workers.dev'

test('resolveApiBaseUrl returns configured origin for deployed hosts', () => {
  assert.equal(
    resolveApiBaseUrl('studyplaner.pages.dev', `${PRODUCTION_API_BASE_URL}/`),
    PRODUCTION_API_BASE_URL,
  )
})

test('getApiBaseUrl returns empty string for deployed hosts without config', () => {
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

test('resolveApiBaseUrl returns configured origin for custom production domains', () => {
  assert.equal(resolveApiBaseUrl('studyos.example.edu', PRODUCTION_API_BASE_URL), PRODUCTION_API_BASE_URL)
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
