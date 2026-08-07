// The CoursesOverview page component is intentionally not re-exported here:
// it is lazy-loaded in App.tsx and a static re-export would pull it into the
// initial bundle.
export { CourseDetailDrawer } from './components/CourseDetailDrawer'
export { useCatalogCourseDetail } from './hooks/useCatalogCourseDetail'
export { useCatalogCourses } from './hooks/useCatalogCourses'
export { useCatalogPeriods } from './hooks/useCatalogPeriods'
export { ALL_CATALOG_PERIODS } from './api'
export { findCatalogPeriodForSemesterLabel } from './utils/periods'
export { cleanCourseTitle, formatCourseTypeLabel } from './utils/courseTitle.ts'
export {
  getDetailSeasonTermType,
  getLatestKnownSeasonTermType,
  getOfferingStatus,
  getOutdatedOfferingSortRank,
  getRecentSeasonTermType,
  isCompulsoryCourse,
  isDefaultVisibleOfferingStatus,
  isOutdatedOfferingStatus,
  resolveUnconfirmedOfferingVisibility,
  type OfferingStatus,
} from './utils/catalogOffering.ts'
export type {
  CatalogPeriod,
  Course,
  CompletedCourse,
  CourseExam,
  CourseExternalLink,
  CourseParticipantLimit,
  CourseRatingSummary,
  CourseTermType,
  MasterCat,
  MasterCategoryMeta,
  ScheduleSlot,
  StudyAreaOption,
} from './types'
