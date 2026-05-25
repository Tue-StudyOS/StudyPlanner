function formatSummerSemester(year: number): string {
  return `SS ${year}`
}

function formatWinterSemester(startYear: number): string {
  return `WS ${startYear}/${String(startYear + 1).slice(-2)}`
}

export interface ParsedSemesterLabel {
  term: 'SS' | 'WS'
  year: number
}

export function parseSemesterLabel(label: string | null | undefined): ParsedSemesterLabel | null {
  const normalizedLabel = label?.trim().toUpperCase() ?? ''
  const summerMatch = normalizedLabel.match(/^SS\s+(\d{4})$/)
  if (summerMatch) {
    return {
      term: 'SS',
      year: Number(summerMatch[1]),
    }
  }

  const winterMatch = normalizedLabel.match(/^WS\s+(\d{4})\s*\/\s*(\d{2,4})$/)
  if (winterMatch) {
    return {
      term: 'WS',
      year: Number(winterMatch[1]),
    }
  }

  return null
}

function stepSemester(semester: ParsedSemesterLabel, delta: number): ParsedSemesterLabel {
  let nextTerm = semester.term
  let nextYear = semester.year

  for (let index = 0; index < Math.abs(delta); index += 1) {
    if (delta > 0) {
      if (nextTerm === 'SS') {
        nextTerm = 'WS'
      } else {
        nextTerm = 'SS'
        nextYear += 1
      }
      continue
    }

    if (nextTerm === 'WS') {
      nextTerm = 'SS'
    } else {
      nextTerm = 'WS'
      nextYear -= 1
    }
  }

  return {
    term: nextTerm,
    year: nextYear,
  }
}

export function formatSemesterLabel(semester: ParsedSemesterLabel): string {
  return semester.term === 'SS'
    ? formatSummerSemester(semester.year)
    : formatWinterSemester(semester.year)
}

export function formatSemesterLabelShort(label: string): string {
  const parsed = parseSemesterLabel(label)
  if (!parsed) return label
  const y2 = String(parsed.year).slice(-2)
  return parsed.term === 'SS'
    ? `SS ${y2}`
    : `WS ${y2}/${String(parsed.year + 1).slice(-2)}`
}

export function compareSemesterLabels(left: string, right: string): number {
  const leftSemester = parseSemesterLabel(left)
  const rightSemester = parseSemesterLabel(right)
  if (!leftSemester || !rightSemester) {
    return left.localeCompare(right)
  }
  if (leftSemester.year !== rightSemester.year) {
    return leftSemester.year - rightSemester.year
  }
  if (leftSemester.term === rightSemester.term) {
    return 0
  }
  return leftSemester.term === 'SS' ? -1 : 1
}

export function getCurrentSemesterLabel(now: Date = new Date()): string {
  const month = now.getMonth()
  const year = now.getFullYear()

  if (month >= 3 && month <= 8) {
    return formatSummerSemester(year)
  }

  return month >= 9 ? formatWinterSemester(year) : formatWinterSemester(year - 1)
}

export function getRelativeSemesterLabel(label: string, delta: number): string {
  const parsedSemester = parseSemesterLabel(label)
  if (!parsedSemester) {
    return label
  }
  return formatSemesterLabel(stepSemester(parsedSemester, delta))
}

function buildSemesterRange(startLabel: string, endLabel: string): string[] {
  const startSemester = parseSemesterLabel(startLabel)
  const endSemester = parseSemesterLabel(endLabel)
  if (!startSemester || !endSemester) {
    return [startLabel, endLabel].filter((label, index, labels) => label && labels.indexOf(label) === index)
  }

  const labels: string[] = []
  let currentSemester = startSemester
  let guard = 0
  while (compareSemesterLabels(formatSemesterLabel(currentSemester), endLabel) <= 0 && guard < 40) {
    labels.push(formatSemesterLabel(currentSemester))
    currentSemester = stepSemester(currentSemester, 1)
    guard += 1
  }
  return labels
}

export function buildSemesterOptions(
  labels: Array<string | null | undefined>,
  fallbackLabel: string = getCurrentSemesterLabel(),
  earliestLabel?: string | null,
  latestLabel?: string | null,
): string[] {
  const normalizedBaseLabels = labels
    .map((label) => label?.trim() ?? '')
    .filter((label) => label.length > 0)

  const defaultEarliestLabel = earliestLabel?.trim()
    || getRelativeSemesterLabel(fallbackLabel, -2)
  const defaultLatestLabel = latestLabel?.trim()
    || getRelativeSemesterLabel(fallbackLabel, 1)

  let options = buildSemesterRange(defaultEarliestLabel, defaultLatestLabel)
  if (options.length === 0) {
    options = [fallbackLabel]
  }

  const validBaseLabels = normalizedBaseLabels.filter((label) =>
    compareSemesterLabels(label, defaultEarliestLabel) >= 0
      && compareSemesterLabels(label, defaultLatestLabel) <= 0,
  )

  return [...new Set([...options, ...validBaseLabels])].sort(compareSemesterLabels)
}
