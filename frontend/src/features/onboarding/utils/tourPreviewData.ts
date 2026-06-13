import type { CompletedCourse, Course, CourseTermType, MasterCat, ScheduleSlot } from '../../courses/types.ts'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation.ts'
import { studyAreaCodeToMasterCat } from '../../../shared/utils/regulation.ts'
import type { TranscriptImportCandidate } from '../../transcript/types.ts'
import type { TourSampleCardVariant } from '../types.ts'

interface TourCourseInput {
  id: string
  number: string
  title: string
  lecturer: string
  types: string[]
  ects: number
  masterCats: MasterCat[]
  termType: CourseTermType
  schedule?: ScheduleSlot[]
  description: string
  studyAreaCode?: string
  studyAreaName?: string
  studyProgramCode?: string | null
}

interface TourPlannerPreview {
  ruleGroups: RegulationRuleGroup[]
  plannedCourses: Course[]
  favoriteCourses: Course[]
  completedCourses: CompletedCourse[]
  assignments: Record<string, string>
}

const CATALOG_STEP_TO_VARIANT: Record<string, TourSampleCardVariant> = {
  'catalog-card': 'confirmed',
  'catalog-card-likely': 'likely',
  'catalog-card-unknown': 'unknown',
}

export const TOUR_CATALOG_SAMPLE_VARIANTS: TourSampleCardVariant[] = ['confirmed', 'likely', 'unknown']

export function getTourCatalogSampleTarget(variant: TourSampleCardVariant): string {
  return `catalog-sample-${variant}`
}

export function getCatalogTourSampleVariant(stepId: string | null): TourSampleCardVariant | null {
  return stepId ? CATALOG_STEP_TO_VARIANT[stepId] ?? null : null
}

export function isCatalogCardTourStep(stepId: string | null): boolean {
  return getCatalogTourSampleVariant(stepId) !== null
}

export function isPlannerTourStep(stepId: string | null): boolean {
  return Boolean(stepId && stepId.startsWith('planner-'))
}

const PLANNER_INSERTED_STEP_IDS = new Set(['planner-progress', 'planner-export'])

// Steps shown after the "interested" step, where the highlighted saved course
// should already appear inserted into the planned week.
export function isPlannerInsertedTourStep(stepId: string | null): boolean {
  return stepId !== null && PLANNER_INSERTED_STEP_IDS.has(stepId)
}

export function isTranscriptTourStep(stepId: string | null): boolean {
  return stepId === 'transcript'
}

function createTourCourse(input: TourCourseInput): Course {
  const schedule = input.schedule ?? []
  const studyAreaOptions = input.studyAreaCode
    ? [
        {
          programCode: input.studyProgramCode ?? null,
          programName: null,
          studyAreaCode: input.studyAreaCode,
          studyAreaName: input.studyAreaName ?? input.studyAreaCode,
          areaType: null,
          optionStatus: 'tour_preview',
          ectsCounted: input.ects,
          moduleCode: null,
          moduleTitle: null,
        },
      ]
    : undefined

  return {
    id: input.id,
    number: input.number,
    title: input.title,
    lecturer: input.lecturer,
    lecturers: [input.lecturer],
    room: schedule[0]?.room ?? 'TBA',
    types: input.types,
    ects: input.ects,
    sws: 2,
    masterCats: input.masterCats,
    studyAreaOptions,
    weekdays: schedule.map((slot) => slot.day),
    schedule,
    frequency: 'Every mock semester',
    language: 'English',
    prerequisites: [],
    description: input.description,
    exams: [],
    registrationPeriod: 'Tour preview only',
    organisation: 'Department of Playful Computer Science',
    courseType: input.types.join(' + '),
    shortComment: 'Tour preview data',
    moduleCode: null,
    moduleTitle: null,
    hasRegulationMapping: true,
    offeredPeriods: [],
    termType: input.termType,
    externalLinks: [],
  }
}

function getFallbackMasterCat(areaCode: string, fallback: MasterCat): MasterCat {
  return studyAreaCodeToMasterCat(areaCode) ?? fallback
}

function getVisibleTourRuleGroups(ruleGroups: RegulationRuleGroup[]): RegulationRuleGroup[] {
  const visibleRuleGroups = ruleGroups.filter((ruleGroup) => ruleGroup.code.trim().toUpperCase() !== 'THESIS')
  return visibleRuleGroups.length > 0 ? visibleRuleGroups : TOUR_PLANNER_RULE_GROUPS
}

