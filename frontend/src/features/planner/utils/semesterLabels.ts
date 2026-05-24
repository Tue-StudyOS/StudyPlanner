function formatSummerSemester(year: number): string {
  return `SS ${year}`
}

function formatWinterSemester(startYear: number): string {
  return `WS ${startYear}/${String(startYear + 1).slice(-2)}`
}

interface ParsedSemesterLabel {
  term: 'SS' | 'WS'
  year: number
}

function parseSemesterLabel(label: string | null | undefined): ParsedSemesterLabel | null {
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

function formatSemesterLabel(semester: ParsedSemesterLabel): string {
  return semester.term === 'SS'
    ? formatSummerSemester(semester.year)
    : formatWinterSemester(semester.year)
}

export function getCurrentSemesterLabel(now: Date = new Date()): string {
  const month = now.getMonth()
  const year = now.getFullYear()

  if (month >= 3 && month <= 8) {
    return formatSummerSemester(year)
  }

  return month >= 9 ? formatWinterSemester(year) : formatWinterSemester(year - 1)
}

function buildSuggestedSemesterLabels(anchorLabel: string): string[] {
  const parsedAnchor = parseSemesterLabel(anchorLabel)
  if (!parsedAnchor) {
    return [anchorLabel]
  }

  return [-2, -1, 0, 1, 2, 3]
    .map((delta) => formatSemesterLabel(stepSemester(parsedAnchor, delta)))
}

export function buildSemesterOptions(
  labels: Array<string | null | undefined>,
  fallbackLabel: string = getCurrentSemesterLabel(),
): string[] {
  const uniqueLabels: string[] = []
  const seenLabels = new Set<string>()

  const baseLabels = labels
    .map((label) => label?.trim() ?? '')
    .filter((label) => label.length > 0)
  const anchorLabel = baseLabels[0] || fallbackLabel

  for (const label of [...buildSuggestedSemesterLabels(anchorLabel), ...baseLabels, fallbackLabel]) {
    const normalizedLabel = label.trim()
    if (!normalizedLabel || seenLabels.has(normalizedLabel)) {
      continue
    }
    seenLabels.add(normalizedLabel)
    uniqueLabels.push(normalizedLabel)
  }

  return uniqueLabels
}
