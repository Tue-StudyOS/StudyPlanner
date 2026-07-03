import {
  buildRelevantCourseAreaOptions,
  formatRegulationAreaShortLabel,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation.ts'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation.ts'
import type { Course, MasterCat } from '../types'
import { formatCourseTypeLabel } from './courseTitle.ts'

interface CourseAreaTag {
  key: string
  label: string
  masterCat: MasterCat | null
}

function isProseminarCourse(course: Pick<Course, 'types' | 'title'>): boolean {
  const typeLabel = formatCourseTypeLabel(course.types ?? []).toLowerCase()
  return typeLabel.includes('proseminar') || course.title.toLowerCase().includes('proseminar')
}

function buildProseminarMainTag(
  regulationRuleGroups: RegulationRuleGroup[],
): CourseAreaTag | null {
  const mainGroup = regulationRuleGroups.find((group) => {
    const code = group.code.trim().toUpperCase()
    const groupType = group.groupType?.trim().toLowerCase() ?? ''
    return groupType === 'pflicht' || code === 'INF'
  })
  if (!mainGroup) {
    return null
  }
  return {
    key: mainGroup.code,
    label: formatRegulationAreaShortLabel(mainGroup.code, mainGroup.groupType),
    masterCat: studyAreaCodeToMasterCat(mainGroup.code),
  }
}

/**
 * Study-area tags shown on a course, adapted to the active examination
 * regulation: when a study program is selected the tags come from that
 * program's area mapping (e.g. "DIVERSE" for M.Sc. Machine Learning), so they
 * never show another regulation's categories. Without a selected program the
 * broad master categories are used as a public-catalog fallback.
 */
export function buildCourseAreaTags(
  course: Pick<Course, 'masterCats' | 'studyAreaOptions' | 'types' | 'title'>,
  studyProgramCode: string | null,
  regulationRuleGroups: RegulationRuleGroup[] = [],
): CourseAreaTag[] {
  let tags: CourseAreaTag[] = []
  if (studyProgramCode) {
    const regulationOptions = buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode)
    if (regulationOptions.length > 0) {
      tags = regulationOptions.map((option) => ({
        key: option.code,
        label: option.shortLabel,
        masterCat: option.masterCat,
      }))
    }
  }
  if (tags.length === 0) {
    tags = course.masterCats.map((masterCat) => ({
      key: masterCat,
      label: masterCat,
      masterCat,
    }))
  }

  if (isProseminarCourse(course) && regulationRuleGroups.length > 0) {
    const mainTag = buildProseminarMainTag(regulationRuleGroups)
    if (mainTag && !tags.some((tag) => tag.label === mainTag.label || tag.key === mainTag.key)) {
      tags = [mainTag, ...tags]
    }
  }

  return tags
}

interface CompletedCourseCardVisibility {
  showTitle: true
  showSeason: true
  showEcts: true
  showCompletedLabel: boolean
  showSecondaryDetails: boolean
}

export function getCompletedCourseCardVisibility(isCompleted: boolean): CompletedCourseCardVisibility {
  return {
    showTitle: true,
    showSeason: true,
    showEcts: true,
    showCompletedLabel: isCompleted,
    showSecondaryDetails: !isCompleted,
  }
}