function withTourStudyArea(
  course: Course,
  area: RegulationRuleGroup,
  studyProgramCode: string | null,
  fallbackMasterCat: MasterCat,
): Course {
  const masterCat = getFallbackMasterCat(area.code, fallbackMasterCat)
  const ects = course.ects ?? 0
  return {
    ...course,
    masterCats: [masterCat],
    studyAreaOptions: [
      {
        programCode: studyProgramCode,
        programName: null,
        studyAreaCode: area.code,
        studyAreaName: area.name,
        areaType: area.groupType,
        optionStatus: 'tour_preview',
        ectsCounted: ects,
        moduleCode: null,
        moduleTitle: null,
      },
    ],
  }
}

export const TOUR_SAMPLE_COURSES: Record<TourSampleCardVariant, Course> = {
  confirmed: createTourCourse({
    id: 'tour-sample-confirmed',
    number: 'TOUR101',
    title: 'Distributed Systems for Office Coffee Machines',
    lecturer: 'Max Mustermann',
    types: ['Lecture'],
    ects: 6,
    masterCats: ['TECH', 'PRAK'],
    termType: 'summer',
    schedule: [
      { day: 'Monday', time: '10:00 - 12:00', room: 'Caffeine Lab 1', type: 'Lecture' },
    ],
    description: 'A tour-only lecture about consensus, queues, and why the coffee machine is always a single point of failure.',
  }),
  likely: createTourCourse({
    id: 'tour-sample-likely',
    number: 'TOUR202',
    title: 'Efficient Procrastination',
    lecturer: 'Erika Musterfrau',
    types: ['Lecture', 'Exercise'],
    ects: 6,
    masterCats: ['THEO', 'TECH'],
    termType: 'winter',
    schedule: [
      { day: 'Wednesday', time: '14:00 - 16:00', room: 'Room Eventually', type: 'Lecture' },
    ],
    description: 'A tour-only course about turning todo lists into intermediate representation and optimizing them away.',
  }),
  unknown: createTourCourse({
    id: 'tour-sample-unknown',
    number: 'TOUR404',
    title: 'Static Analysis of My Own Bad Code',
    lecturer: 'Emre Sözbilir',
    types: ['Seminar'],
    ects: 3,
    masterCats: ['INFO', 'PRAK'],
    termType: 'winter',
    description: 'A tour-only seminar that is intentionally not offered: every warning points back at the lecturer.',
  }),
}

export interface TourCatalogOpenArea {
  code: string
  name: string
  earnedEcts: number
  requiredEcts: number
}

// Fallback chips for the catalog "still open areas" header during the tour,
// so the opening catalog step always has something to highlight even when the
// signed-in user has no real progress data yet.
export const TOUR_CATALOG_OPEN_AREAS: TourCatalogOpenArea[] = [
  { code: 'TECH', name: 'Technical Computer Science', earnedEcts: 6, requiredEcts: 18 },
  { code: 'INFO', name: 'Computer Science', earnedEcts: 0, requiredEcts: 18 },
  { code: 'PRAK', name: 'Practical Computer Science', earnedEcts: 3, requiredEcts: 18 },
  { code: 'THEO', name: 'Theoretical Computer Science', earnedEcts: 0, requiredEcts: 18 },
]

export const TOUR_PLANNER_RULE_GROUPS: RegulationRuleGroup[] = [
  { code: 'TECH', name: 'Technical Computer Science', groupType: 'elective_area', requiredEcts: 18, sortOrder: 1 },
  { code: 'INFO', name: 'Computer Science', groupType: 'elective_area', requiredEcts: 18, sortOrder: 2 },
  { code: 'PRAK', name: 'Practical Computer Science', groupType: 'elective_area', requiredEcts: 18, sortOrder: 3 },
  { code: 'THEO', name: 'Theoretical Computer Science', groupType: 'elective_area', requiredEcts: 18, sortOrder: 4 },
  { code: 'UEBK', name: 'Interdisciplinary Skills', groupType: 'elective_area', requiredEcts: 6, sortOrder: 5 },
]

