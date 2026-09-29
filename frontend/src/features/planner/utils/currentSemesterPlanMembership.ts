import type { SemesterPlan } from '../types.ts'

export type SemesterPlanWriteFields = Pick<
  SemesterPlan,
  'title' | 'notes' | 'courseIds' | 'hiddenSlotIds' | 'manualSlots' | 'courseAssignments'
>

export function dropCourseFromPlanFields(
  plan: SemesterPlanWriteFields,
  courseId: string,
): SemesterPlanWriteFields {
  return {
    title: plan.title,
    notes: plan.notes,
    courseIds: plan.courseIds.filter((plannedCourseId) => plannedCourseId !== courseId),
    hiddenSlotIds: plan.hiddenSlotIds.filter((slotId) => !slotId.startsWith(`${courseId}:`)),
    manualSlots: (plan.manualSlots ?? []).filter((slot) => slot.courseId !== courseId),
    courseAssignments: Object.fromEntries(
      Object.entries(plan.courseAssignments).filter(([assignedCourseId]) => assignedCourseId !== courseId),
    ),
  }
}
