// The CourseDetail and CoursesOverview page components are intentionally not
// re-exported here: they are lazy-loaded in App.tsx and static re-exports
// would pull them into the initial bundle.
export { CourseDetailDrawer } from './components/CourseDetailDrawer'
export { useCatalogCourseDetail } from './hooks/useCatalogCourseDetail'
export { useCatalogCourses } from './hooks/useCatalogCourses'
export { useCatalogPeriods } from './hooks/useCatalogPeriods'
export { findCatalogPeriodForSemesterLabel } from './utils/periods'
export type {
  CatalogPeriod,
  Course,
  CompletedCourse,
  CourseExam,
  MasterCat,
  MasterCategoryMeta,
  ScheduleSlot,
  StudyAreaOption,
} from './types'
