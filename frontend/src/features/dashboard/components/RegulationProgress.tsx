import { useMemo, useState } from 'react'
import type { MasterCat } from '../../courses'
import { CloseIcon } from '../../../shared/components/icons'
import { RegulationAreasInfo } from '../../../shared/components/RegulationAreasInfo'
import type { RegulationAreaCourse, RegulationAreaProgress } from '../types'

const CAT_COLOR_CLASS: Partial<Record<MasterCat, string>> & { default: string } = {
  TECH: 'bg-cat-tech',
  THEO: 'bg-cat-theo',
  PRAK: 'bg-cat-prak',
  INFO: 'bg-cat-info',
  BASIS: 'bg-cat-basis',
  default: 'bg-border',
}

function colorClass(masterCat: MasterCat | null): string {
  return (masterCat ? CAT_COLOR_CLASS[masterCat] : undefined) ?? CAT_COLOR_CLASS.default
}

function formatCourseLabel(course: RegulationAreaCourse): string {
  const gradePart = course.grade !== null ? `Note: ${course.grade.toFixed(1)}` : null
  const parts = [course.courseNumber, course.semester, `${course.ects} ECTS`, gradePart].filter(Boolean)
  return parts.join(' · ')
}

function RegulationAreaDetailModal({
  area,
  onClose,
}: {
  area: RegulationAreaProgress
  onClose: () => void
}) {
  const courses = area.courses ?? []

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/45" role="dialog" aria-modal="true" aria-labelledby="regulation-area-modal-title" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center px-4 py-6">
        <div className="flex w-full max-w-3xl flex-col rounded-[14px] border border-border bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-xs ${colorClass(area.masterCat)}`} />
              <span className="text-[13px] font-semibold text-fg">{area.code}</span>
              <span className="text-[12px] text-fg-muted">
                {(area.rawAreaCodes ?? []).length > 1 ? `Includes ${area.rawAreaCodes?.join(', ')}` : area.name}
              </span>
            </div>
            <h3 id="regulation-area-modal-title" className="break-words text-[20px] font-semibold text-fg">
              {area.name}
            </h3>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {area.earnedEcts}/{area.requiredEcts} ECTS credited · {courses.length} counted course{courses.length !== 1 ? 's' : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="px-6 py-5">
          {courses.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border px-5 py-10 text-center text-[13px] text-fg-muted">
              No completed courses are counted toward this regulation part yet.
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
    </div>
  )
}

interface RegulationProgressProps {
  areas: RegulationAreaProgress[]
}

export function RegulationProgress({ areas }: RegulationProgressProps) {
  const [selectedAreaCode, setSelectedAreaCode] = useState<string | null>(null)

  const selectedArea = useMemo(
    () => areas.find((area) => area.code === selectedAreaCode) ?? null,
    [areas, selectedAreaCode],
  )

  if (areas.length === 0) {
    return null
  }

  return (
    <>
      <div className="overflow-hidden rounded-[10px] border border-border bg-surface px-6 py-5.5">
        <div className="mb-4.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[14px] font-semibold text-fg">Regulation Progress</div>
            <RegulationAreasInfo />
          </div>
          <p className="mt-1 text-[12px] text-fg-muted">
            Click a regulation part to inspect the counted courses.
          </p>
        </div>
        <div className="grid gap-3.5">
          {areas.map((area) => {
            const pct = area.requiredEcts > 0
              ? Math.min(100, Math.round((area.earnedEcts / area.requiredEcts) * 100))
              : 0
            return (
              <button
                key={area.code}
                type="button"
                onClick={() => setSelectedAreaCode(area.code)}
                className="w-full min-w-0 rounded-[10px] border border-transparent px-2 py-1 text-left transition-colors hover:border-border hover:bg-surface-hover/35"
              >
                <div className="mb-1.5 flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 rounded-xs ${colorClass(area.masterCat)}`} />
                    <span className="text-[13px] font-semibold text-fg">{area.code}</span>
                    <span className="truncate text-[12px] text-fg-muted">{area.name}</span>
                    {area.isFulfilled ? (
                      <span className="shrink-0 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                        Fulfilled
                      </span>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold text-fg">
                    {area.earnedEcts}/{area.requiredEcts}
                  </span>
                </div>
                <div className="h-1.25 overflow-hidden rounded-[3px] bg-border-light">
                  <div
                    className={`h-full rounded-[3px] ${colorClass(area.masterCat)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedArea ? (
        <RegulationAreaDetailModal area={selectedArea} onClose={() => setSelectedAreaCode(null)} />
      ) : null}
    </>
  )
}
