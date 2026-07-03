import { Link } from 'react-router-dom'
import type { CompletedCourse, Course } from '../../courses'
import { cleanCourseTitle, formatCourseTypeLabel } from '../../courses'
import { buildCourseAreaTags } from '../../courses/utils/courseCardDisplay.ts'
import { ROUTES } from '../../routes'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { AreaBadge } from '../../../shared/components/AreaBadge'
import { FavStar } from '../../../shared/components/FavStar'
import { useTranslation } from '../../i18n'
import { usePlannerFavorites, type PlannerFavoriteCandidate } from '../hooks/usePlannerFavorites'
import { formatSemesterLabelShort } from '../utils/semesterLabels'
import { assignCourseNumbers, getCourseColor } from '../utils/courseBadge.ts'
import {
  getTutorialSlotOptions,
  resolveVisibleTutorialSlotId,
} from '../utils/plannerSlotSelection.ts'
import { useTheme } from '../../theme'
import type { PlannerRenderMode } from './PlannerGrid'

function formatPlannerTypeLabel(types: string[]): string {
  return formatCourseTypeLabel(types).replace(/\s*\/\s*/g, ' + ')
}

function CandidateCard({
  candidate,
  studyProgramCode,
  activeSemesterLabel,
  isBadge,
  badgeNumber,
  hiddenSlotIds,
  onAddCourse,
  onToggleFavorite,
  onSelectTutorialSlot,
}: {
  candidate: PlannerFavoriteCandidate
  studyProgramCode: string | null
  activeSemesterLabel: string
  isBadge: boolean
  badgeNumber?: number
  hiddenSlotIds: string[]
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onToggleFavorite: (courseId: string) => void
  onSelectTutorialSlot: (courseId: string, selectedSlotId: string) => void
}) {
  const { t } = useTranslation()
  const { isDark } = useTheme()
  const badgeTextColor = isDark ? '#1a1a1a' : '#ffffff'
  const { course, isPlanned, isOfferedInActiveSemester, completedCourse, options, explicitAreaCode } = candidate
  const isAssignable = options.length > 0
  const canAdd = isAssignable && isOfferedInActiveSemester
  const dimClassName = !canAdd ? 'opacity-50' : completedCourse ? 'opacity-75' : ''
  const areaTags = buildCourseAreaTags(course, studyProgramCode)
  const tutorialSlotOptions = isPlanned ? getTutorialSlotOptions(course) : []
  const selectedTutorialSlotId = resolveVisibleTutorialSlotId(tutorialSlotOptions, hiddenSlotIds)
  const blockedHint = !isAssignable
    ? t('planner.favorites.notAssignable')
    : !isOfferedInActiveSemester
      ? t('planner.favorites.notOfferedHint', { semester: formatSemesterLabelShort(activeSemesterLabel) })
      : undefined

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={canAdd}
      onDragStart={(event) => {
        if (!canAdd) {
          event.preventDefault()
          return
        }
        event.dataTransfer.setData('text/planner-course-id', course.id)
        event.dataTransfer.setData('text/planner-area-code', explicitAreaCode ?? '')
        event.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => {
        if (canAdd) {
          onAddCourse(course.id, explicitAreaCode)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          if (canAdd) {
            onAddCourse(course.id, explicitAreaCode)
          }
        }
      }}
      title={blockedHint}
      className={`group/card cursor-pointer rounded-[10px] border border-border-light px-3.5 py-3 transition-colors hover:border-primary/30 ${
        completedCourse ? 'bg-surface-hover/20' : 'bg-surface'
      } ${canAdd ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`min-w-0 flex-1 ${dimClassName}`}>
          <div className="break-words text-[13px] font-semibold leading-snug text-fg">
            {isBadge && badgeNumber ? (
              <span
                className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-[4px] align-[-2px] text-[10px] font-bold tabular-nums"
                style={{ backgroundColor: getCourseColor(course.id), color: badgeTextColor }}
              >
                {badgeNumber}
              </span>
            ) : null}
            {cleanCourseTitle(course.title, course.number)}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2 py-0.5 text-[10px] font-medium text-pill-text">
              {formatPlannerTypeLabel(course.types)}
            </span>
            {isPlanned ? (
              <span className="inline-block whitespace-nowrap rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                {t('planner.favorites.inPlan')}
              </span>
            ) : null}
            {completedCourse ? (
              <span className="text-[10.5px] font-medium text-fg-muted">{t('planner.favorites.done')}</span>
            ) : null}
            {!isOfferedInActiveSemester ? (
              <span className="inline-block whitespace-nowrap rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-fg-muted">
                {t('planner.favorites.notOffered')}
              </span>
            ) : null}
          </div>
          {areaTags.length > 0 ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {areaTags.map((tag) => (
                <AreaBadge key={tag.key} label={tag.label} masterCat={tag.masterCat} />
              ))}
            </div>
          ) : null}
          {tutorialSlotOptions.length > 1 && selectedTutorialSlotId ? (
            <label
              className="mt-2 grid gap-1"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('planner.favorites.chooseTutorialSlot')}
              </span>
              <select
                value={selectedTutorialSlotId}
                onChange={(event) => onSelectTutorialSlot(course.id, event.target.value)}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[11.5px] text-fg outline-none focus:border-primary"
              >
                {tutorialSlotOptions.map((option) => (
                  <option key={option.slotId} value={option.slotId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
  activeTerm: 'SS' | 'WS' | null
  activeSemesterLabel: string
  plannedCourseIds: string[]
  isLoading: boolean
  error: string | null
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  chosenInfoAlternativeCode: string | null
  maxVisibleCandidates?: number
  renderMode?: PlannerRenderMode
  catalogTo?: string
  onSetAssignment: (courseId: string, areaCode: string | null) => void
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onToggleFavorite: (courseId: string) => void
  hiddenSlotIds: string[]
  onSelectTutorialSlot: (courseId: string, selectedSlotId: string) => void
}

export function PlannerFavoritesPanel({
  favoriteCourses,
  activeTerm,
  activeSemesterLabel,
  plannedCourseIds,
  isLoading,
  error,
  studyProgramCode,
  regulationRuleGroups,
  planAssignments,
  plannedCourses,
  completedCourses,
  chosenInfoAlternativeCode,
  maxVisibleCandidates,
  renderMode = 'name',
  catalogTo = ROUTES.catalog,
  onSetAssignment,
  onAddCourse,
  onToggleFavorite,
  hiddenSlotIds,
  onSelectTutorialSlot,
}: PlannerFavoritesPanelProps) {
  const { t } = useTranslation()
  const isBadge = renderMode === 'badge'
  const courseNumbers = assignCourseNumbers(plannedCourses.map((course) => course.id))
  const { candidates } = usePlannerFavorites({
    favoriteCourses,
    plannedCourseIds,
    studyProgramCode,
    regulationRuleGroups,
    planAssignments,
    plannedCourses,
    completedCourses,
    chosenInfoAlternativeCode,
    activeTerm,
    onSetAssignment,
  })

  const visibleCandidates = typeof maxVisibleCandidates === 'number'
    ? candidates.filter((candidate) => !candidate.isPlanned).slice(0, maxVisibleCandidates)
    : candidates

  return (
    <aside
      data-tour="planner-interested"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-border bg-surface min-[1100px]:h-0 min-[1100px]:min-h-full"
    >
      <div className="shrink-0 border-b border-border px-5 py-4">
        <div className="text-[14px] font-semibold text-fg">{t('planner.favorites.title')}</div>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          {t('planner.favorites.hint')}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-hover/30 px-4 py-3.5">
        {isLoading ? (
          <div className="text-[13px] text-fg-muted">{t('planner.favorites.loading')}</div>
        ) : error ? (
          <div className="text-[13px] text-danger">{t('planner.favorites.loadFailed')} {error}</div>
        ) : visibleCandidates.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-[10px] border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-fg-muted">
            <span>{t('planner.favorites.empty')}</span>
            <Link
              to={catalogTo}
              className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              {t('planner.favorites.openCatalog')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-2">
            {visibleCandidates.map((candidate, index) => (
              <div key={candidate.course.id} data-tour={index === 0 ? 'planner-interested-card' : undefined}>
                <CandidateCard
                  candidate={candidate}
                  studyProgramCode={studyProgramCode}
                  activeSemesterLabel={activeSemesterLabel}
                  isBadge={isBadge}
                  badgeNumber={courseNumbers.get(candidate.course.id)}
                  hiddenSlotIds={hiddenSlotIds}
                  onAddCourse={onAddCourse}
                  onToggleFavorite={onToggleFavorite}
                  onSelectTutorialSlot={onSelectTutorialSlot}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
