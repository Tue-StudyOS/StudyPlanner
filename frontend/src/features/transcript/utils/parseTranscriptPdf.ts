import type { MasterCat } from '../../courses'
import type { ParsedTranscriptEntry } from '../types'
import { ensureReadableStreamAsyncIterator } from './ensureReadableStreamAsyncIterator.ts'
import {
  buildLineCollection,
  DEFAULT_COLUMN_LAYOUT,
  detectColumnLayout,
  extractColumnText,
  type TranscriptColumnLayout,
  type TranscriptLine,
} from './transcriptPdfLines.ts'
import {
  classifyTranscriptCompletionStatus,
  containsSemesterOrDateToken,
  normalizeLineText,
  parseTranscriptNumber,
  parseTranscriptSemesterValue,
  splitMergedStatusAndEcts,
} from './transcriptValues.ts'

// Re-exported because downstream code and tests import these from this module.
export {
  classifyTranscriptCompletionStatus,
  parseTranscriptSemesterValue,
  type TranscriptCompletionStatus,
} from './transcriptValues.ts'

interface ParsedTranscriptRow {
  page: number
  y: number
  section: string | null
  rawText: string
  title: string
  semester: string
  grade: number | null
  ects: number | null
  hasDetailTokens: boolean
  parseIssues: string[]
}

export interface TranscriptRowColumns {
  title: string
  semesterText: string
  examinerText?: string
  formText?: string
  gradeText: string
  statusText: string
  ectsText: string
  rawText: string
}

interface TranscriptRowContext {
  page: number
  y: number
  section: string | null
}

const SECTION_HEADING_PATTERN = /area:|study area|professional skills|unassigned elements|pflichtbereich|wahl?pflichtfach|studienbereich|studium professionale|unzugeordnete elemente/i

const PAGE_BREAK_DUPLICATE_BOTTOM_Y_MAX = 140
const PAGE_BREAK_DUPLICATE_TOP_Y_MIN = 700

