import { useEffect, useState } from 'react'
import { CloseIcon } from '../../../shared/components/icons'
import type { RegulationAreaOption } from '../../../shared/utils/regulation'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { CourseDetailBody } from '../../courses/components/CourseDetailBody'
import { useCatalogCourseDetail } from '../../courses/hooks/useCatalogCourseDetail'
import type { CompletedCourse, Course } from '../../courses'

interface PlannerCourseDetailModalProps {
  course: Course
  isPlanned: boolean
  completedCourse: CompletedCourse | null
  areaOptions: RegulationAreaOption[]
  assignedAreaCode: string | null
  suggestedAreaCode: string | null
  onAdd: (courseId: string, areaCode: string | null) => void
  onRemove: (courseId: string) => void
  onSetAssignment: (courseId: string, areaCode: string | null) => void
  onClose: () => void
}

/**
 * Centered course detail for the planner (bottom sheet on phones). Adding and
 * removing a course from the plan happens here — the grid itself stays free
 * of destructive controls.
 */
export function PlannerCourseDetailModal({
  course,
  isPlanned,
  completedCourse,
  areaOptions,
  assignedAreaCode,
  suggestedAreaCode,
  onAdd,
  onRemove,
  onSetAssignment,
  onClose,
}: PlannerCourseDetailModalProps) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')
  // The planner works on catalog summaries; load the full record for the body.
  const { course: detailCourse } = useCatalogCourseDetail(course.id)
  // Reset the local selection during render when the modal switches courses.
  const [selection, setSelection] = useState<{ courseId: string; areaCode: string | null }>({
    courseId: course.id,
    areaCode: assignedAreaCode,
  })
  if (selection.courseId !== course.id) {
    setSelection({ courseId: course.id, areaCode: assignedAreaCode })
  }
  const selectedAreaCode = selection.areaCode

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSelectArea(areaCode: string | null): void {
    setSelection({ courseId: course.id, areaCode })
    if (isPlanned) {
      onSetAssignment(course.id, areaCode)
    }
  }

  const footer = (
    <div className="grid gap-3">
      {areaOptions.length > 0 ? (
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Counts as
          </span>
          <select
            value={selectedAreaCode ?? ''}
            onChange={(event) => handleSelectArea(event.target.value || null)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-[13px] text-fg outline-none focus:border-primary"
          >
            <option value="">{suggestedAreaCode ? 'Automatic' : 'Choose area'}</option>
            {areaOptions.map((option) => (
              <option key={option.code} value={option.code} title={option.label}>
                {option.shortLabel}
                {suggestedAreaCode === option.code ? ' · suggested' : ''}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {isPlanned ? (
        <button
          type="button"
          onClick={() => {
            onRemove(course.id)
            onClose()
          }}
          className="w-full rounded-md border border-border px-4 py-3 text-[13.5px] font-medium text-fg transition-colors hover:border-primary/40 hover:text-primary"
        >
          Remove from plan
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            onAdd(course.id, selectedAreaCode)
            onClose()
          }}
          disabled={areaOptions.length === 0}
          title={
            areaOptions.length === 0
              ? "Can't be added: this course isn't part of your selected study program or examination regulations."
              : undefined
          }
          className="w-full rounded-md bg-primary px-4 py-3 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add to plan
        </button>
      )}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/30"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={
          isMobileViewport
            ? 'absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[18px] border-t border-border bg-bg px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
            : 'mx-auto my-10 max-h-[85dvh] w-[34rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[14px] border border-border bg-bg px-5 py-5 shadow-2xl'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Course Details
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close course details"
            className="flex items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <CourseDetailBody
          course={detailCourse ?? course}
          completedCourse={completedCourse ?? undefined}
          footer={footer}
        />
      </div>
    </div>
  )
}
