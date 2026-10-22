import type { CompletedCourse, Course, RecognitionEvidence } from '../../courses/types.ts'
import { studyAreaCodeToMasterCat } from '../../../shared/utils/regulation.ts'
import { getCreditAchievementKey } from '../../../shared/utils/creditProjection.ts'

export function buildPlannedCompletedCourse(
  course: Course,
  semesterLabel: string,
  studyAreaCode: string | null,
  studyProgramCode: string | null = null,
): CompletedCourse {
  const fallbackMasterCat = course.masterCats[0] ?? 'INFO'
  return {
    id: `planner-${semesterLabel}-${course.id}`,
    courseId: course.id,
    courseNumber: course.number,
    externalCourseCode: course.number,
    title: course.title,
    ects: course.ects ?? 0,
    masterCat: studyAreaCode ? studyAreaCodeToMasterCat(studyAreaCode) ?? fallbackMasterCat : fallbackMasterCat,
    studyAreaCode,
    grade: null,
    semester: semesterLabel,
    source: 'planner_completion',
    creditMetadata: course.creditMetadata,
    achievementKey: getCreditAchievementKey(course, studyProgramCode),
    recognitionEvidence: course.recognitionEvidence,
    isAdditionalAchievement: course.isAdditionalAchievement,
    assessmentType: course.assessmentType,
  }
}

export function buildRecognitionEvidence({
  confirmed, module, areaCode, assessmentType, componentKind, componentKey, countedEcts,
}: {
  confirmed: boolean
  module?: { code: string; areaCode: string }
  areaCode: string | null
  assessmentType: NonNullable<RecognitionEvidence['assessmentType']>
  componentKind: NonNullable<RecognitionEvidence['componentKind']>
  componentKey: string
  countedEcts: string
}): RecognitionEvidence | undefined {
  if (!confirmed) return undefined
  return {
    confirmed: true,
    ...(module ? { moduleCode: module.code, areaCode: module.areaCode } : areaCode ? { areaCode } : {}),
    assessmentType,
    componentKind,
    ...(componentKey.trim() ? { componentKey: componentKey.trim() } : {}),
    ...(countedEcts.trim() ? { countedEcts: Number(countedEcts.replace(',', '.')) } : {}),
  }
}
