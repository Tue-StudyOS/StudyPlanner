import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { VisualizationCategoryCourse, VisualizationCategoryProgress } from '../types'
import { VISUALIZATION_CATEGORY_COLORS } from '../visualizationCategories'

const EXTENDED_RING_SCALE = 1.1
const MIN_POINT_SCALE = 0.1
const STRONG_THRESHOLD = 0.55

interface Point {
  x: number
  y: number
}

interface SpecializationCircleProps {
  categories: VisualizationCategoryProgress[]
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

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function formatCourseLabel(course: VisualizationCategoryCourse): string {
  const parts = [
    course.courseNumber || null,
    course.semester || null,
    course.ects ? `${course.ects} ECTS` : null,
    course.grade !== null ? `Note ${course.grade.toFixed(1)}` : null,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0))
  return parts.join(' · ')
}

function SpecializationDetailModal({
  category,
  onClose,
}: {
  category: VisualizationCategoryProgress
  onClose: () => void
}) {
  const courses = category.courses ?? []
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-black/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-2xl flex-col rounded-[14px] border border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-fg">{category.name}</div>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {category.earnedEcts}/{category.referenceEcts} ECTS · {courses.length} course
              {courses.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-5">
          {courses.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border px-5 py-8 text-center text-[12.5px] text-fg-muted">
              No completed courses are credited toward this specialization area yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:gap-2.5">
              {courses.map((course) => (
                <div
                  key={course.completedCourseId}
                  className="min-w-0 rounded-[10px] border border-border-light bg-surface-hover/35 px-3 py-2.5 sm:px-4 sm:py-3"
                >
                  <div className="break-words text-[12.5px] font-semibold text-fg sm:text-[13px]">
                    {course.title}
                  </div>
                  <div className="break-words text-[11.5px] text-fg-muted sm:text-[12px]">
                    {formatCourseLabel(course)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function SpecializationCircle({ categories }: SpecializationCircleProps) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [hoveredCode, setHoveredCode] = useState<string | null>(null)

  const selectedCategory = useMemo(
    () => categories.find((category) => category.code === selectedCode) ?? null,
    [categories, selectedCode],
  )

  if (categories.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
        <div className="mb-1 text-[14px] font-semibold text-fg">Specialization Profile</div>
        <div className="text-[12px] text-fg-muted">
          Your specialization profile will appear here once progress data is available.
        </div>
      </div>
    )
  }

  const size = 420
  const center = size / 2
  const radius = 135

  const outerPoints = categories.map((_, index) => pointOnCircle(index, categories.length, radius, center))
  const extendedOuterPoints = categories.map((_, index) =>
    pointOnCircle(index, categories.length, radius * EXTENDED_RING_SCALE, center),
  )
  const edgeMidpoints = outerPoints.map((_, index) =>
    midpoint(outerPoints[index], outerPoints[(index + 1) % outerPoints.length]),
  )
  const dataPoints = categories.map((category, index) =>
    pointOnCircle(
      index,
      categories.length,
      radius * (MIN_POINT_SCALE + (1 - MIN_POINT_SCALE) * category.progressRatio),
      center,
    ),
  )

  return (
    <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="mb-1 text-[14px] font-semibold text-fg">Specialization Profile</div>
      <div className="mb-4 text-[12px] text-fg-muted">
        Click a slice to inspect the courses credited to that specialization.
      </div>

      <div className="flex justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[420px]">
          {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((scale) => (
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

          <path
            d={polygonPath(extendedOuterPoints)}
            fill="none"
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth="1"
          />

          {extendedOuterPoints.map((point, index) => (
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

          {categories.map((category, index) => {
            const prevMid = edgeMidpoints[(index - 1 + categories.length) % categories.length]
            const nextMid = edgeMidpoints[index]
            const isActive = selectedCode === category.code
            const isHovered = hoveredCode === category.code
            const slicePath = polygonPath([
              { x: center, y: center },
              prevMid,
              outerPoints[index],
              nextMid,
            ])
            const fillOpacity = isActive ? 0.18 : isHovered ? 0.08 : 0
            const fillColor = VISUALIZATION_CATEGORY_COLORS[category.code] ?? 'rgb(147 13 42)'
            return (
              <path
                key={`slice-${category.code}`}
                d={slicePath}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={isActive ? fillColor : 'transparent'}
                strokeOpacity={isActive ? 0.55 : 0}
                strokeWidth={1.2}
                className="cursor-pointer transition-[fill-opacity,stroke-opacity] duration-150"
                role="button"
                tabIndex={0}
                aria-label={`Show courses for ${category.name}`}
                onClick={() => setSelectedCode(category.code)}
                onMouseEnter={() => setHoveredCode(category.code)}
                onMouseLeave={() =>
                  setHoveredCode((current) => (current === category.code ? null : current))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedCode(category.code)
                  }
                }}
              />
            )
          })}

          <path
            d={polygonPath(dataPoints)}
            fill="rgba(147, 13, 42, 0.18)"
            stroke="rgb(147 13 42)"
            strokeWidth="2"
            pointerEvents="none"
          />

          {dataPoints.map((point, index) => {
            const category = categories[index]
            const isStrong = category.progressRatio >= STRONG_THRESHOLD
            const dotColor = isStrong
              ? VISUALIZATION_CATEGORY_COLORS[category.code] ?? 'rgb(147 13 42)'
              : 'rgb(148 163 184)'
            return (
              <circle
                key={`dot-${category.code}`}
                cx={point.x}
                cy={point.y}
                r="3"
                fill={dotColor}
                pointerEvents="none"
              />
            )
          })}

          {outerPoints.map((_, index) => {
            const category = categories[index]
            const labelPoint = pointOnCircle(index, categories.length, radius * 1.22, center)
            const isStrong = category.progressRatio >= STRONG_THRESHOLD
            return (
              <text
                key={`label-${category.code}`}
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isStrong ? VISUALIZATION_CATEGORY_COLORS[category.code] ?? 'rgb(147 13 42)' : 'currentColor'}
                className={isStrong ? 'text-[13px] font-semibold text-fg' : 'text-[11px] text-fg-muted'}
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: isStrong ? 13 : 11.5,
                  fontWeight: isStrong ? 700 : 400,
                  pointerEvents: 'none',
                } as CSSProperties}
              >
                {category.name}
              </text>
            )
          })}
        </svg>
      </div>

      {selectedCategory ? (
        <SpecializationDetailModal
          category={selectedCategory}
          onClose={() => setSelectedCode(null)}
        />
      ) : null}
    </div>
  )
}
