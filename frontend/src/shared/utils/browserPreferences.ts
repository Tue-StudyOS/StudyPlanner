export function saveBrowserPreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Explicit choices still apply to the current page when storage is blocked.
  }
}
