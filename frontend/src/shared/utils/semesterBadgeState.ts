let isSemesterBadgeVisible = false

export function readSemesterBadge(): boolean {
  return isSemesterBadgeVisible
}

export function setSemesterBadge(visible: boolean): void {
  isSemesterBadgeVisible = visible
}
