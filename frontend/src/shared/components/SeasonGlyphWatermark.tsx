import type { ReactNode } from 'react'
import type { CourseTermType } from '../../features/courses'
import { SeasonSymbol, SeasonSymbolPattern } from './SeasonSymbol.tsx'
import {
  SEASON_CARD_PATTERN_OPACITY_CLASS,
  SEASON_CARD_WATERMARK_WRAPPER_CLASS,
  SEASON_GLYPH_FILL_CLASS,
  SEASON_GLYPH_MUTED_FADE_CLASS,
  SEASON_GLYPH_OVERLAY_CLASS,
  SEASON_SEMESTER_WATERMARK_WRAPPER_CLASS,
  type SeasonGlyphMotif,
  type SeasonGlyphTone,
} from './seasonSymbolStyles.ts'

// Mirrors the top-right watermark box on the opposite corner (double-corner motif).
const BOTTOM_LEFT_WATERMARK_BOX_CLASS =
  'pointer-events-none absolute -bottom-[1.9375rem] -left-[1.9375rem] h-[7.75rem] w-[7.75rem]'

type MotifConfig =
  | { kind: 'pattern'; tileSize: number; regionClass: string }
  | { kind: 'glyph'; boxClasses: string[] }

/**
 * Catalog watermark motifs. Pattern motifs tile the glyph edge-to-edge inside
 * their region (masks fade them out instead of clipping tiles mid-stroke);
 * glyph motifs place one full-size glyph per box.
 */
const CATALOG_MOTIF_CONFIGS: Record<SeasonGlyphMotif, MotifConfig> = {
  'small-tile': { kind: 'pattern', tileSize: 34, regionClass: 'inset-0 h-full w-full' },
  'dense-tile': { kind: 'pattern', tileSize: 24, regionClass: 'inset-0 h-full w-full' },
  'sparse-tile': { kind: 'pattern', tileSize: 58, regionClass: 'inset-0 h-full w-full' },
  'diagonal-wash': {
    kind: 'pattern',
    tileSize: 34,
    regionClass: 'inset-0 h-full w-full [mask-image:linear-gradient(to_bottom_left,black_15%,transparent_70%)]',
  },
  'corner-wash': {
    kind: 'pattern',
    tileSize: 30,
    regionClass: 'inset-0 h-full w-full [mask-image:radial-gradient(circle_at_top_right,black,transparent_65%)]',
  },
  'sparse-center': {
    kind: 'pattern',
    tileSize: 52,
    regionClass: 'inset-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]',
  },
  'left-border-accent': {
    kind: 'pattern',
    tileSize: 26,
    regionClass: 'inset-y-0 left-0 h-full w-10 [mask-image:linear-gradient(to_right,black_40%,transparent)]',
  },
  'right-border-accent': {
    kind: 'pattern',
    tileSize: 26,
    regionClass: 'inset-y-0 right-0 h-full w-10 [mask-image:linear-gradient(to_left,black_40%,transparent)]',
  },
  'bottom-strip': {
    kind: 'pattern',
    tileSize: 26,
    regionClass: 'inset-x-0 bottom-0 h-10 w-full [mask-image:linear-gradient(to_top,black_40%,transparent)]',
  },
  'top-strip': {
    kind: 'pattern',
    tileSize: 26,
    regionClass: 'inset-x-0 top-0 h-10 w-full [mask-image:linear-gradient(to_bottom,black_40%,transparent)]',
  },
  'large-corner': { kind: 'glyph', boxClasses: [SEASON_CARD_WATERMARK_WRAPPER_CLASS] },
  'corner-only': { kind: 'glyph', boxClasses: ['pointer-events-none absolute right-2 top-2 h-11 w-11'] },
  'double-corner': {
    kind: 'glyph',
    boxClasses: [SEASON_CARD_WATERMARK_WRAPPER_CLASS, BOTTOM_LEFT_WATERMARK_BOX_CLASS],
  },
  'center-watermark': {
    kind: 'glyph',
    boxClasses: ['pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2'],
  },
}

interface SeasonGlyphWatermarkProps {
  termType: CourseTermType | undefined
  variant?: 'catalog' | 'semester'
  motif?: SeasonGlyphMotif
  tone?: SeasonGlyphTone
  overlay?: ReactNode
}

/** Shared watermark shell — glyph and overlays share one box. */
export function SeasonGlyphWatermark({
  termType,
  variant = 'catalog',
  motif = 'large-corner',
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

  const config = CATALOG_MOTIF_CONFIGS[motif]
  const mutedFadeClass = resolvedTone === 'muted' ? ` ${SEASON_GLYPH_MUTED_FADE_CLASS}` : ''

  // The overlay (bookmark) keeps the same top-right corner box across all
  // motifs so its position never shifts between cards.
  return (
    <>
      {config.kind === 'pattern' ? (
        <SeasonSymbolPattern
          termType={termType}
          tileSize={config.tileSize}
          tone={resolvedTone}
          className={`pointer-events-none absolute ${config.regionClass} ${SEASON_CARD_PATTERN_OPACITY_CLASS}`}
        />
      ) : (
        config.boxClasses.map((boxClass) => (
          <div key={boxClass} className={`${boxClass}${mutedFadeClass}`}>
            <SeasonSymbol termType={termType} className={SEASON_GLYPH_FILL_CLASS} tone={resolvedTone} />
          </div>
        ))
      )}
      {overlay ? (
        <div className={SEASON_CARD_WATERMARK_WRAPPER_CLASS}>
          <div className={SEASON_GLYPH_OVERLAY_CLASS}>{overlay}</div>
        </div>
      ) : null}
    </>
  )
}
