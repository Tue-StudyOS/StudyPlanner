const TYPE_WORDS = [
  'Vorlesung',
  'Übung',
  'Uebung',
  'Übungen',
  'Seminar',
  'Proseminar',
  'Hauptseminar',
  'Oberseminar',
  'Blockseminar',
  'Praktikum',
  'Blockpraktikum',
  'Tutorium',
  'Kolloquium',
  'Lecture',
  'Exercise',
  'Exercises',
  'Tutorial',
  'Practical',
  'Lab',
]

const TYPE_PHRASE = `(?:${TYPE_WORDS.join('|')})(?:\\s*(?:\\+|&|/|,|und|and|mit|with)\\s*(?:${TYPE_WORDS.join('|')}))*`
const PARENTHESIZED_TYPE_SUFFIX = new RegExp(`\\s*[([]\\s*${TYPE_PHRASE}\\s*[)\\]]\\s*$`, 'iu')
const SEPARATED_TYPE_SUFFIX = new RegExp(`\\s*[-–—:,·]\\s*${TYPE_PHRASE}\\s*$`, 'iu')
// Course codes like "INFO2420", "BIOINF-3510", or "ML 4201" at the start of a title.
const LEADING_COURSE_CODE = /^[A-Za-z]{2,10}[-\s]?\d{3,5}[A-Za-z0-9.]*\s*[:·\-–—]?\s+/u

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Course titles in the catalog often carry their course number and end in
 * their event type ("BIOINF3510 … (Vorlesung)"). Both are shown in dedicated
 * places (detail facts, type tag), so the displayed title drops them.
 */
export function cleanCourseTitle(title: string, courseNumber?: string | null): string {
  let cleanedTitle = title.trim()

  const normalizedNumber = courseNumber?.trim()
  if (normalizedNumber) {
    const numberPattern = new RegExp(
      `(?:^|\\s)${escapeRegExp(normalizedNumber)}(?=$|[\\s:·\\-–—,)])[:·\\-–—,]?`,
      'giu',
    )
    cleanedTitle = cleanedTitle.replace(numberPattern, ' ').replace(/\s{2,}/g, ' ').trim()
  }
  cleanedTitle = cleanedTitle.replace(LEADING_COURSE_CODE, '').trim()

  for (let guard = 0; guard < 4; guard += 1) {
    const nextTitle = cleanedTitle
      .replace(PARENTHESIZED_TYPE_SUFFIX, '')
      .replace(SEPARATED_TYPE_SUFFIX, '')
      .trim()
    if (nextTitle === cleanedTitle) {
      break
    }
    cleanedTitle = nextTitle
  }

  cleanedTitle = cleanedTitle.replace(/^[-–—:·,\s]+|[-–—:·,\s]+$/gu, '')

  return cleanedTitle.length > 0 ? cleanedTitle : title.trim()
}

// Catalog data mixes German and English type names; tags render uniformly in
// English.
const TYPE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^vorlesung(en)?$/i, 'Lecture'],
  [/^(ü|ue)bung(en)?$/i, 'Exercise'],
  [/^(haupt|ober|block)?seminar$/i, 'Seminar'],
  [/^proseminar$/i, 'Proseminar'],
  [/^praxisseminar$/i, 'Practical seminar'],
  [/^(block)?praktikum$/i, 'Practical'],
  [/^projekt$/i, 'Project'],
  [/^kolloquium$/i, 'Colloquium'],
  [/^vortrag$/i, 'Talk'],
  [/^tutorium$/i, 'Tutorial'],
  [/^ringvorlesung$/i, 'Lecture series'],
  [/^informationsveranstaltung$/i, 'Info session'],
  [/^einf(ü|ue)hrungskurs$/i, 'Introductory course'],
  [/^blockveranstaltung$/i, 'Block course'],
  [/^repetitorium$/i, 'Revision course'],
]

// Some catalog types are combined ("Vorlesung/Übung", "Vorlesung mit Übung");
// translate each part so no German label leaks through.
function splitCourseTypeParts(type: string): string[] {
  return type
    .split(/\s*(?:[/+&,]|\bmit\b|\bund\b|\band\b|\bwith\b)\s*/i)
    .map((part) => part.trim())
    .filter((part) => /[\p{L}\p{N}]/u.test(part))
}

export function translateCourseType(type: string): string {
  const parts = splitCourseTypeParts(type)
  return parts
    .map((part) => {
      const translation = TYPE_TRANSLATIONS.find(([pattern]) => pattern.test(part))
      return translation ? translation[1] : part
    })
    .join(' + ')
}

export function formatCourseTypeLabel(types: string[]): string {
  const uniqueTypes = [
    ...new Set(
      types
        .flatMap((type) => splitCourseTypeParts(type))
        .map((part) => translateCourseType(part))
        .filter((type) => type.length > 0),
    ),
  ]
  return uniqueTypes.join(' + ') || 'Course'
}
