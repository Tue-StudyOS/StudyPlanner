export interface CatalogStudySelection {
  studyProgramCode: string | null
  regulationVersionCode: string | null
}

export function parseStoredStudyProgramId(value: string | null | undefined): number | null {
  const normalized = value?.trim() ?? ''
  if (!/^[1-9]\d*$/.test(normalized)) {
    return null
  }
  return Number(normalized)
}

/**
 * Logged-in accounts keep their saved program. Guests use the program they
 * picked in the catalog, which points at that program's default regulation.
 */
export function resolveCatalogStudySelection(
  account: CatalogStudySelection | null,
  guestProgram: CatalogStudySelection | null,
): CatalogStudySelection {
  if (account?.studyProgramCode) {
    return {
      studyProgramCode: account.studyProgramCode,
      regulationVersionCode: account.regulationVersionCode,
    }
  }
  return {
    studyProgramCode: guestProgram?.studyProgramCode ?? null,
    regulationVersionCode: guestProgram?.regulationVersionCode ?? null,
  }
}
