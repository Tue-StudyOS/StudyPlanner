/** Catalog watermark — bookmark-centered; size tuned so the glyph reaches the ECTS row. */
export const SEASON_ICON_SIZE_CLASS = 'h-[7.75rem] w-[7.75rem]'

/** Center sits on the bookmark control (px-4 + p-1 + 9px icon half). */
export const SEASON_CARD_WATERMARK_CLASS =
  `pointer-events-none absolute right-[1.8125rem] top-[1.5625rem] z-0 translate-x-1/2 -translate-y-1/2 ${SEASON_ICON_SIZE_CLASS}`

/** Semester hub — centered on the notification dot anchor. */
export const SEASON_SEMESTER_ICON_SIZE_CLASS = 'h-[8.75rem] w-[8.75rem]'

export const SEASON_SEMESTER_CARD_CLASS =
  'pointer-events-none absolute right-[1.375rem] top-[1.375rem] z-0 translate-x-1/2 -translate-y-1/2 h-[8.75rem] w-[8.75rem]'

/** Inline header glyph in course detail. */
export const SEASON_HEADER_ICON_CLASS = 'h-7 w-7 shrink-0 opacity-80'
