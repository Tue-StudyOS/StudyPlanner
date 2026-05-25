import type { MasterCat } from '../courses'

export interface CategoryProgress {
  cat: MasterCat
  label: string
  earnedEcts: number
  requiredEcts: number
}

export interface RegulationAreaCourse {
  completedCourseId: string
  courseId: string | null
  courseNumber: string | null
  title: string
  ects: number
  grade: number | null
  semester: string
  masterCat: MasterCat | null
}

export interface RegulationAreaProgress {
  code: string
  name: string
  requiredEcts: number
  earnedEcts: number
  masterCat: MasterCat | null
  rawAreaCodes?: string[]
  courseCount?: number
  isFulfilled?: boolean
  courses?: RegulationAreaCourse[]
}

export interface ThesisProgress {
  label: string
  earnedEcts: number
  requiredEcts: number
}

export interface VisualizationCategoryProgress {
  code: string
  name: string
  description?: string | null
  referenceEcts: number
  earnedEcts: number
  progressRatio: number
  progressPercentage: number
  colorToken?: string | null
}

export interface ProgressSummary {
  totalEcts: number
  requiredEcts: number
  progressPercentage: number
  averageGrade: number | null
}

export interface ProgressSnapshot {
  summary: ProgressSummary
  masterCategoryProgress: Array<{
    cat: MasterCat
    earnedEcts: number
  }>
  regulationProgress: RegulationAreaProgress[]
  visualizationCategories: VisualizationCategoryProgress[]
  profileName: string
  unmappedCompletedCourses: Array<{
    completedCourseId: string
    courseId: string | null
    courseNumber: string | null
    title: string
    ects: number
    semester: string
    masterCat: MasterCat
  }>
}
