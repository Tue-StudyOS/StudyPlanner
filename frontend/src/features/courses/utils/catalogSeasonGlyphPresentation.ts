import type { SeasonGlyphTone, SeasonGlyphSize } from '../../../shared/components/seasonSymbolStyles.ts'

export interface CatalogSeasonGlyphPresentation {
  size: SeasonGlyphSize
  tone: SeasonGlyphTone
}

/** ponytail: temporary catalog A/B grid — small bg (6 gray + 6 color), then large (6 gray + rest color). */
export function getCatalogSeasonGlyphPresentation(cardIndex: number): CatalogSeasonGlyphPresentation {
  if (cardIndex < 6) {
    return { size: 'small', tone: 'muted' }
  }
  if (cardIndex < 12) {
    return { size: 'small', tone: 'seasonal' }
  }
  if (cardIndex < 18) {
    return { size: 'large', tone: 'muted' }
  }
  return { size: 'large', tone: 'seasonal' }
}
