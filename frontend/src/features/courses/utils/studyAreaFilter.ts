import { buildRelevantCourseAreaOptions } from '../../../shared/utils/regulation.ts'
import type { Course } from '../types'

// These programs have regulation areas, but the catalog has no course mappings
// for them yet (docs/regulation-model.md). Until that seed exists, their area
// chips reuse the Informatik catalog plus the medical/media course numbers.
const PROGRAMS_WITHOUT_CATALOG_MAPPINGS = new Set([
  'BSC_BIOINFO_2021',
  'BSC_MEDIENINFO_2021',
  'BSC_MEDIZININFO_2021',
])

const INFORMATICS_ELECTIVE_CODES = new Set([
  'PRAK',
  'TECH',
  'THEO',
  'INFO',
  'INFO-PRAK',
  'INFO-TECH',
  'INFO-THEO',
  'INFO-INFO',
  'INFO-FOKUS',
])

function areaCodesForProgram(
  course: Pick<Course, 'studyAreaOptions'>,
  studyProgramCode: string | null | undefined,
): string[] {
  return buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode).map(
    (option) => option.code,
  )
}

type AreaFilterCourse = Pick<Course, 'studyAreaOptions'> & Partial<Pick<Course, 'title' | 'number'>>

function isMedicalCatalogCourse(course: AreaFilterCourse): boolean {
  const number = course.number?.trim().toUpperCase() ?? ''
  if (number.startsWith('MDZ')) {
    return true
  }
  return /medizin|telemedizin|humanbiologie|terminolog/i.test(course.title ?? '')
}

function isMediaCatalogCourse(course: AreaFilterCourse): boolean {
  const number = course.number?.trim().toUpperCase() ?? ''
  if (number.startsWith('MEINF')) {
    return true
  }
  return /medieninformatik|medienwissenschaft/i.test(course.title ?? '')
}

function selectedAreaMatches(
  selectedCode: string,
  courseAreaCodes: Set<string>,
  course: AreaFilterCourse,
  allowSharedCatalog: boolean,
): boolean {
  if (courseAreaCodes.has(selectedCode)) {
    return true
  }
  if (!allowSharedCatalog) {
    return false
  }
  if (selectedCode === 'ELECTIVE') {
    return [...courseAreaCodes].some((code) => INFORMATICS_ELECTIVE_CODES.has(code))
  }
  if (selectedCode === 'MED_BIO_PHYS' || selectedCode === 'MEDINFO') {
    return isMedicalCatalogCourse(course)
  }
  if (selectedCode === 'MEDIAINFO' || selectedCode === 'MEDIA_STUDIES') {
    return isMediaCatalogCourse(course)
  }
  return false
}

export function courseMatchesStudyAreaFilter(
  course: AreaFilterCourse,
  selectedStudyAreaCodes: string[],
  studyProgramCode: string | null | undefined,
): boolean {
  if (selectedStudyAreaCodes.length === 0) {
    return true
  }

  const allowSharedCatalog = Boolean(
    studyProgramCode && PROGRAMS_WITHOUT_CATALOG_MAPPINGS.has(studyProgramCode),
  )
  let courseAreaCodes = areaCodesForProgram(course, studyProgramCode)
  if (courseAreaCodes.length === 0 && allowSharedCatalog) {
    courseAreaCodes = [
      ...areaCodesForProgram(course, 'BSC_INFO_2021'),
      ...areaCodesForProgram(course, 'MSC_INFO_2021'),
    ]
  }

  const codes = new Set(courseAreaCodes)
  return selectedStudyAreaCodes.every((code) =>
    selectedAreaMatches(code, codes, course, allowSharedCatalog),
  )
}
