import type { Course, MasterCat, StudyAreaOption } from '../../courses'
import {
  buildAssignableRegulationAreaOptions,
  buildRelevantCourseAreaOptions,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation.ts'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation.ts'
import type {
  ParsedTranscriptEntry,
  TranscriptCoursePreview,
  TranscriptImportBuildContext,
  TranscriptImportCandidate,
  TranscriptImportStatus,
} from '../types.ts'
import { isValidTranscriptGrade } from './grades.ts'

interface CourseMatchResult {
  preview: TranscriptCoursePreview
  score: number
  lecturerScore: number
  ectsCompatibility: number
  priority: number
}

// Rows without a catalog match can be accepted as written; they then count
// toward the always-assignable übK area.
export const UEBK_AREA_CODE = 'UEBK'

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

const LEADING_COURSE_CODE_PATTERN = /^\s*(?:[a-zäöü]{2,10}\s*)?\d{3,5}[a-z]?\s+/i
const FORMER_TITLE_NOTE_PATTERN = /\s*\((?:früher|formerly)[^)]*\)/gi
const COURSE_TYPE_SUFFIX_PATTERN = /\s+[-–—]\s*(?:(?:vorlesung|lecture|übung|uebung|exercise|tutorial|praktikum|lab course|seminar|projekt|project)\s*(?:\/|\+|&|and)?\s*)+$/i

