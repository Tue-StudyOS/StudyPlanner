import type { Course, ScheduleSlot } from '../../courses/types.ts'

export function getScheduleSlotId(
  course: Pick<Course, 'id'>,
  slot: ScheduleSlot,
  index: number,
): string {
  const appointmentId = slot.id?.trim()
  return appointmentId
    ? `${course.id}:appointment:${appointmentId}`
    : `${course.id}:${index}`
}

export function getScheduleSlotLegacyIds(
  course: Pick<Course, 'id'>,
  slot: ScheduleSlot,
  index: number,
): string[] {
  const ids = [`${course.id}:${index}`]
  const sourceCourseId = slot.sourceCourseId?.trim()
  if (sourceCourseId && typeof slot.sourceIndex === 'number') {
    ids.push(`${sourceCourseId}:${slot.sourceIndex}`)
  }
  return [...new Set(ids)]
}

export function isScheduleSlotHidden(
  hiddenSlotIds: readonly string[],
  course: Pick<Course, 'id'>,
  slot: ScheduleSlot,
  index: number,
): boolean {
  const candidates = [
    getScheduleSlotId(course, slot, index),
    ...getScheduleSlotLegacyIds(course, slot, index),
  ]
  return candidates.some((candidate) => hiddenSlotIds.includes(candidate))
}

export function isStoredSlotIdForCourse(
  slotId: string,
  course: Pick<Course, 'id' | 'sourceCourseIds'>,
): boolean {
  const courseIds = new Set([course.id, ...(course.sourceCourseIds ?? [])])
  return [...courseIds].some((courseId) => slotId.startsWith(`${courseId}:`))
}
