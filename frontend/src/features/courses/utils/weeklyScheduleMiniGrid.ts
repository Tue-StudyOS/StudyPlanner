import {
  DAY_LABELS,
  isSingleDateSlot,
  normalizeWeekday,
  parseTimeRange,
  type PlannerBlock,
} from '../../planner/utils/plannerFeedback.ts'
import { parseDateSortValue } from './examLabels.ts'
import { getScheduleSlotKind, getScheduleSlotTypeLabel, type ScheduleSlotKind } from './scheduleSlotKind.ts'
import type { ScheduleSlot } from '../types.ts'

export const MINI_GRID_START_MINUTES = 8 * 60
export const MINI_GRID_END_MINUTES = 20 * 60
export const MINI_GRID_LABEL_SEPARATOR = ' \u00b7 '

export interface MiniGridBlock extends PlannerBlock {
  /** Concrete date string for one-off exam slots, null for weekly slots. */
  examDate: string | null
}

export function buildMiniGridBlocks(schedule: ScheduleSlot[]): MiniGridBlock[] {
  const parsedBlocks: MiniGridBlock[] = []
  schedule.forEach((slot, index) => {
    const day = normalizeWeekday(slot.day)
    const timeRange = parseTimeRange(slot.time)
    if (!day || !timeRange || timeRange.endMinutes <= MINI_GRID_START_MINUTES || timeRange.startMinutes >= MINI_GRID_END_MINUTES) {
      return
    }
    const slotKind = getScheduleSlotKind(slot)
    const dayLabel = isSingleDateSlot(slot.day) ? slot.day.trim() : DAY_LABELS[day]
    parsedBlocks.push({
      blockId: `${slot.day}-${slot.time}-${index}`,
      slotId: `${index}`,
      courseId: '',
      courseTitle: '',
      day,
      startMinutes: timeRange.startMinutes,
      endMinutes: timeRange.endMinutes,
      label: `${dayLabel} ${slot.time}${slot.room && slot.room !== 'TBA' ? `${MINI_GRID_LABEL_SEPARATOR}${slot.room}` : ''}`,
      room: slot.room,
      slotType: getScheduleSlotTypeLabel(slot),
      slotKind,
      hasOverlap: false,
      isManual: false,
      examDate: slotKind !== 'weekly' ? slot.day.trim() : null,
    })
  })
  return parsedBlocks
}

export function collapseMiniGridBlocksForCalendar(blocks: MiniGridBlock[]): MiniGridBlock[] {
  const visibleBlocks: MiniGridBlock[] = []
  const seenBlockKeys = new Set<string>()

  blocks.forEach((block) => {
    const key = `${block.day}-${block.startMinutes}-${block.endMinutes}-${block.slotKind}`
    if (seenBlockKeys.has(key)) {
      return
    }
    seenBlockKeys.add(key)
    visibleBlocks.push(block)
  })

  return visibleBlocks
}

const EXAM_SLOT_KIND_ORDER: Record<Exclude<ScheduleSlotKind, 'weekly'>, number> = {
  exam: 0,
  resit: 1,
}

/** Weekly slots first; exam slots by date, Klausur before Nachklausur on the same day. */
export function compareMiniGridListEntries(left: MiniGridBlock, right: MiniGridBlock): number {
  const leftIsWeekly = left.slotKind === 'weekly'
  const rightIsWeekly = right.slotKind === 'weekly'
  if (leftIsWeekly !== rightIsWeekly) {
    return leftIsWeekly ? -1 : 1
  }

  if (!leftIsWeekly && !rightIsWeekly) {
    const leftDate = parseDateSortValue(left.examDate ?? '')
    const rightDate = parseDateSortValue(right.examDate ?? '')
    if (leftDate !== null && rightDate !== null && leftDate !== rightDate) {
      return leftDate - rightDate
    }
    if (leftDate !== null && rightDate === null) {
      return -1
    }
    if (leftDate === null && rightDate !== null) {
      return 1
    }
    const leftKindOrder = EXAM_SLOT_KIND_ORDER[left.slotKind as keyof typeof EXAM_SLOT_KIND_ORDER]
    const rightKindOrder = EXAM_SLOT_KIND_ORDER[right.slotKind as keyof typeof EXAM_SLOT_KIND_ORDER]
    if (leftKindOrder !== rightKindOrder) {
      return leftKindOrder - rightKindOrder
    }
  }

  return left.label.localeCompare(right.label)
}
