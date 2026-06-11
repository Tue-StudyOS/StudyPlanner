import type { MasterCat } from '../../courses'
import type { ParsedTranscriptEntry } from '../types'

interface TextItemLike {
  str: string
  transform: number[]
  width: number
}

interface TranscriptLine {
  page: number
  y: number
  x: number
  text: string
  items: TextItemLike[]
}

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

export type TranscriptCompletionStatus = 'completed' | 'ignored' | 'unknown'

const SEMESTER_OR_DATE_VALUE_SOURCE = String.raw`(?:\b(?:wt|st|ws|ss|wise|sose|winter(?:\s+(?:term|semester))?|summer(?:\s+(?:term|semester))?)\s+\d{2,4}(?:\s*\/\s*\d{2,4})?\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b)`
const SEMESTER_OR_DATE_SEGMENT_PATTERN = new RegExp(SEMESTER_OR_DATE_VALUE_SOURCE, 'i')
const JOINED_SEMESTER_OR_DATE_PATTERN = new RegExp(String.raw`([^\s])(${SEMESTER_OR_DATE_VALUE_SOURCE})`, 'gi')
const DATE_VALUE_PATTERN = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/
const SUMMER_SEMESTER_VALUE_PATTERN = /^(?:st|ss|sose|summer(?:\s+(?:term|semester))?)\s+(\d{2,4})$/i
const WINTER_SEMESTER_VALUE_PATTERN = /^(?:wt|ws|wise|winter(?:\s+(?:term|semester))?)\s+(\d{2,4})(?:\s*\/\s*(\d{2,4}))?$/i
const SECTION_HEADING_PATTERN = /area:|professional skills|unassigned elements|pflichtbereich|wahl?pflichtfach|studium professionale|unzugeordnete elemente/i

const COMPLETED_STATUS_VALUES = new Set([
  'be',
  'vbe',
  'anerkannt',
  'angerechnet',
  'bestanden',
  'completed',
  'credit',
  'credited',
  'equivalent',
  'erbracht',
  'pass',
  'passed',
  'recognised',
  'recognized',
  'successful',
])

const IGNORED_STATUS_VALUES = new Set([
  'abgebrochen',
  'begonnen',
  'examregistered',
  'f',
  'fail',
  'failed',
  'inprogress',
  'mb',
  'modulbegonnen',
  'na',
  'nb',
  'nbe',
  'nf',
  'nichtabgeschlossen',
  'nichtbestanden',
  'notpassed',
  'ongoing',
  'open',
  'pending',
  'progress',
  'prufungvorhanden',
  'pv',
  'registered',
  'unfinished',
  'withdrawn',
])

const SEMESTER_COLUMN_MIN_X = 295
const EXAMINER_COLUMN_MIN_X = 360
const FORM_COLUMN_MIN_X = 445
const GRADE_COLUMN_MIN_X = 460
const STATUS_COLUMN_MIN_X = 495
const ECTS_COLUMN_MIN_X = 532

const PAGE_BREAK_DUPLICATE_BOTTOM_Y_MAX = 140
const PAGE_BREAK_DUPLICATE_TOP_Y_MIN = 700

function isTextItemLike(value: unknown): value is TextItemLike {
  if (!value || typeof value !== 'object') {
    return false
  }

  const item = value as Partial<TextItemLike>
  return (
    typeof item.str === 'string' &&
    Array.isArray(item.transform) &&
    typeof item.transform[4] === 'number' &&
    typeof item.transform[5] === 'number' &&
    typeof item.width === 'number'
  )
}

