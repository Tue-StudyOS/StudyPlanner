import type { CourseTermType } from '../../features/courses'

// Single neutral watermark gray (the old sun gray) shared by every glyph.
const GLYPH_COLOR_CLASSES = 'text-[#C2BDB4]'

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

// Open arc through the upper-left (no closing chord). It runs slightly past
// the down-left ray (135°→148°) but stops short of the diagonal at the top
// right (315°→297°) so the sun never touches the snowflake.
const FUSED_SUN_ARC_PATH = 'M13.95 8.17A4.3 4.3 0 0 0 8.35 14.28'

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

function SunGlyph() {
  return (
    <g
      className={GLYPH_COLOR_CLASSES}
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

function SnowflakeGlyph() {
  return (
    <g
      className={GLYPH_COLOR_CLASSES}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      fill="none"
    >
      <Lines segments={SNOWFLAKE_LINES} />
    </g>
  )
}

function FusedSeasonGlyph() {
  return (
    <>
      <g
        className={GLYPH_COLOR_CLASSES}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      >
        <path d={FUSED_SUN_ARC_PATH} />
        <Lines segments={FUSED_SUN_RAYS} />
      </g>
      <g
        className={GLYPH_COLOR_CLASSES}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      >
        <Lines segments={FUSED_SNOWFLAKE_LINES} />
      </g>
    </>
  )
}

interface SeasonSymbolProps {
  termType: CourseTermType | undefined
  /** Controls size, opacity, and positioning; the SVG itself stays square. */
  className?: string
}

/**
 * Minimalist season glyph replacing the old text season tags: a sun for
 * summer, a snowflake for winter, and a diagonally split half/half symbol
 * for courses offered in both terms.
 */
export function SeasonSymbol({ termType, className }: SeasonSymbolProps) {
  if (!termType || termType === 'unknown') {
    return null
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      {termType === 'summer' ? <SunGlyph /> : null}
      {termType === 'winter' ? <SnowflakeGlyph /> : null}
      {termType === 'both' ? <FusedSeasonGlyph /> : null}
    </svg>
  )
}
