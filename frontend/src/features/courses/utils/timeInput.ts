/**
 * Helpers for the masked time inputs: users type plain digits, the value is
 * rendered as HH:MM, and partial input completes to sensible defaults
 * (minutes default to 00).
 */

export function sanitizeTimeDigits(rawValue: string): string {
  return rawValue.replace(/\D/g, '').slice(0, 4)
}

export function formatTimeDigits(digits: string): string {
  if (digits.length <= 2) {
    return digits
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

/** Completes partial input on blur/tab: '9' -> '09:00', '143' -> '14:30'. */
export function completeTimeDigits(digits: string): string {
  if (digits.length === 0) {
    return ''
  }
  let hours = Number(digits.slice(0, 2).padStart(2, '0'))
  if (digits.length === 1) {
    hours = Number(digits)
  }
  hours = Math.min(hours, 23)

  const rawMinutes = digits.slice(2)
  let minutes = 0
  if (rawMinutes.length === 1) {
    minutes = Number(rawMinutes) * 10
  } else if (rawMinutes.length === 2) {
    minutes = Number(rawMinutes)
  }
  minutes = Math.min(minutes, 59)

  return `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`
}

export function timeDigitsToMinutes(digits: string): number | null {
  const completed = completeTimeDigits(digits)
  if (completed.length !== 4) {
    return null
  }
  return Number(completed.slice(0, 2)) * 60 + Number(completed.slice(2))
}
