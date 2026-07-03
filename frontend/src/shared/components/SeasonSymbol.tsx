import { useId } from 'react'
import type { CourseTermType } from '../../features/courses'

// Almost neutral tints — barely colored, mostly gray.
const SUMMER_COLOR_CLASSES = 'text-amber-700/20 dark:text-amber-200/15'
const WINTER_COLOR_CLASSES = 'text-sky-700/20 dark:text-sky-200/15'

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

// Six spokes, each with a small outward V-branch, form a minimalist snowflake.
const SNOWFLAKE_LINES: LineSegment[] = [90, 150, 210, 270, 330, 30].flatMap((angle) => {
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
})

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
      className={SUMMER_COLOR_CLASSES}
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
      className={WINTER_COLOR_CLASSES}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      fill="none"
    >
      <Lines segments={SNOWFLAKE_LINES} />
    </g>
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
  const clipId = useId()

  if (!termType || termType === 'unknown') {
    return null
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      {termType === 'summer' ? <SunGlyph /> : null}
      {termType === 'winter' ? <SnowflakeGlyph /> : null}
      {termType === 'both' ? (
        <>
          <defs>
            {/* A small gutter along the anti-diagonal keeps the halves visually separated. */}
            <clipPath id={`${clipId}-summer`}>
              <path d="M0 0H22.8L0 22.8Z" />
            </clipPath>
            <clipPath id={`${clipId}-winter`}>
              <path d="M24 1.2V24H1.2Z" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${clipId}-summer)`}>
            <SunGlyph />
          </g>
          <g clipPath={`url(#${clipId}-winter)`}>
            <SnowflakeGlyph />
          </g>
        </>
      ) : null}
    </svg>
  )
}
