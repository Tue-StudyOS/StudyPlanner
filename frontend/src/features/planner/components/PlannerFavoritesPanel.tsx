import { Link } from 'react-router-dom'
import type { CompletedCourse, Course } from '../../courses'
import { cleanCourseTitle, formatCourseTypeLabel } from '../../courses'
import { ROUTES } from '../../routes'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { CatBadge } from '../../../shared/components/CatBadge'
import { FavStar } from '../../../shared/components/FavStar'
import { usePlannerFavorites, type PlannerFavoriteCandidate } from '../hooks/usePlannerFavorites'

const NOT_ASSIGNABLE_HINT =
  "Can't be added: this course isn't part of your selected study program or examination regulations."

function CandidateCard({
  candidate,
  onOpenCourse,
  onToggleFavorite,
}: {
  candidate: PlannerFavoriteCandidate
  onOpenCourse: (course: Course) => void
  onToggleFavorite: (courseId: string) => void
}) {
  const { course, isPlanned, completedCourse, options, explicitAreaCode } = candidate
  const isAssignable = options.length > 0
  const dimClassName = !isAssignable ? 'opacity-50' : completedCourse ? 'opacity-75' : ''

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={isAssignable}
      onDragStart={(event) => {
        if (!isAssignable) {
          event.preventDefault()
          return
        }
        event.dataTransfer.setData('text/planner-course-id', course.id)
        event.dataTransfer.setData('text/planner-area-code', explicitAreaCode ?? '')
        event.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onOpenCourse(course)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpenCourse(course)
        }
      }}
      title={!isAssignable ? NOT_ASSIGNABLE_HINT : undefined}
      className={`group/card cursor-pointer rounded-[10px] border border-border-light px-3.5 py-3 transition-colors hover:border-primary/30 ${
        completedCourse ? 'bg-surface-hover/20' : 'bg-surface'
      } ${isAssignable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`min-w-0 flex-1 ${dimClassName}`}>
          <div className="break-words text-[13px] font-semibold leading-snug text-fg">
            {cleanCourseTitle(course.title, course.number)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2 py-0.5 text-[10px] font-medium text-pill-text">
              {formatCourseTypeLabel(course.types)}
            </span>
            {course.masterCats.map((cat) => (
              <CatBadge key={cat} cat={cat} />
            ))}
            {isPlanned ? (
              <span className="inline-block whitespace-nowrap rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                In plan
              </span>
            ) : null}
            {completedCourse ? (
              <span className="text-[10.5px] font-medium text-fg-muted">done</span>
            ) : null}
          </div>
        </div>

        <div onClick={(event) => event.stopPropagation()}>
          <FavStar active onToggle={() => onToggleFavorite(course.id)} />
        </div>
      </div>
    </div>
  )
}

interface PlannerFavoritesPanelProps {
  favoriteCourses: Course[]
  plannedCourseIds: string[]
  isLoading: boolean
  error: string | null
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  onSetAssignment: (courseId: string, areaCode: string | null) => void
  onOpenCourse: (course: Course) => void
  onToggleFavorite: (courseId: string) => void
}

export function PlannerFavoritesPanel({
  favoriteCourses,
  plannedCourseIds,
  isLoading,
  error,
  studyProgramCode,
  regulationRuleGroups,
  planAssignments,
  plannedCourses,
  completedCourses,
  onSetAssignment,
  onOpenCourse,
  onToggleFavorite,
}: PlannerFavoritesPanelProps) {
  const { candidates } = usePlannerFavorites({
    favoriteCourses,
    plannedCourseIds,
    studyProgramCode,
    regulationRuleGroups,
    planAssignments,
    plannedCourses,
    completedCourses,
    onSetAssignment,
  })

  return (
    <aside
      data-tour="planner-interested"
      className="flex flex-col overflow-hidden rounded-[10px] border border-border bg-surface min-[1100px]:h-0 min-[1100px]:min-h-full"
    >
      <div className="shrink-0 border-b border-border px-5 py-4">
        <div className="text-[14px] font-semibold text-fg">Interested</div>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Tap a course for details, drag it into the week to plan it.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-hover/30 px-4 py-3.5">
        {isLoading ? (
          <div className="text-[13px] text-fg-muted">Loading your interested courses...</div>
        ) : error ? (
          <div className="text-[13px] text-primary">Failed to load planner candidates. {error}</div>
        ) : candidates.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-[10px] border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-fg-muted">
            <span>Bookmark some courses in the catalog first, then plan with them here.</span>
            <Link
              to={ROUTES.catalog}
              className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              Open catalog
            </Link>
          </div>
        ) : (
          <div className="grid gap-2">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.course.id}
                candidate={candidate}
                onOpenCourse={onOpenCourse}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
