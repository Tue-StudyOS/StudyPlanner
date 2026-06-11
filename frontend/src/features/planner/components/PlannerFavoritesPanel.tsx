import type { CompletedCourse, Course } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import { FavStar } from '../../../shared/components/FavStar'
import { usePlannerFavorites } from '../hooks/usePlannerFavorites'

function AssignmentSelect({
  options,
  selectedAreaCode,
  suggestedAreaCode,
  isPlanned,
  isEditing,
  onSelectAssignment,
}: {
  options: RegulationAreaOption[]
  selectedAreaCode: string | null
  suggestedAreaCode: string | null
  isPlanned: boolean
  isEditing: boolean
  onSelectAssignment: (areaCode: string | null) => void
}) {
  if (options.length === 0) {
    return null
  }

  return (
    <label className="grid gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        Counts as
      </span>
      <select
        value={selectedAreaCode ?? ''}
        disabled={!isEditing}
        onChange={(event) => onSelectAssignment(event.target.value || null)}
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">
          {suggestedAreaCode ? 'Automatic' : 'Choose area'}
        </option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
            {!isPlanned && suggestedAreaCode === option.code ? ' · suggested' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

const EDIT_REQUIRED_HINT = 'Click "Edit semester" first to add courses to your plan.'
const NOT_ASSIGNABLE_HINT =
  "Can't be added: this course isn't part of your selected study program or examination regulations."

function CandidateCard({
  course,
  isPlanned,
  isEditing,
  options,
  selectedAreaCode,
  explicitAreaCode,
  suggestedAreaCode,
  completedCourse,
  onSelectAssignment,
  onAddCourse,
  onRemoveCourse,
  onToggleFavorite,
}: {
  course: Course
  isPlanned: boolean
  isEditing: boolean
  options: RegulationAreaOption[]
  selectedAreaCode: string | null
  explicitAreaCode: string | null
  suggestedAreaCode: string | null
  completedCourse: CompletedCourse | null
  onSelectAssignment: (areaCode: string | null) => void
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onRemoveCourse: (courseId: string) => void
  onToggleFavorite: (courseId: string) => void
}) {
  const isAssignable = options.length > 0
  const isDraggable = isEditing && isAssignable
  // The assignability distinction (dimming + hint) only matters while editing.
  // Outside edit mode every favorite is treated equally and just shows the edit hint.
  const showNotAssignable = isEditing && !isAssignable
  const dimClassName = showNotAssignable ? 'opacity-50' : completedCourse ? 'opacity-75' : ''

  return (
    <div
      draggable={isDraggable}
      onDragStart={(event) => {
        if (!isDraggable) {
          event.preventDefault()
          return
        }
        event.dataTransfer.setData('text/planner-course-id', course.id)
        event.dataTransfer.setData('text/planner-area-code', explicitAreaCode ?? '')
        event.dataTransfer.effectAllowed = 'move'
      }}
      className={`group/card relative rounded-[10px] border border-border-light px-4 py-3 transition-colors ${
        completedCourse ? 'bg-surface-hover/20' : 'bg-surface'
      } ${isDraggable ? 'cursor-grab hover:bg-surface-hover active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`min-w-0 ${dimClassName}`}>
          <div className="break-words text-[13px] font-semibold text-fg">
            {course.title}
            {completedCourse ? <span className="font-medium text-fg-muted"> - done</span> : null}
          </div>
          <div className="break-words text-[12px] text-fg-muted">
            {course.number} · {course.ects ?? '–'} ECTS
          </div>
          <div className="mt-1 break-words text-[11px] text-fg-muted">
            {course.schedule.at(0)?.day ?? 'Day tba'} · {course.schedule.at(0)?.time ?? 'Time tba'}
          </div>
        </div>

        <div className={`flex shrink-0 items-center gap-1.5 ${completedCourse ? 'opacity-80' : ''}`}>
          <span className="group/btn relative inline-flex">
            <button
              type="button"
              disabled={!isEditing || !isAssignable}
              onClick={() => (isPlanned ? onRemoveCourse(course.id) : onAddCourse(course.id, explicitAreaCode))}
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isPlanned
                  ? 'border border-border bg-surface text-fg hover:bg-surface-hover'
                  : 'bg-primary text-white hover:opacity-90'
              }`}
            >
              {isPlanned ? 'Remove' : 'Add'}
            </button>

            {!isEditing ? (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-48 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium leading-snug text-fg-muted opacity-0 shadow-md transition-opacity duration-150 group-hover/btn:opacity-100"
              >
                {EDIT_REQUIRED_HINT}
              </span>
            ) : null}
          </span>

          <FavStar active onToggle={() => onToggleFavorite(course.id)} />
        </div>
      </div>

      <div className={`mt-3 grid gap-2 ${dimClassName}`}>
        <AssignmentSelect
          options={options}
          selectedAreaCode={selectedAreaCode}
          suggestedAreaCode={suggestedAreaCode}
          isPlanned={isPlanned}
          isEditing={isEditing}
          onSelectAssignment={onSelectAssignment}
        />

        {suggestedAreaCode && !isPlanned ? (
          <div className="text-[11px] text-fg-muted">
            Suggested automatically from your remaining regulation needs and already credited courses.
          </div>
        ) : null}
      </div>

      {showNotAssignable ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-3 right-3 z-20 mb-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium leading-snug text-fg-muted opacity-0 shadow-md transition-opacity duration-150 group-hover/card:opacity-100"
        >
          {NOT_ASSIGNABLE_HINT}
        </span>
      ) : null}
    </div>
  )
}

interface PlannerFavoritesPanelProps {
  favoriteCourses: Course[]
  plannedCourseIds: string[]
  activeSemesterLabel: string
  isEditing: boolean
  isLoading: boolean
  error: string | null
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  onSetAssignment: (courseId: string, areaCode: string | null) => void
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onRemoveCourse: (courseId: string) => void
  onToggleFavorite: (courseId: string) => void
}

export function PlannerFavoritesPanel({
  favoriteCourses,
  plannedCourseIds,
  activeSemesterLabel,
  isEditing,
  isLoading,
  error,
  studyProgramCode,
  regulationRuleGroups,
  planAssignments,
  plannedCourses,
  completedCourses,
  onSetAssignment,
  onAddCourse,
  onRemoveCourse,
  onToggleFavorite,
}: PlannerFavoritesPanelProps) {
  const { candidates, selectAssignment } = usePlannerFavorites({
    favoriteCourses,
    plannedCourseIds,
    isEditing,
    studyProgramCode,
    regulationRuleGroups,
    planAssignments,
    plannedCourses,
    completedCourses,
    onSetAssignment,
  })

  return (
    <aside className="rounded-[10px] border border-border bg-surface">
      <div className="border-b border-border px-6 py-5.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="text-[14px] font-semibold text-fg">Favorites</div>
          <div className="text-[11.5px] text-fg-muted">{favoriteCourses.length} favorite(s)</div>
          <div className="text-[11.5px] text-fg-muted">{plannedCourseIds.length} already planned</div>
        </div>
        <p className="text-[12.5px] text-fg-muted">
          Add favorite courses to {activeSemesterLabel} and choose directly what each course should count as.
        </p>
      </div>

      <div className="bg-surface-hover/30 px-6 py-4">
        {isLoading ? (
          <div className="text-[13px] text-fg-muted">Loading your favorite course candidates...</div>
        ) : error ? (
          <div className="text-[13px] text-primary">Failed to load planner candidates. {error}</div>
        ) : candidates.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-fg-muted">
            Add some favorites in the catalog first, then come back here to plan with them.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {candidates.map((candidate) => (
              <CandidateCard
                key={candidate.course.id}
                course={candidate.course}
                isPlanned={candidate.isPlanned}
                isEditing={isEditing}
                options={candidate.options}
                selectedAreaCode={candidate.selectedAreaCode}
                explicitAreaCode={candidate.explicitAreaCode}
                suggestedAreaCode={candidate.suggestedAreaCode}
                completedCourse={candidate.completedCourse}
                onSelectAssignment={(areaCode) =>
                  selectAssignment(candidate.course.id, candidate.isPlanned, areaCode)
                }
                onAddCourse={onAddCourse}
                onRemoveCourse={onRemoveCourse}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
