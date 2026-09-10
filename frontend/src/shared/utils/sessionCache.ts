import {
  SESSION_CACHE_SCHEMA_VERSION,
  SESSION_CACHE_STORAGE_PREFIX,
} from './browserStorageRegistry.ts'

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

interface CacheEnvelope<T> {
  schemaVersion: number
  key: string
  userKey: string
  createdAt: number
  expiresAt: number
  value: T
}

// Reuse responses during navigation without persisting private data across reloads.
const memoryCache = new Map<string, CacheEnvelope<unknown>>()

function now(): number {
  return Date.now()
}

function storageKey(key: string, userKey: string): string {
  return `${SESSION_CACHE_STORAGE_PREFIX}.${SESSION_CACHE_SCHEMA_VERSION}.${userKey}.${key}`
}

function isExpired(envelope: CacheEnvelope<unknown>, currentTime = now()): boolean {
  return envelope.schemaVersion !== SESSION_CACHE_SCHEMA_VERSION || envelope.expiresAt <= currentTime
}

export function readSessionCache<T>(key: string, userKey = 'public'): T | null {
  const scopedKey = storageKey(key, userKey)
  const inMemory = memoryCache.get(scopedKey)
  if (inMemory && !isExpired(inMemory)) {
    return inMemory.value as T
  }
  if (inMemory) {
    memoryCache.delete(scopedKey)
  }

  return null
}

export function writeSessionCache<T>(
  key: string,
  value: T,
  userKey = 'public',
  ttlMs = DEFAULT_TTL_MS,
): void {
  const createdAt = now()
  const envelope: CacheEnvelope<T> = {
    schemaVersion: SESSION_CACHE_SCHEMA_VERSION,
    key,
    userKey,
    createdAt,
    expiresAt: createdAt + Math.min(ttlMs, DEFAULT_TTL_MS),
    value,
  }
  const scopedKey = storageKey(key, userKey)
  memoryCache.set(scopedKey, envelope)
}

export function invalidateSessionCache(prefix: string, userKey?: string): void {
  const scopedPrefix = userKey === undefined
    ? `${SESSION_CACHE_STORAGE_PREFIX}.${SESSION_CACHE_SCHEMA_VERSION}.`
    : `${SESSION_CACHE_STORAGE_PREFIX}.${SESSION_CACHE_SCHEMA_VERSION}.${userKey}.`

  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(scopedPrefix) && key.includes(`.${prefix}`)) {
      memoryCache.delete(key)
    }
  }
}

export function clearExpiredSessionCache(currentTime = now()): void {
  for (const [key, envelope] of [...memoryCache.entries()]) {
    if (isExpired(envelope, currentTime)) {
      memoryCache.delete(key)
    }
  }
}

export function clearSessionCacheForUser(userKey: string): void {
  const scopedPrefix = `${SESSION_CACHE_STORAGE_PREFIX}.${SESSION_CACHE_SCHEMA_VERSION}.${userKey}.`

  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(scopedPrefix)) {
      memoryCache.delete(key)
    }
  }
}
