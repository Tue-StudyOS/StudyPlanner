import type { ReactNode } from 'react'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import type { PlannerBlock } from '../utils/plannerFeedback'

export interface PlannerOverflowState {
  title: string
  blocks: PlannerBlock[]
}

export function PlannerOverflowDialog({
  overflow,
  onClose,
  onOpenCourse,
}: {
  overflow: PlannerOverflowState
  onClose: () => void
  onOpenCourse: (courseId: string) => void
}) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/20" onClick={onClose}>
      <div
        className={
          isMobileViewport
            ? 'fixed inset-x-0 bottom-0 rounded-t-[18px] border-t border-border bg-surface px-5 py-5'
            : 'mx-auto mt-20 w-[28rem] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-surface px-5 py-5 shadow-2xl'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[14px] font-semibold text-fg">Additional Overlapping Courses</div>
            <p className="mt-1 text-[12px] text-fg-muted">{overflow.title}</p>
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

        <div className="grid gap-2">
          {overflow.blocks.map((block) => (
            <button
              key={block.blockId}
              type="button"
              onClick={() => onOpenCourse(block.courseId)}
              className="min-w-0 rounded-[10px] border border-border-light bg-surface-hover/35 px-4 py-3 text-left transition-colors hover:border-primary/30"
            >
              <div className="truncate text-[13px] font-semibold text-fg">{block.courseTitle}</div>
              <div className="text-[12px] text-fg-muted">{block.label}</div>
              {block.room ? <div className="text-[12px] text-fg-muted">{block.room}</div> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

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
        className="absolute inset-x-0 bottom-0 flex h-[min(32rem,80dvh)] flex-col overflow-hidden rounded-t-[18px] border-t border-border bg-surface px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
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
