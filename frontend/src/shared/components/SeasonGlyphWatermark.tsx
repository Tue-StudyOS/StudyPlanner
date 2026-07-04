import type { ReactNode } from 'react'
import type { CourseTermType } from '../../features/courses'
import { SeasonSymbol } from './SeasonSymbol.tsx'
import {
  SEASON_CARD_SMALL_BACKGROUND_CLASS,
  SEASON_CARD_WATERMARK_WRAPPER_CLASS,
  SEASON_GLYPH_FILL_CLASS,
  SEASON_GLYPH_OVERLAY_CLASS,
  SEASON_GLYPH_SMALL_CLASS,
  SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS,
  type SeasonGlyphSize,
  type SeasonGlyphTone,
} from './seasonSymbolStyles.ts'

interface SeasonGlyphWatermarkProps {
  termType: CourseTermType | undefined
  variant?: 'catalog' | 'semester'
  size?: SeasonGlyphSize
  tone?: SeasonGlyphTone
  overlay?: ReactNode
}

/** Shared watermark shell — glyph and overlays share one box. */
export function SeasonGlyphWatermark({
  termType,
  variant = 'catalog',
  size = 'large',
  tone,
  overlay,
}: SeasonGlyphWatermarkProps) {
  const resolvedTone = tone ?? (variant === 'semester' ? 'seasonal' : 'muted')

  if (variant === 'semester') {
    return (
      <div className={SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS}>
        <SeasonSymbol termType={termType} className={SEASON_GLYPH_FILL_CLASS} tone={resolvedTone} />
        {overlay ? <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div> : null}
      </div>
    )
  }

  if (size === 'small') {
    return (
      <div className={SEASON_CARD_SMALL_BACKGROUND_CLASS}>
        <SeasonSymbol
          termType={termType}
          className={SEASON_GLYPH_SMALL_CLASS}
          tone={resolvedTone}
        />
        {overlay ? <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div> : null}
      </div>
    )
  }

  return (
    <div className={SEASON_CARD_WATERMARK_WRAPPER_CLASS}>
      <SeasonSymbol termType={termType} className={SEASON_GLYPH_FILL_CLASS} tone={resolvedTone} />
      {overlay ? <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div> : null}
    </div>
  )
}
