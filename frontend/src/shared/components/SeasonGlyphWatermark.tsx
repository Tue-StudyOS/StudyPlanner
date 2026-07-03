import type { ReactNode } from 'react'
import type { CourseTermType } from '../../features/courses'
import { SeasonSymbol } from './SeasonSymbol.tsx'
import {
  SEASON_CARD_WATERMARK_WRAPPER_CLASS,
  SEASON_GLYPH_FILL_CLASS,
  SEASON_GLYPH_OVERLAY_CLASS,
  SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS,
} from './seasonSymbolStyles.ts'

interface SeasonGlyphWatermarkProps {
  termType: CourseTermType | undefined
  variant?: 'catalog' | 'semester'
  overlay?: ReactNode
}

/** Shared top-right watermark shell — glyph and overlays share one box. */
export function SeasonGlyphWatermark({
  termType,
  variant = 'catalog',
  overlay,
}: SeasonGlyphWatermarkProps) {
  const wrapperClass =
    variant === 'semester' ? SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS : SEASON_CARD_WATERMARK_WRAPPER_CLASS

  return (
    <div className={wrapperClass}>
      <SeasonSymbol termType={termType} className={SEASON_GLYPH_FILL_CLASS} />
      {overlay ? <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div> : null}
    </div>
  )
}
