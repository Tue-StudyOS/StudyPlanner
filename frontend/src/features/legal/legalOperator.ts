export interface LegalOperator {
  isPreview: boolean
  name: string
  addressLines: readonly string[]
  emailDisplay: string
}

// Contact confirmation does not resolve the outstanding legal-notice assessments.
export const LEGAL_NOTICE_IS_DRAFT: boolean = true

export const LEGAL_OPERATOR: LegalOperator = {
  isPreview: false,
  name: 'Yonatan Dankner',
  addressLines: ['Hafengasse 11', '72070 Tübingen', 'Deutschland'],
  // Obfuscate the displayed address to deter basic email scrapers.
  emailDisplay: 'yonatan.dankner (at) gmail.com',
}
