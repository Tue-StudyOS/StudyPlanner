import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course, MasterCat } from '../../src/features/courses/index.ts'
import type { ParsedTranscriptEntry } from '../../src/features/transcript/types.ts'
import {
  buildTranscriptImportCandidates,
  canImportTranscriptCandidate,
} from '../../src/features/transcript/utils/buildTranscriptImportCandidates.ts'
import {
  classifyTranscriptCompletionStatus,
  parseTranscriptRowColumns,
  parseTranscriptSemesterValue,
} from '../../src/features/transcript/utils/parseTranscriptPdf.ts'

function createCourse(overrides: Partial<Course>): Course {
  return {
    id: overrides.id ?? 'course-1',
    numericId: overrides.numericId,
    number: overrides.number ?? 'INF0000',
    title: overrides.title ?? 'Placeholder title',
    lecturer: overrides.lecturer ?? '',
    lecturers: overrides.lecturers,
    room: overrides.room ?? '',
    types: overrides.types ?? [],
    ects: overrides.ects ?? 6,
    sws: overrides.sws ?? null,
    masterCats: overrides.masterCats ?? ['INFO'],
    studyAreaOptions: overrides.studyAreaOptions,
    weekdays: overrides.weekdays ?? [],
    schedule: overrides.schedule ?? [],
    frequency: overrides.frequency ?? '',
    language: overrides.language ?? 'German',
    prerequisites: overrides.prerequisites ?? [],
    description: overrides.description ?? '',
    exams: overrides.exams ?? [],
    registrationPeriod: overrides.registrationPeriod,
    detailUrl: overrides.detailUrl,
    detailPageUrl: overrides.detailPageUrl,
    organisation: overrides.organisation,
    courseType: overrides.courseType ?? 'Lecture',
    shortComment: overrides.shortComment,
    moduleCode: overrides.moduleCode ?? null,
    moduleTitle: overrides.moduleTitle ?? null,
    hasRegulationMapping: overrides.hasRegulationMapping,
  }
}

function createEntry(overrides: Partial<ParsedTranscriptEntry>): ParsedTranscriptEntry {
  return {
    id: overrides.id ?? 'entry-1',
    sourcePage: overrides.sourcePage ?? 1,
    sourceSection: overrides.sourceSection ?? 'Pflichtbereich Informatik',
    rawText: overrides.rawText ?? 'raw transcript row',
    extractedTitle: overrides.extractedTitle ?? 'Placeholder title',
    titleCandidates: overrides.titleCandidates ?? [overrides.extractedTitle ?? 'Placeholder title'],
    extractedGrade: overrides.extractedGrade ?? 1.7,
    extractedEcts: overrides.extractedEcts ?? 6,
    extractedSemester: overrides.extractedSemester ?? 'WS 2024/25',
    defaultMasterCat: overrides.defaultMasterCat ?? 'INFO',
    parseIssues: overrides.parseIssues ?? [],
  }
}

test('parseTranscriptRowColumns supports German semester labels and decimal commas', () => {
  const row = parseTranscriptRowColumns(
    {
      title: 'Mathematik für Informatik 1: Analysis',
      semesterText: 'WiSe 2022/23',
      examinerText: 'Dorn',
      formText: 'K',
      gradeText: '2,70',
      statusText: 'BE',
      ectsText: '9',
      rawText: 'Mathematik für Informatik 1: AnalysisWiSe 2022/23DornK2,7BE9',
    },
    {
      page: 1,
      y: 545,
      section: 'Pflichtbereich Informatik',
    },
  )

  assert.ok(row)
  assert.equal(row.semester, 'WS 2022/23')
  assert.equal(row.grade, 2.7)
  assert.equal(row.ects, 9)
  assert.equal(row.hasDetailTokens, true)
  assert.deepEqual(row.parseIssues, [])
})

test('parseTranscriptSemesterValue keeps English semesters and maps date-based rows', () => {
  assert.equal(parseTranscriptSemesterValue('WT 2024/25'), 'WS 2024/25')
  assert.equal(parseTranscriptSemesterValue('SoSe 2025'), 'SS 2025')
  assert.equal(parseTranscriptSemesterValue('14.02.2025'), 'WS 2024/25')
  assert.equal(parseTranscriptSemesterValue('16.05.2025'), 'SS 2025')
})

test('parseTranscriptRowColumns keeps the English import path plausible', () => {
  const row = parseTranscriptRowColumns(
    {
      title: 'Machine Learning',
      semesterText: 'WT 2024/25',
      examinerText: 'Hennig',
      formText: 'E',
      gradeText: '1.7',
      statusText: 'PASSED',
      ectsText: '9',
      rawText: 'Machine Learning WT 2024/25 Hennig E 1.7 PASSED 9',
    },
    {
      page: 1,
      y: 300,
      section: 'Area: Computer Science',
    },
  )

  assert.ok(row)
  assert.equal(row.semester, 'WS 2024/25')
  assert.equal(row.grade, 1.7)
  assert.equal(row.ects, 9)
  assert.deepEqual(row.parseIssues, [])
})

