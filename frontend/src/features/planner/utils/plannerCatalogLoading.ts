export function shouldLoadPlannerAllCatalogCourses(
  favoriteIds: readonly string[],
  isPastSemester: boolean,
): boolean {
  return !isPastSemester && favoriteIds.length > 0
}
