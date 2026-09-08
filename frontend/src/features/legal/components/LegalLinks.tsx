import { Link } from 'react-router-dom'
import { ROUTES } from '../../routes.ts'

export function LegalLinks() {
  return (
    <footer className="flex min-w-0 shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border-light bg-bg px-3 py-2 text-[11.5px] text-fg-muted">
      <Link className="hover:text-fg hover:underline" to={ROUTES.privacy}>Datenschutz</Link>
      <Link className="hover:text-fg hover:underline" to={ROUTES.imprint}>Impressum</Link>
      <Link className="hover:text-fg hover:underline" to={ROUTES.reviewRules}>Bewertungsregeln</Link>
    </footer>
  )
}
