// Per-course badge colors for the simplified schedule: the grid cells and the
// course lists show a colored square with a number instead of the full title.
// Color is deterministic per course id (so it stays stable across renders and
// between the grid and the legend), drawn from a fixed, legible palette.
const COURSE_COLOR_PALETTE = [
  '#4361ee',
  '#f72585',
  '#4cc9f0',
  '#f9844a',
  '#43aa8b',
  '#9b5de5',
  '#ef476f',
  '#118ab2',
  '#06d6a0',
  '#ffc300',
  '#7209b7',
  '#2a9d8f',
] as const

function hashCourseId(courseId: string): number {
  let hash = 0
  for (let index = 0; index < courseId.length; index += 1) {
    hash = (hash * 31 + courseId.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

export function getCourseColor(courseId: string): string {
  return COURSE_COLOR_PALETTE[hashCourseId(courseId) % COURSE_COLOR_PALETTE.length]
}

// Picks black or white for legibility on the given fill, using perceived
// luminance so the number stays readable regardless of palette entry or theme.
export function getContrastTextColor(hexColor: string): string {
  const normalized = hexColor.replace('#', '')
  const red = parseInt(normalized.slice(0, 2), 16)
  const green = parseInt(normalized.slice(2, 4), 16)
  const blue = parseInt(normalized.slice(4, 6), 16)
  const perceivedLuminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return perceivedLuminance > 0.6 ? '#111111' : '#ffffff'
}

// Numbers planned courses 1..n in plan order; the same id always keeps its first
// number so the grid badge and the legend agree.
export function assignCourseNumbers(courseIds: string[]): Map<string, number> {
  const numbers = new Map<string, number>()
  let next = 1
  for (const courseId of courseIds) {
    if (!numbers.has(courseId)) {
      numbers.set(courseId, next)
      next += 1
    }
  }
  return numbers
}