function createId(prefix: string, index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${index}`
}

function appendContinuationText(baseText: string, continuationText: string): string {
  if (baseText.endsWith('-')) {
    return normalizeLineText(`${baseText}${continuationText}`)
  }
  return normalizeLineText(`${baseText} ${continuationText}`)
}

function isHeaderOrFooter(line: TranscriptLine): boolean {
  return (
    /transcript of records/i.test(line.text) ||
    /^page \d+ of \d+$/i.test(line.text) ||
    /^seite\s*\d+\s*von\s*\d+$/i.test(line.text) ||
    /student id no:/i.test(line.text) ||
    /student id number:/i.test(line.text) ||
    /^name des\/der studierenden:/i.test(line.text) ||
    /^student's name:/i.test(line.text) ||
    /^geburtsdatum und -ort:/i.test(line.text) ||
    /^geschlecht:/i.test(line.text) ||
    /^\(angestrebter\) abschluss:/i.test(line.text) ||
    /^studienfach\/-fächer:/i.test(line.text) ||
    /^matrikelnummer:/i.test(line.text) ||
    /^heimathochschule:/i.test(line.text) ||
    /^bezeichnung der leistung/i.test(line.text) ||
    /^examination\/course/i.test(line.text) ||
    /^tübingen, /i.test(line.text)
  )
}

function isSectionHeading(text: string): boolean {
  return SECTION_HEADING_PATTERN.test(text)
}

function extractSectionHeadingText(line: TranscriptLine, layout: TranscriptColumnLayout): string {
  const sectionText = extractColumnText(line, 0, layout.semesterMinX)
  return sectionText || normalizeLineText(line.text)
}

// Maps a ToR section heading to the default master category preselected for
// unmatched rows. German and English exports of the same transcript must map
// to the same category (e.g. "Pflichtbereich" === "Compulsory Area").
export function toDefaultMasterCat(section: string | null): MasterCat {
  const normalizedSection = section?.toLowerCase() ?? ''
  if (normalizedSection.includes('practical computer science') || normalizedSection.includes('praktische informatik')) {
    return 'PRAK'
  }
  if (
    normalizedSection.includes('theoretical computer science') ||
    normalizedSection.includes('theoretische informatik') ||
    normalizedSection.includes('logics')
  ) {
    return 'THEO'
  }
  if (
    normalizedSection.includes('technical computer science') ||
    normalizedSection.includes('technische informatik') ||
    normalizedSection.includes('robotik')
  ) {
    return 'TECH'
  }
  if (normalizedSection.includes('mathematics') || normalizedSection.includes('mathematik')) {
    return 'BASIS'
  }
  // Compulsory/foundation and cross-area sections default to BASIS. The
  // startsWith check keeps "Wahlpflichtbereich"-style electives out of it.
  if (
    normalizedSection.startsWith('pflichtbereich') ||
    normalizedSection.includes('compulsory') ||
    normalizedSection.includes('info basis') ||
    normalizedSection.includes('info basic') ||
    normalizedSection.includes('professional skills') ||
    normalizedSection.includes('studium professionale') ||
    normalizedSection.includes('übk') ||
    normalizedSection.includes('ubk')
  ) {
    return 'BASIS'
  }
  return 'INFO'
}

function shouldAppendContinuation(
  previousLine: TranscriptLine | null,
  currentLine: TranscriptLine,
  layout: TranscriptColumnLayout,
): boolean {
  if (!previousLine) {
    return false
  }
  if (previousLine.page !== currentLine.page) {
    return false
  }
  if (containsSemesterOrDateToken(currentLine.text)) {
    return false
  }
  if (currentLine.x >= layout.semesterMinX) {
    return false
  }
  if (isSectionHeading(currentLine.text) || isHeaderOrFooter(currentLine)) {
    return false
  }

  const distance = previousLine.y - currentLine.y
  return distance > 0 && distance <= 16
}

export function parseTranscriptRowColumns(
  columns: TranscriptRowColumns,
  context: TranscriptRowContext,
): ParsedTranscriptRow | null {
  const title = normalizeLineText(columns.title)
  const semester = parseTranscriptSemesterValue(columns.semesterText)
  const { statusText, ectsText } = splitMergedStatusAndEcts(columns.statusText, columns.ectsText)

  if (!title || !semester || !statusText) {
    return null
  }

  const ects = parseTranscriptNumber(ectsText)
  const gradeText = normalizeLineText(columns.gradeText)
  const grade = gradeText ? parseTranscriptNumber(gradeText) : null

  if (ects === null || (gradeText && grade === null)) {
    return null
  }

  const completionStatus = classifyTranscriptCompletionStatus(statusText)
  if (completionStatus === 'ignored') {
    return null
  }

  const parseIssues = completionStatus === 'unknown'
    ? [`Completion status "${statusText}" could not be verified automatically.`]
    : []

  return {
    page: context.page,
    y: context.y,
    section: context.section,
    rawText: normalizeLineText(columns.rawText),
    title,
    semester,
    grade,
    ects,
    hasDetailTokens: Boolean(normalizeLineText(columns.examinerText ?? '') || normalizeLineText(columns.formText ?? '')),
    parseIssues,
  }
}

function parseTranscriptRow(
  line: TranscriptLine,
  section: string | null,
  layout: TranscriptColumnLayout,
): ParsedTranscriptRow | null {
  return parseTranscriptRowColumns(
    {
      title: extractColumnText(line, 0, layout.semesterMinX),
      semesterText: extractColumnText(line, layout.semesterMinX, layout.examinerMinX),
      examinerText: extractColumnText(line, layout.examinerMinX, layout.formMinX),
      formText: extractColumnText(line, layout.formMinX, layout.gradeMinX),
      gradeText: extractColumnText(line, layout.gradeMinX, layout.statusMinX),
      statusText: extractColumnText(line, layout.statusMinX, layout.ectsMinX),
      ectsText: extractColumnText(line, layout.ectsMinX),
      rawText: line.text,
    },
    {
      page: line.page,
      y: line.y,
      section,
    },
  )
}

function haveMatchingRowOutcome(currentRow: ParsedTranscriptRow, nextRow: ParsedTranscriptRow): boolean {
  return (
    currentRow.section === nextRow.section &&
    currentRow.semester === nextRow.semester &&
    currentRow.grade === nextRow.grade &&
    currentRow.ects === nextRow.ects
  )
}

// ToR exports often render the module row and the course row as two adjacent
// lines with the same outcome; treat them as one entry with title candidates.
function areLikelyDuplicateRows(currentRow: ParsedTranscriptRow, nextRow: ParsedTranscriptRow): boolean {
  if (!haveMatchingRowOutcome(currentRow, nextRow)) {
    return false
  }

  const normalizedCurrentTitle = normalizeLineText(currentRow.title)
  const normalizedNextTitle = normalizeLineText(nextRow.title)
  const haveMatchingTitles = normalizedCurrentTitle.length > 0 && normalizedCurrentTitle === normalizedNextTitle

  if (currentRow.page === nextRow.page) {
    return (
      currentRow.y - nextRow.y > 0 &&
      currentRow.y - nextRow.y <= 28 &&
      (haveMatchingTitles || currentRow.hasDetailTokens !== nextRow.hasDetailTokens)
    )
  }

  if (nextRow.page !== currentRow.page + 1) {
    return false
  }

  return (
    currentRow.y <= PAGE_BREAK_DUPLICATE_BOTTOM_Y_MAX &&
    nextRow.y >= PAGE_BREAK_DUPLICATE_TOP_Y_MIN &&
    !currentRow.hasDetailTokens &&
    nextRow.hasDetailTokens
  )
}

async function loadPdfDocument(file: File) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (typeof window !== 'undefined') {
    const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
    if (pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    }
  }

  const fileBuffer = await file.arrayBuffer()
  try {
    return await pdfjs.getDocument({ data: new Uint8Array(fileBuffer) }).promise
  } catch (error) {
    throw new Error(
      'The PDF could not be read. Make sure it is a valid, non-password-protected Transcript of Records export.',
      { cause: error },
    )
  }
}

interface TranscriptParseState {
  parsedRows: ParsedTranscriptRow[]
  activeSection: string | null
  continuationAnchorLine: TranscriptLine | null
  continuationRowIndex: number | null
  columnLayout: TranscriptColumnLayout
}

function collectParsedRows(pageLines: TranscriptLine[], state: TranscriptParseState): void {
  for (const line of pageLines) {
    const headerLayout = detectColumnLayout(line)
    if (headerLayout) {
      state.columnLayout = headerLayout
      continue
    }

    if (isHeaderOrFooter(line)) {
      continue
    }

    if (isSectionHeading(line.text) && !containsSemesterOrDateToken(line.text)) {
      state.activeSection = extractSectionHeadingText(line, state.columnLayout)
      state.continuationAnchorLine = null
      state.continuationRowIndex = null
      continue
    }

    const parsedRow = parseTranscriptRow(line, state.activeSection, state.columnLayout)
    if (parsedRow) {
      state.parsedRows.push(parsedRow)
      state.continuationAnchorLine = line
      state.continuationRowIndex = state.parsedRows.length - 1
      continue
    }

    if (
      state.continuationAnchorLine &&
      state.continuationRowIndex !== null &&
      shouldAppendContinuation(state.continuationAnchorLine, line, state.columnLayout)
    ) {
      const previousParsedRow = state.parsedRows[state.continuationRowIndex]
      previousParsedRow.title = appendContinuationText(previousParsedRow.title, line.text)
      previousParsedRow.rawText = appendContinuationText(previousParsedRow.rawText, line.text)
      state.continuationAnchorLine = line
      continue
    }

    state.continuationAnchorLine = null
    state.continuationRowIndex = null
  }
}

function toTranscriptEntries(parsedRows: ParsedTranscriptRow[]): ParsedTranscriptEntry[] {
  const entries: ParsedTranscriptEntry[] = []

  for (let index = 0; index < parsedRows.length; index += 1) {
    const currentRow = parsedRows[index]
    const nextRow = parsedRows[index + 1]
    const titleCandidates = [currentRow.title]
    const rawTextCandidates = [currentRow.rawText]
    const parseIssues = [...currentRow.parseIssues]

    if (nextRow && areLikelyDuplicateRows(currentRow, nextRow)) {
      titleCandidates.push(nextRow.title)
      rawTextCandidates.push(nextRow.rawText)
      parseIssues.push(...nextRow.parseIssues)
      index += 1
    }

    const uniqueTitleCandidates = [...new Set(titleCandidates.map((title) => normalizeLineText(title)).filter(Boolean))]
    const uniqueRawTextCandidates = [...new Set(rawTextCandidates.map((text) => normalizeLineText(text)).filter(Boolean))]
    const extractedTitle = uniqueTitleCandidates[0] ?? currentRow.title

    entries.push({
      id: createId('transcript-entry', index),
      sourcePage: currentRow.page,
      sourceSection: currentRow.section,
      rawText: uniqueRawTextCandidates.join(' / '),
      extractedTitle,
      titleCandidates: uniqueTitleCandidates,
      extractedGrade: currentRow.grade,
      extractedEcts: currentRow.ects,
      extractedSemester: currentRow.semester,
      defaultMasterCat: toDefaultMasterCat(currentRow.section),
      parseIssues: [...new Set(parseIssues)],
    })
  }

  return entries
}

export async function parseTranscriptPdf(file: File): Promise<ParsedTranscriptEntry[]> {
  ensureReadableStreamAsyncIterator()

  const pdfDocument = await loadPdfDocument(file)
  const state: TranscriptParseState = {
    parsedRows: [],
    activeSection: null,
    continuationAnchorLine: null,
    continuationRowIndex: null,
    columnLayout: DEFAULT_COLUMN_LAYOUT,
  }

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    collectParsedRows(buildLineCollection(textContent.items, pageNumber), state)
  }

  return toTranscriptEntries(state.parsedRows)
}
