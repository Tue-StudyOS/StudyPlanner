import type { JSX } from 'react'
import { LEGAL_OPERATOR } from '../legalOperator.ts'

export function OperatorContact(): JSX.Element {
  return (
    <address className="grid min-w-0 gap-3 not-italic">
      <p className="break-words">
        <strong className="font-medium text-fg">{LEGAL_OPERATOR.name}</strong>
        {LEGAL_OPERATOR.addressLines.map((line) => <span className="block" key={line}>{line}</span>)}
      </p>
      <p className="min-w-0 break-words">
        E-Mail: <span className="break-all">{LEGAL_OPERATOR.emailDisplay}</span>
      </p>
    </address>
  )
}
