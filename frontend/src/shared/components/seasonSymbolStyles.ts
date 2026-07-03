/** Watermark sized to the smallest catalog card — same px everywhere. */
export const SEASON_ICON_SIZE_CLASS = 'h-[3.25rem] w-[3.25rem]'

/** Large watermark on catalog cards — inset so glyphs never clip the card edge. */
export const SEASON_CARD_WATERMARK_CLASS =
  `pointer-events-none absolute bottom-2 right-2 z-0 ${SEASON_ICON_SIZE_CLASS}`

/** Semester hub cards — same visual scale as catalog watermarks. */
export const SEASON_SEMESTER_CARD_CLASS = `pointer-events-none ${SEASON_ICON_SIZE_CLASS}`

/** Inline header glyph in course detail. */
export const SEASON_HEADER_ICON_CLASS = 'h-7 w-7 shrink-0'
