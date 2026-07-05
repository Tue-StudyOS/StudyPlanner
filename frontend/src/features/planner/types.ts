export interface SemesterPlanSummary {
  semesterLabel: string
  title: string | null
  notes: string | null
  courseCount: number
  createdAtUnix: number
  updatedAtUnix: number
}

export interface ManualPlannerSlot {
  id: string
  courseId: string
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'
  time: string
  room?: string | null
  label?: string | null
}

export interface SemesterPlan extends SemesterPlanSummary {
  courseIds: string[]
  courseAssignments: Record<string, string>
  hiddenSlotIds: string[]
  manualSlots?: ManualPlannerSlot[]
}
