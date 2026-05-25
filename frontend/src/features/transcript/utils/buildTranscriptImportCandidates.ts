import type { Course, MasterCat, StudyAreaOption } from '../../courses'
import {
  buildAssignableRegulationAreaOptions,
  buildRelevantCourseAreaOptions,
} from '../../../shared/utils/regulation'
import type {
  ParsedTranscriptEntry,
  TranscriptCoursePreview,
  TranscriptImportBuildContext,
  TranscriptImportCandidate,
  TranscriptImportStatus,
} from '../types'

interface CourseMatchResult {
  preview: TranscriptCoursePreview
  score: number
  priority: number
}

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'de',
  'der',
  'des',
  'die',
  'for',
  'from',
  'in',
  'mit',
  'of',
  'the',
  'und',
  'with',
])

export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

export function studyAreaCodeToMasterCat(studyAreaCode: string | null | undefined): MasterCat | null {
  const normalizedCode = studyAreaCode?.trim().toUpperCase() ?? ''
  if (!normalizedCode) {
    return null
  }
  if (normalizedCode.endsWith('TECH')) {
    return 'TECH'
  }
  if (normalizedCode.endsWith('THEO')) {
    return 'THEO'
  }
  if (normalizedCode.endsWith('PRAK')) {
    return 'PRAK'
  }
  if (normalizedCode === 'INFO' || normalizedCode === 'INFO-INFO' || normalizedCode === 'ML-CS' || normalizedCode.endsWith('-INFO')) {
    return 'INFO'
  }
  if (
    normalizedCode === 'ELECTIVE'
    || normalizedCode === 'INFO-FOKUS'
    || normalizedCode === 'ML-DIVERSE'
    || normalizedCode === 'ML-EXP'
    || normalizedCode === 'PROSEM'
    || normalizedCode === 'UEBK'
    || normalizedCode === 'MATH'
    || normalizedCode === 'INF'
    || normalizedCode === 'INFO-BASIS'
    || normalizedCode === 'ML-FOUND'
    || normalizedCode.endsWith('BASIS')
  ) {
    return 'BASIS'
  }
  return null
}

function buildPreferredMasterCats(
  fallbackMasterCats: MasterCat[],
  studyAreaOptions: StudyAreaOption[] | undefined,
  studyProgramCode: string | null | undefined,
): MasterCat[] {
  if (!studyAreaOptions || studyAreaOptions.length === 0 || !studyProgramCode) {
    return fallbackMasterCats
  }

  const preferredMasterCats = studyAreaOptions
    .filter((option) => option.programCode === studyProgramCode)
    .map((option) => studyAreaCodeToMasterCat(option.studyAreaCode))
    .filter((masterCat): masterCat is MasterCat => masterCat !== null)

  if (preferredMasterCats.length === 0) {
    return fallbackMasterCats
  }

  return [...new Set([...preferredMasterCats, ...fallbackMasterCats])]
}

export function toTranscriptCoursePreview(
  course: Course,
  studyProgramCode?: string | null,
): TranscriptCoursePreview {
  return {
    id: course.id,
    number: course.moduleCode ?? course.number,
    title: course.moduleTitle ?? course.title,
    ects: course.ects,
    masterCats: buildPreferredMasterCats(course.masterCats, course.studyAreaOptions, studyProgramCode),
    studyAreaOptions: course.studyAreaOptions,
    regulationAreaCodes: buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode).map(
      (option) => option.code,
    ),
  }
}

function scoreCourseTitle(candidateTitle: string, courseTitle: string, expectedEcts: number | null): number {
  const normalizedCandidateTitle = normalizeText(candidateTitle)
  const normalizedCourseTitle = normalizeText(courseTitle)
  if (!normalizedCandidateTitle || !normalizedCourseTitle) {
    return 0
  }

  if (normalizedCandidateTitle === normalizedCourseTitle) {
    return expectedEcts !== null ? 1 : 0.98
  }

  if (
    normalizedCandidateTitle.length >= 12 &&
    normalizedCourseTitle.includes(normalizedCandidateTitle)
  ) {
    return expectedEcts !== null ? 0.95 : 0.9
  }

  if (
    normalizedCourseTitle.length >= 12 &&
    normalizedCandidateTitle.includes(normalizedCourseTitle)
  ) {
    return expectedEcts !== null ? 0.93 : 0.88
  }

  const candidateTokens = tokenize(candidateTitle)
  const courseTokens = tokenize(courseTitle)
  if (candidateTokens.length === 0 || courseTokens.length === 0) {
    return 0
  }

  const courseTokenSet = new Set(courseTokens)
  const overlappingTokenCount = candidateTokens.filter((token) => courseTokenSet.has(token)).length
  if (overlappingTokenCount === 0) {
    return 0
  }

  const tokenScore = overlappingTokenCount / Math.max(candidateTokens.length, courseTokens.length)
  const ectsBonus = expectedEcts !== null ? 0.08 : 0
  return Math.min(0.92, tokenScore + ectsBonus)
}

