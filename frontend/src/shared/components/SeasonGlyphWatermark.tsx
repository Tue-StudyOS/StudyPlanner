import type { ReactNode } from 'react'
import type { CourseTermType } from '../../features/courses'
import { SeasonSymbol } from './SeasonSymbol.tsx'
import {
  SEASON_CARD_BOOKMARK_ANCHOR_CLASS,
  SEASON_GLYPH_FILL_CLASS,
  SEASON_GLYPH_OVERLAY_CLASS,
  SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS,
  type SeasonGlyphTone,
} from './seasonSymbolStyles.ts'

interface SeasonGlyphWatermarkProps {
  termType?: CourseTermType | undefined
  variant?: 'catalog' | 'semester'
  tone?: SeasonGlyphTone
  overlay?: ReactNode
}

function BookmarkOverlay({ overlay }: { overlay: ReactNode }) {
  return (
    <div className={SEASON_CARD_BOOKMARK_ANCHOR_CLASS}>
      <div className="pointer-events-auto">{overlay}</div>
    </div>
  )
}

/** Catalog cards only anchor the bookmark; semester cards keep the large watermark. */
export function SeasonGlyphWatermark({
  termType,
  variant = 'catalog',
  tone,
  overlay,
}: SeasonGlyphWatermarkProps) {
  if (variant === 'semester') {
    return (
      <div className={SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS}>
        <SeasonSymbol
          termType={termType}
          className={SEASON_GLYPH_FILL_CLASS}
          tone={tone ?? 'seasonal'}
        />
        {overlay ? <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div> : null}
      </div>
    )
  }

  return overlay ? <BookmarkOverlay overlay={overlay} /> : null
}
