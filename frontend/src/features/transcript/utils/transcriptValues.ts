// Pure value parsing for Transcript-of-Records rows: semester labels, numbers
// with German/English decimal formats, and completion-status classification.

export type TranscriptCompletionStatus = 'completed' | 'ignored' | 'unknown'

export const SEMESTER_OR_DATE_VALUE_SOURCE = String.raw`(?:\b(?:wt|st|ws|ss|wise|sose|winter(?:\s+(?:term|semester))?|summer(?:\s+(?:term|semester))?)\s+\d{2,4}(?:\s*\/\s*\d{2,4})?\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b)`
export const SEMESTER_OR_DATE_SEGMENT_PATTERN = new RegExp(SEMESTER_OR_DATE_VALUE_SOURCE, 'i')
const JOINED_SEMESTER_OR_DATE_PATTERN = new RegExp(String.raw`([^\s])(${SEMESTER_OR_DATE_VALUE_SOURCE})`, 'gi')
const DATE_VALUE_PATTERN = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/
const SUMMER_SEMESTER_VALUE_PATTERN = /^(?:st|ss|sose|summer(?:\s+(?:term|semester))?)\s+(\d{2,4})$/i
const WINTER_SEMESTER_VALUE_PATTERN = /^(?:wt|ws|wise|winter(?:\s+(?:term|semester))?)\s+(\d{2,4})(?:\s*\/\s*(\d{2,4}))?$/i

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

export function normalizeLineText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(JOINED_SEMESTER_OR_DATE_PATTERN, '$1 $2')
    .replace(/\s+([,.)])/g, '$1')
    .trim()
}

export function containsSemesterOrDateToken(value: string): boolean {
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

export function parseTranscriptNumber(value: string): number | null {
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

// ToR exports sometimes merge the status and ECTS columns into one token
// (e.g. "BE6") when the layout is tight; split them back apart.
export function splitMergedStatusAndEcts(
  statusText: string,
  ectsText: string,
): { statusText: string; ectsText: string } {
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
