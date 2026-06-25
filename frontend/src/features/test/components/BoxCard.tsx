import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface BoxCardProps {
  to: string
  title: string
  description: string
  icon?: ReactNode
  disabled?: boolean
}

const CARD_CLASS =
  'group flex min-h-[10rem] w-full min-w-0 flex-col justify-between gap-3 rounded-[14px] border border-border bg-surface p-6 text-left transition-all duration-150 hover:border-primary hover:shadow-lg sm:min-h-[12rem]'

// A large, central choice box. Two of these side by side on desktop, stacked on
// mobile, are the recurring navigation unit of the "/test" surface.
export function BoxCard({ to, title, description, icon, disabled }: BoxCardProps) {
  const content = (
    <>
      {icon ? <span className="text-fg-muted transition-colors group-hover:text-primary">{icon}</span> : null}
      <div className="min-w-0">
        <h2 className="text-[20px] font-semibold text-fg">{title}</h2>
        <p className="mt-1 break-words text-[13px] leading-5 text-fg-muted">{description}</p>
      </div>
    </>
  )

  if (disabled) {
    return (
      <div className={`${CARD_CLASS} cursor-not-allowed opacity-50`} aria-disabled="true">
        {content}
      </div>
    )
  }

  return (
    <Link to={to} className={CARD_CLASS}>
      {content}
    </Link>
  )
}

export function BoxGrid({ children }: { children: ReactNode }) {
  return <div className="grid w-full gap-4 sm:grid-cols-2">{children}</div>
}
