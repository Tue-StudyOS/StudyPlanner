import type { CSSProperties } from 'react'
import type { VisualizationCategoryProgress } from '../types'
import { VISUALIZATION_CATEGORY_COLORS } from '../visualizationCategories'

interface Point {
  x: number
  y: number
}

interface SpecializationCircleProps {
  categories: VisualizationCategoryProgress[]
  profileName: string
}

function polygonPath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') + ' Z'
}

function pointOnCircle(index: number, total: number, radius: number, center: number): Point {
  const angle = ((Math.PI * 2) / total) * index - Math.PI / 2
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  }
}

export function SpecializationCircle({ categories, profileName }: SpecializationCircleProps) {
  const size = 420
  const center = size / 2
  const radius = 135

  const outerPoints = categories.map((_, index) => pointOnCircle(index, categories.length, radius, center))
  const dataPoints = categories.map((category, index) =>
    pointOnCircle(index, categories.length, radius * category.progressRatio, center),
  )

  const topCategory = categories.reduce<VisualizationCategoryProgress | null>((best, current) => {
    if (!best) {
      return current
    }
    if (current.progressRatio > best.progressRatio) {
      return current
    }
    return best
  }, null)

  return (
    <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="mb-1 text-[14px] font-semibold text-fg">Specialization Profile</div>
      <div className="mb-4 text-[12px] text-fg-muted">
        Visual summary of your completed-course focus areas.
      </div>

      <div className="flex justify-center overflow-x-auto">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-[420px] w-[420px] min-w-[420px]">
          {[0.25, 0.5, 0.75, 1].map((scale) => (
            <path
              key={scale}
              d={polygonPath(
                categories.map((_, index) => pointOnCircle(index, categories.length, radius * scale, center)),
              )}
              fill="none"
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1"
            />
          ))}

          {outerPoints.map((point, index) => (
            <line
              key={`spoke-${categories[index].code}`}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="rgba(148, 163, 184, 0.25)"
              strokeWidth="1"
            />
          ))}

          <path
            d={polygonPath(dataPoints)}
            fill="rgba(147, 13, 42, 0.18)"
            stroke="rgb(147 13 42)"
            strokeWidth="2"
          />

          {dataPoints.map((point, index) => {
            const category = categories[index]
            return (
              <circle
                key={`dot-${category.code}`}
                cx={point.x}
                cy={point.y}
                r="5"
                fill={VISUALIZATION_CATEGORY_COLORS[category.code] ?? 'rgb(147 13 42)'}
              />
            )
          })}

          {outerPoints.map((_, index) => {
            const category = categories[index]
            const labelPoint = pointOnCircle(index, categories.length, radius * 1.16, center)
            const isTopCategory = topCategory?.code === category.code && category.progressRatio > 0
            return (
              <text
                key={`label-${category.code}`}
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isTopCategory ? VISUALIZATION_CATEGORY_COLORS[category.code] : 'currentColor'}
                className={isTopCategory ? 'text-[13px] font-semibold text-fg' : 'text-[11px] text-fg-muted'}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: isTopCategory ? 13 : 11.5,
                  fontWeight: isTopCategory ? 700 : 400,
                } as CSSProperties}
              >
                {category.name}
              </text>
            )
          })}

          <circle cx={center} cy={center} r="44" fill="rgba(147, 13, 42, 0.08)" stroke="rgba(147, 13, 42, 0.2)" />
          <text
            x={center}
            y={center - 8}
            textAnchor="middle"
            fill="currentColor"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, letterSpacing: '0.08em' }}
            className="text-fg-muted"
          >
            PROFILE
          </text>
          <text
            x={center}
            y={center + 12}
            textAnchor="middle"
            fill="currentColor"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700 }}
            className="text-fg"
          >
            {profileName}
          </text>
        </svg>
      </div>
    </div>
  )
}
