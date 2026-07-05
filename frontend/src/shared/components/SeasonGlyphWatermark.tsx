import type { ReactNode } from 'react'
import type { CourseTermType } from '../../features/courses'
import { SeasonSymbol } from './SeasonSymbol.tsx'
import {
  CATALOG_CORNER_GLYPH_SIZE_CLASS,
  CATALOG_CORNER_GLYPH_WRAPPER_CLASS,
  CATALOG_EDGE_GLYPH_CLIP_WIDTH_CLASS,
  CATALOG_EDGE_GLYPH_SIZE_CLASS,
  SEASON_CARD_BOOKMARK_ANCHOR_CLASS,
  SEASON_GLYPH_FILL_CLASS,
  SEASON_GLYPH_OVERLAY_CLASS,
  SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS,
  isGraySeasonGlyphStrength,
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

function BookmarkOverlay({ overlay }: { overlay: ReactNode }) {
  return (
    <div className={SEASON_CARD_BOOKMARK_ANCHOR_CLASS}>
      <div className="pointer-events-auto">{overlay}</div>
    </div>
  )
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
  const grayScale = isGraySeasonGlyphStrength(strength)
  const tone = grayScale ? 'muted' : 'seasonal'
  const strengthClass = seasonGlyphStrengthClass(strength)
  const edgeRotateFused = layout === 'right-half'

  if (layout === 'right-half') {
    return (
      <div
        className={`pointer-events-none absolute right-0 top-[5%] z-0 overflow-hidden ${CATALOG_EDGE_GLYPH_SIZE_CLASS} ${CATALOG_EDGE_GLYPH_CLIP_WIDTH_CLASS} ${strengthClass}`}
        aria-hidden="true"
      >
        <SeasonSymbol
          termType={termType}
          tone={tone}
          grayScale={grayScale}
          edgeRotateFused={edgeRotateFused}
          className={`absolute right-0 top-1/2 aspect-square ${CATALOG_EDGE_GLYPH_SIZE_CLASS} ${SEASON_GLYPH_FILL_CLASS} translate-x-1/2 -translate-y-1/2`}
        />
      </div>
    )
  }

  if (layout === 'bottom-right') {
    return (
      <div
        className={`${CATALOG_CORNER_GLYPH_WRAPPER_CLASS} ${CATALOG_CORNER_GLYPH_SIZE_CLASS} ${strengthClass}`}
        aria-hidden="true"
      >
        <SeasonSymbol
          termType={termType}
          tone={tone}
          grayScale={grayScale}
          className={SEASON_GLYPH_FILL_CLASS}
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
    return overlay ? <BookmarkOverlay overlay={overlay} /> : null
  }

  return (
    <>
      <CatalogGlyph termType={termType} layout={layout} strength={strength} />
      {overlay ? <BookmarkOverlay overlay={overlay} /> : null}
    </>
  )
}
