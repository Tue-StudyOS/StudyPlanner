import type { ReactNode } from 'react'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { DAY_LABELS, type PlannerBlock } from '../utils/plannerFeedback'
import { TrashIcon } from '../../../shared/components/icons'

export interface PlannerOverflowState {
  title: string
  blocks: PlannerBlock[]
}

export function PlannerBlockDetailDialog({
  block,
  isEditing,
  onClose,
  onRemoveSlot,
}: {
  block: PlannerBlock
  isEditing: boolean
  onClose: () => void
  onRemoveSlot: (slotId: string) => void
}) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/25" onClick={onClose}>
      <div
        className={
          isMobileViewport
            ? 'fixed inset-x-0 bottom-0 rounded-t-[18px] border-t border-border bg-surface px-5 py-5'
            : 'mx-auto mt-20 w-[26rem] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-surface px-5 py-5 shadow-2xl'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="break-words text-[15px] font-semibold text-fg">{block.courseTitle}</div>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {DAY_LABELS[block.day]} · {block.label}
            </p>
            {block.room ? (
              <p className="mt-0.5 text-[12.5px] text-fg-muted">Room: {block.room}</p>
            ) : null}
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

        {isEditing ? (
          <button
            type="button"
            onClick={() => onRemoveSlot(block.slotId)}
            className="w-full rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            Remove this time slot
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function PlannerOverflowDialog({
  overflow,
  isEditing,
  onClose,
  onRemoveSlot,
}: {
  overflow: PlannerOverflowState
  isEditing: boolean
  onClose: () => void
  onRemoveSlot: (slotId: string) => void
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
            <div
              key={block.blockId}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-border-light bg-surface-hover/35 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-fg">{block.courseTitle}</div>
                <div className="text-[12px] text-fg-muted">{block.label}</div>
                <div className="text-[12px] text-fg-muted">{block.room}</div>
              </div>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => onRemoveSlot(block.slotId)}
                  aria-label={`Remove ${block.courseTitle} from this time slot`}
                  className="rounded-md border border-border p-2 text-fg transition-colors hover:bg-surface-hover"
                >
                  <TrashIcon size={14} />
                </button>
              ) : null}
            </div>
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
        className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[18px] border-t border-border bg-surface px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-fg">Import Courses</div>
            <div className="text-[12px] text-fg-muted">Add favorite courses to this semester plan</div>
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
        {children}
      </div>
    </div>
  )
}
