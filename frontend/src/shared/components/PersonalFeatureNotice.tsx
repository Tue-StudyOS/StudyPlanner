import { Link } from 'react-router-dom'
import { ROUTES } from '../../features/routes'

interface PersonalFeatureNoticeProps {
  title: string
  description: string
}

export function PersonalFeatureNotice({ title, description }: PersonalFeatureNoticeProps) {
  return (
    <div className="rounded-[10px] border border-dashed border-border bg-surface px-8 py-12 text-center">
      <h2 className="mb-2 text-[18px] font-semibold text-fg">{title}</h2>
      <p className="mx-auto mb-5 max-w-[520px] text-[13.5px] leading-6 text-fg-muted">
        {description}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to={ROUTES.account}
          className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Sign in or create an account
        </Link>
        <Link
          to={ROUTES.catalog}
          className="rounded-md border border-border px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
        >
          Browse the public catalog
        </Link>
      </div>
    </div>
  )
}
