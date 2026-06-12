import type { SupportedLanguage } from '../../i18n'
import type { CourseExam } from '../types'

const GERMAN_DATE_PATTERN = /\b(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b/
const ISO_DATE_PATTERN = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/

function normalizeExamDate(date: string): string {
  return date.trim().replace(/\s+/g, ' ').toLowerCase()
}

function parseDateSortValue(date: string): number | null {
  const germanDateMatch = date.match(GERMAN_DATE_PATTERN)
  if (germanDateMatch) {
    const day = Number(germanDateMatch[1])
    const month = Number(germanDateMatch[2])
    const rawYear = Number(germanDateMatch[3])
    const year = rawYear < 100 ? 2000 + rawYear : rawYear
    return Date.UTC(year, month - 1, day)
  }

  const isoDateMatch = date.match(ISO_DATE_PATTERN)
  if (isoDateMatch) {
    const year = Number(isoDateMatch[1])
    const month = Number(isoDateMatch[2])
    const day = Number(isoDateMatch[3])
    return Date.UTC(year, month - 1, day)
  }

  return null
}

export function getExamDateOrdinal(exams: CourseExam[], examIndex: number): number {
  const uniqueDates = new Map<string, { key: string; firstIndex: number; sortValue: number | null }>()
  exams.forEach((exam, index) => {
    const normalizedDate = normalizeExamDate(exam.date)
    const key = normalizedDate || `undated-${index}`
    if (!uniqueDates.has(key)) {
      uniqueDates.set(key, {
        key,
        firstIndex: index,
        sortValue: parseDateSortValue(exam.date),
      })
    }
  })

  const ordinalByDate = new Map<string, number>()
  ;[...uniqueDates.values()]
    .sort((left, right) => {
      if (left.sortValue !== null && right.sortValue !== null && left.sortValue !== right.sortValue) {
        return left.sortValue - right.sortValue
      }
      if (left.sortValue !== null && right.sortValue === null) return -1
      if (left.sortValue === null && right.sortValue !== null) return 1
      return left.firstIndex - right.firstIndex
    })
    .forEach((entry, ordinal) => ordinalByDate.set(entry.key, ordinal))

  const exam = exams[examIndex]
  if (!exam) {
    return 0
  }
  const normalizedDate = normalizeExamDate(exam.date)
  const key = normalizedDate || `undated-${examIndex}`
  return ordinalByDate.get(key) ?? 0
}

export function getExamDisplayLabel(
  exams: CourseExam[],
  examIndex: number,
  language: SupportedLanguage,
): string {
  const ordinal = getExamDateOrdinal(exams, examIndex)
  if (ordinal === 0) {
    return language === 'de' ? 'Klausur' : 'Exam'
  }
  return language === 'de' ? 'Nachklausur' : 'Resit exam'
}
