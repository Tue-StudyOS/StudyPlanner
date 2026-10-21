import { RemoveIcon } from '../../../shared/components/icons'
import { scheduleSlotBlockClasses, scheduleSlotListLabelClasses } from '../../courses/utils/scheduleSlotKind.ts'
import { buildBlockLeft, buildBlockWidth, buildDayLayout, PIXELS_PER_HOUR } from '../utils/plannerDayLayout.ts'
import { calendarTimeBounds, type CalendarBlock, type CalendarDateItem } from '../utils/plannerCalendar.ts'
import { addCalendarDays, CALENDAR_DAYS, calendarWeekday, formatCalendarDate } from '../utils/plannerDates.ts'
import { getBlockTitleLineClamp } from '../utils/plannerBlockText.ts'

interface Props {
  weekStart: string
  blocks: CalendarBlock[]
  dateItems: CalendarDateItem[]
  isMobilePlanner: boolean
  onOpenCourse: (id: string) => void
  onRemoveCourse?: (id: string) => void
  onRequestAdd: () => void
}

export function PlannerWeekView({ weekStart, blocks, dateItems, isMobilePlanner, onOpenCourse, onRemoveCourse, onRequestAdd }: Props) {
  const weekend = [...blocks, ...dateItems].some((item) => ['Saturday', 'Sunday'].includes(calendarWeekday(item.date)))
  const days = CALENDAR_DAYS.slice(0, weekend ? 7 : 5)
  const { startHour, endHour } = calendarTimeBounds(blocks)
  // Leave room for minimum-height late appointments rather than clipping their controls.
  const totalHeight = (endHour - startHour) * PIXELS_PER_HOUR + 44
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index)
  const gapRem = isMobilePlanner ? 0.125 : 0.5

  function renderDateItems(date: string) {
    return dateItems.filter((item) => item.date === date).map((item) => (
      <div key={item.id} data-calendar-date-only={item.id} className="flex min-w-0 items-start gap-1 rounded border border-amber-500/40 bg-amber-500/10 p-0.5 min-[769px]:p-2">
        <button type="button" onClick={() => onOpenCourse(item.courseId)} className="min-w-0 flex-1 text-left text-[clamp(9px,2.8cqw,10px)] leading-3 text-fg [overflow-wrap:anywhere] min-[769px]:text-xs" aria-label={`Show details for ${item.courseTitle}`} title={`${item.courseTitle} · ${item.label}`}>
          <strong>{item.courseTitle}</strong><span className="block text-fg-mid">{item.label}</span>
        </button>
        {onRemoveCourse && !isMobilePlanner ? <button type="button" className="shrink-0 p-1 text-fg-muted" onClick={() => onRemoveCourse(item.courseId)} aria-label={`Remove ${item.courseTitle} from semester plan`}><RemoveIcon size={12} /></button> : null}
      </div>
    ))
  }

  return (
    <div data-tour="planner-grid" role="region" aria-label="Weekly calendar" className="min-w-0 w-full max-w-full [container-type:inline-size]">
      <div className="grid min-w-0 w-full gap-[clamp(2px,0.8cqw,8px)] py-2" style={{ gridTemplateColumns: `clamp(20px,6cqw,42px) repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((day, index) => {
          const date = addCalendarDays(weekStart, index)
          return <div key={day} className="min-w-0 text-center text-[clamp(8px,2.8cqw,12px)] font-semibold text-fg-mid" data-calendar-date={date} title={formatCalendarDate(date, true)}>
            {day.slice(0, 3)}<span className="block tabular-nums">{date.slice(8)}.{date.slice(5, 7)}</span>
          </div>
        })}
        <div aria-hidden="true" />
        {days.map((day, index) => <div key={day} className="min-w-0 space-y-1">{renderDateItems(addCalendarDays(weekStart, index))}</div>)}
        <div className="relative">
          {hours.map((hour, index) => <div key={hour} className="absolute right-0 -translate-y-1/2 text-[clamp(8px,2.25cqw,12px)] tabular-nums text-fg-mid" style={{ top: index * PIXELS_PER_HOUR }}>
            {String(hour).padStart(2, '0')}<span className="hidden min-[769px]:inline">:00</span>
          </div>)}
        </div>
        {days.map((day, index) => <div key={day} data-calendar-day={addCalendarDays(weekStart, index)} onClick={isMobilePlanner ? (event) => {
          if (event.target === event.currentTarget) onRequestAdd()
        } : undefined} className="relative min-w-0 rounded-lg border border-border-light bg-surface-hover/25" style={{ height: totalHeight }}>
          {hours.map((hour, hourIndex) => <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-border-light/70" style={{ top: hourIndex * PIXELS_PER_HOUR }} />)}
          {buildDayLayout(blocks.filter((block) => block.day === day)).visibleBlocks.map((block) => {
            const height = Math.max((block.endMinutes - block.startMinutes) / 60 * PIXELS_PER_HOUR, 44)
            return <div key={block.blockId} data-calendar-event={block.blockId} className="absolute min-w-0" style={{ top: (block.startMinutes - startHour * 60) / 60 * PIXELS_PER_HOUR, height, left: buildBlockLeft(block.columnIndex, block.visibleColumnCount, gapRem), width: buildBlockWidth(block.visibleColumnCount, gapRem) }}>
              <button type="button" onClick={() => onOpenCourse(block.courseId)} aria-label={`Show details for ${block.courseTitle}`} title={`${block.courseTitle} · ${block.label} · ${block.room}`} className={`flex h-full w-full flex-col items-stretch overflow-hidden rounded border px-0.5 py-0.5 text-left shadow-sm focus:ring-1 focus:ring-fg-muted min-[769px]:rounded-lg min-[769px]:px-1 min-[769px]:py-1 ${scheduleSlotBlockClasses(block.slotKind, block.hasOverlap, block.sessionRole)}`}>
                <div className="text-[clamp(9px,2.8cqw,10px)] font-semibold leading-3 [overflow-wrap:anywhere] min-[769px]:text-xs min-[769px]:leading-[15px]" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: getBlockTitleLineClamp(height, isMobilePlanner, !isMobilePlanner && Boolean(block.slotType)), overflow: 'hidden' }}>{block.courseTitle}</div>
                {!isMobilePlanner ? <div className={`truncate text-[10px] ${scheduleSlotListLabelClasses(block.slotKind, block.sessionRole)}`}>{block.slotType}</div> : null}
              </button>
              {onRemoveCourse && !isMobilePlanner ? <button type="button" onClick={() => onRemoveCourse(block.courseId)} aria-label={`Remove ${block.courseTitle} from semester plan`} className="absolute right-0.5 top-0.5 rounded bg-surface p-0.5 text-fg-muted"><RemoveIcon size={10} /></button> : null}
            </div>
          })}
        </div>)}
      </div>
    </div>
  )
}