function isLikelyExerciseCourse(course: Course): boolean {
  const normalizedCourseType = normalizeText(course.courseType)
  const normalizedTitle = normalizeText(course.title)

  return (
    normalizedCourseType.includes('ubung') ||
    normalizedCourseType.includes('exercise') ||
    normalizedTitle.startsWith('ubung ') ||
    normalizedTitle.startsWith('ubungen ') ||
    normalizedTitle.includes('ubung zur vorlesung') ||
    normalizedTitle.includes('ubungen zur vorlesung') ||
    normalizedTitle.includes('exercise for')
  )
}

function buildMatchKey(preview: TranscriptCoursePreview): string {
  return `${normalizeText(preview.number)}::${normalizeText(preview.title)}`
}

function scoreCourseMatch(candidateTitle: string, course: Course, expectedEcts: number | null): number {
  const expectedEctsMatches = expectedEcts !== null && course.ects === expectedEcts
  const candidateCourseTitles = [
    ...new Set([course.moduleTitle, course.title].filter((courseTitle): courseTitle is string => Boolean(courseTitle))),
  ]

  return Math.max(
    ...candidateCourseTitles.map((courseTitle) =>
      scoreCourseTitle(candidateTitle, courseTitle, expectedEctsMatches ? expectedEcts : null),
    ),
  )
}

function getValidationIssues(candidate: TranscriptImportCandidate): string[] {
  const issues = [...candidate.parseIssues]

  if (!candidate.semester.trim()) {
    issues.push('Semester is missing.')
  }
  if (candidate.ects === null || candidate.ects <= 0) {
    issues.push('ECTS must be greater than 0.')
  }
  if (candidate.grade !== null && (candidate.grade < 1 || candidate.grade > 5)) {
    issues.push('Grade must stay between 1.0 and 5.0.')
  }
  if ((candidate.matchedCourse?.regulationAreaCodes?.length ?? 0) > 1 && !candidate.studyAreaCode) {
    issues.push('Choose the correct regulation area for this course.')
  }

  return [...new Set(issues)]
}

function getStatus(candidate: TranscriptImportCandidate, validationIssues: string[]): TranscriptImportStatus {
  if (validationIssues.length > 0) {
    return 'invalid'
  }
  if (candidate.courseId && candidate.matchedCourse) {
    return 'matched'
  }
  if (candidate.matchOptions.length > 0) {
    return 'uncertain'
  }
  return 'unmatched'
}

function getStatusDetail(candidate: TranscriptImportCandidate, status: TranscriptImportStatus, validationIssues: string[]): string {
  if (status === 'invalid') {
    return validationIssues[0] ?? 'This row needs manual review.'
  }
  if (status === 'matched' && candidate.matchedCourse) {
    return `Ready to import as ${candidate.matchedCourse.number || candidate.matchedCourse.title}.`
  }
  if (status === 'uncertain') {
    return 'Choose the right catalog course from the suggested matches before importing.'
  }
  return 'Search the catalog and assign the correct course before importing this row.'
}

function finalizeCandidate(candidate: TranscriptImportCandidate): TranscriptImportCandidate {
  const validationIssues = getValidationIssues(candidate)
  const status = getStatus(candidate, validationIssues)

  return {
    ...candidate,
    validationIssues,
    status,
    statusDetail: getStatusDetail(candidate, status, validationIssues),
  }
}

function buildMatchResults(
  entry: ParsedTranscriptEntry,
  courses: Course[],
  studyProgramCode?: string | null,
): CourseMatchResult[] {
  const scoredMatches = new Map<string, CourseMatchResult>()

  for (const course of courses) {
    const score = Math.max(
      ...entry.titleCandidates.map((candidateTitle) =>
        scoreCourseMatch(candidateTitle, course, entry.extractedEcts),
      ),
    )

    if (score < 0.55) {
      continue
    }

    const preview = toTranscriptCoursePreview(course, studyProgramCode)
    const key = buildMatchKey(preview)
    const candidateMatchResult: CourseMatchResult = {
      preview,
      score,
      priority: isLikelyExerciseCourse(course) ? 1 : 0,
    }
    const existingMatchResult = scoredMatches.get(key)

    if (
      !existingMatchResult ||
      candidateMatchResult.score > existingMatchResult.score ||
      (candidateMatchResult.score === existingMatchResult.score && candidateMatchResult.priority < existingMatchResult.priority)
    ) {
      scoredMatches.set(key, candidateMatchResult)
    }
  }

  return [...scoredMatches.values()].sort((firstMatch, secondMatch) => {
    if (secondMatch.score !== firstMatch.score) {
      return secondMatch.score - firstMatch.score
    }
    return firstMatch.priority - secondMatch.priority
  })
}

function pickDefaultMasterCat(entry: ParsedTranscriptEntry, matchedCourse: TranscriptCoursePreview | null): MasterCat {
  return matchedCourse?.masterCats[0] ?? entry.defaultMasterCat
}

