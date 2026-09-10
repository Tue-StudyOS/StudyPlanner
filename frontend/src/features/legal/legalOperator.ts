export interface LegalOperator {
  name: string
  addressLines: readonly string[]
  emailDisplay: string
}

export const LEGAL_OPERATOR: LegalOperator = {
  name: 'Yonatan Dankner',
  addressLines: ['Hafengasse 11', '72070 Tübingen', 'Deutschland'],
  // Obfuscate the displayed address to deter basic email scrapers.
  emailDisplay: 'yonatan.dankner (at) gmail.com',
}
