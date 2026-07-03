// Catalog lecturer strings carry full academic titles ("o. Prof. Dr. rer.
// nat. Torsten Grust"); cards and facts only want the person's name.

// Dotted abbreviations ("Prof.", "rer.", "Dipl.-Inform.") are detected
// generically; this set only covers title tokens that appear without a dot.
const UNDOTTED_TITLE_TOKENS = new Set([
  'pd',
  'prof',
  'dr',
  'phd',
  'msc',
  'bsc',
  'ba',
  'ma',
  'habil',
  'apl',
  'jun',
  'dipl',
  'ing',
  'mag',
])

function isTitleToken(token: string): boolean {
  if (token.includes('.')) {
    return true
  }
  return UNDOTTED_TITLE_TOKENS.has(token.toLowerCase())
}

function cleanSingleName(name: string): string {
  const tokens = name.split(/\s+/).filter((token) => token.length > 0)
  const nameTokens = tokens.filter((token) => !isTitleToken(token))
  // A title-only string (or one where everything looked like a title) is
  // returned unchanged rather than emptied.
  return nameTokens.length > 0 ? nameTokens.join(' ') : name
}

/**
 * Strips academic titles and grades from a lecturer string while keeping the
 * actual names, including particles ("von", "van") and hyphenated names.
 * Multiple lecturers separated by ",", ";" or "/" are cleaned individually
 * and rejoined with ", ".
 */
export function cleanLecturerName(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return trimmed
  }
  const cleanedNames = trimmed
    .split(/[,;/]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => cleanSingleName(part))
  return cleanedNames.length > 0 ? cleanedNames.join(', ') : trimmed
}
