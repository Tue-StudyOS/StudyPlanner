export type PasswordStrength = 'weak' | 'strong'

export function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) {
    return null
  }

  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length

  if (password.length >= 8 && variety >= 2) {
    return 'strong'
  }

  return 'weak'
}
