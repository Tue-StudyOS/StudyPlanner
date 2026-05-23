export type MasterCat = 'TECH' | 'THEO' | 'PRAK' | 'INFO' | 'FOKUS' | 'BASIS'

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
  title: string
  ects: number
  masterCat: MasterCat
  grade: number
  semester: string
}

export interface Course {
  id: string
  numericId?: number
  number: string
  title: string
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
}
