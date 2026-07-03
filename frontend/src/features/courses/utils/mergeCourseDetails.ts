import type { Course } from '../types.ts'

function preferDetail<T>(detailValue: T, summaryValue: T, isEmpty: (value: T) => boolean): T {
  return isEmpty(detailValue) ? summaryValue : detailValue
}

/**
 * Keeps list-row data when the detail fetch returns sparse fields (common when
 * the resolved catalog period lacks ILIAS text or scraped appointments).
 */
export function mergeCourseDetails(summary: Course, detail: Course): Course {
  return {
    ...summary,
    ...detail,
    title: detail.title.trim() ? detail.title : summary.title,
    lecturer: detail.lecturer.trim() ? detail.lecturer : summary.lecturer,
    description: detail.description.trim() ? detail.description : summary.description,
    schedule: detail.schedule.length > 0 ? detail.schedule : summary.schedule,
    contents: detail.contents && detail.contents.length > 0 ? detail.contents : summary.contents,
    exams: detail.exams.length > 0 ? detail.exams : summary.exams,
    prerequisites: detail.prerequisites.length > 0 ? detail.prerequisites : summary.prerequisites,
    studyAreaOptions: detail.studyAreaOptions && detail.studyAreaOptions.length > 0
      ? detail.studyAreaOptions
      : summary.studyAreaOptions,
    offeredPeriods: detail.offeredPeriods && detail.offeredPeriods.length > 0
      ? detail.offeredPeriods
      : summary.offeredPeriods,
    masterCats: detail.masterCats.length > 0 ? detail.masterCats : summary.masterCats,
    externalLinks: detail.externalLinks && detail.externalLinks.length > 0
      ? detail.externalLinks
      : summary.externalLinks,
    termType: preferDetail(detail.termType, summary.termType, (value) => value === 'unknown'),
  }
}