const TOUR_PLANNER_BASE_PLANNED_COURSES: Course[] = [
  TOUR_SAMPLE_COURSES.confirmed,
  createTourCourse({
    id: 'tour-planner-overlap',
    number: 'TOUR303',
    title: 'Race Conditions in Group Chat Planning',
    lecturer: 'Nora Niemand',
    types: ['Exercise'],
    ects: 3,
    masterCats: ['PRAK'],
    termType: 'summer',
    schedule: [
      { day: 'Tuesday', time: '14:00 - 16:00', room: 'Thread Pool B', type: 'Exercise' },
    ],
    description: 'A tour-only exercise where every participant edits the same plan at the same time.',
  }),
  createTourCourse({
    id: 'tour-planner-unscheduled',
    number: 'TOUR304',
    title: 'Requirements Engineering for Rubber Ducks',
    lecturer: 'Alex Beispiel',
    types: ['Seminar'],
    ects: 3,
    masterCats: ['INFO'],
    termType: 'both',
    description: 'A tour-only seminar with no weekly time yet, because the duck has not confirmed office hours.',
  }),
]

// Highlighted on the planner "interested" step and then shown inserted into the
// planned week from the progress step onward, to demonstrate adding a saved
// course. The "A…" title keeps it first in the alphabetically sorted list.
const TOUR_PLANNER_INTERESTED_INSERT_COURSE: Course = createTourCourse({
  id: 'tour-planner-wednesday',
  number: 'TOUR306',
  title: 'Algorithms Before Coffee',
  lecturer: 'Theo Tagwerk',
  types: ['Lecture'],
  ects: 6,
  masterCats: ['INFO', 'TECH'],
  termType: 'summer',
  schedule: [
    { day: 'Wednesday', time: '08:00 - 10:00', room: 'Lecture Hall Dawn', type: 'Lecture' },
  ],
  description: 'A tour-only early lecture used to show how a saved course slots into your week.',
})

// The interested list shows saved courses still to add, so it intentionally
// omits the already-planned "confirmed" sample. This also keeps the highlighted
// first card (the Wednesday insert course) consistent on desktop, where planned
// courses would otherwise sort to the top of the list.
const TOUR_PLANNER_BASE_FAVORITE_COURSES: Course[] = [
  TOUR_PLANNER_INTERESTED_INSERT_COURSE,
  TOUR_SAMPLE_COURSES.likely,
  createTourCourse({
    id: 'tour-planner-favorite',
    number: 'TOUR305',
    title: 'Cache Invalidation and Other Small Lies',
    lecturer: 'Kim Konto',
    types: ['Lecture', 'Exercise'],
    ects: 6,
    masterCats: ['TECH', 'INFO'],
    termType: 'winter',
    schedule: [
      { day: 'Thursday', time: '16:00 - 18:00', room: 'Stale Data Hall', type: 'Lecture' },
    ],
    description: 'A tour-only candidate for the interested list: the two hard things are naming, invalidation, and counting.',
  }),
]

export const TOUR_PLANNER_PLANNED_COURSES: Course[] = TOUR_PLANNER_BASE_PLANNED_COURSES
export const TOUR_PLANNER_FAVORITE_COURSES: Course[] = TOUR_PLANNER_BASE_FAVORITE_COURSES

export const TOUR_PLANNER_ASSIGNMENTS: Record<string, string> = {
  'tour-sample-confirmed': 'TECH',
  'tour-planner-overlap': 'PRAK',
  'tour-planner-unscheduled': 'INFO',
}

export const TOUR_PLANNER_COMPLETED_COURSES: CompletedCourse[] = [
  {
    id: 'tour-completed-1',
    courseId: null,
    courseNumber: 'DONE101',
    externalCourseCode: null,
    title: 'Introduction to Finished Things',
    ects: 6,
    masterCat: 'TECH',
    studyAreaCode: 'TECH',
    studyAreaName: 'Technical Computer Science',
    availableStudyAreaOptions: [],
    categoryLocked: true,
    isGradeCounted: true,
    grade: 1.7,
    semester: 'Previous semester',
    source: 'tour_preview',
  },
]

