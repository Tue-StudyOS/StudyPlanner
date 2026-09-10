import type { JSX } from 'react'
import { LEGAL_NOTICE_IS_DRAFT } from '../legalOperator.ts'

export function LegalPreviewNotice(): JSX.Element | null {
  if (!LEGAL_NOTICE_IS_DRAFT) return null

  return (
    <aside className="grid min-w-0 gap-1 rounded-[12px] border border-primary/30 bg-primary-soft p-4">
      <h2 className="font-semibold text-fg">Rechtliche Angaben in Bearbeitung</h2>
      <p>
        Die Kontaktdaten des Verantwortlichen sind hinterlegt und können für
        Datenschutzanfragen genutzt werden. Die Datenschutzerklärung enthält noch
        offene Prüfungen zu Rechtsgrundlagen, Browser-Speicher und Hosting und ist
        noch nicht vollständig.
      </p>
    </aside>
  )
}
