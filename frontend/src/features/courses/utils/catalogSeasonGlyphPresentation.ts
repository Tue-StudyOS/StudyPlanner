import type { SeasonGlyphMotif, SeasonGlyphTone } from '../../../shared/components/seasonSymbolStyles.ts'

export interface CatalogSeasonGlyphPresentation {
  motif: SeasonGlyphMotif
  tone: SeasonGlyphTone
}

/**
 * ponytail: temporary catalog A/B grid — distinct watermark motif/tone combos
 * cycle by card index so candidate treatments can be compared side by side.
 */
export const CATALOG_SEASON_GLYPH_PRESENTATIONS: readonly CatalogSeasonGlyphPresentation[] = [
  { motif: 'small-tile', tone: 'muted' },
  { motif: 'small-tile', tone: 'seasonal' },
  { motif: 'dense-tile', tone: 'muted' },
  { motif: 'dense-tile', tone: 'seasonal' },
  { motif: 'sparse-tile', tone: 'seasonal' },
  { motif: 'large-corner', tone: 'muted' },
  { motif: 'large-corner', tone: 'seasonal' },
  { motif: 'corner-only', tone: 'seasonal' },
  { motif: 'double-corner', tone: 'muted' },
  { motif: 'left-border-accent', tone: 'seasonal' },
  { motif: 'right-border-accent', tone: 'muted' },
  { motif: 'bottom-strip', tone: 'seasonal' },
  { motif: 'top-strip', tone: 'muted' },
  { motif: 'diagonal-wash', tone: 'seasonal' },
  { motif: 'corner-wash', tone: 'muted' },
  { motif: 'sparse-center', tone: 'seasonal' },
  { motif: 'center-watermark', tone: 'muted' },
]

export function getCatalogSeasonGlyphPresentation(cardIndex: number): CatalogSeasonGlyphPresentation {
  const count = CATALOG_SEASON_GLYPH_PRESENTATIONS.length
  return CATALOG_SEASON_GLYPH_PRESENTATIONS[((cardIndex % count) + count) % count]
}
