import type { SeasonGlyphLayout, SeasonGlyphStrength } from '../../../shared/components/seasonSymbolStyles.ts'

export interface CatalogSeasonGlyphPresentation {
  layout: SeasonGlyphLayout
  strength: SeasonGlyphStrength
}

/**
 * ponytail: temporary catalog A/B grid — base 14 presentations plus extra faint
 * edge variants appended for side-by-side comparison (nothing replaced).
 */
export const CATALOG_SEASON_GLYPH_PRESENTATIONS: readonly CatalogSeasonGlyphPresentation[] = [
  { layout: 'right-half', strength: 'strong' },
  { layout: 'right-half', strength: 'strong' },
  { layout: 'right-half', strength: 'soft' },
  { layout: 'right-half', strength: 'soft' },
  { layout: 'right-half', strength: 'gray' },
  { layout: 'right-half', strength: 'gray' },
  { layout: 'ects-inline', strength: 'strong' },
  { layout: 'ects-inline', strength: 'strong' },
  { layout: 'bottom-right', strength: 'strong' },
  { layout: 'bottom-right', strength: 'strong' },
  { layout: 'bottom-right', strength: 'soft' },
  { layout: 'bottom-right', strength: 'soft' },
  { layout: 'bottom-right', strength: 'gray' },
  { layout: 'bottom-right', strength: 'gray' },
  { layout: 'right-half', strength: 'softer' },
  { layout: 'right-half', strength: 'softer' },
  { layout: 'right-half', strength: 'gray-softer' },
  { layout: 'right-half', strength: 'gray-softer' },
  { layout: 'bottom-right', strength: 'softer' },
  { layout: 'bottom-right', strength: 'softer' },
  { layout: 'bottom-right', strength: 'gray-softer' },
  { layout: 'bottom-right', strength: 'gray-softer' },
]

export function getCatalogSeasonGlyphPresentation(cardIndex: number): CatalogSeasonGlyphPresentation {
  const count = CATALOG_SEASON_GLYPH_PRESENTATIONS.length
  return CATALOG_SEASON_GLYPH_PRESENTATIONS[((cardIndex % count) + count) % count]!
}
