/** 'muted' = subdued season tint (semester hub); 'seasonal' = full amber sun / sky snowflake. */
export type SeasonGlyphTone = 'muted' | 'seasonal'

/** Catalog watermark layout — three candidate treatments for side-by-side comparison. */
export type SeasonGlyphLayout = 'right-half' | 'ects-inline' | 'bottom-right'

/** Catalog A/B color strengths — faded soft tint or gray watermark. */
export type SeasonGlyphStrength = 'soft' | 'gray'

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

export const SEASON_GLYPH_GRAY_TONE = 'text-fg-muted'

/** Smallest catalog card min-height — glyph sizing is derived from this. */
export const CATALOG_CARD_MIN_HEIGHT_REM = 7

/** Edge watermarks span this share of the smallest catalog card height. */
export const CATALOG_GLYPH_HEIGHT_RATIO = 1

export const CATALOG_EDGE_GLYPH_SIZE_CLASS = 'h-full'

export const CATALOG_EDGE_GLYPH_CLIP_WIDTH_CLASS = 'w-[45%]'

/** Bottom-right corner glyph — 80% of smallest card; equal bleed past bottom and right. */
export const CATALOG_CORNER_GLYPH_SIZE_CLASS = 'h-[5.6rem] w-[5.6rem]'

export const CATALOG_CORNER_GLYPH_WRAPPER_CLASS =
  'pointer-events-none absolute -bottom-[1.25rem] -right-[1.25rem] z-0 aspect-square'

/**
 * 25% of the icon bleeds past the top-right corner — equal inset on top and
 * right. Deliberately no z-index: the box must not open a stacking context, so
 * the z-20 overlay inside (bookmark) can stack above the card content while
 * the glyph itself stays behind it in DOM order.
 */
export const SEASON_CARD_WATERMARK_WRAPPER_CLASS =
  'pointer-events-none absolute -top-[1.9375rem] -right-[1.9375rem] h-[7.75rem] w-[7.75rem]'

/** Bookmark sits on the first title line (card py-3 + title cap height). */
export const SEASON_CARD_BOOKMARK_ANCHOR_CLASS =
  'pointer-events-none absolute right-3 top-3 z-20 flex h-[1.2rem] items-center justify-end'

export const SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS =
  'pointer-events-none absolute -top-[2.1875rem] -right-[2.1875rem] z-0 h-[8.75rem] w-[8.75rem] opacity-35 dark:opacity-40'

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

export function isGraySeasonGlyphStrength(strength: SeasonGlyphStrength): boolean {
  return strength === 'gray'
}

export function seasonGlyphStrengthClass(strength: SeasonGlyphStrength): string {
  if (strength === 'gray') {
    return 'opacity-30 dark:opacity-25'
  }
  return ''
}