function createId(prefix: string, index: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${index}`
}

function normalizeLineText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(JOINED_SEMESTER_OR_DATE_PATTERN, '$1 $2')
    .replace(/\s+([,.)])/g, '$1')
    .trim()
}

function buildLineText(items: TextItemLike[]): string {
  let text = ''
  let previousRightEdge: number | null = null

  for (const item of items) {
    const rawSegment = item.str.replace(/\s+/g, ' ')
    const segment = rawSegment.trim()
    if (!segment) {
      previousRightEdge = item.transform[4] + item.width
      continue
    }

    const currentX = item.transform[4]
    const needsSpace =
      text.length > 0 &&
      !text.endsWith(' ') &&
      (segment.startsWith('(') ||
        SEMESTER_OR_DATE_SEGMENT_PATTERN.test(segment) ||
        (previousRightEdge !== null && currentX - previousRightEdge > 1.5))

    if (needsSpace) {
      text += ' '
    }

    text += segment
    previousRightEdge = item.transform[4] + item.width
  }

  return normalizeLineText(text)
}

function extractColumnText(line: TranscriptLine, minX: number, maxX?: number): string {
  const matchingItems = line.items.filter(
    (item) => item.transform[4] >= minX && (maxX === undefined || item.transform[4] < maxX),
  )
  return buildLineText(matchingItems)
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
    /^geburtsdatum und -ort:/i.test(line.text) ||
    /^geschlecht:/i.test(line.text) ||
    /^\(angestrebter\) abschluss:/i.test(line.text) ||
    /^studienfach\/-fächer:/i.test(line.text) ||
    /^matrikelnummer:/i.test(line.text) ||
    /^heimathochschule:/i.test(line.text) ||
    /^bezeichnung der leistung/i.test(line.text) ||
    /^tübingen, /i.test(line.text)
  )
}

function isSectionHeading(text: string): boolean {
  return SECTION_HEADING_PATTERN.test(text)
}

function extractSectionHeadingText(line: TranscriptLine): string {
  const sectionText = extractColumnText(line, 0, SEMESTER_COLUMN_MIN_X)
  return sectionText || normalizeLineText(line.text)
}

function toDefaultMasterCat(section: string | null): MasterCat {
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
  // Professional skills and similar cross-area sections fall back to BASIS.
  if (
    normalizedSection.includes('professional skills') ||
    normalizedSection.includes('studium professionale') ||
    normalizedSection.includes('compulsory') ||
    normalizedSection.includes('übk') ||
    normalizedSection.includes('ubk')
  ) {
    return 'BASIS'
  }
  return 'INFO'
}

function containsSemesterOrDateToken(value: string): boolean {
  return SEMESTER_OR_DATE_SEGMENT_PATTERN.test(value)
}

function normalizeYearValue(value: string): number {
  const parsedYear = Number(value)
  if (!Number.isInteger(parsedYear)) {
    return Number.NaN
  }
  if (value.length === 2) {
    return parsedYear >= 70 ? 1900 + parsedYear : 2000 + parsedYear
  }
  return parsedYear
}

function formatTwoDigitYear(year: number): string {
  return String(year).slice(-2).padStart(2, '0')
}

function formatWinterSemesterLabel(startYear: number, endYear: number = startYear + 1): string {
  return `WS ${startYear}/${formatTwoDigitYear(endYear)}`
}

export function parseTranscriptSemesterValue(value: string): string | null {
  const normalizedValue = normalizeLineText(value).replace(/[.\s]+$/g, '')
  if (!normalizedValue) {
    return null
  }

  const winterMatch = normalizedValue.match(WINTER_SEMESTER_VALUE_PATTERN)
  if (winterMatch) {
    const startYear = normalizeYearValue(winterMatch[1])
    const endYear = winterMatch[2] ? normalizeYearValue(winterMatch[2]) : startYear + 1
    if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
      return formatWinterSemesterLabel(startYear, endYear)
    }
  }

  const summerMatch = normalizedValue.match(SUMMER_SEMESTER_VALUE_PATTERN)
  if (summerMatch) {
    const year = normalizeYearValue(summerMatch[1])
    if (Number.isFinite(year)) {
      return `SS ${year}`
    }
  }

  const dateMatch = normalizedValue.match(DATE_VALUE_PATTERN)
  if (dateMatch) {
    const month = Number(dateMatch[2])
    const year = normalizeYearValue(dateMatch[3])
    if (!Number.isFinite(month) || !Number.isFinite(year) || month < 1 || month > 12) {
      return null
    }
    if (month >= 4 && month <= 9) {
      return `SS ${year}`
    }
    if (month >= 10) {
      return formatWinterSemesterLabel(year)
    }
    return formatWinterSemesterLabel(year - 1, year)
  }

  return null
}

function parseTranscriptNumber(value: string): number | null {
  const normalizedValue = value.replace(/\s+/g, '').replace(',', '.')
  if (!normalizedValue) {
    return null
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(normalizedValue)) {
    return null
  }

  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function normalizeStatusValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function splitMergedStatusAndEcts(statusText: string, ectsText: string): { statusText: string; ectsText: string } {
  const normalizedStatusText = normalizeLineText(statusText)
  const normalizedEctsText = normalizeLineText(ectsText)

  if (normalizedEctsText) {
    return {
      statusText: normalizedStatusText,
      ectsText: normalizedEctsText,
    }
  }

  const mergedMatch = normalizedStatusText.match(/^(.*?)(\d+(?:[.,]\d+)?)$/)
  if (!mergedMatch) {
    return {
      statusText: normalizedStatusText,
      ectsText: normalizedEctsText,
    }
  }

  const mergedStatusText = normalizeLineText(mergedMatch[1])
  const mergedEctsText = mergedMatch[2]
  if (!mergedStatusText || parseTranscriptNumber(mergedEctsText) === null) {
    return {
      statusText: normalizedStatusText,
      ectsText: normalizedEctsText,
    }
  }

  return {
    statusText: mergedStatusText,
    ectsText: mergedEctsText,
  }
}

export function classifyTranscriptCompletionStatus(value: string): TranscriptCompletionStatus {
  const normalizedValue = normalizeStatusValue(value)
  if (!normalizedValue) {
    return 'unknown'
  }
  if (COMPLETED_STATUS_VALUES.has(normalizedValue)) {
    return 'completed'
  }
  if (IGNORED_STATUS_VALUES.has(normalizedValue)) {
    return 'ignored'
  }
  if (/bestand|pass|credit|anerk|angerech|recogn/.test(normalizedValue)) {
    return 'completed'
  }
  if (/fail|nicht|begonn|pending|ongoing|withdrawn|abgebroch|vorhand|registered|unfinished|progress/.test(normalizedValue)) {
    return 'ignored'
  }
  if (/^[a-z]{1,6}$/.test(normalizedValue)) {
    return 'completed'
  }
  return 'unknown'
}

function shouldAppendContinuation(previousLine: TranscriptLine | null, currentLine: TranscriptLine): boolean {
  if (!previousLine) {
    return false
  }
  if (previousLine.page !== currentLine.page) {
    return false
  }
  if (containsSemesterOrDateToken(currentLine.text)) {
    return false
  }
  if (currentLine.x >= SEMESTER_COLUMN_MIN_X) {
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

function parseTranscriptRow(line: TranscriptLine, section: string | null): ParsedTranscriptRow | null {
  return parseTranscriptRowColumns(
    {
      title: extractColumnText(line, 0, SEMESTER_COLUMN_MIN_X),
      semesterText: extractColumnText(line, SEMESTER_COLUMN_MIN_X, EXAMINER_COLUMN_MIN_X),
      examinerText: extractColumnText(line, EXAMINER_COLUMN_MIN_X, FORM_COLUMN_MIN_X),
      formText: extractColumnText(line, FORM_COLUMN_MIN_X, GRADE_COLUMN_MIN_X),
      gradeText: extractColumnText(line, GRADE_COLUMN_MIN_X, STATUS_COLUMN_MIN_X),
      statusText: extractColumnText(line, STATUS_COLUMN_MIN_X, ECTS_COLUMN_MIN_X),
      ectsText: extractColumnText(line, ECTS_COLUMN_MIN_X),
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

function buildLineCollection(items: unknown[], pageNumber: number): TranscriptLine[] {
  const linesByY = new Map<number, TextItemLike[]>()

  for (const item of items) {
    if (!isTextItemLike(item)) {
      continue
    }
    const y = Math.round(item.transform[5])
    const sameLineItems = linesByY.get(y) ?? []
    sameLineItems.push(item)
    linesByY.set(y, sameLineItems)
  }

  return [...linesByY.entries()]
    .sort((firstEntry, secondEntry) => secondEntry[0] - firstEntry[0])
    .map(([y, lineItems]) => {
      const sortedItems = [...lineItems].sort((firstItem, secondItem) => firstItem.transform[4] - secondItem.transform[4])
      return {
        page: pageNumber,
        y,
        x: Math.round(Math.min(...sortedItems.map((item) => item.transform[4]))),
        text: buildLineText(sortedItems),
        items: sortedItems,
      }
    })
    .filter((line) => line.text.length > 0)
}

// Safari and iOS browsers do not implement async iteration over ReadableStream,
// which pdf.js relies on internally in getTextContent(). Without this polyfill the
// parser throws "undefined is not a function (near '...value of readableStream...')".
function ensureReadableStreamAsyncIterator(): void {
  if (typeof ReadableStream === 'undefined') {
    return
  }

  const streamPrototype = ReadableStream.prototype as ReadableStream & {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>
  }
  if (typeof streamPrototype[Symbol.asyncIterator] === 'function') {
    return
  }

  streamPrototype[Symbol.asyncIterator] = function asyncIterator(this: ReadableStream) {
    const reader = this.getReader()
    return {
      next(): Promise<IteratorResult<unknown>> {
        return reader.read() as Promise<IteratorResult<unknown>>
      },
      async return(value?: unknown): Promise<IteratorResult<unknown>> {
        reader.releaseLock()
        return { done: true, value }
      },
      [Symbol.asyncIterator]() {
        return this
      },
    }
  }
}

export async function parseTranscriptPdf(file: File): Promise<ParsedTranscriptEntry[]> {
  ensureReadableStreamAsyncIterator()

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (typeof window !== 'undefined') {
    const workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
    if (pdfjs.GlobalWorkerOptions.workerSrc !== workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
    }
  }

  const fileBuffer = await file.arrayBuffer()
  const pdfDocument = await pdfjs.getDocument({
    data: new Uint8Array(fileBuffer),
  }).promise
  const parsedRows: ParsedTranscriptRow[] = []
  let activeSection: string | null = null
  let continuationAnchorLine: TranscriptLine | null = null
  let continuationRowIndex: number | null = null

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const pageLines = buildLineCollection(textContent.items, pageNumber)

    for (const line of pageLines) {
      if (isHeaderOrFooter(line)) {
        continue
      }

      if (isSectionHeading(line.text) && !containsSemesterOrDateToken(line.text)) {
        activeSection = extractSectionHeadingText(line)
        continuationAnchorLine = null
        continuationRowIndex = null
        continue
      }

      const parsedRow = parseTranscriptRow(line, activeSection)
      if (parsedRow) {
        parsedRows.push(parsedRow)
        continuationAnchorLine = line
        continuationRowIndex = parsedRows.length - 1
        continue
      }

      if (
        continuationAnchorLine &&
        continuationRowIndex !== null &&
        shouldAppendContinuation(continuationAnchorLine, line)
      ) {
        const previousParsedRow = parsedRows[continuationRowIndex]
        previousParsedRow.title = appendContinuationText(previousParsedRow.title, line.text)
        previousParsedRow.rawText = appendContinuationText(previousParsedRow.rawText, line.text)
        continuationAnchorLine = line
        continue
      }

      continuationAnchorLine = null
      continuationRowIndex = null
    }
  }

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
