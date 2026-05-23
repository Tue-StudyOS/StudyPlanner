import type { Course, MasterCat, StudyAreaOption } from '../../courses'

export const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

export const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
}

const DAY_ALIASES: Record<string, (typeof DAY_ORDER)[number]> = {
  mo: 'Monday',
  mon: 'Monday',
  monday: 'Monday',
  di: 'Tuesday',
  tue: 'Tuesday',
  tuesday: 'Tuesday',
  mi: 'Wednesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  do: 'Thursday',
  thu: 'Thursday',
  thursday: 'Thursday',
  fr: 'Friday',
  fri: 'Friday',
  friday: 'Friday',
}

const MASTER_CATEGORY_LABELS: Record<MasterCat, string> = {
  TECH: 'Technical Computer Science',
  THEO: 'Theoretical Computer Science',
  PRAK: 'Practical Computer Science',
  INFO: 'Computer Science',
  FOKUS: 'Focus and Extensions',
  BASIS: 'Foundations',
}

interface PlannerCoverageItem {
  key: string
  label: string
  courseCount: number
  ects: number
}

export interface PlannerBlock {
  blockId: string
  courseId: string
  courseTitle: string
  day: (typeof DAY_ORDER)[number]
  startMinutes: number
  endMinutes: number
  label: string
  room: string
  hasOverlap: boolean
}

export interface PlannerFeedbackSummary {
  totalCourses: number
  totalEcts: number
  totalBlocks: number
  scheduledHours: number
  overlapCount: number
  unscheduledCourses: Course[]
  coverageLabel: string
  coverageItems: PlannerCoverageItem[]
  scheduledBlocks: PlannerBlock[]
}

function normalizeWeekday(value: string): (typeof DAY_ORDER)[number] | null {
  return DAY_ALIASES[value.trim().toLowerCase()] ?? null
}

function parseTimeRange(timeText: string): { startMinutes: number; endMinutes: number } | null {
  const match = timeText.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
  if (!match) {
    return null
  }

  const [startHour, startMinute] = match[1].split(':').map(Number)
  const [endHour, endMinute] = match[2].split(':').map(Number)
  return {
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute,
  }
}

export function buildPlannerBlocks(courses: Course[]): PlannerBlock[] {
  const blocks: PlannerBlock[] = []

  courses.forEach((course) => {
    course.schedule.forEach((slot, index) => {
      const normalizedDay = normalizeWeekday(slot.day)
      const timeRange = parseTimeRange(slot.time)
      if (!normalizedDay || !timeRange) {
        return
      }
      blocks.push({
        blockId: `${course.id}-${index}`,
        courseId: course.id,
        courseTitle: course.title,
        day: normalizedDay,
        startMinutes: timeRange.startMinutes,
        endMinutes: timeRange.endMinutes,
        label: `${slot.type} · ${slot.time}`,
        room: slot.room,
        hasOverlap: false,
      })
    })
  })

  return blocks
    .map((block) => {
      const hasOverlap = blocks.some((candidate) => {
        if (candidate.blockId === block.blockId || candidate.day !== block.day) {
          return false
        }
        return candidate.startMinutes < block.endMinutes && block.startMinutes < candidate.endMinutes
      })
      return { ...block, hasOverlap }
    })
    .sort((left, right) => {
      const dayDifference = DAY_ORDER.indexOf(left.day) - DAY_ORDER.indexOf(right.day)
      if (dayDifference !== 0) {
        return dayDifference
      }
      return left.startMinutes - right.startMinutes
    })
}

function buildCoverageFromStudyAreas(
  courses: Course[],
  studyProgramCode: string | null,
): PlannerCoverageItem[] {
  const coverageByKey = new Map<string, PlannerCoverageItem>()

  courses.forEach((course) => {
    const programSpecificOptions = (course.studyAreaOptions ?? []).filter(
      (option) => !studyProgramCode || option.programCode === studyProgramCode,
    )
    const fallbackOptions = course.studyAreaOptions ?? []
    const relevantOptions = programSpecificOptions.length > 0 ? programSpecificOptions : fallbackOptions
    const uniqueKeys = new Set<string>()

    relevantOptions.forEach((option) => {
      const key = buildStudyAreaKey(option)
      if (!key || uniqueKeys.has(key)) {
        return
      }
      uniqueKeys.add(key)

      const nextItem = coverageByKey.get(key) ?? {
        key,
        label: option.studyAreaName || option.studyAreaCode || 'Unassigned study area',
        courseCount: 0,
        ects: 0,
      }
      nextItem.courseCount += 1
      nextItem.ects += course.ects ?? 0
      coverageByKey.set(key, nextItem)
    })
  })

  return [...coverageByKey.values()].sort((left, right) => right.ects - left.ects || left.label.localeCompare(right.label))
}

function buildStudyAreaKey(option: StudyAreaOption): string | null {
  if (option.studyAreaCode) {
    return option.studyAreaCode
  }
  if (option.studyAreaName) {
    return option.studyAreaName
  }
  return null
}

function buildCoverageFromMasterCategories(courses: Course[]): PlannerCoverageItem[] {
  const coverageByKey = new Map<string, PlannerCoverageItem>()

  courses.forEach((course) => {
    const uniqueCategories = [...new Set(course.masterCats)]
    uniqueCategories.forEach((masterCategory) => {
      const nextItem = coverageByKey.get(masterCategory) ?? {
        key: masterCategory,
        label: MASTER_CATEGORY_LABELS[masterCategory],
        courseCount: 0,
        ects: 0,
      }
      nextItem.courseCount += 1
      nextItem.ects += course.ects ?? 0
      coverageByKey.set(masterCategory, nextItem)
    })
  })

  return [...coverageByKey.values()].sort((left, right) => right.ects - left.ects || left.label.localeCompare(right.label))
}

export function calculatePlannerFeedback(
  courses: Course[],
  studyProgramCode: string | null,
): PlannerFeedbackSummary {
  const scheduledBlocks = buildPlannerBlocks(courses)
  const totalEcts = courses.reduce((sum, course) => sum + (course.ects ?? 0), 0)
  const overlapCount = scheduledBlocks.filter((block) => block.hasOverlap).length
  const scheduledHours = scheduledBlocks.reduce(
    (sum, block) => sum + (block.endMinutes - block.startMinutes) / 60,
    0,
  )
  const unscheduledCourses = courses.filter(
    (course) => !scheduledBlocks.some((block) => block.courseId === course.id),
  )

  const studyAreaCoverage = buildCoverageFromStudyAreas(courses, studyProgramCode)
  const coverageItems = studyAreaCoverage.length > 0 ? studyAreaCoverage : buildCoverageFromMasterCategories(courses)

  return {
    totalCourses: courses.length,
    totalEcts: totalEcts,
    totalBlocks: scheduledBlocks.length,
    scheduledHours,
    overlapCount,
    unscheduledCourses,
    coverageLabel:
      studyAreaCoverage.length > 0 ? 'Elective block coverage' : 'Master category coverage',
    coverageItems,
    scheduledBlocks,
  }
}
