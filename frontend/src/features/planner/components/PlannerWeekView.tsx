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
  selectedDay: number
  onSelectDay: (day: number) => void
  onOpenCourse: (id: string) => void
  onRemoveCourse?: (id: string) => void
  onRequestAdd: () => void
}

export function PlannerWeekView({ weekStart, blocks, dateItems, isMobilePlanner, selectedDay, onSelectDay, onOpenCourse, onRemoveCourse, onRequestAdd }: Props) {
  const weekend = [...blocks, ...dateItems].some((item) => ['Saturday', 'Sunday'].includes(calendarWeekday(item.date)))
  const days = CALENDAR_DAYS.slice(0, weekend ? 7 : 5)
  const activeDay = Math.min(selectedDay, days.length - 1)
  const { startHour, endHour } = calendarTimeBounds(blocks)
  // Leave room for minimum-height late appointments rather than clipping their controls.
  const totalHeight = (endHour - startHour) * PIXELS_PER_HOUR + 44
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index)

  function renderDateItems(date: string) {
    return dateItems.filter((item) => item.date === date).map((item) => (
      <div key={item.id} data-calendar-date-only={item.id} className="flex min-w-0 items-start gap-1 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
        <button type="button" onClick={() => onOpenCourse(item.courseId)} className="min-w-0 flex-1 break-words text-left text-fg" aria-label={`Show details for ${item.courseTitle}`}>
          <strong>{item.courseTitle}</strong><span className="block text-fg-muted">{item.label}</span>
        </button>
        {onRemoveCourse ? <button type="button" className="shrink-0 p-1 text-fg-muted" onClick={() => onRemoveCourse(item.courseId)} aria-label={`Remove ${item.courseTitle} from semester plan`}><RemoveIcon size={12} /></button> : null}
      </div>
    ))
  }

  if (isMobilePlanner) {
    const date = addCalendarDays(weekStart, activeDay)
    const dayBlocks = blocks.filter((block) => block.date === date).sort((a, b) => a.startMinutes - b.startMinutes)
    return (
      <div data-tour="planner-grid" className="min-w-0 max-w-full">
        <div className="mb-3 flex flex-wrap gap-1" aria-label="Days of viewed week">
          {days.map((day, index) => <button key={day} type="button" data-calendar-date={addCalendarDays(weekStart, index)} aria-pressed={activeDay === index} aria-label={formatCalendarDate(addCalendarDays(weekStart, index), true)} onClick={() => onSelectDay(index)} className={`min-h-11 rounded border px-2 py-1 text-xs ${activeDay === index ? 'border-primary bg-primary/10 text-primary' : 'border-border text-fg-muted'}`}>
            {day.slice(0, 3)}<span className="block tabular-nums">{addCalendarDays(weekStart, index).slice(8)}</span>
          </button>)}
        </div>
        <h3 className="mb-2 text-sm font-semibold text-fg">{formatCalendarDate(date, true)}</h3>
        <div className="space-y-2" data-calendar-day={date}>
          {renderDateItems(date)}
          {dayBlocks.map((block) => <div key={block.blockId} data-calendar-event={block.blockId} className={`flex min-w-0 items-start gap-2 rounded-lg border p-3 ${scheduleSlotBlockClasses(block.slotKind, block.hasOverlap, block.sessionRole)}`}>
            <button type="button" onClick={() => onOpenCourse(block.courseId)} className="min-w-0 flex-1 break-words text-left" aria-label={`Show details for ${block.courseTitle}`}>
              <span className="block text-xs tabular-nums">{block.label}</span>
              <strong className="block text-sm">{block.courseTitle}</strong>
              <span className={`block text-xs ${scheduleSlotListLabelClasses(block.slotKind, block.sessionRole)}`}>{[block.slotType, block.room].filter(Boolean).join(' · ')}</span>
            </button>
            {onRemoveCourse ? <button type="button" onClick={() => onRemoveCourse(block.courseId)} className="shrink-0 p-1 text-fg-muted" aria-label={`Remove ${block.courseTitle} from semester plan`}><RemoveIcon size={14} /></button> : null}
          </div>)}
          {!dayBlocks.length && !dateItems.some((item) => item.date === date) ? <p className="rounded-lg border border-border-light p-4 text-sm text-fg-muted">No appointments on this date.</p> : null}
          <button type="button" onClick={onRequestAdd} className="rounded border border-dashed border-border px-3 py-2 text-xs text-primary">+ Add course / slot</button>
        </div>
      </div>
    )
  }

  return (
    <div data-tour="planner-grid" className="grid min-w-0 max-w-full gap-2" style={{ gridTemplateColumns: `42px repeat(${days.length}, minmax(0, 1fr))` }}>
      <div />
      {days.map((day, index) => <div key={day} className="min-w-0 text-center text-xs font-semibold text-fg-muted" data-calendar-date={addCalendarDays(weekStart, index)}>{day.slice(0, 3)}<span className="block">{formatCalendarDate(addCalendarDays(weekStart, index))}</span></div>)}
      <div className="text-[10px] text-fg-muted">Date only</div>
      {days.map((day, index) => <div key={day} className="min-w-0 space-y-1">{renderDateItems(addCalendarDays(weekStart, index))}</div>)}
      <div className="relative">
        {hours.map((hour, index) => <div key={hour} className="absolute right-0 -translate-y-1/2 text-[11px] tabular-nums text-fg-muted" style={{ top: index * PIXELS_PER_HOUR }}>{String(hour).padStart(2, '0')}:00</div>)}
      </div>
      {days.map((day, index) => <div key={day} data-calendar-day={addCalendarDays(weekStart, index)} className="relative min-w-0 rounded-lg border border-border-light bg-surface-hover/25" style={{ height: totalHeight }}>
        {hours.map((hour, hourIndex) => <div key={hour} className="pointer-events-none absolute inset-x-0 border-t border-border-light/70" style={{ top: hourIndex * PIXELS_PER_HOUR }} />)}
        {buildDayLayout(blocks.filter((block) => block.day === day)).visibleBlocks.map((block) => {
          const height = Math.max((block.endMinutes - block.startMinutes) / 60 * PIXELS_PER_HOUR, 44)
          return <div key={block.blockId} data-calendar-event={block.blockId} className="absolute min-w-0" style={{ top: (block.startMinutes - startHour * 60) / 60 * PIXELS_PER_HOUR, height, left: buildBlockLeft(block.columnIndex, block.visibleColumnCount), width: buildBlockWidth(block.visibleColumnCount) }}>
            <button type="button" onClick={() => onOpenCourse(block.courseId)} aria-label={`Show details for ${block.courseTitle}`} title={`${block.courseTitle} · ${block.label} · ${block.room}`} className={`h-full w-full overflow-hidden rounded-lg border px-1 py-1 text-left shadow-sm focus:ring-1 focus:ring-fg-muted ${scheduleSlotBlockClasses(block.slotKind, block.hasOverlap, block.sessionRole)}`}>
              <div className="text-[10px] tabular-nums">{block.label}</div>
              <div className="break-words text-xs font-semibold" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: getBlockTitleLineClamp(height, false, Boolean(block.slotType)), overflow: 'hidden' }}>{block.courseTitle}</div>
              <div className={`truncate text-[10px] ${scheduleSlotListLabelClasses(block.slotKind, block.sessionRole)}`}>{block.slotType}</div>
            </button>
            {onRemoveCourse ? <button type="button" onClick={() => onRemoveCourse(block.courseId)} aria-label={`Remove ${block.courseTitle} from semester plan`} className="absolute right-0.5 top-0.5 rounded bg-surface p-0.5 text-fg-muted"><RemoveIcon size={10} /></button> : null}
          </div>
        })}
      </div>)}
    </div>
  )
}