const COURSE_TITLE_ALIASES = new Map<string, string[]>([
  ['praktische informatik 4 teamprojekt', ['forschungsprojekt informatik']],
  ['practical computer science 4 team project', ['forschungsprojekt informatik']],
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

function stripCatalogTitleDecorations(value: string): string {
  return value
    .replace(LEADING_COURSE_CODE_PATTERN, '')
    .replace(FORMER_TITLE_NOTE_PATTERN, '')
    .replace(COURSE_TYPE_SUFFIX_PATTERN, '')
    .trim()
}

function addCompactVariant(normalizedValues: Set<string>, value: string): void {
  const compactValue = value.replace(/\s+/g, '')
  if (compactValue && compactValue !== value) {
    normalizedValues.add(compactValue)
  }
}

function addGermanTransliterationVariants(normalizedValues: Set<string>, value: string): void {
  const transliterated = value
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
  if (transliterated) {
    normalizedValues.add(transliterated)
    addCompactVariant(normalizedValues, transliterated)
  }
}

function addTitleMatchVariant(normalizedValues: Set<string>, value: string): void {
  const normalizedValue = normalizeText(value)
  if (!normalizedValue) {
    return
  }
  normalizedValues.add(normalizedValue)
  addCompactVariant(normalizedValues, normalizedValue)
  addGermanTransliterationVariants(normalizedValues, normalizedValue)
}

function buildTitleMatchVariants(value: string | null | undefined): string[] {
  const normalizedValues = new Set<string>()
  for (const titleValue of [value ?? '', stripCatalogTitleDecorations(value ?? '')]) {
    addTitleMatchVariant(normalizedValues, titleValue)
  }
  for (const normalizedValue of [...normalizedValues]) {
    for (const alias of COURSE_TITLE_ALIASES.get(normalizedValue) ?? []) {
      addTitleMatchVariant(normalizedValues, alias)
    }
  }
  return [...normalizedValues]
}

function tokenizeMatchVariant(value: string): string[] {
  return value
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
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
  const normalizedCandidateTitles = buildTitleMatchVariants(candidateTitle)
  const normalizedCourseTitles = buildTitleMatchVariants(courseTitle)
  if (normalizedCandidateTitles.length === 0 || normalizedCourseTitles.length === 0) {
    return 0
  }

  let bestScore = 0

  for (const normalizedCandidateTitle of normalizedCandidateTitles) {
    for (const normalizedCourseTitle of normalizedCourseTitles) {
      if (normalizedCandidateTitle === normalizedCourseTitle) {
        bestScore = Math.max(bestScore, expectedEcts !== null ? 1 : 0.98)
        continue
      }

      if (
        normalizedCandidateTitle.length >= 12 &&
        normalizedCourseTitle.includes(normalizedCandidateTitle)
      ) {
        bestScore = Math.max(bestScore, expectedEcts !== null ? 0.95 : 0.9)
        continue
      }

      if (
        normalizedCourseTitle.length >= 12 &&
        normalizedCandidateTitle.includes(normalizedCourseTitle)
      ) {
        bestScore = Math.max(bestScore, expectedEcts !== null ? 0.93 : 0.88)
        continue
      }

      const candidateTokens = tokenizeMatchVariant(normalizedCandidateTitle)
      const courseTokens = tokenizeMatchVariant(normalizedCourseTitle)
      if (candidateTokens.length === 0 || courseTokens.length === 0) {
        continue
      }

      const courseTokenSet = new Set(courseTokens)
      const overlappingTokenCount = candidateTokens.filter((token) => courseTokenSet.has(token)).length
      if (overlappingTokenCount === 0) {
        continue
      }

      const tokenScore = overlappingTokenCount / Math.max(candidateTokens.length, courseTokens.length)
      const ectsBonus = expectedEcts !== null ? 0.08 : 0
      bestScore = Math.max(bestScore, Math.min(0.92, tokenScore + ectsBonus))
    }
  }

  return bestScore
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

function normalizePersonName(value: string | null | undefined): string {
  return normalizeText(value)
    .replace(/\b(?:o|prof|dr|phil|med|rer|nat|ing|apl|jun|univ|m sc|msc|ma|ba)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function personNameTokens(value: string | null | undefined): string[] {
  return normalizePersonName(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

function scoreLecturerMatch(entry: ParsedTranscriptEntry, course: Course): number {
  const examinerTokens = new Set(
    (entry.examinerCandidates ?? [])
      .flatMap((examiner) => personNameTokens(examiner)),
  )
  if (examinerTokens.size === 0) {
    return 0
  }

  const lecturerTokens = [course.lecturer, ...(course.lecturers ?? [])].flatMap((lecturer) => personNameTokens(lecturer))
  if (lecturerTokens.length === 0) {
    return 0
  }

  return lecturerTokens.some((token) => examinerTokens.has(token)) ? 1 : 0
}

function getEctsCompatibility(entry: ParsedTranscriptEntry, course: Course): number {
  if (entry.extractedEcts === null || course.ects === null) {
    return 1
  }
  return entry.extractedEcts === course.ects ? 2 : 0
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
  if (!isValidTranscriptGrade(candidate.grade)) {
    issues.push('Grade must use the official ToR scale from 1.0 to 4.0.')
  }
  if ((candidate.matchedCourse?.regulationAreaCodes?.length ?? 0) > 1 && !candidate.studyAreaCode) {
    issues.push('Choose the correct regulation area for this course.')
  }

  return [...new Set(issues)]
}

function isAcceptedAsUebk(candidate: TranscriptImportCandidate): boolean {
  return !candidate.matchedCourse && candidate.studyAreaCode === UEBK_AREA_CODE
}

function getStatus(candidate: TranscriptImportCandidate, validationIssues: string[]): TranscriptImportStatus {
  if (validationIssues.length > 0) {
    return 'invalid'
  }
  if (candidate.courseId && candidate.matchedCourse) {
    return 'matched'
  }
  if (isAcceptedAsUebk(candidate)) {
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
  if (status === 'matched' && isAcceptedAsUebk(candidate)) {
    return 'Will be imported as written and counted toward the übK area.'
  }
  if (status === 'uncertain') {
    return 'Choose the right catalog course from the suggested matches before importing.'
  }
  return 'Search the catalog and assign the correct course — or accept the row as written into übK.'
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
      lecturerScore: scoreLecturerMatch(entry, course),
      ectsCompatibility: getEctsCompatibility(entry, course),
      priority: isLikelyExerciseCourse(course) ? 1 : 0,
    }
    const existingMatchResult = scoredMatches.get(key)

    if (
      !existingMatchResult ||
      candidateMatchResult.score > existingMatchResult.score ||
      (
        candidateMatchResult.score === existingMatchResult.score &&
        candidateMatchResult.lecturerScore > existingMatchResult.lecturerScore
      ) ||
      (
        candidateMatchResult.score === existingMatchResult.score &&
        candidateMatchResult.lecturerScore === existingMatchResult.lecturerScore &&
        candidateMatchResult.ectsCompatibility > existingMatchResult.ectsCompatibility
      ) ||
      (
        candidateMatchResult.score === existingMatchResult.score &&
        candidateMatchResult.lecturerScore === existingMatchResult.lecturerScore &&
        candidateMatchResult.ectsCompatibility === existingMatchResult.ectsCompatibility &&
        candidateMatchResult.priority < existingMatchResult.priority
      )
    ) {
      scoredMatches.set(key, candidateMatchResult)
    }
  }

  return [...scoredMatches.values()].sort((firstMatch, secondMatch) => {
    if (secondMatch.score !== firstMatch.score) {
      return secondMatch.score - firstMatch.score
    }
    if (secondMatch.lecturerScore !== firstMatch.lecturerScore) {
      return secondMatch.lecturerScore - firstMatch.lecturerScore
    }
    if (secondMatch.ectsCompatibility !== firstMatch.ectsCompatibility) {
      return secondMatch.ectsCompatibility - firstMatch.ectsCompatibility
    }
    return firstMatch.priority - secondMatch.priority
  })
}

function pickDefaultMasterCat(entry: ParsedTranscriptEntry, matchedCourse: TranscriptCoursePreview | null): MasterCat {
  return matchedCourse?.masterCats[0] ?? entry.defaultMasterCat
}

function hasCompatibleEcts(matchResult: CourseMatchResult): boolean {
  return matchResult.ectsCompatibility > 0
}

function hasExactNormalizedTitleMatch(
  entry: ParsedTranscriptEntry,
  matchResult: CourseMatchResult,
): boolean {
  const candidateTitles = entry.titleCandidates.flatMap((candidateTitle) => buildTitleMatchVariants(candidateTitle))
  const previewTitles = [
    ...buildTitleMatchVariants(matchResult.preview.title),
    normalizeText(matchResult.preview.number),
  ]
  return candidateTitles.some((candidateTitle) =>
    previewTitles.some((previewTitle) => candidateTitle.length > 0 && candidateTitle === previewTitle),
  )
}

function compareAutoMatchCandidates(firstMatch: CourseMatchResult, secondMatch: CourseMatchResult): number {
  if (secondMatch.lecturerScore !== firstMatch.lecturerScore) {
    return secondMatch.lecturerScore - firstMatch.lecturerScore
  }
  if (secondMatch.ectsCompatibility !== firstMatch.ectsCompatibility) {
    return secondMatch.ectsCompatibility - firstMatch.ectsCompatibility
  }
  if (firstMatch.priority !== secondMatch.priority) {
    return firstMatch.priority - secondMatch.priority
  }
  return secondMatch.score - firstMatch.score
}

function pickAutoMatchedCourse(
  entry: ParsedTranscriptEntry,
  matchResults: CourseMatchResult[],
): TranscriptCoursePreview | null {
  const exactMatches = matchResults.filter((matchResult) => hasExactNormalizedTitleMatch(entry, matchResult))
  if (exactMatches.length === 0) {
    return null
  }
  if (exactMatches.length === 1) {
    return exactMatches[0].preview
  }

  const sortedExactMatches = [...exactMatches].sort(compareAutoMatchCandidates)
  const bestMatch = sortedExactMatches[0]
  const secondBestMatch = sortedExactMatches[1]
  if (!secondBestMatch) {
    return bestMatch.preview
  }

  const hasUniqueLecturerMatch = bestMatch.lecturerScore > 0 && bestMatch.lecturerScore > secondBestMatch.lecturerScore
  const hasUniqueEctsMatch = hasCompatibleEcts(bestMatch) && bestMatch.ectsCompatibility > secondBestMatch.ectsCompatibility
  const hasUniqueCourseTypeMatch =
    bestMatch.priority < secondBestMatch.priority &&
    bestMatch.lecturerScore === secondBestMatch.lecturerScore &&
    bestMatch.ectsCompatibility === secondBestMatch.ectsCompatibility

  return hasUniqueLecturerMatch || hasUniqueEctsMatch || hasUniqueCourseTypeMatch
    ? bestMatch.preview
    : null
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

function findRuleGroupCode(
  ruleGroups: RegulationRuleGroup[],
  predicate: (group: RegulationRuleGroup, normalizedCode: string, groupType: string) => boolean,
): string | null {
  const match = ruleGroups.find((group) =>
    predicate(group, group.code.trim().toUpperCase(), (group.groupType ?? '').trim().toLowerCase()),
  )
  return match?.code ?? null
}

function findCompulsoryRuleGroupCode(ruleGroups: RegulationRuleGroup[]): string | null {
  return (
    findRuleGroupCode(ruleGroups, (_group, _code, groupType) => groupType === 'pflicht') ??
    findRuleGroupCode(ruleGroups, (_group, code) => code === 'INF' || code === 'REQUIRED')
  )
}

function findUebkRuleGroupCode(ruleGroups: RegulationRuleGroup[]): string | null {
  return findRuleGroupCode(ruleGroups, (group, code, groupType) => {
    const normalizedName = normalizeText(group.name)
    return (
      code === 'UEBK' ||
      groupType === 'free_choice' ||
      normalizedName.includes('uberfachlich') ||
      normalizedName.includes('professional')
    )
  })
}

function findElectiveRuleGroupCodeForMasterCat(
  ruleGroups: RegulationRuleGroup[],
  masterCat: MasterCat,
): string | null {
  return (
    findRuleGroupCode(
      ruleGroups,
      (_group, code, groupType) =>
        groupType !== 'pflicht' && studyAreaCodeToMasterCat(code) === masterCat,
    ) ?? findRuleGroupCode(ruleGroups, (_group, code) => studyAreaCodeToMasterCat(code) === masterCat)
  )
}

// The official transcript groups each course under a study-area heading; that
// heading is the authoritative regulation placement, so map it back to a rule
// group in the active regulation to drive auto-assignment and selectability.
export function resolveSectionRuleGroupCode(
  section: string | null | undefined,
  ruleGroups: RegulationRuleGroup[],
): string | null {
  const normalizedSection = normalizeText(section)
  if (
    !normalizedSection ||
    ruleGroups.length === 0 ||
    normalizedSection.includes('unzugeordnet') ||
    normalizedSection.includes('unassigned')
  ) {
    return null
  }

  if (
    normalizedSection.includes('uberfachlich') ||
    normalizedSection.includes('professional') ||
    normalizedSection.includes('studium professionale') ||
    /\buebk\b/.test(normalizedSection) ||
    /\bubk\b/.test(normalizedSection)
  ) {
    return findUebkRuleGroupCode(ruleGroups)
  }

  if (normalizedSection.includes('proseminar')) {
    return (
      findRuleGroupCode(ruleGroups, (_group, code) => code === 'PROSEM') ??
      findUebkRuleGroupCode(ruleGroups)
    )
  }

  if (normalizedSection.includes('praktische') || normalizedSection.includes('practical')) {
    return findElectiveRuleGroupCodeForMasterCat(ruleGroups, 'PRAK')
  }
  if (
    normalizedSection.includes('theoretische') ||
    normalizedSection.includes('theoretical') ||
    normalizedSection.includes('logik') ||
    normalizedSection.includes('logics')
  ) {
    return findElectiveRuleGroupCodeForMasterCat(ruleGroups, 'THEO')
  }
  if (
    normalizedSection.includes('technische') ||
    normalizedSection.includes('technical') ||
    normalizedSection.includes('robotik')
  ) {
    return findElectiveRuleGroupCodeForMasterCat(ruleGroups, 'TECH')
  }

  if (normalizedSection.includes('mathematik') || normalizedSection.includes('mathematics')) {
    return (
      findRuleGroupCode(ruleGroups, (_group, code) => code === 'MATH') ??
      findCompulsoryRuleGroupCode(ruleGroups)
    )
  }

  const isElectiveSection =
    normalizedSection.includes('wahlpflicht') || normalizedSection.includes('elective')
  if (
    !isElectiveSection &&
    (normalizedSection.includes('pflicht') ||
      normalizedSection.includes('compulsory') ||
      normalizedSection.includes('required'))
  ) {
    return findCompulsoryRuleGroupCode(ruleGroups)
  }

  if (normalizedSection.includes('informatik') || normalizedSection.includes('computer science')) {
    return findElectiveRuleGroupCodeForMasterCat(ruleGroups, 'INFO')
  }

  return null
}

export function buildTranscriptImportCandidates(
  entries: ParsedTranscriptEntry[],
  courses: Course[],
  context: TranscriptImportBuildContext,
): TranscriptImportCandidate[] {
  return entries.map((entry) => {
    const matchResults = buildMatchResults(entry, courses, context.studyProgramCode)
    const matchedCourse = pickAutoMatchedCourse(entry, matchResults)

    const assignableRegulationAreaCodes = getAssignableRegulationAreaCodes(matchedCourse, context)
    const sectionAreaCode = matchedCourse
      ? resolveSectionRuleGroupCode(entry.sourceSection, context.regulationRuleGroups)
      : null
    const selectableRegulationAreaCodes =
      sectionAreaCode && !assignableRegulationAreaCodes.includes(sectionAreaCode)
        ? [...assignableRegulationAreaCodes, sectionAreaCode]
        : assignableRegulationAreaCodes
    const autoStudyAreaCode = sectionAreaCode
      ? sectionAreaCode
      : assignableRegulationAreaCodes.length === 1
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
      ects: entry.extractedEcts ?? matchedCourse?.ects ?? null,
      masterCat: autoStudyAreaCode
        ? studyAreaCodeToMasterCat(autoStudyAreaCode) ?? pickDefaultMasterCat(entry, matchedCourse)
        : pickDefaultMasterCat(entry, matchedCourse),
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
            regulationAreaCodes: selectableRegulationAreaCodes,
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
    ects: candidate.extractedEcts ?? course.ects,
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

export function acceptCandidateAsUebk(candidate: TranscriptImportCandidate): TranscriptImportCandidate {
  return finalizeCandidate({
    ...candidate,
    title: candidate.extractedTitle,
    ects: candidate.extractedEcts,
    studyAreaCode: UEBK_AREA_CODE,
    masterCat: studyAreaCodeToMasterCat(UEBK_AREA_CODE) ?? candidate.masterCat,
    matchedCourse: null,
    courseId: null,
    courseNumber: null,
    isUserEdited: true,
  })
}

export function canImportTranscriptCandidate(candidate: TranscriptImportCandidate): boolean {
  const requiresAreaSelection = (candidate.matchedCourse?.regulationAreaCodes?.length ?? 0) > 1
  const hasCatalogMatch = Boolean(candidate.courseId && candidate.matchedCourse)

  return Boolean(
    (hasCatalogMatch || isAcceptedAsUebk(candidate)) &&
      candidate.semester.trim() &&
      candidate.ects !== null &&
      candidate.ects > 0 &&
      (!requiresAreaSelection || candidate.studyAreaCode) &&
      isValidTranscriptGrade(candidate.grade)
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
