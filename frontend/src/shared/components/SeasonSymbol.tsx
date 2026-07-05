import { useId } from 'react'
import type { CourseTermType } from '../../features/courses'
import {
  SEASON_GLYPH_GRAY_TONE,
  SEASON_GLYPH_MUTED_SNOW_TONE,
  SEASON_GLYPH_MUTED_SUN_TONE,
  SEASON_GLYPH_SNOW_TONE,
  SEASON_GLYPH_SUN_TONE,
  type SeasonGlyphTone,
} from './seasonSymbolStyles.ts'

function sunColorClass(tone: SeasonGlyphTone, grayScale: boolean): string {
  if (grayScale) {
    return SEASON_GLYPH_GRAY_TONE
  }
  return tone === 'seasonal' ? SEASON_GLYPH_SUN_TONE : SEASON_GLYPH_MUTED_SUN_TONE
}

function snowflakeColorClass(tone: SeasonGlyphTone, grayScale: boolean): string {
  if (grayScale) {
    return SEASON_GLYPH_GRAY_TONE
  }
  return tone === 'seasonal' ? SEASON_GLYPH_SNOW_TONE : SEASON_GLYPH_MUTED_SNOW_TONE
}

interface Point {
  x: number
  y: number
}

function polarPoint(radius: number, angleDegrees: number): Point {
  const radians = (angleDegrees * Math.PI) / 180
  return {
    x: Math.round((12 + radius * Math.cos(radians)) * 100) / 100,
    y: Math.round((12 + radius * Math.sin(radians)) * 100) / 100,
  }
}

interface LineSegment {
  from: Point
  to: Point
}

const SUN_RAYS: LineSegment[] = [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => ({
  from: polarPoint(6.6, angle),
  to: polarPoint(9.4, angle),
}))

// One snowflake arm: a spoke from the center with a small outward V-branch.
function buildSnowflakeArm(angle: number): LineSegment[] {
  const branchBase = polarPoint(5.4, angle)
  const branchTip = (offset: number): Point => {
    const radians = ((angle + offset) * Math.PI) / 180
    return {
      x: Math.round((branchBase.x + 2.6 * Math.cos(radians)) * 100) / 100,
      y: Math.round((branchBase.y + 2.6 * Math.sin(radians)) * 100) / 100,
    }
  }
  return [
    { from: polarPoint(0, angle), to: polarPoint(9.3, angle) },
    { from: branchBase, to: branchTip(-45) },
    { from: branchBase, to: branchTip(45) },
  ]
}

// Six spokes, each with a small outward V-branch, form a minimalist snowflake.
const SNOWFLAKE_LINES: LineSegment[] = [90, 150, 210, 270, 330, 30].flatMap(buildSnowflakeArm)

// Fused "both" glyph: half sun upper-left, half snowflake lower-right, split
// by a sharp top-right→bottom-left cut. SVG polar angles (0° = right, y down):
// sun rays point up (270°), up-left (225°), left (180°), down-left (135°);
// snowflake arms point down (90°), down-right (30°), up-right (330°).
const FUSED_SUN_RAYS: LineSegment[] = [270, 225, 180, 135].map((angle) => ({
  from: polarPoint(6.6, angle),
  to: polarPoint(9.4, angle),
}))

const FUSED_SNOWFLAKE_LINES: LineSegment[] = [90, 30, 330].flatMap(buildSnowflakeArm)

// Open arc through the upper-left (no closing chord). It runs clearly past
// the down-left ray (135°→~125°) but stops short of the diagonal at the top
// right (315°→297°) so the sun never touches the snowflake.
const FUSED_SUN_ARC_PATH = 'M13.95 8.17A4.3 4.3 0 0 0 9.53 15.52'

function Lines({ segments }: { segments: LineSegment[] }) {
  return (
    <>
      {segments.map((segment, index) => (
        <line
          key={index}
          x1={segment.from.x}
          y1={segment.from.y}
          x2={segment.to.x}
          y2={segment.to.y}
        />
      ))}
    </>
  )
}

function SunGlyph({ tone, grayScale }: { tone: SeasonGlyphTone; grayScale: boolean }) {
  return (
    <g
      className={sunColorClass(tone, grayScale)}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      fill="none"
    >
      <circle cx={12} cy={12} r={4.3} />
      <Lines segments={SUN_RAYS} />
    </g>
  )
}

function SnowflakeGlyph({ tone, grayScale }: { tone: SeasonGlyphTone; grayScale: boolean }) {
  return (
    <g
      className={snowflakeColorClass(tone, grayScale)}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <Lines segments={SNOWFLAKE_LINES} />
    </g>
  )
}

