/** 'muted' = subdued season tint (catalog watermark); 'seasonal' = full amber sun / sky snowflake (semester hub). */
export type SeasonGlyphTone = 'muted' | 'seasonal'

/** Catalog watermark motif — how the season glyph is laid out on a course card. */
export type SeasonGlyphMotif =
  | 'small-tile'
  | 'dense-tile'
  | 'sparse-tile'
  | 'large-corner'
  | 'corner-only'
  | 'double-corner'
  | 'left-border-accent'
  | 'right-border-accent'
  | 'bottom-strip'
  | 'top-strip'
  | 'diagonal-wash'
  | 'corner-wash'
  | 'sparse-center'
  | 'center-watermark'

/**
 * Muted tone is season-tinted: plain watermark gray was invisible on the white
 * light-mode surface. Colors stay solid so overlapping strokes don't composite
 * darker at joins; the watermark fade comes from wrapper opacity classes.
 */
export const SEASON_GLYPH_MUTED_SUN_TONE = 'text-amber-600 dark:text-[#47443A]'
export const SEASON_GLYPH_MUTED_SNOW_TONE = 'text-sky-600 dark:text-[#3B434C]'

/** Seasonal watermark colors; solid so overlapping strokes don't composite darker at joins. */
export const SEASON_GLYPH_SUN_TONE = 'text-amber-400 dark:text-amber-300'
export const SEASON_GLYPH_SNOW_TONE = 'text-sky-400 dark:text-sky-300'

/** Fade applied to every tiled card-background pattern. */
export const SEASON_CARD_PATTERN_OPACITY_CLASS = 'opacity-30 dark:opacity-25'

/**
 * Muted single glyphs need the same fade in light mode (the solid tint would
 * be too strong); the dark muted colors are already subdued, so stay solid.
 */
export const SEASON_GLYPH_MUTED_FADE_CLASS = 'opacity-30 dark:opacity-100'

/**
 * 25% of the icon bleeds past the top-right corner — equal inset on top and
 * right. Deliberately no z-index: the box must not open a stacking context, so
 * the z-20 overlay inside (bookmark) can stack above the card content while
 * the glyph itself stays behind it in DOM order.
 */
export const SEASON_CARD_WATERMARK_WRAPPER_CLASS =
  'pointer-events-none absolute -top-[1.9375rem] -right-[1.9375rem] h-[7.75rem] w-[7.75rem]'

export const SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS =
  'pointer-events-none absolute -top-[2.1875rem] -right-[2.1875rem] z-0 h-[8.75rem] w-[8.75rem]'

/** Glyph fills the watermark shell. */
export const SEASON_GLYPH_FILL_CLASS = 'h-full w-full'

/**
 * Centered overlay slot (bookmark, notification dot, …). The slot itself must
 * not capture clicks — only the interactive child opts back in with
 * pointer-events-auto — otherwise it would swallow card clicks near the corner.
 */
export const SEASON_GLYPH_OVERLAY_CLASS =
  'pointer-events-none absolute inset-0 z-20 flex items-center justify-center'

export const SEASON_SEMESTER_BADGE_GLOW_CLASS =
  'absolute inset-0 rounded-full bg-red-500/20 blur-[2.5px] dark:bg-red-400/35'

export const SEASON_SEMESTER_BADGE_DOT_CLASS =
  'relative h-2 w-2 rounded-full bg-red-500 shadow-[0_0_0_1.5px_var(--color-surface),0_0_4px_rgba(239,68,68,0.4),0_0_9px_rgba(239,68,68,0.25)] dark:bg-[#FB7185] dark:shadow-[0_0_0_1.5px_var(--color-surface),0_0_6px_rgba(251,113,133,0.55),0_0_12px_rgba(251,113,133,0.38)]'

/** Inline header glyph in course detail. */
export const SEASON_HEADER_ICON_CLASS = 'h-7 w-7 shrink-0 opacity-80 dark:opacity-95'
