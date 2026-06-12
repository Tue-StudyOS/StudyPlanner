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

/**
 * Course titles in the catalog often end in their event type ("… (Vorlesung)",
 * "… - Übung"). The type is shown as a dedicated tag, so the title itself
 * should not repeat it.
 */
export function cleanCourseTitle(title: string): string {
  let cleanedTitle = title.trim()

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

  return cleanedTitle.length > 0 ? cleanedTitle : title.trim()
}

export function formatCourseTypeLabel(types: string[]): string {
  const uniqueTypes = [...new Set(types.map((type) => type.trim()).filter((type) => type.length > 0))]
  return uniqueTypes.join(' + ') || 'Course'
}
