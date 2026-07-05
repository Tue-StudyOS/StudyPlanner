import { useMemo } from 'react'
import type { Course, MasterCat } from '../../courses'
import {
  buildBlockLeft,
  buildBlockWidth,
  buildDayLayout,
  END_HOUR,
  START_HOUR,
} from '../../planner/utils/plannerDayLayout.ts'
import { DAY_ORDER, buildPlannerBlocks } from '../../planner/utils/plannerFeedback.ts'
import { isTutorialLikeSlotType } from '../../planner/utils/plannerSlotSelection.ts'
import { isLectureOrTutorialBlock } from '../utils/timetableFilter'

const PX_PER_HOUR = 42
const GRID_HEIGHT = (END_HOUR - START_HOUR) * PX_PER_HOUR
const CAT_COLOR_VAR: Record<MasterCat, string> = {
  TECH: 'var(--color-cat-tech)',
  THEO: 'var(--color-cat-theo)',
  PRAK: 'var(--color-cat-prak)',
  INFO: 'var(--color-cat-info)',
  BASIS: 'var(--color-cat-basis)',
}

function categoryColor(category: MasterCat | null | undefined): string {
  return category ? CAT_COLOR_VAR[category] : '#7c5cff'
}

const DAY_LABELS_DE: Record<(typeof DAY_ORDER)[number], string> = {
  Monday: 'MO',
  Tuesday: 'DI',
  Wednesday: 'MI',
  Thursday: 'DO',
  Friday: 'FR',
}
const HOUR_MARKS = Array.from({ length: (END_HOUR - START_HOUR) / 2 + 1 }, (_, i) => START_HOUR + i * 2)

interface TimetableProps {
  plannedCourses: Course[]
  hiddenSlotIds: string[]
  plannedEcts: number
  /** Assigned Informatik category per planned course id — drives the block color. */
  categoryByCourseId: Map<string, MasterCat | null>
}

export function Timetable({ plannedCourses, hiddenSlotIds, plannedEcts, categoryByCourseId }: TimetableProps) {
  const blocks = useMemo(
    () =>
      buildPlannerBlocks(plannedCourses)
        .filter(isLectureOrTutorialBlock)
        .filter((block) => !hiddenSlotIds.includes(block.slotId)),
    [plannedCourses, hiddenSlotIds],
  )
  const layoutByDay = useMemo(
    () =>
      Object.fromEntries(
        DAY_ORDER.map((day) => [day, buildDayLayout(blocks.filter((block) => block.day === day))]),
      ) as Record<(typeof DAY_ORDER)[number], ReturnType<typeof buildDayLayout>>,
    [blocks],
  )
  const isEmpty = blocks.length === 0

  return (
    <section className="rounded-3xl border border-[#ece7db] bg-white p-6 shadow-[0_2px_10px_rgba(60,50,20,0.04)] dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#221f19] dark:text-neutral-100">
          Stundenplan
        </h2>
        <span className="text-[12px] font-bold text-[#6a3ef0] dark:text-[#a893e0]">
          {plannedCourses.length} Kurse · {plannedEcts} ECTS
        </span>
      </div>
      <div className="mb-3 flex gap-4 text-[10.5px] font-semibold text-[#a39d90]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm border-l-[3px] border-[#7c5cff] bg-[#7c5cff]/20" />
          Vorlesung
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-sm border-l-[3px] border-dashed border-[#7c5cff] bg-[#7c5cff]/10" />
          Tutorium
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid grid-cols-[34px_repeat(5,1fr)] gap-1.5">
            <div />
            {DAY_ORDER.map((day) => (
              <div key={day} className="text-center text-[10px] font-bold text-[#a39d90]">
                {DAY_LABELS_DE[day]}
              </div>
            ))}
          </div>

          <div className="mt-1.5 grid grid-cols-[34px_repeat(5,1fr)] gap-1.5">
            <div className="relative" style={{ height: GRID_HEIGHT }}>
              {HOUR_MARKS.map((hour) => (
                <span
                  key={hour}
                  className="absolute text-[9px] font-semibold text-[#c2bcac]"
                  style={{ top: (hour - START_HOUR) * PX_PER_HOUR - 5 }}
                >
                  {String(hour).padStart(2, '0')}
                </span>
              ))}
            </div>

            {DAY_ORDER.map((day) => (
              <div
                key={day}
                className="relative rounded-[14px] border border-[#ece7db] dark:border-neutral-800"
                style={{
                  height: GRID_HEIGHT,
                  backgroundImage:
                    'repeating-linear-gradient(#faf8f3,#faf8f3 ' +
                    `${PX_PER_HOUR - 1}px,#f2ede2 ${PX_PER_HOUR - 1}px,#f2ede2 ${PX_PER_HOUR}px)`,
                }}
              >
                {layoutByDay[day].visibleBlocks.map((block) => {
                  const isTutorial = isTutorialLikeSlotType(block.slotType)
                  const top = ((block.startMinutes - START_HOUR * 60) / 60) * PX_PER_HOUR
                  const height = ((block.endMinutes - block.startMinutes) / 60) * PX_PER_HOUR
                  const color = categoryColor(categoryByCourseId.get(block.courseId))
                  return (
                    <div
                      key={block.blockId}
                      className="absolute overflow-hidden rounded-[7px] px-1.5 py-1"
                      style={{
                        top,
                        height,
                        left: buildBlockLeft(block.columnIndex, block.visibleColumnCount),
                        width: buildBlockWidth(block.visibleColumnCount),
                        borderLeft: `3px ${isTutorial ? 'dashed' : 'solid'} ${color}`,
                        backgroundColor: `color-mix(in srgb, ${color} ${isTutorial ? 12 : 22}%, transparent)`,
                      }}
                    >
                      <div className="truncate text-[9.5px] font-bold leading-[11px] text-[#221f19] dark:text-neutral-100">
                        {block.courseTitle}
                      </div>
                      <div
                        className="mt-0.5 truncate text-[8.5px] font-semibold"
                        style={{ color }}
                      >
                        {isTutorial ? 'Tut' : 'VL'} · {block.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isEmpty ? (
        <p className="mt-3 text-center text-[12px] text-[#a39d90]">
          Noch leer — links Kurse einplanen, sie erscheinen hier.
        </p>
      ) : null}
    </section>
  )
}
