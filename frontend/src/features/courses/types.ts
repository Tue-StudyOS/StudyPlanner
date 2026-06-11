export type MasterCat = 'TECH' | 'THEO' | 'PRAK' | 'INFO' | 'BASIS'

export type MasterCategoryMeta = Record<MasterCat, { fullLabel: string }>

export interface ScheduleSlot {
  day: string
  time: string
  room: string
  type: string
}

export interface CourseExam {
  type: string
  date: string
  duration: string
}

export interface StudyAreaOption {
  programCode: string | null
  programName: string | null
  studyAreaCode: string | null
  studyAreaName: string | null
  areaType: string | null
  optionStatus: string
  ectsCounted: number | null
  moduleCode: string | null
  moduleTitle: string | null
}

export interface CompletedCourse {
  id: string
  courseId?: string | null
  courseNumber?: string | null
  externalCourseCode?: string | null
  title: string
  ects: number
  masterCat: MasterCat
  studyAreaCode?: string | null
  studyAreaName?: string | null
  availableStudyAreaOptions?: Array<{
    studyAreaCode: string
    studyAreaName: string | null
    groupType: string | null
  }>
  categoryLocked?: boolean
  isGradeCounted?: boolean
  grade: number | null
  semester: string
  source?: string
}

export interface CatalogPeriod {
  periodId: string
  label: string
  courseCount: number
}

export type CourseTermType = 'summer' | 'winter' | 'both' | 'unknown'

export interface CourseExternalLink {
  platform: string
  url: string
  label: string
}

export interface Course {
  id: string
  numericId?: number
  number: string
  title: string
  periodId?: string | null
  periodLabel?: string | null
  lecturer: string
  lecturers?: string[]
  room: string
  types: string[]
  ects: number | null
  sws: number | null
  masterCats: MasterCat[]
  studyAreaOptions?: StudyAreaOption[]
  weekdays: string[]
  schedule: ScheduleSlot[]
  frequency: string
  language: string
  prerequisites: string[]
  description: string
  exams: CourseExam[]
  registrationPeriod?: string
  detailUrl?: string
  detailPageUrl?: string
  organisation?: string
  courseType?: string
  shortComment?: string
  moduleCode?: string | null
  moduleTitle?: string | null
  hasRegulationMapping?: boolean
  offeredPeriods?: string[]
  termType?: CourseTermType
  externalLinks?: CourseExternalLink[]
}
