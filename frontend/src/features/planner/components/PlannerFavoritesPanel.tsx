import { Link } from 'react-router-dom'
import type { CompletedCourse, Course } from '../../courses'
import { cleanCourseTitle, formatCourseTypeLabel } from '../../courses'
import { buildCourseAreaTags } from '../../courses/utils/courseCardDisplay.ts'
import { ROUTES } from '../../routes'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { AreaBadge } from '../../../shared/components/AreaBadge'
import { FavStar } from '../../../shared/components/FavStar'
import { InfoIcon } from '../../../shared/components/icons'
import { useTranslation } from '../../i18n'
import { usePlannerFavorites, type PlannerFavoriteCandidate } from '../hooks/usePlannerFavorites'
import { formatSemesterLabelShort } from '../utils/semesterLabels'
import {
  getTutorialSlotOptions,
  resolveVisibleTutorialSlotId,
  type TutorialSlotSelectLayout,
} from '../utils/plannerSlotSelection.ts'
import { TutorialSlotSelect } from './TutorialSlotSelect.tsx'

function formatPlannerTypeLabel(types: string[]): string {
  return formatCourseTypeLabel(types).replace(/\s*\/\s*/g, ' + ')
}

function CandidateCard({
  candidate,
  studyProgramCode,
  activeSemesterLabel,
  hiddenSlotIds,
  tutorialSlotSelectLayout,
  onAddCourse,
  onOpenCourse,
  onToggleFavorite,
  isFavoriteSaving,
  onSelectTutorialSlot,
}: {
  candidate: PlannerFavoriteCandidate
  studyProgramCode: string | null
  activeSemesterLabel: string
  hiddenSlotIds: string[]
  tutorialSlotSelectLayout: TutorialSlotSelectLayout
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onOpenCourse: (courseId: string) => void
  onToggleFavorite: (courseId: string) => void
  isFavoriteSaving: (courseId: string) => boolean
  onSelectTutorialSlot: (courseId: string, selectedSlotId: string) => void
}) {
  const { t } = useTranslation()
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
            <div
              data-tour="planner-tutorial-slots"
              className="mt-2 grid gap-1.5"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                {t('planner.favorites.chooseTutorialSlot')}
              </span>
              <TutorialSlotSelect
                options={tutorialSlotOptions}
                selectedSlotId={selectedTutorialSlotId}
                layout={tutorialSlotSelectLayout}
                onSelect={(slotId) => onSelectTutorialSlot(course.id, slotId)}
              />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-start gap-1" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => onOpenCourse(course.id)}
            aria-label={t('planner.favorites.openCourseDetail')}
            className="flex items-center justify-center rounded-md p-1 text-fg-muted transition-colors hover:bg-surface-hover hover:text-primary"
          >
            <InfoIcon size={15} />
          </button>
          <FavStar
            active
            isLoading={isFavoriteSaving(course.id)}
            onToggle={() => onToggleFavorite(course.id)}
          />
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
  catalogTo?: string
  onSetAssignment: (courseId: string, areaCode: string | null) => void
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onOpenCourse: (courseId: string) => void
  onToggleFavorite: (courseId: string) => void
  isFavoriteSaving: (courseId: string) => boolean
  hiddenSlotIds: string[]
  tutorialSlotSelectLayout: TutorialSlotSelectLayout
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
  catalogTo = ROUTES.catalog,
  onSetAssignment,
  onAddCourse,
  onOpenCourse,
  onToggleFavorite,
  isFavoriteSaving,
  hiddenSlotIds,
  tutorialSlotSelectLayout,
  onSelectTutorialSlot,
}: PlannerFavoritesPanelProps) {
  const { t } = useTranslation()
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
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-[10px] border border-border bg-surface min-[1180px]:h-0 min-[1180px]:min-h-full"
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
                  hiddenSlotIds={hiddenSlotIds}
                  tutorialSlotSelectLayout={tutorialSlotSelectLayout}
                  onAddCourse={onAddCourse}
                  onOpenCourse={onOpenCourse}
                  onToggleFavorite={onToggleFavorite}
                  isFavoriteSaving={isFavoriteSaving}
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
