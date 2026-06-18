import assert from 'node:assert/strict'
import test from 'node:test'
import type { Course, MasterCat } from '../../src/features/courses/index.ts'
import type { ParsedTranscriptEntry } from '../../src/features/transcript/types.ts'
import {
  acceptCandidateAsUebk,
  buildTranscriptImportCandidates,
  canImportTranscriptCandidate,
  resolveSectionRuleGroupCode,
} from '../../src/features/transcript/utils/buildTranscriptImportCandidates.ts'
import type { RegulationRuleGroup } from '../../src/shared/utils/regulation.ts'
import {
  classifyTranscriptCompletionStatus,
  parseTranscriptRowColumns,
  parseTranscriptSemesterValue,
  toDefaultMasterCat,
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
    extractedExaminer: overrides.extractedExaminer,
    examinerCandidates: overrides.examinerCandidates,
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

test('parseTranscriptSemesterValue handles long forms, two-digit years, and invalid input', () => {
  assert.equal(parseTranscriptSemesterValue('Winter term 2024/25'), 'WS 2024/25')
  assert.equal(parseTranscriptSemesterValue('Summer semester 2025'), 'SS 2025')
  assert.equal(parseTranscriptSemesterValue('WS 22/23'), 'WS 2022/23')
  assert.equal(parseTranscriptSemesterValue('wt 2024 / 25'), 'WS 2024/25')
  assert.equal(parseTranscriptSemesterValue('SoSe 2025.'), 'SS 2025')
  assert.equal(parseTranscriptSemesterValue('31.02.2025'), 'WS 2024/25')
  assert.equal(parseTranscriptSemesterValue('14.13.2025'), null)
  assert.equal(parseTranscriptSemesterValue('Semester'), null)
  assert.equal(parseTranscriptSemesterValue(''), null)
})

test('toDefaultMasterCat maps German and English sections of the same area identically', () => {
  // Bachelor ToR sections.
  assert.equal(toDefaultMasterCat('Pflichtbereich Informatik'), 'BASIS')
  assert.equal(toDefaultMasterCat('Compulsory Area: Computer Science'), 'BASIS')
  assert.equal(toDefaultMasterCat('Wahlpflichtfach Praktische Informatik'), 'PRAK')
  assert.equal(toDefaultMasterCat('Elective Area: Practical Computer Science'), 'PRAK')
  assert.equal(toDefaultMasterCat('Wahpflichtfach Theoretische Informatik'), 'THEO')
  assert.equal(toDefaultMasterCat('Elective Area: Theoretical Computer Science'), 'THEO')
  assert.equal(toDefaultMasterCat('Wahlpflichtfach Technische Informatik'), 'TECH')
  assert.equal(toDefaultMasterCat('Elective Area: Technical Computer Science'), 'TECH')
  assert.equal(toDefaultMasterCat('Wahlpflichtfach Informatik'), 'INFO')
  assert.equal(toDefaultMasterCat('Elective Area: Computer Science'), 'INFO')
  assert.equal(toDefaultMasterCat('Studium Professionale (übK)'), 'BASIS')
  assert.equal(toDefaultMasterCat('Professional Skills'), 'BASIS')

  // Master ToR sections.
  assert.equal(toDefaultMasterCat('Studienbereich Praktische Informatik'), 'PRAK')
  assert.equal(toDefaultMasterCat('Study Area Practical Computer Science'), 'PRAK')
  assert.equal(toDefaultMasterCat('Studienbereich Info Basis'), 'BASIS')
  assert.equal(toDefaultMasterCat('Study Area INFO BASIC'), 'BASIS')

  // Fallbacks.
  assert.equal(toDefaultMasterCat(null), 'INFO')
  assert.equal(toDefaultMasterCat('Unzugeordnete Elemente'), 'INFO')
  assert.equal(toDefaultMasterCat('Unassigned Elements'), 'INFO')
})

test('parseTranscriptRowColumns keeps long titles with special characters intact', () => {
  const row = parseTranscriptRowColumns(
    {
      title:
        'Proseminar (übK): Anwendungen der diskreten Mathematik in der Informatik: Beweise aus dem Buch — Teil 1 & 2',
      semesterText: 'WiSe 2025/26',
      examinerText: 'Schlipf',
      formText: 'PS',
      gradeText: '2,7',
      statusText: 'BE',
      ectsText: '3',
      rawText: 'Proseminar (übK): … WiSe 2025/26 Schlipf PS 2,7 BE 3',
    },
    { page: 2, y: 410, section: 'Studium Professionale (übK)' },
  )

  assert.ok(row)
  assert.ok(row.title.startsWith('Proseminar (übK):'))
  assert.ok(row.title.endsWith('Teil 1 & 2'))
  assert.equal(row.grade, 2.7)
})

test('parseTranscriptRowColumns rejects rows with missing or malformed core fields', () => {
  const base = {
    examinerText: '',
    formText: '',
    gradeText: '1,3',
    statusText: 'BE',
    ectsText: '6',
    rawText: 'raw',
  }
  const context = { page: 1, y: 100, section: null }

  assert.equal(parseTranscriptRowColumns({ ...base, title: '', semesterText: 'SoSe 2025' }, context), null)
  assert.equal(parseTranscriptRowColumns({ ...base, title: 'Course', semesterText: 'kein Semester' }, context), null)
  assert.equal(
    parseTranscriptRowColumns(
      { ...base, title: 'Course', semesterText: 'SoSe 2025', gradeText: 'n/a' },
      context,
    ),
    null,
  )
  assert.equal(
    parseTranscriptRowColumns(
      { ...base, title: 'Course', semesterText: 'SoSe 2025', ectsText: 'x' },
      context,
    ),
    null,
  )
})

test('parseTranscriptRowColumns flags unknown completion statuses for manual review', () => {
  const row = parseTranscriptRowColumns(
    {
      title: 'Course with odd status',
      semesterText: 'SoSe 2025',
      examinerText: '',
      formText: '',
      gradeText: '2,0',
      statusText: 'committee review 2026',
      ectsText: '6',
      rawText: 'Course with odd status SoSe 2025 2,0 committee review 2026 6',
    },
    { page: 1, y: 90, section: null },
  )

  assert.ok(row)
  assert.equal(row.parseIssues.length, 1)
  assert.match(row.parseIssues[0], /could not be verified/)
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

test('catalog prefixes and type suffixes do not block safe transcript auto-matches', () => {
  const entry = createEntry({
    extractedTitle: 'Modern Search Engines',
    titleCandidates: ['Modern Search Engines'],
    extractedEcts: 6,
  })
  const course = createCourse({
    id: 'course-modern-search',
    number: 'INFO4271',
    title: 'INFO4271 Modern Search Engines - Vorlesung/Übung',
    ects: 6,
    masterCats: ['INFO' satisfies MasterCat],
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.matchedCourse?.id, course.id)
  assert.equal(candidate.courseNumber, course.number)
  assert.equal(canImportTranscriptCandidate(candidate), true)
})

test('catalog former-title notes and ASCII German transliterations still auto-match safely', () => {
  const entry = createEntry({
    extractedTitle: 'Mathematik für Informatik 2: Lineare Algebra',
    titleCandidates: ['Mathematik für Informatik 2: Lineare Algebra'],
    extractedEcts: 9,
  })
  const course = createCourse({
    id: 'course-linear-algebra',
    number: 'INF1020',
    title: 'INF1020 Mathematik fuer Informatik 2: Lineare Algebra (früher Mathematik II) - Vorlesung',
    ects: 9,
    masterCats: ['BASIS' satisfies MasterCat],
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.matchedCourse?.id, course.id)
  assert.equal(canImportTranscriptCandidate(candidate), true)
})

test('minor hyphenation differences do not block safe transcript auto-matches', () => {
  const entry = createEntry({
    extractedTitle: 'Praktische Informatik 2: Imperative und objekt-orientierte Programmierung',
    titleCandidates: ['Praktische Informatik 2: Imperative und objekt-orientierte Programmierung'],
    extractedEcts: 9,
  })
  const course = createCourse({
    id: 'course-pi2',
    number: 'INF1120',
    title: 'Praktische Informatik 2: Imperative und objektorientierte Programmierung',
    ects: 9,
    masterCats: ['INFO' satisfies MasterCat],
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.matchedCourse?.id, course.id)
  assert.equal(canImportTranscriptCandidate(candidate), true)
})

test('lecturer names disambiguate duplicate lecture and practical-course suggestions', () => {
  const entry = createEntry({
    extractedTitle: 'Grundlagen des Maschinellen Lernens',
    titleCandidates: ['Grundlagen des Maschinellen Lernens'],
    extractedEcts: 6,
    extractedExaminer: 'Martius',
    examinerCandidates: ['Martius'],
  })
  const lecture = createCourse({
    id: 'course-ml-lecture',
    number: 'INF3151',
    title: 'INF3151 Grundlagen des Maschinellen Lernens - Vorlesung/Übung',
    ects: 6,
    lecturer: 'Prof. Dr. rer. nat. Georg Martius',
  })
  const practical = createCourse({
    id: 'course-ml-practical',
    number: 'INF3152',
    title: 'INF3152 Grundlagen des Maschinellen Lernens - Praktikum',
    ects: 6,
    lecturer: 'o. Prof. Dr. rer. nat. Andreas Schilling',
    courseType: 'Praktikum',
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [practical, lecture], {
    studyProgramCode: 'BSC_INFO_2021',
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.matchedCourse?.id, lecture.id)
  assert.equal(candidate.courseNumber, lecture.number)
})

test('exact title matches may auto-match while preserving transcript ECTS', () => {
  const entry = createEntry({
    extractedTitle: 'Natural Language Processing',
    titleCandidates: ['Natural Language Processing'],
    extractedEcts: 6,
  })
  const course = createCourse({
    id: 'course-nlp',
    number: 'INFO4193',
    title: 'INFO4193 Natural Language Processing - Vorlesung/Übung',
    moduleTitle: 'Natural Language Processing',
    ects: 9,
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.matchedCourse?.id, course.id)
  assert.equal(candidate.ects, 6)
})

test('Praktische Informatik 4 transcript rows map to the research project course alias', () => {
  const entry = createEntry({
    extractedTitle: 'Praktische Informatik 4: Teamprojekt',
    titleCandidates: ['Praktische Informatik 4: Teamprojekt'],
    extractedEcts: 9,
  })
  const course = createCourse({
    id: 'course-research-project',
    number: 'INFO4998',
    title: 'INFO4998 Forschungsprojekt Informatik - Projekt',
    moduleTitle: 'Forschungsprojekt Informatik',
    ects: 9,
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: 'BSC_INFO_2021',
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.matchedCourse?.id, course.id)
})

test('similar top suggestions stay uncertain when cleaned titles differ', () => {
  const entry = createEntry({
    extractedTitle: 'Neural Data Science',
    titleCandidates: ['Neural Data Science'],
    extractedEcts: 6,
  })
  const course = createCourse({
    id: 'course-medical-data-science',
    number: 'MEDZ4991',
    title: 'Medical Data Science',
    ects: 6,
    masterCats: ['INFO' satisfies MasterCat],
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })

  assert.equal(candidate.status, 'uncertain')
  assert.equal(candidate.matchedCourse, null)
  assert.equal(candidate.matchOptions[0]?.id, course.id)
})

test('automatched courses can be converted back to anonymous übK rows', () => {
  const entry = createEntry({
    extractedTitle: 'Natural Language Processing',
    titleCandidates: ['Natural Language Processing'],
    extractedEcts: 6,
  })
  const course = createCourse({
    id: 'course-nlp',
    number: 'INFO4193',
    title: 'INFO4193 Natural Language Processing - Vorlesung/Übung',
    moduleTitle: 'Natural Language Processing',
    ects: 9,
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: null,
    regulationRuleGroups: [],
  })
  const acceptedAsUebk = acceptCandidateAsUebk(candidate)

  assert.equal(acceptedAsUebk.status, 'matched')
  assert.equal(acceptedAsUebk.matchedCourse, null)
  assert.equal(acceptedAsUebk.courseId, null)
  assert.equal(acceptedAsUebk.courseNumber, null)
  assert.equal(acceptedAsUebk.studyAreaCode, 'UEBK')
  assert.equal(acceptedAsUebk.title, entry.extractedTitle)
  assert.equal(acceptedAsUebk.ects, entry.extractedEcts)
  assert.equal(canImportTranscriptCandidate(acceptedAsUebk), true)
})

// Mirrors the live BSC_INFO_2021 rule groups (real German group types).
const BSC_INFO_RULE_GROUPS: RegulationRuleGroup[] = [
  { code: 'INF', name: 'Pflichtstudienbereich Informatik', groupType: 'pflicht', sortOrder: 1 },
  { code: 'PRAK', name: 'Wahlpflichtfach Praktische Informatik', groupType: 'wahlpflicht', sortOrder: 2 },
  { code: 'TECH', name: 'Wahlpflichtfach Technische Informatik', groupType: 'wahlpflicht', sortOrder: 3 },
  { code: 'THEO', name: 'Wahlpflichtfach Theoretische Informatik', groupType: 'wahlpflicht', sortOrder: 4 },
  { code: 'INFO', name: 'Wahlpflichtfach Informatik', groupType: 'wahlpflicht', sortOrder: 5 },
  { code: 'UEBK', name: 'Ueberfachliche Kompetenzen', groupType: 'free_choice', sortOrder: 6 },
  { code: 'THESIS', name: 'Bachelorarbeit incl. Vortrag', groupType: 'thesis', sortOrder: 7 },
]

test('resolveSectionRuleGroupCode maps ToR sections to regulation rule groups', () => {
  const resolve = (section: string | null): string | null =>
    resolveSectionRuleGroupCode(section, BSC_INFO_RULE_GROUPS)

  assert.equal(resolve('Pflichtbereich Informatik'), 'INF')
  assert.equal(resolve('Compulsory Area: Computer Science'), 'INF')
  assert.equal(resolve('Mathematik für Informatik 1: Analysis'), 'INF')
  assert.equal(resolve('Wahlpflichtfach Praktische Informatik'), 'PRAK')
  assert.equal(resolve('Elective Area: Theoretical Computer Science'), 'THEO')
  assert.equal(resolve('Wahlpflichtfach Technische Informatik'), 'TECH')
  assert.equal(resolve('Wahlpflichtfach Informatik'), 'INFO')
  assert.equal(resolve('Studium Professionale (übK)'), 'UEBK')
  assert.equal(resolve('Unzugeordnete Elemente'), null)
  assert.equal(resolveSectionRuleGroupCode('Pflichtbereich Informatik', []), null)
})

test('compulsory transcript rows auto-assign to the MAIN area even without a catalog mapping', () => {
  const entry = createEntry({
    sourceSection: 'Pflichtbereich Informatik',
    extractedTitle: 'Theoretische Informatik',
    titleCandidates: ['Theoretische Informatik'],
    extractedEcts: 9,
    defaultMasterCat: 'BASIS',
  })
  const course = createCourse({
    id: 'course-theoretische-informatik',
    number: 'INF1100',
    title: 'Theoretische Informatik',
    ects: 9,
    masterCats: ['BASIS' satisfies MasterCat],
    studyAreaOptions: undefined,
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: 'BSC_INFO_2021',
    regulationRuleGroups: BSC_INFO_RULE_GROUPS,
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.studyAreaCode, 'INF')
  assert.equal(candidate.masterCat, 'BASIS')
  assert.ok(candidate.matchedCourse?.regulationAreaCodes?.includes('INF'))
  assert.equal(canImportTranscriptCandidate(candidate), true)
})

test('elective transcript rows auto-assign to the section area instead of staying ambiguous', () => {
  const entry = createEntry({
    sourceSection: 'Wahlpflichtfach Praktische Informatik',
    extractedTitle: 'Datenbanksysteme',
    titleCandidates: ['Datenbanksysteme'],
    extractedEcts: 6,
    defaultMasterCat: 'PRAK',
  })
  const course = createCourse({
    id: 'course-datenbanksysteme',
    number: 'INF3000',
    title: 'Datenbanksysteme',
    ects: 6,
    masterCats: ['PRAK' satisfies MasterCat],
    studyAreaOptions: undefined,
  })

  const [candidate] = buildTranscriptImportCandidates([entry], [course], {
    studyProgramCode: 'BSC_INFO_2021',
    regulationRuleGroups: BSC_INFO_RULE_GROUPS,
  })

  assert.equal(candidate.status, 'matched')
  assert.equal(candidate.studyAreaCode, 'PRAK')
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
