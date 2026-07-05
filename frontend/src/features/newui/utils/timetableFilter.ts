import type { PlannerBlock } from '../../planner/utils/plannerFeedback.ts'
import { isTutorialLikeSlotType } from '../../planner/utils/plannerSlotSelection.ts'

// Session types that are neither lectures nor tutorials and must stay out of the
// weekly grid.
const OTHER_SESSION_PATTERN = /seminar|praktikum|kolloquium/i

/**
 * The beta timetable shows only lectures and tutorials — never exams/resits
 * (non-weekly slot kinds) or other session types.
 */
export function isLectureOrTutorialBlock(block: Pick<PlannerBlock, 'slotKind' | 'slotType'>): boolean {
  if (block.slotKind !== 'weekly') {
    return false
  }
  if (isTutorialLikeSlotType(block.slotType)) {
    return true
  }
  return !OTHER_SESSION_PATTERN.test(block.slotType)
}
