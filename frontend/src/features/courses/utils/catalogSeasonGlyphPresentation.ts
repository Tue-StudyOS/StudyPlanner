import type { SeasonGlyphLayout, SeasonGlyphStrength } from '../../../shared/components/seasonSymbolStyles.ts'

export interface CatalogSeasonGlyphPresentation {
  layout: SeasonGlyphLayout
  strength: SeasonGlyphStrength
}

/** ponytail: temporary catalog layout A/B — soft and gray only. */
export const CATALOG_SEASON_GLYPH_PRESENTATIONS: readonly CatalogSeasonGlyphPresentation[] = [
  { layout: 'right-half', strength: 'soft' },
  { layout: 'right-half', strength: 'soft' },
  { layout: 'right-half', strength: 'gray' },
  { layout: 'right-half', strength: 'gray' },
  { layout: 'ects-inline', strength: 'soft' },
  { layout: 'ects-inline', strength: 'soft' },
  { layout: 'ects-inline', strength: 'soft' },
  { layout: 'ects-inline', strength: 'soft' },
  { layout: 'bottom-right', strength: 'soft' },
  { layout: 'bottom-right', strength: 'soft' },
  { layout: 'bottom-right', strength: 'gray' },
  { layout: 'bottom-right', strength: 'gray' },
]

export function getCatalogSeasonGlyphPresentation(cardIndex: number): CatalogSeasonGlyphPresentation {
  const count = CATALOG_SEASON_GLYPH_PRESENTATIONS.length
  return CATALOG_SEASON_GLYPH_PRESENTATIONS[((cardIndex % count) + count) % count]!
}
