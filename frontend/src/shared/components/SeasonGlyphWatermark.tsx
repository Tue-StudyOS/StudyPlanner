import type { ReactNode } from 'react'
import type { CourseTermType } from '../../features/courses'
import { SeasonSymbol } from './SeasonSymbol.tsx'
import {
  SEASON_CARD_WATERMARK_WRAPPER_CLASS,
  SEASON_GLYPH_FILL_CLASS,
  SEASON_GLYPH_OVERLAY_CLASS,
  SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS,
  type SeasonGlyphTone,
} from './seasonSymbolStyles.ts'

interface SeasonGlyphWatermarkProps {
  termType: CourseTermType | undefined
  variant?: 'catalog' | 'semester'
  tone?: SeasonGlyphTone
  overlay?: ReactNode
}

/** Shared top-right watermark shell — glyph and overlays share one box. */
export function SeasonGlyphWatermark({
  termType,
  variant = 'catalog',
  tone,
  overlay,
}: SeasonGlyphWatermarkProps) {
  const wrapperClass =
    variant === 'semester' ? SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS : SEASON_CARD_WATERMARK_WRAPPER_CLASS
  const resolvedTone = tone ?? (variant === 'semester' ? 'seasonal' : 'muted')

  return (
    <div className={wrapperClass}>
      <SeasonSymbol
        termType={termType}
        className={SEASON_GLYPH_FILL_CLASS}
        tone={resolvedTone}
      />
      {overlay ? <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div> : null}
    </div>
  )
}
