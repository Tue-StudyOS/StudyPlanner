import { CoursesOverview } from '../../courses/components/Overview'

// Reuses the full catalog, but hides bookmarking for signed-out visitors. The
// back affordance lives in TestLayout's header.
export function TestCatalog() {
  return <CoursesOverview favoritesVisibility="authenticatedOnly" />
}
