import {
  DAY_LABELS,
  normalizeWeekday,
  parseTimeRange,
  type PlannerBlock,
} from '../../planner/utils/plannerFeedback.ts'
import { getScheduleSlotKind, type ScheduleSlotKind } from './scheduleSlotKind.ts'
import type { ScheduleSlot } from '../types.ts'

export const MINI_GRID_START_MINUTES = 8 * 60
export const MINI_GRID_END_MINUTES = 20 * 60
export const MINI_GRID_LABEL_SEPARATOR = ' \u00b7 '

export interface MiniGridBlock extends PlannerBlock {
  kind: ScheduleSlotKind
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
    const kind = getScheduleSlotKind(slot)
    const isExam = kind !== 'weekly'
    const dayLabel = isExam ? slot.day.trim() : DAY_LABELS[day]
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
      slotType: slot.type,
      hasOverlap: false,
      kind,
      examDate: isExam ? slot.day.trim() : null,
    })
  })
  return parsedBlocks
}

export function collapseMiniGridBlocksForCalendar(blocks: MiniGridBlock[]): MiniGridBlock[] {
  const visibleBlocks: MiniGridBlock[] = []
  const seenBlockKeys = new Set<string>()

  blocks.forEach((block) => {
    const key = `${block.day}-${block.startMinutes}-${block.endMinutes}-${block.kind}`
    if (seenBlockKeys.has(key)) {
      return
    }
    seenBlockKeys.add(key)
    visibleBlocks.push(block)
  })

  return visibleBlocks
}
