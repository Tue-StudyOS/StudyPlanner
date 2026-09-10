export interface LegalOperator {
  isPreview: boolean
  name: string
  addressLines: readonly string[]
  email: string
}

// Contact confirmation does not resolve the outstanding legal-notice assessments.
export const LEGAL_NOTICE_IS_DRAFT: boolean = true

export const LEGAL_OPERATOR: LegalOperator = {
  isPreview: false,
  name: 'Yonatan Dankner',
  addressLines: ['Hafengasse 11', '72070 Tübingen', 'Deutschland'],
  email: 'yonatan.dankner@gmail.com',
}

export function getLegalContactHref(operator: LegalOperator): string | undefined {
  // Sample details must never look like a working channel for personal requests.
  if (operator.isPreview || operator.email.endsWith('.invalid')) return undefined
  return `mailto:${operator.email}?subject=${encodeURIComponent('StudyPlanner: Datenschutzanfrage')}`
}