function hasExactNormalizedTitleMatch(
  entry: ParsedTranscriptEntry,
  matchResult: CourseMatchResult,
): boolean {
  const candidateTitles = entry.titleCandidates.map((candidateTitle) => normalizeText(candidateTitle))
  const previewTitles = [matchResult.preview.title, matchResult.preview.number].map((value) => normalizeText(value))
  return candidateTitles.some((candidateTitle) =>
    previewTitles.some((previewTitle) => candidateTitle.length > 0 && candidateTitle === previewTitle),
  )
}

function getAssignableRegulationAreaCodes(
  matchedCourse: TranscriptCoursePreview | null,
  context: TranscriptImportBuildContext,
): string[] {
  if (!matchedCourse) {
    return []
  }

  return buildAssignableRegulationAreaOptions(
    matchedCourse.studyAreaOptions,
    context.studyProgramCode,
    context.regulationRuleGroups,
    matchedCourse.masterCats,
  ).map((option) => option.code)
}

export function buildTranscriptImportCandidates(
  entries: ParsedTranscriptEntry[],
  courses: Course[],
  context: TranscriptImportBuildContext,
): TranscriptImportCandidate[] {
  return entries.map((entry) => {
    const matchResults = buildMatchResults(entry, courses, context.studyProgramCode)
    const exactMatches = matchResults.filter((matchResult) => hasExactNormalizedTitleMatch(entry, matchResult))
    const matchedCourse = exactMatches.length === 1 ? exactMatches[0].preview : null

    const assignableRegulationAreaCodes = getAssignableRegulationAreaCodes(matchedCourse, context)
    const autoStudyAreaCode = assignableRegulationAreaCodes.length === 1
      ? assignableRegulationAreaCodes[0]
      : null

    return finalizeCandidate({
      id: entry.id,
      sourcePage: entry.sourcePage,
      sourceSection: entry.sourceSection,
      rawText: entry.rawText,
      extractedTitle: entry.extractedTitle,
      titleCandidates: entry.titleCandidates,
      title: matchedCourse?.title ?? entry.extractedTitle,
      semester: entry.extractedSemester ?? '',
      grade: entry.extractedGrade,
      extractedEcts: entry.extractedEcts,
      ects: matchedCourse?.ects ?? entry.extractedEcts,
      masterCat: pickDefaultMasterCat(entry, matchedCourse),
      studyAreaCode: autoStudyAreaCode,
      status: matchedCourse ? 'matched' : matchResults.length > 0 ? 'uncertain' : 'unmatched',
      statusDetail: '',
      parseIssues: entry.parseIssues,
      validationIssues: [],
      matchOptions: matchResults.slice(0, 5).map((matchResult) => ({
        ...matchResult.preview,
        regulationAreaCodes: getAssignableRegulationAreaCodes(matchResult.preview, context),
      })),
      matchedCourse: matchedCourse
        ? {
            ...matchedCourse,
            regulationAreaCodes: assignableRegulationAreaCodes,
          }
        : null,
      courseId: matchedCourse?.id ?? null,
      courseNumber: matchedCourse?.number ?? null,
      isUserEdited: false,
    })
  })
}

export function applyCatalogCourseMatch(
  candidate: TranscriptImportCandidate,
  course: TranscriptCoursePreview,
): TranscriptImportCandidate {
  const nextStudyAreaCode = course.regulationAreaCodes?.length === 1 ? course.regulationAreaCodes[0] : null

  return finalizeCandidate({
    ...candidate,
    title: course.title,
    ects: course.ects ?? candidate.extractedEcts,
    masterCat: course.masterCats[0] ?? candidate.masterCat,
    studyAreaCode: nextStudyAreaCode,
    matchedCourse: course,
    courseId: course.id,
    courseNumber: course.number,
    isUserEdited: true,
    matchOptions: [course, ...candidate.matchOptions.filter((option) => option.id !== course.id)].slice(0, 5),
  })
}

export function updateTranscriptImportCandidate(
  candidate: TranscriptImportCandidate,
  updates: Partial<TranscriptImportCandidate>,
): TranscriptImportCandidate {
  return finalizeCandidate({
    ...candidate,
    ...updates,
    isUserEdited: true,
  })
}

export function canImportTranscriptCandidate(candidate: TranscriptImportCandidate): boolean {
  const requiresAreaSelection = (candidate.matchedCourse?.regulationAreaCodes?.length ?? 0) > 1

  return Boolean(
    candidate.courseId &&
      candidate.matchedCourse &&
      candidate.semester.trim() &&
      candidate.ects !== null &&
      candidate.ects > 0 &&
      (!requiresAreaSelection || candidate.studyAreaCode) &&
      (candidate.grade === null || (candidate.grade >= 1 && candidate.grade <= 5))
  )
}

export function matchesCourseQuery(course: TranscriptCoursePreview, query: string): boolean {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) {
    return true
  }

  return [course.number, course.title]
    .map((value) => normalizeText(value))
    .some((value) => value.includes(normalizedQuery))
}
