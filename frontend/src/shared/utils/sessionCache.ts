const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000
const STORAGE_PREFIX = 'studyplanner.sessionCache'
const SCHEMA_VERSION = 1

interface CacheEnvelope<T> {
  schemaVersion: number
  key: string
  userKey: string
  createdAt: number
  expiresAt: number
  value: T
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>()

function now(): number {
  return Date.now()
}

function storageKey(key: string, userKey: string): string {
  return `${STORAGE_PREFIX}.${SCHEMA_VERSION}.${userKey}.${key}`
}

function isExpired(envelope: CacheEnvelope<unknown>, currentTime = now()): boolean {
  return envelope.schemaVersion !== SCHEMA_VERSION || envelope.expiresAt <= currentTime
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

  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(scopedKey)
    if (!rawValue) {
      return null
    }
    const envelope = JSON.parse(rawValue) as CacheEnvelope<T>
    if (
      envelope.schemaVersion !== SCHEMA_VERSION
      || envelope.key !== key
      || envelope.userKey !== userKey
      || isExpired(envelope)
    ) {
      window.sessionStorage.removeItem(scopedKey)
      return null
    }
    memoryCache.set(scopedKey, envelope)
    return envelope.value
  } catch {
    window.sessionStorage.removeItem(scopedKey)
    return null
  }
}

export function writeSessionCache<T>(
  key: string,
  value: T,
  userKey = 'public',
  ttlMs = DEFAULT_TTL_MS,
): void {
  const createdAt = now()
  const envelope: CacheEnvelope<T> = {
    schemaVersion: SCHEMA_VERSION,
    key,
    userKey,
    createdAt,
    expiresAt: createdAt + Math.min(ttlMs, DEFAULT_TTL_MS),
    value,
  }
  const scopedKey = storageKey(key, userKey)
  memoryCache.set(scopedKey, envelope)

  if (typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(scopedKey, JSON.stringify(envelope))
  } catch {
    // Keep the in-memory cache for this SPA session if browser storage is full
    // or unavailable.
  }
}

export function invalidateSessionCache(prefix: string, userKey?: string): void {
  const scopedPrefix = userKey === undefined
    ? `${STORAGE_PREFIX}.${SCHEMA_VERSION}.`
    : `${STORAGE_PREFIX}.${SCHEMA_VERSION}.${userKey}.`

  for (const key of [...memoryCache.keys()]) {
    if (key.startsWith(scopedPrefix) && key.includes(`.${prefix}`)) {
      memoryCache.delete(key)
    }
  }

  if (typeof window === 'undefined') {
    return
  }

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(scopedPrefix) && key.includes(`.${prefix}`)) {
        window.sessionStorage.removeItem(key)
      }
    }
  } catch {
    // Ignore storage iteration failures.
  }
}

export function clearExpiredSessionCache(currentTime = now()): void {
  for (const [key, envelope] of [...memoryCache.entries()]) {
    if (isExpired(envelope, currentTime)) {
      memoryCache.delete(key)
    }
  }

  if (typeof window === 'undefined') {
    return
  }

  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index)
      if (!key?.startsWith(`${STORAGE_PREFIX}.${SCHEMA_VERSION}.`)) {
        continue
      }
      const rawValue = window.sessionStorage.getItem(key)
      if (!rawValue) {
        continue
      }
      const envelope = JSON.parse(rawValue) as CacheEnvelope<unknown>
      if (isExpired(envelope, currentTime)) {
        window.sessionStorage.removeItem(key)
      }
    }
  } catch {
    // Ignore malformed cache cleanup errors.
  }
}
