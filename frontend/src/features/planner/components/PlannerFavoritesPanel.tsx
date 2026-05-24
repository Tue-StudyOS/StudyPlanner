import { useMemo } from 'react'
import type { Course } from '../../courses'

function CandidateCard({
  course,
  isPlanned,
  onAddCourse,
  onRemoveCourse,
}: {
  course: Course
  isPlanned: boolean
  onAddCourse: (courseId: string) => void
  onRemoveCourse: (courseId: string) => void
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/planner-course-id', course.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      className="cursor-grab rounded-[10px] border border-border-light bg-surface px-4 py-3 transition-colors hover:bg-surface-hover active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-fg">{course.title}</div>
          <div className="text-[12px] text-fg-muted">
            {course.number} · {course.ects ?? '–'} ECTS
          </div>
          <div className="mt-1 text-[11px] text-fg-muted">
            {course.schedule.at(0)?.day ?? 'Day tba'} · {course.schedule.at(0)?.time ?? 'Time tba'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => (isPlanned ? onRemoveCourse(course.id) : onAddCourse(course.id))}
          className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            isPlanned
              ? 'border border-border bg-surface text-fg hover:bg-surface-hover'
              : 'bg-primary text-white hover:opacity-90'
          }`}
        >
          {isPlanned ? 'Remove' : 'Add'}
        </button>
      </div>
    </div>
  )
}

interface PlannerFavoritesPanelProps {
  favoriteCourses: Course[]
  plannedCourseIds: string[]
  activeSemesterLabel: string
  isLoading: boolean
  error: string | null
  onAddCourse: (courseId: string) => void
  onRemoveCourse: (courseId: string) => void
}

export function PlannerFavoritesPanel({
  favoriteCourses,
  plannedCourseIds,
  activeSemesterLabel,
  isLoading,
  error,
  onAddCourse,
  onRemoveCourse,
}: PlannerFavoritesPanelProps) {
  const sortedFavoriteCourses = useMemo(
    () =>
      [...favoriteCourses].sort((leftCourse, rightCourse) => {
        const leftIsPlanned = plannedCourseIds.includes(leftCourse.id)
        const rightIsPlanned = plannedCourseIds.includes(rightCourse.id)
        if (leftIsPlanned !== rightIsPlanned) {
          return Number(leftIsPlanned) - Number(rightIsPlanned)
        }
        return leftCourse.title.localeCompare(rightCourse.title)
      }),
    [favoriteCourses, plannedCourseIds],
  )

  return (
    <aside className="overflow-hidden rounded-[10px] border border-border bg-surface lg:h-[44rem]">
      <div className="border-b border-border px-6 py-5.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-surface-hover/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Favorites picker
          </div>
          <div className="text-[11.5px] text-fg-muted">{favoriteCourses.length} favorite(s)</div>
          <div className="text-[11.5px] text-fg-muted">{plannedCourseIds.length} already planned</div>
        </div>
        <p className="text-[12.5px] text-fg-muted">
          Only planning mode shows this fixed-size picker for {activeSemesterLabel}.
        </p>
      </div>

      <div className="max-h-[26rem] overflow-y-auto bg-surface-hover/30 px-6 py-4 lg:h-[calc(44rem-89px)] lg:max-h-none">
        {isLoading ? (
          <div className="text-[13px] text-fg-muted">Loading your favorite course candidates...</div>
        ) : error ? (
          <div className="text-[13px] text-primary">Failed to load planner candidates. {error}</div>
        ) : sortedFavoriteCourses.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-fg-muted">
            Add some favorites in the catalog first, then come back here to plan with them.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {sortedFavoriteCourses.map((course) => (
              <CandidateCard
                key={course.id}
                course={course}
                isPlanned={plannedCourseIds.includes(course.id)}
                onAddCourse={onAddCourse}
                onRemoveCourse={onRemoveCourse}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
