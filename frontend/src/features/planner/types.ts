export interface SemesterPlanSummary {
  semesterLabel: string
  title: string | null
  notes: string | null
  courseCount: number
  createdAtUnix: number
  updatedAtUnix: number
}

export interface SemesterPlan extends SemesterPlanSummary {
  courseIds: string[]
}
