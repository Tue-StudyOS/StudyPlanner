import type { Course } from '../../courses'
import { cleanCourseTitle } from '../../courses'
import {
  getTutorialSlotOptions,
  resolveVisibleTutorialSlotId,
} from '../../planner/utils/plannerSlotSelection.ts'
import type { CategoryControl } from '../hooks/useBetaPlanner'
import { formatTutorialSlotLabel } from '../utils/plannerFormat'
import { CourseCategoryDropdown } from './CourseCategoryDropdown'

interface CoursePickerProps {
  favoriteCourses: Course[]
  plannedCourseIds: string[]
  hiddenSlotIds: string[]
  isLoading: boolean
  categoryControl: CategoryControl
  onAdd: (courseId: string) => void
  onRemove: (courseId: string) => void
  onSelectTutorial: (courseId: string, slotId: string) => void
}

function courseMeta(course: Course): string {
  return [course.number, course.ects !== null ? `${course.ects} ECTS` : null].filter(Boolean).join(' · ')
}

export function CoursePicker({
  favoriteCourses,
  plannedCourseIds,
  hiddenSlotIds,
  isLoading,
  categoryControl,
  onAdd,
  onRemove,
  onSelectTutorial,
}: CoursePickerProps) {
  // Planned courses float to the top; stable sort keeps the alphabetical order
  // within each group.
  const orderedCourses = [...favoriteCourses].sort((left, right) => {
    const leftPlanned = plannedCourseIds.includes(left.id)
    const rightPlanned = plannedCourseIds.includes(right.id)
    if (leftPlanned === rightPlanned) {
      return 0
    }
    return leftPlanned ? -1 : 1
  })

  return (
    <section className="rounded-3xl border border-[#ece7db] bg-white p-6 shadow-[0_2px_10px_rgba(60,50,20,0.04)] dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#221f19] dark:text-neutral-100">
        Kurse &amp; Auswahl
      </h2>
      <p className="mt-1 mb-4 text-[12.5px] text-[#a39d90]">
        Deine Favoriten — einplanen und bei mehreren Tutorien den Termin wählen.
      </p>

      {isLoading && favoriteCourses.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-[#a39d90]">Lädt…</div>
      ) : favoriteCourses.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#e0dbcd] px-4 py-8 text-center text-[12.5px] text-[#a39d90]">
          Noch keine Favoriten. Markiere Kurse im Katalog als Favorit — sie erscheinen hier.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {orderedCourses.map((course) => {
            const isPlanned = plannedCourseIds.includes(course.id)
            const tutorialOptions = getTutorialSlotOptions(course)
            const visibleSlotId = resolveVisibleTutorialSlotId(tutorialOptions, hiddenSlotIds)
            const selectableCats = categoryControl.selectableOf(course)
            const category = categoryControl.categoryOf(course)
            return (
              <div
                key={course.id}
                className={`rounded-[16px] border px-4 py-3 ${
                  isPlanned
                    ? 'border-[#ded2fa] bg-[#f6f2ff] dark:border-violet-500/40 dark:bg-violet-500/5'
                    : 'border-[#ece7db] bg-[#faf8f3] dark:border-neutral-800 dark:bg-neutral-900/60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-snug text-[#221f19] dark:text-neutral-100">
                      {cleanCourseTitle(course.title, course.number)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#a39d90]">{courseMeta(course)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => (isPlanned ? onRemove(course.id) : onAdd(course.id))}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[11.5px] font-bold transition-colors ${
                      isPlanned
                        ? 'bg-white text-[#6a3ef0] hover:bg-[#efe9ff] dark:bg-neutral-800 dark:text-[#a893e0]'
                        : 'bg-[#7c5cff] text-white shadow-[0_4px_14px_#7c5cff33] hover:bg-[#6a3ef0]'
                    }`}
                  >
                    {isPlanned ? 'Entfernen' : '+ Einplanen'}
                  </button>
                </div>

                {selectableCats.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-semibold text-[#a39d90]">Kategorie</span>
                    <CourseCategoryDropdown
                      value={category ?? selectableCats[0]}
                      selectable={selectableCats}
                      onChange={(cat) => categoryControl.change(course, cat)}
                    />
                  </div>
                ) : null}

                {isPlanned && tutorialOptions.length > 1 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-semibold text-[#a39d90]">Tutorium</span>
                    {tutorialOptions.map((option) => {
                      const isSelected = option.slotId === visibleSlotId
                      return (
                        <button
                          key={option.slotId}
                          type="button"
                          onClick={() => onSelectTutorial(course.id, option.slotId)}
                          className={`rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                            isSelected
                              ? 'border-[#7c5cff] bg-[#7c5cff] text-white'
                              : 'border-[#ded2fa] bg-white text-[#6a3ef0] hover:bg-[#f6f2ff] dark:border-neutral-700 dark:bg-neutral-800 dark:text-[#a893e0]'
                          }`}
                        >
                          {formatTutorialSlotLabel(option.label)}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
