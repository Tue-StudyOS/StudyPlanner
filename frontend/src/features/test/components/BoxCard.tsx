import type { MouseEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

type BoxCardTone = 'catalog' | 'personal' | 'progress' | 'semesters' | 'schedule' | 'editor'

interface BoxCardProps {
  to: string
  title: string
  description?: string
  icon?: ReactNode
  tone?: BoxCardTone
  disabled?: boolean
}

const CARD_CLASS =
  'group/card relative isolate flex min-h-[11rem] w-full min-w-0 flex-col overflow-hidden rounded-[24px] border border-border bg-surface p-5 text-left shadow-sm transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-2xl active:translate-y-0 active:scale-[0.985] sm:min-h-[13rem] sm:p-6'

const TONE_GRADIENT_CLASS: Record<BoxCardTone, string> = {
  catalog: 'from-primary/12 via-transparent to-accent/10',
  personal: 'from-accent/15 via-transparent to-primary/8',
  progress: 'from-success/15 via-transparent to-primary/8',
  semesters: 'from-primary/10 via-transparent to-cat-tech/10',
  schedule: 'from-cat-tech/14 via-transparent to-primary/8',
  editor: 'from-accent/15 via-transparent to-cat-info/10',
}

const TONE_BUBBLE_CLASS: Record<BoxCardTone, string> = {
  catalog: 'bg-primary/10 text-primary',
  personal: 'bg-accent/15 text-accent',
  progress: 'bg-success/15 text-success',
  semesters: 'bg-primary/10 text-primary',
  schedule: 'bg-cat-tech/15 text-cat-tech',
  editor: 'bg-cat-info/15 text-cat-info',
}

function CardVisual({ tone }: { tone: BoxCardTone }) {
  if (tone === 'catalog') {
    return (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <path d="M13 14h26M13 25h26M13 36h17" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  if (tone === 'personal') {
    return (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <circle cx="26" cy="19" r="8" stroke="currentColor" strokeWidth="4" />
        <path d="M12 40c3-7 8-10 14-10s11 3 14 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  if (tone === 'progress') {
    return (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <path d="M12 36h28" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M16 36V24M26 36V15M36 36V20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  if (tone === 'schedule') {
    return (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <rect x="12" y="13" width="28" height="27" rx="5" stroke="currentColor" strokeWidth="4" />
        <path d="M18 23h16M18 31h10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
    )
  }
  if (tone === 'editor') {
    return (
      <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
        <path d="M15 17h22M15 26h22M15 35h22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <circle cx="22" cy="17" r="3" fill="currentColor" />
        <circle cx="31" cy="26" r="3" fill="currentColor" />
        <circle cx="25" cy="35" r="3" fill="currentColor" />
      </svg>
    )
  }
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" aria-hidden="true">
      <rect x="12" y="12" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="4" />
      <rect x="28" y="12" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="4" />
      <rect x="12" y="28" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="4" />
      <rect x="28" y="28" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="4" />
    </svg>
  )
}

function shouldUseNativeNavigation(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
}

async function animateCardZoom(source: HTMLElement): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !source.animate) {
    return
  }

  const rect = source.getBoundingClientRect()
  const clone = source.cloneNode(true) as HTMLElement
  const viewportPadding = Math.min(24, Math.max(14, window.innerWidth * 0.04))
  const targetTop = Math.max(84, viewportPadding)
  const targetLeft = viewportPadding
  const targetWidth = Math.max(rect.width, window.innerWidth - viewportPadding * 2)
  const availableHeight = Math.max(rect.height, window.innerHeight - targetTop - viewportPadding)
  const targetHeight = Math.min(Math.max(rect.height * 1.65, 260), availableHeight)

  clone.setAttribute('aria-hidden', 'true')
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    zIndex: '999',
    pointerEvents: 'none',
    transformOrigin: 'center',
    maxWidth: 'none',
  })
  document.body.appendChild(clone)
  source.style.visibility = 'hidden'

  try {
    const animation = clone.animate(
      [
        {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          borderRadius: '24px',
          opacity: 1,
          transform: 'scale(1)',
        },
        {
          left: `${targetLeft}px`,
          top: `${targetTop}px`,
          width: `${targetWidth}px`,
          height: `${targetHeight}px`,
          borderRadius: '30px',
          opacity: 0.96,
          transform: 'scale(1.015)',
        },
      ],
      { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' },
    )
    await animation.finished
  } finally {
    source.style.visibility = ''
    clone.remove()
  }
}

export function BoxCard({ to, title, description, icon, tone = 'semesters', disabled }: BoxCardProps) {
  const navigate = useNavigate()
  const content = (
    <>
      <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${TONE_GRADIENT_CLASS[tone]}`} />
      <span className={`pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full ${TONE_BUBBLE_CLASS[tone]}`} />
      <span className={`pointer-events-none absolute bottom-4 right-4 opacity-20 transition-all duration-200 group-hover/card:scale-110 group-hover/card:opacity-30 ${TONE_BUBBLE_CLASS[tone]}`}>
        {icon ?? <CardVisual tone={tone} />}
      </span>
      <span className="relative z-10 flex h-full min-w-0 flex-col justify-between gap-8">
        <span className="min-w-0">
          <span className="mb-4 block h-1 w-10 rounded-full bg-primary/70 transition-all duration-200 group-hover/card:w-16" />
          <h2 className="break-words text-[22px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[24px]">
            {title}
          </h2>
          {description ? <span className="mt-2 block break-words text-[13px] leading-5 text-fg-muted">{description}</span> : null}
        </span>
        <span className="flex items-center justify-between gap-3">
          <span className="h-px min-w-0 flex-1 bg-border" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface/80 text-primary shadow-sm transition-transform duration-200 group-hover/card:translate-x-0.5">
            →
          </span>
        </span>
      </span>
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
    <Link
      to={to}
      className={CARD_CLASS}
      onClick={(event) => {
        if (shouldUseNativeNavigation(event)) {
          return
        }
        event.preventDefault()
        const targetPath = to
        void animateCardZoom(event.currentTarget).finally(() => navigate(targetPath))
      }}
    >
      {content}
    </Link>
  )
}

export function BoxGrid({ children }: { children: ReactNode }) {
  return <div className="grid w-full gap-4 sm:grid-cols-2 sm:gap-5">{children}</div>
}
