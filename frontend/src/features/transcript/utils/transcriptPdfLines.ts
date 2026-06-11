// Geometry layer for Transcript-of-Records PDFs: groups pdf.js text items into
// lines, extracts column slices, and derives the table-column layout from the
// repeated header row ("Bezeichnung der Leistung ... Note Status CP" /
// "Examination/Course ... Grade Status CP") so small per-language and per-page
// x-offsets do not push values into the wrong column.
import { normalizeLineText, SEMESTER_OR_DATE_SEGMENT_PATTERN } from './transcriptValues.ts'

export interface TextItemLike {
  str: string
  transform: number[]
  width: number
}

export interface TranscriptLine {
  page: number
  y: number
  x: number
  text: string
  items: TextItemLike[]
}

export interface TranscriptColumnLayout {
  semesterMinX: number
  examinerMinX: number
  formMinX: number
  gradeMinX: number
  statusMinX: number
  ectsMinX: number
}

// Fallback for documents where no table-header row is detected. Matches the
// historical hardcoded boundaries of the German ToR export.
export const DEFAULT_COLUMN_LAYOUT: TranscriptColumnLayout = {
  semesterMinX: 295,
  examinerMinX: 360,
  formMinX: 445,
  gradeMinX: 460,
  statusMinX: 495,
  ectsMinX: 532,
}

// Data cells start at or slightly right of their header label; shifting the
// boundary left by this tolerance keeps them in the intended column.
const HEADER_COLUMN_TOLERANCE = 4

const HEADER_LABEL_MATCHERS: ReadonlyArray<{ key: keyof TranscriptColumnLayout; pattern: RegExp }> = [
  { key: 'semesterMinX', pattern: /^semester$/i },
  { key: 'examinerMinX', pattern: /^(?:prüfer\/?in|pruefer\/?in|examiner)$/i },
  { key: 'formMinX', pattern: /^form$/i },
  { key: 'gradeMinX', pattern: /^(?:note|grade)$/i },
  { key: 'statusMinX', pattern: /^status$/i },
  { key: 'ectsMinX', pattern: /^(?:cp|ects|lp)$/i },
]

export function isTextItemLike(value: unknown): value is TextItemLike {
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

export function buildLineText(items: TextItemLike[]): string {
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

export function extractColumnText(line: TranscriptLine, minX: number, maxX?: number): string {
  const matchingItems = line.items.filter(
    (item) => item.transform[4] >= minX && (maxX === undefined || item.transform[4] < maxX),
  )
  return buildLineText(matchingItems)
}

export function buildLineCollection(items: unknown[], pageNumber: number): TranscriptLine[] {
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

export function detectColumnLayout(line: TranscriptLine): TranscriptColumnLayout | null {
  const labelPositions = new Map<keyof TranscriptColumnLayout, number>()

  for (const item of line.items) {
    const label = item.str.trim()
    if (!label) {
      continue
    }
    for (const { key, pattern } of HEADER_LABEL_MATCHERS) {
      if (!labelPositions.has(key) && pattern.test(label)) {
        labelPositions.set(key, item.transform[4])
        break
      }
    }
  }

  if (labelPositions.size !== HEADER_LABEL_MATCHERS.length) {
    return null
  }

  const layout: TranscriptColumnLayout = {
    semesterMinX: labelPositions.get('semesterMinX')! - HEADER_COLUMN_TOLERANCE,
    examinerMinX: labelPositions.get('examinerMinX')! - HEADER_COLUMN_TOLERANCE,
    formMinX: labelPositions.get('formMinX')! - HEADER_COLUMN_TOLERANCE,
    gradeMinX: labelPositions.get('gradeMinX')! - HEADER_COLUMN_TOLERANCE,
    statusMinX: labelPositions.get('statusMinX')! - HEADER_COLUMN_TOLERANCE,
    ectsMinX: labelPositions.get('ectsMinX')! - HEADER_COLUMN_TOLERANCE,
  }

  const orderedBoundaries = [
    layout.semesterMinX,
    layout.examinerMinX,
    layout.formMinX,
    layout.gradeMinX,
    layout.statusMinX,
    layout.ectsMinX,
  ]
  const isStrictlyIncreasing = orderedBoundaries.every(
    (boundary, index) => index === 0 || boundary > orderedBoundaries[index - 1],
  )

  return isStrictlyIncreasing ? layout : null
}
