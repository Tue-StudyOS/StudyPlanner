export type MasterCat = 'TECH' | 'THEO' | 'PRAK' | 'INFO' | 'BASIS'

export type MasterCategoryMeta = Record<MasterCat, { fullLabel: string }>

export interface ScheduleSlot {
  day: string
  time: string
  room: string
  type: string
  /** Catalog row id of the parallel group this slot belongs to (unstable across re-imports). */
  parallelGroupId?: number | null
  /** 1-based position of the parallel group within the course (stable across re-imports). */
  groupPosition?: number | null
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

export interface CourseTextLink {
  label: string
  url: string
}

export interface CourseContentSection {
  position?: number
  title: string
  text: string
  links?: CourseTextLink[]
}

export interface CourseParallelGroup {
  /** 1-based position within the course; the stable key for a user's group choice. */
  position: number
  parallelGroupId?: number | null
  title: string | null
  /** Derived teaching role (Vorlesung, Übung, Klausur, ...). */
  role: string | null
  maxParticipants: number | null
  minParticipants: number | null
  schedule: ScheduleSlot[]
}

export interface CourseParticipantLimit {
  parallelGroupId: string
  title: string | null
  groupType: string | null
  minParticipants: number | null
  maxParticipants: number | null
}

export interface CourseIliasMetadata {
  refId: string
  title: string
  url: string
  description?: string | null
  availability?: string | null
  registration?: string | null
  deadline?: string | null
  maxParticipants?: number | null
  instructors?: string[]
  tags?: string[]
  match?: {
    confidence: number
    type: string
    notes: string
  }
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
  descriptionLinks?: CourseTextLink[]
  contents?: CourseContentSection[]
  contentsLinks?: CourseTextLink[]
  contentSections?: CourseContentSection[]
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
  participantLimits?: CourseParticipantLimit[]
  parallelGroups?: CourseParallelGroup[]
  illias?: CourseIliasMetadata | null
}
