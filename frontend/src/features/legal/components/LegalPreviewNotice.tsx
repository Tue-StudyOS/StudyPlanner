import type { JSX } from 'react'
import { LEGAL_OPERATOR } from '../legalOperator.ts'

export function LegalPreviewNotice(): JSX.Element | null {
  if (!LEGAL_OPERATOR.isPreview) return null

  return (
    <aside className="grid min-w-0 gap-1 rounded-[12px] border border-primary/30 bg-primary-soft p-4">
      <h2 className="font-semibold text-fg">Vorschau mit Musterdaten</h2>
      <p>
        Name, Anschrift und E-Mail sind fiktiv. Die Beispieladresse empfängt keine
        Nachrichten. Diese Vorschau ist noch keine vollständige rechtliche Information
        für den öffentlichen Betrieb.
      </p>
    </aside>
  )
}
