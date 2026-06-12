// The CourseDetail and CoursesOverview page components are intentionally not
// re-exported here: they are lazy-loaded in App.tsx and static re-exports
// would pull them into the initial bundle.
export { CourseDetailDrawer } from './components/CourseDetailDrawer'
export { useCatalogCourseDetail } from './hooks/useCatalogCourseDetail'
export { useCatalogCourses } from './hooks/useCatalogCourses'
export { useCatalogPeriods } from './hooks/useCatalogPeriods'
export { ALL_CATALOG_PERIODS } from './api'
export { findCatalogPeriodForSemesterLabel } from './utils/periods'
export { cleanCourseTitle, formatCourseTypeLabel } from './utils/courseTitle.ts'
export {
  formatTermTypeLabel,
  getOfferingStatus,
  isCompulsoryCourse,
  type OfferingStatus,
} from './utils/catalogOffering.ts'
export type {
  CatalogPeriod,
  Course,
  CompletedCourse,
  CourseExam,
  CourseExternalLink,
  CourseTermType,
  MasterCat,
  MasterCategoryMeta,
  ScheduleSlot,
  StudyAreaOption,
} from './types'
