import type { CourseTermType } from '../../features/courses'

const SUMMER_COLOR_CLASSES = 'text-amber-600/25 dark:text-amber-300/20'
const WINTER_COLOR_CLASSES = 'text-sky-600/25 dark:text-sky-300/20'

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
  from: polarPoint(7.2, angle),
  to: polarPoint(8.8, angle),
}))

// Spokes stop short of the center so strokes never stack into a dark blob.
const SNOWFLAKE_LINES: LineSegment[] = [0, 60, 120, 180, 240, 300].map((angle) => ({
  from: polarPoint(4.5, angle),
  to: polarPoint(8.8, angle),
}))

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

function SunGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <g
        className={SUMMER_COLOR_CLASSES}
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
      >
        <circle cx={12} cy={12} r={3.8} />
        <Lines segments={SUN_RAYS} />
      </g>
    </svg>
  )
}

function SnowflakeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <g
        className={WINTER_COLOR_CLASSES}
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        fill="none"
      >
        <Lines segments={SNOWFLAKE_LINES} />
      </g>
    </svg>
  )
}

interface SeasonSymbolProps {
  termType: CourseTermType | undefined
  /** Controls size, opacity, and positioning; the SVG itself stays square. */
  className?: string
}

/**
 * Minimalist season glyph replacing the old text season tags: a sun for
 * summer, a snowflake for winter, and separated corner glyphs for both terms.
 */
export function SeasonSymbol({ termType, className }: SeasonSymbolProps) {
  if (!termType || termType === 'unknown') {
    return null
  }

  if (termType === 'summer') {
    return <SunGlyph className={className} />
  }

  if (termType === 'winter') {
    return <SnowflakeGlyph className={className} />
  }

  return (
    <div className={`relative ${className ?? ''}`} aria-hidden="true">
      <SunGlyph className="absolute left-[6%] top-[6%] h-[46%] w-[46%]" />
      <SnowflakeGlyph className="absolute bottom-[6%] right-[6%] h-[46%] w-[46%]" />
    </div>
  )
}
