import { RemoveIcon } from '../../../shared/components/icons'
import { scheduleSlotBlockClasses } from '../../courses/utils/scheduleSlotKind.ts'
import { DAY_ORDER, type PlannerBlock } from '../utils/plannerFeedback.ts'

export function PlannerWeeklyListView({
  blocks,
  isLoading,
  isPastSemester,
  onOpenCourse,
  onRemoveCourse,
  onRequestAdd,
}: {
  blocks: PlannerBlock[]
  isLoading: boolean
  isPastSemester: boolean
  onOpenCourse: (courseId: string) => void
  onRemoveCourse?: (courseId: string) => void
  onRequestAdd: () => void
}) {
  return (
    <div className="grid min-w-0 gap-5">
      {DAY_ORDER.map((day) => {
        const dayBlocks = blocks.filter((block) => block.day === day)
        return (
          <section key={day} aria-label={day} className="min-w-0">
            <h3 className="mb-2 flex items-center gap-3 text-[13px] font-semibold text-fg">
              {day}
              <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-border-light" />
            </h3>
            {dayBlocks.length === 0 ? (
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-dashed border-border px-3 py-1 text-[12px] text-fg-mid">
                <span>{isLoading ? 'Loading schedule…' : 'No planned sessions'}</span>
                <button
                  type="button"
                  onClick={onRequestAdd}
                  className="min-h-11 rounded-md px-1 font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {isPastSemester ? '+ Add slot' : '+ Add courses'}
                </button>
              </div>
            ) : (
              <div className="grid min-w-0 gap-2">
                {dayBlocks.map((block) => (
                  <div
                    key={block.blockId}
                    className={`flex min-w-0 items-start rounded-lg border ${scheduleSlotBlockClasses(block.slotKind, block.hasOverlap, block.sessionRole)}`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCourse(block.courseId)}
                      aria-label={`Show details for ${block.courseTitle}`}
                      className="min-h-11 min-w-0 flex-1 rounded-lg p-3 text-left transition-colors hover:bg-surface-hover/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="block text-[14px] font-semibold leading-5 [overflow-wrap:anywhere]">
                        {block.courseTitle}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] leading-5 text-fg-mid">
                        <span className="font-medium tabular-nums">{block.label}</span>
                        {block.slotType ? <span className="[overflow-wrap:anywhere]">{block.slotType}</span> : null}
                        {block.isManual && block.slotType !== 'Manual' ? <span>Manual</span> : null}
                      </span>
                      {block.room ? (
                        <span className="mt-0.5 block text-[12px] leading-5 text-fg-mid [overflow-wrap:anywhere]">
                          {block.room}
                        </span>
                      ) : null}
                      {block.hasOverlap ? (
                        <span className="mt-2 inline-block rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                          Time conflict
                        </span>
                      ) : null}
                    </button>
                    {onRemoveCourse && !isPastSemester ? (
                      <button
                        type="button"
                        onClick={() => onRemoveCourse(block.courseId)}
                        aria-label={`Remove ${block.courseTitle} from semester plan`}
                        title="Remove from plan"
                        className="m-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-fg-mid transition-colors hover:bg-surface-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        <RemoveIcon size={14} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