export function buildTourPlannerPreview(
  regulationRuleGroups: RegulationRuleGroup[],
  studyProgramCode: string | null,
  options: { insertInterestedCourse?: boolean } = {},
): TourPlannerPreview {
  const ruleGroups = getVisibleTourRuleGroups(regulationRuleGroups)
  const basePlannedCourses = options.insertInterestedCourse
    ? [...TOUR_PLANNER_BASE_PLANNED_COURSES, TOUR_PLANNER_INTERESTED_INSERT_COURSE]
    : TOUR_PLANNER_BASE_PLANNED_COURSES
  const plannedCourses = basePlannedCourses.map((course, index) =>
    withTourStudyArea(course, ruleGroups[index % ruleGroups.length], studyProgramCode, course.masterCats[0] ?? 'INFO'),
  )
  const plannedAreaByCourseId = new Map(
    plannedCourses.map((course, index) => [course.id, ruleGroups[index % ruleGroups.length]]),
  )
  const favoriteCourses = TOUR_PLANNER_BASE_FAVORITE_COURSES.map((course, index) =>
    withTourStudyArea(
      course,
      plannedAreaByCourseId.get(course.id) ?? ruleGroups[(index + 1) % ruleGroups.length],
      studyProgramCode,
      course.masterCats[0] ?? 'INFO',
    ),
  )
  const assignments = Object.fromEntries(
    plannedCourses.map((course, index) => [course.id, ruleGroups[index % ruleGroups.length].code]),
  )
  const completedArea = ruleGroups[0]
  const completedMasterCat = getFallbackMasterCat(completedArea.code, 'TECH')
  const completedCourses: CompletedCourse[] = [
    {
      id: 'tour-completed-1',
      courseId: null,
      courseNumber: 'DONE101',
      externalCourseCode: null,
      title: 'Introduction to Finished Things',
      ects: 6,
      masterCat: completedMasterCat,
      studyAreaCode: completedArea.code,
      studyAreaName: completedArea.name,
      availableStudyAreaOptions: [],
      categoryLocked: true,
      isGradeCounted: true,
      grade: 1.7,
      semester: 'Previous semester',
      source: 'tour_preview',
    },
  ]

  return { ruleGroups, plannedCourses, favoriteCourses, completedCourses, assignments }
}

const transcriptMatchedCourse = {
  id: 'tour-transcript-matched-course',
  number: 'TOUR-TOR-1',
  title: 'Algorithms for Breakfast Logistics',
  ects: 6,
  masterCats: ['INFO'] as MasterCat[],
  regulationAreaCodes: ['INFO'],
}

export const TOUR_TRANSCRIPT_IMPORT_CANDIDATES: TranscriptImportCandidate[] = [
  {
    id: 'tour-transcript-review-1',
    sourcePage: 1,
    sourceSection: 'Tour preview',
    rawText: 'Algorithms for Breakfast Logistics  6 ECTS  1.7  SoSe 2026',
    extractedTitle: 'Algorithms for Breakfast Logistics',
    extractedEcts: 6,
    titleCandidates: ['Algorithms for Breakfast Logistics'],
    title: 'Algorithms for Breakfast Logistics',
    semester: 'SoSe 2026',
    grade: 1.7,
    ects: 6,
    masterCat: 'INFO',
    studyAreaCode: 'INFO',
    status: 'matched',
    statusDetail: 'Matched automatically for the tour preview.',
    parseIssues: [],
    validationIssues: [],
    matchOptions: [transcriptMatchedCourse],
    matchedCourse: transcriptMatchedCourse,
    courseId: transcriptMatchedCourse.id,
    courseNumber: transcriptMatchedCourse.number,
    isUserEdited: false,
  },
]

export const TOUR_TRANSCRIPT_COMPLETED_COURSES: CompletedCourse[] = [
  {
    id: 'tour-transcript-completed-1',
    courseId: null,
    courseNumber: 'TOUR-DONE-1',
    externalCourseCode: null,
    title: 'Databases for Tiny Libraries',
    ects: 6,
    masterCat: 'TECH',
    studyAreaCode: 'TECH',
    studyAreaName: 'Technical Computer Science',
    availableStudyAreaOptions: [],
    categoryLocked: true,
    isGradeCounted: true,
    grade: 2.0,
    semester: 'WiSe 2025/26',
    source: 'tour_preview',
  },
]

export const TOUR_TRANSCRIPT_STATS = {
  totalEcts: 12,
  requiredEcts: 120,
  progress: 10,
  averageGrade: 1.85,
}
