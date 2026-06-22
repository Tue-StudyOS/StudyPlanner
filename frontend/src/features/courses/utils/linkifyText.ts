export interface TextLink {
  label: string
  url: string
}

export type LinkedTextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; url: string }

interface LinkRange {
  start: number
  end: number
  url: string
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi
const TRAILING_URL_PUNCTUATION = /[),.;:!?]+$/

function normalizeLinks(links: TextLink[] | undefined): TextLink[] {
  const normalized: TextLink[] = []
  const seen = new Set<string>()
  for (const link of links ?? []) {
    const url = link.url.trim()
    const label = link.label.trim()
    if (!url || label.length < 3) continue
    const key = `${label.toLowerCase()}\u0000${url}`
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push({ label, url })
  }
  return normalized
}

function overlapsExistingRange(ranges: LinkRange[], start: number, end: number): boolean {
  return ranges.some((range) => start < range.end && end > range.start)
}

function addExplicitLinkRanges(text: string, links: TextLink[], ranges: LinkRange[]): void {
  const lowerText = text.toLowerCase()
  const sortedLinks = [...links].sort((left, right) => right.label.length - left.label.length)

  for (const link of sortedLinks) {
    const needle = link.label.toLowerCase()
    let searchFrom = 0
    while (searchFrom < lowerText.length) {
      const start = lowerText.indexOf(needle, searchFrom)
      if (start === -1) break
      const end = start + link.label.length
      if (!overlapsExistingRange(ranges, start, end)) {
        ranges.push({ start, end, url: link.url })
      }
      searchFrom = end
    }
  }
}

function trimUrlText(rawUrl: string): string {
  let trimmed = rawUrl
  while (TRAILING_URL_PUNCTUATION.test(trimmed)) {
    trimmed = trimmed.slice(0, -1)
  }
  return trimmed
}

function addPlainUrlRanges(text: string, ranges: LinkRange[]): void {
  for (const match of text.matchAll(URL_PATTERN)) {
    const rawUrl = match[0]
    const start = match.index ?? 0
    const urlText = trimUrlText(rawUrl)
    const end = start + urlText.length
    if (!urlText || overlapsExistingRange(ranges, start, end)) continue
    ranges.push({ start, end, url: urlText })
  }
}

export function buildLinkedTextSegments(
  text: string,
  links?: TextLink[],
): LinkedTextSegment[] {
  if (!text) return []

  const ranges: LinkRange[] = []
  addExplicitLinkRanges(text, normalizeLinks(links), ranges)
  addPlainUrlRanges(text, ranges)
  ranges.sort((left, right) => left.start - right.start || right.end - left.end)

  const segments: LinkedTextSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start < cursor) continue
    if (range.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, range.start) })
    }
    segments.push({ kind: 'link', text: text.slice(range.start, range.end), url: range.url })
    cursor = range.end
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) })
  }
  return segments
}
