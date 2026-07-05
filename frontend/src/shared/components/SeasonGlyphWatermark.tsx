import type { ReactNode } from 'react'
import type { CourseTermType } from '../../features/courses'
import { SeasonSymbol } from './SeasonSymbol.tsx'
import {
  CATALOG_GLYPH_HEIGHT_CLASS,
  SEASON_CARD_WATERMARK_WRAPPER_CLASS,
  SEASON_GLYPH_FILL_CLASS,
  SEASON_GLYPH_GRAY_TONE,
  SEASON_GLYPH_OVERLAY_CLASS,
  SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS,
  seasonGlyphStrengthClass,
  type SeasonGlyphLayout,
  type SeasonGlyphStrength,
  type SeasonGlyphTone,
} from './seasonSymbolStyles.ts'

interface SeasonGlyphWatermarkProps {
  termType: CourseTermType | undefined
  variant?: 'catalog' | 'semester'
  layout?: SeasonGlyphLayout
  strength?: SeasonGlyphStrength
  tone?: SeasonGlyphTone
  overlay?: ReactNode
}

function CatalogGlyph({
  termType,
  layout,
  strength,
}: {
  termType: CourseTermType | undefined
  layout: SeasonGlyphLayout
  strength: SeasonGlyphStrength
}) {
  const tone = strength === 'gray' ? 'muted' : 'seasonal'
  const strengthClass = seasonGlyphStrengthClass(strength)
  const grayClass = strength === 'gray' ? SEASON_GLYPH_GRAY_TONE : ''

  if (layout === 'right-half') {
    return (
      <div
        className={`pointer-events-none absolute right-0 top-1/2 z-0 w-[2.8rem] -translate-y-1/2 overflow-hidden ${CATALOG_GLYPH_HEIGHT_CLASS} ${strengthClass}`}
        aria-hidden="true"
      >
        <SeasonSymbol
          termType={termType}
          tone={tone}
          grayScale={strength === 'gray'}
          className={`${CATALOG_GLYPH_HEIGHT_CLASS} absolute right-0 top-0 aspect-square ${SEASON_GLYPH_FILL_CLASS} ${grayClass}`}
        />
      </div>
    )
  }

  if (layout === 'bottom-left') {
    return (
      <div
        className={`pointer-events-none absolute -bottom-[1.25rem] -left-[1.25rem] z-0 ${CATALOG_GLYPH_HEIGHT_CLASS} w-[5.6rem] ${strengthClass}`}
        aria-hidden="true"
      >
        <SeasonSymbol
          termType={termType}
          tone={tone}
          grayScale={strength === 'gray'}
          className={`${SEASON_GLYPH_FILL_CLASS} ${grayClass}`}
        />
      </div>
    )
  }

  return null
}

/** Shared watermark shell — glyph and overlays share one box. */
export function SeasonGlyphWatermark({
  termType,
  variant = 'catalog',
  layout = 'right-half',
  strength = 'strong',
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

  if (layout === 'ects-inline') {
    return overlay ? (
      <div className={SEASON_CARD_WATERMARK_WRAPPER_CLASS}>
        <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div>
      </div>
    ) : null
  }

  return (
    <>
      <CatalogGlyph termType={termType} layout={layout} strength={strength} />
      {overlay ? (
        <div className={SEASON_CARD_WATERMARK_WRAPPER_CLASS}>
          <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div>
        </div>
      ) : null}
    </>
  )
}
