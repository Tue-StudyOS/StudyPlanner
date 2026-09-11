import { useState } from 'react'
import { saveBrowserPreference } from '../utils/browserPreferences.ts'

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

  function setPreference(next: boolean): void {
    setValue(next)
    saveBrowserPreference(storageKey, String(next))
  }

  return [value, setPreference]
}
