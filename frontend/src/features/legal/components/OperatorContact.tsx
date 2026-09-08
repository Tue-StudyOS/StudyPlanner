import type { JSX } from 'react'
import { getLegalContactHref, LEGAL_OPERATOR } from '../legalOperator.ts'

export function OperatorContact(): JSX.Element {
  const contactHref = getLegalContactHref(LEGAL_OPERATOR)

  return (
    <address className="grid min-w-0 gap-3 not-italic">
      <p className="break-words">
        <strong className="font-medium text-fg">{LEGAL_OPERATOR.name}</strong>
        {LEGAL_OPERATOR.addressLines.map((line) => <span className="block" key={line}>{line}</span>)}
      </p>
      <p className="min-w-0 break-words">
        E-Mail: {contactHref ? (
          <a className="break-all underline underline-offset-4 hover:text-fg" href={contactHref}>
            {LEGAL_OPERATOR.email}
          </a>
        ) : <span className="break-all">{LEGAL_OPERATOR.email} (Musteradresse)</span>}
      </p>
    </address>
  )
}
