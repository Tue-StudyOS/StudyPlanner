import { useEffect, useState } from 'react'

/**
 * A boolean toggle backed by localStorage so a UI preference (e.g. a collapsed
 * section) survives reloads and future sessions on the same device.
 */
export function usePersistedToggle(
  storageKey: string,
  defaultValue: boolean,
): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      return stored === null ? defaultValue : stored === 'true'
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(value))
    } catch {
      // Ignore storage failures (private mode / quota); the toggle still works
      // for the current session, it just is not persisted.
    }
  }, [storageKey, value])

  return [value, setValue]
}
