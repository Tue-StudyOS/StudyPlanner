import type { SeasonGlyphLayout, SeasonGlyphStrength } from '../../../shared/components/seasonSymbolStyles.ts'

export interface CatalogSeasonGlyphPresentation {
  layout: SeasonGlyphLayout
  strength: SeasonGlyphStrength
}

const CATALOG_LAYOUTS: readonly SeasonGlyphLayout[] = ['right-half', 'ects-inline', 'bottom-left']
const CATALOG_STRENGTHS: readonly SeasonGlyphStrength[] = ['strong', 'soft', 'gray']

/**
 * ponytail: temporary catalog A/B grid — the first six cards cycle three layouts
 * and three color strengths (two cards each); later cards default to right-half + strong.
 */
export function getCatalogSeasonGlyphPresentation(cardIndex: number): CatalogSeasonGlyphPresentation {
  const normalizedIndex = Math.max(0, cardIndex)
  if (normalizedIndex < 6) {
    return {
      layout: CATALOG_LAYOUTS[normalizedIndex % CATALOG_LAYOUTS.length]!,
      strength: CATALOG_STRENGTHS[Math.floor(normalizedIndex / 2) % CATALOG_STRENGTHS.length]!,
    }
  }
  return { layout: 'right-half', strength: 'strong' }
}
