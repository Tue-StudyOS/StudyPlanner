export interface LegalOperator {
  isPreview: boolean
  name: string
  addressLines: readonly string[]
  email: string
}

// Replace these together after the actual operator and monitored mailbox are confirmed.
export const LEGAL_OPERATOR: LegalOperator = {
  isPreview: true,
  name: 'Max Mustermann',
  addressLines: ['Musterstraße 1', '12345 Musterstadt', 'Deutschland'],
  email: 'datenschutz@example.invalid',
}

export function getLegalContactHref(operator: LegalOperator): string | undefined {
  // Sample details must never look like a working channel for personal requests.
  if (operator.isPreview || operator.email.endsWith('.invalid')) return undefined
  return `mailto:${operator.email}?subject=${encodeURIComponent('StudyPlanner: Datenschutzanfrage')}`
}
