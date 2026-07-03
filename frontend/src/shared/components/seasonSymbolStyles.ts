/** Catalog card watermark — large enough to reach the ECTS row on min-height cards. */
export const SEASON_ICON_SIZE_CLASS = 'h-[7rem] w-[7rem]'

/** ~75% visible: 25% bleeds past the top-right corner; placement unchanged. */
export const SEASON_CARD_WATERMARK_CLASS =
  `pointer-events-none absolute -top-[1.75rem] -right-[1.75rem] z-0 ${SEASON_ICON_SIZE_CLASS}`

/** Semester hub cards — slightly larger than catalog. */
export const SEASON_SEMESTER_ICON_SIZE_CLASS = 'h-[8rem] w-[8rem]'

export const SEASON_SEMESTER_CARD_CLASS =
  'pointer-events-none absolute -top-[2rem] -right-[2rem] z-0 h-[8rem] w-[8rem]'

/** Inline header glyph in course detail. */
export const SEASON_HEADER_ICON_CLASS = 'h-7 w-7 shrink-0'
