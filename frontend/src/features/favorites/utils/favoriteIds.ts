export function toggleFavoriteId(favoriteIds: string[], courseId: string): string[] {
  return favoriteIds.includes(courseId)
    ? favoriteIds.filter((id) => id !== courseId)
    : [...favoriteIds, courseId]
}

export function updateSavingFavoriteIds(
  savingFavoriteIds: string[],
  courseId: string,
  isSaving: boolean,
): string[] {
  if (isSaving) {
    return savingFavoriteIds.includes(courseId)
      ? savingFavoriteIds
      : [...savingFavoriteIds, courseId]
  }
  return savingFavoriteIds.filter((id) => id !== courseId)
}
