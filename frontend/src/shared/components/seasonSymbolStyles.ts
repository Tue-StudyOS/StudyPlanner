/** 25% of the icon bleeds past the top-right corner — equal inset on top and right. */
export const SEASON_CARD_WATERMARK_WRAPPER_CLASS =
  'pointer-events-none absolute -top-[1.9375rem] -right-[1.9375rem] z-0 h-[7.75rem] w-[7.75rem]'

export const SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS =
  'pointer-events-none absolute -top-[2.1875rem] -right-[2.1875rem] z-0 h-[8.75rem] w-[8.75rem]'

/** Glyph fills the watermark shell. */
export const SEASON_GLYPH_FILL_CLASS = 'h-full w-full'

/** Centered overlay slot (bookmark, notification dot, …). */
export const SEASON_GLYPH_OVERLAY_CLASS =
  'pointer-events-auto absolute inset-0 flex items-center justify-center'

export const SEASON_SEMESTER_BADGE_GLOW_CLASS =
  'absolute inset-0 rounded-full bg-red-500/20 blur-[2.5px] dark:bg-red-400/35'

export const SEASON_SEMESTER_BADGE_DOT_CLASS =
  'relative h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_1.5px_var(--color-surface),0_0_4px_rgba(239,68,68,0.4),0_0_9px_rgba(239,68,68,0.25)] dark:bg-[#FB7185] dark:shadow-[0_0_0_1.5px_var(--color-surface),0_0_6px_rgba(251,113,133,0.55),0_0_12px_rgba(251,113,133,0.38)]'

/** Inline header glyph in course detail. */
export const SEASON_HEADER_ICON_CLASS = 'h-7 w-7 shrink-0 opacity-80 dark:opacity-95'