function FusedSeasonGlyph({ tone, grayScale }: { tone: SeasonGlyphTone; grayScale: boolean }) {
  return (
    <>
      <g
        className={sunColorClass(tone, grayScale)}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      >
        <path d={FUSED_SUN_ARC_PATH} />
        <Lines segments={FUSED_SUN_RAYS} />
      </g>
      <g
        className={snowflakeColorClass(tone, grayScale)}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <Lines segments={FUSED_SNOWFLAKE_LINES} />
      </g>
    </>
  )
}

function SeasonGlyphShapes({
  termType,
  tone,
  grayScale,
  edgeRotateFused,
}: {
  termType: CourseTermType
  tone: SeasonGlyphTone
  grayScale: boolean
  edgeRotateFused: boolean
}) {
  const fusedGlyph = <FusedSeasonGlyph tone={tone} grayScale={grayScale} />

  return (
    <>
      {termType === 'summer' ? <SunGlyph tone={tone} grayScale={grayScale} /> : null}
      {termType === 'winter' ? <SnowflakeGlyph tone={tone} grayScale={grayScale} /> : null}
      {termType === 'both' ? (
        edgeRotateFused ? (
          <g transform="rotate(90 12 12)">{fusedGlyph}</g>
        ) : (
          fusedGlyph
        )
      ) : null}
    </>
  )
}

interface SeasonSymbolProps {
  termType: CourseTermType | undefined
  /** Controls size, opacity, and positioning; the SVG itself stays square. */
  className?: string
  tone?: SeasonGlyphTone
  grayScale?: boolean
  /** Right-edge catalog cards rotate the fused SS/WS glyph 90° clockwise. */
  edgeRotateFused?: boolean
}

/**
 * Minimalist season glyph replacing the old text season tags: a sun for
 * summer, a snowflake for winter, and a diagonally split half/half symbol
 * for courses offered in both terms.
 */
export function SeasonSymbol({
  termType,
  className,
  tone = 'muted',
  grayScale = false,
  edgeRotateFused = false,
}: SeasonSymbolProps) {
  if (!termType || termType === 'unknown') {
    return null
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <SeasonGlyphShapes
        termType={termType}
        tone={tone}
        grayScale={grayScale}
        edgeRotateFused={edgeRotateFused}
      />
    </svg>
  )
}

export const DEFAULT_PATTERN_TILE_SIZE = 34
// Glyph fills just under half the tile; the rest is even breathing room.
const PATTERN_GLYPH_RATIO = 16 / 34

interface PatternGlyphTileProps {
  termType: CourseTermType
  tone: SeasonGlyphTone
  x: number
  y: number
  size: number
}

function PatternGlyphTile({ termType, tone, x, y, size }: PatternGlyphTileProps) {
  return (
    <svg viewBox="0 0 24 24" x={x} y={y} width={size} height={size}>
      <SeasonGlyphShapes termType={termType} tone={tone} grayScale={false} edgeRotateFused={false} />
    </svg>
  )
}

interface SeasonSymbolPatternProps extends SeasonSymbolProps {
  /** Tile edge length in px — smaller means denser tiling. */
  tileSize?: number
}

/**
 * The season glyph repeated as a dense, even tile across the whole element.
 * One SVG `<pattern>` instead of many glyph instances keeps the DOM flat.
 * 'both' tiles as a checkerboard of alternating suns and snowflakes instead
 * of repeating the fused glyph.
 */
export function SeasonSymbolPattern({
  termType,
  className,
  tone = 'muted',
  tileSize = DEFAULT_PATTERN_TILE_SIZE,
}: SeasonSymbolPatternProps) {
  // useId emits ":r0:"-style ids; strip the colons so url(#…) stays valid.
  const patternId = `season-pattern-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  if (!termType || termType === 'unknown') {
    return null
  }

  const glyphSize = Math.round(tileSize * PATTERN_GLYPH_RATIO * 100) / 100
  const inset = (tileSize - glyphSize) / 2
  const isCheckerboard = termType === 'both'
  const patternSize = isCheckerboard ? tileSize * 2 : tileSize

  return (
    <svg aria-hidden="true" focusable="false" className={className}>
      <defs>
        <pattern id={patternId} width={patternSize} height={patternSize} patternUnits="userSpaceOnUse">
          {isCheckerboard ? (
            <>
              <PatternGlyphTile termType="summer" tone={tone} x={inset} y={inset} size={glyphSize} />
              <PatternGlyphTile termType="winter" tone={tone} x={inset + tileSize} y={inset} size={glyphSize} />
              <PatternGlyphTile termType="winter" tone={tone} x={inset} y={inset + tileSize} size={glyphSize} />
              <PatternGlyphTile termType="summer" tone={tone} x={inset + tileSize} y={inset + tileSize} size={glyphSize} />
            </>
          ) : (
            <PatternGlyphTile termType={termType} tone={tone} x={inset} y={inset} size={glyphSize} />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
