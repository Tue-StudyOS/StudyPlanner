import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'

const GUEST_REVIEW_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,64}$/

export function readOrCreateGuestReviewToken(): string {
  try {
    const existing = window.localStorage.getItem(BROWSER_STORAGE_KEYS.guestReviewToken)
    if (existing && GUEST_REVIEW_TOKEN_PATTERN.test(existing)) {
      return existing
    }
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const token = btoa(String.fromCharCode(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')
    window.localStorage.setItem(BROWSER_STORAGE_KEYS.guestReviewToken, token)
    return token
  } catch {
    return ''
  }
}
