export interface LegalOperator {
  name: string
  addressLines: readonly string[]
  emailDisplay: string
}

// Shared contact for the joint operators; this is not the complete controller list.
export const LEGAL_OPERATOR: LegalOperator = {
  name: 'Yonatan Dankner',
  addressLines: ['Hafengasse 11', '72070 Tübingen', 'Deutschland'],
  // Obfuscate the displayed address to deter basic email scrapers.
  emailDisplay: 'yonatan.dankner (at) gmail.com',
}
