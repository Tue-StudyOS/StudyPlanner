import type { ReactNode } from 'react'

export function MobilePlannerFavoritesDrawer({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-[18px] border-t border-border bg-surface px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-fg">Add courses</div>
            <div className="text-[12px] text-fg-muted">Tap an interested course to add it to your plan</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