test('parseTranscriptRowColumns supports date-based semesters and decimal-comma ECTS', () => {
  const row = parseTranscriptRowColumns(
    {
      title: 'Anonymized elective seminar',
      semesterText: '16.05.2025',
      examinerText: 'Muster',
      formText: 'M',
      gradeText: '1,30',
      statusText: 'anerkannt',
      ectsText: '1,5',
      rawText: 'Anonymized elective seminar 16.05.2025 Muster M 1,30 anerkannt 1,5',
    },
    {
      page: 3,
      y: 220,
      section: 'Studium Professionale (übK)',
    },
  )

  assert.ok(row)
  assert.equal(row.semester, 'SS 2025')
  assert.equal(row.grade, 1.3)
  assert.equal(row.ects, 1.5)
  assert.deepEqual(row.parseIssues, [])
})

test('parseTranscriptRowColumns recovers merged German status and ECTS tokens', () => {
  const row = parseTranscriptRowColumns(
    {
      title: 'Anonymized unmatched course',
      semesterText: 'SoSe 2025',
      examinerText: 'Muster',
      formText: '',
      gradeText: '2,30',
      statusText: 'BE6',
      ectsText: '',
      rawText: 'Anonymized unmatched course SoSe 2025 Muster 2,30BE6',
    },
    {
      page: 2,
      y: 320,
      section: 'Unzugeordnete Elemente',
    },
  )

  assert.ok(row)
  assert.equal(row.grade, 2.3)
  assert.equal(row.ects, 6)
  assert.deepEqual(row.parseIssues, [])
})

test('classifyTranscriptCompletionStatus ignores unfinished rows but keeps completed equivalents', () => {
  assert.equal(classifyTranscriptCompletionStatus('MB'), 'ignored')
  assert.equal(classifyTranscriptCompletionStatus('PV'), 'ignored')
  assert.equal(classifyTranscriptCompletionStatus('BE'), 'completed')
  assert.equal(classifyTranscriptCompletionStatus('VBE'), 'completed')
  assert.equal(classifyTranscriptCompletionStatus('PASSED'), 'completed')
})

test('parseTranscriptRowColumns drops unfinished transcript rows', () => {
  const row = parseTranscriptRowColumns(
    {
      title: 'Anonymized in-progress course',
      semesterText: 'SoSe 2025',
      examinerText: '',
      formText: '',
      gradeText: '',
      statusText: 'MB',
      ectsText: '6',
      rawText: 'Anonymized in-progress course SoSe 2025 MB 6',
    },
    {
      page: 2,
      y: 180,
      section: 'Pflichtbereich Informatik',
    },
  )

  assert.equal(row, null)
})

test('German duplicate title candidates still auto-match without manual re-entry', () => {
  const entry = createEntry({
    sourcePage: 2,
    sourceSection: 'Studium Professionale (übK)',
    rawText:
      'Proseminar WiSe 2025/26 2,70 BE 3 / Proseminar (übK): Anwendungen der diskreten Mathematik in der Informatik: Beweise aus dem Buch WiSe 2025/26 Schlipf 2,7 BE 3',
    extractedTitle: 'Proseminar',
    titleCandidates: [
      'Proseminar',
      'Proseminar (übK): Anwendungen der diskreten Mathematik in der Informatik: Beweise aus dem Buch',
    ],
    extractedGrade: 2.7,
    extractedEcts: 3,
    extractedSemester: 'WS 2025/26',
    defaultMasterCat: 'BASIS',
  })
  const course = createCourse({
    id: 'course-proseminar',
    number: 'UEBK001',
    title: 'Proseminar (übK): Anwendungen der diskreten Mathematik in der Informatik: Beweise aus dem Buch',
    ects: 3,
    masterCats: ['BASIS' satisfies MasterCat],
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.title, course.title)
  assert.equal(candidate.matchedCourse?.title, course.title)
  assert.equal(candidate.matchOptions[0]?.title, course.title)
  assert.equal(canImportTranscriptCandidate(candidate), true)
})

test('entries without a catalog match stay visible as unmatched review candidates', () => {
  const entry = createEntry({
    id: 'entry-unmatched',
    extractedTitle: 'Anonymized German course title',
    titleCandidates: ['Anonymized German course title'],
    rawText: 'Anonymized German course title SoSe 2025 1,30 BE 6',
    extractedGrade: 1.3,
    extractedEcts: 6,
    extractedSemester: 'SS 2025',
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'unmatched')
  assert.equal(candidate.rawText, entry.rawText)
  assert.equal(candidate.extractedTitle, entry.extractedTitle)
  assert.equal(candidate.matchOptions.length, 0)
})
