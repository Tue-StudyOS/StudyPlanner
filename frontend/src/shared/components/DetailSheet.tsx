import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'

interface DetailSheetProps {
  onClose: () => void
  header: ReactNode
  children: ReactNode
  labelledBy?: string
}

// Shared overlay that scrolls like the catalog course detail: a fixed header
// plus an internal scroll area, rendered as a bottom sheet on mobile and a
// centered card on desktop. Both keep their own height so long course lists
// scroll inside instead of stretching the dialog past the viewport.
export function DetailSheet({ onClose, header, children, labelledBy }: DetailSheetProps) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/45 px-4 py-6 sm:py-10"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={onClose}
    >
      <div
        className={
          isMobileViewport
            ? 'absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[18px] border-t border-border bg-surface shadow-2xl'
            : 'mx-auto mt-12 mb-10 flex max-h-[80dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[14px] border border-border bg-surface shadow-2xl'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-border">{header}</div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
          {children}
        </div>
      </div>
    </div>
  )
}
