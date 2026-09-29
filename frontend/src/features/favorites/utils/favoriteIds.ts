export function toggleFavoriteId(
  favoriteIds: string[],
  courseId: string,
  courseGroups: string[][] = [],
): string[] {
  const aliases = courseGroups.find((group) => group.includes(courseId)) ?? [courseId]
  return favoriteIds.includes(courseId)
    ? favoriteIds.filter((id) => !aliases.includes(id))
    : [...favoriteIds, courseId]
}
