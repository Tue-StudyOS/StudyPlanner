import { useMemo, useState } from 'react'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { useAuth } from '../../auth'
import type { Course } from '../../courses'
import { useCatalogCourses } from '../../courses'
import { useFavorites } from '../../favorites'

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
}
const DAY_ALIASES: Record<string, (typeof DAY_ORDER)[number]> = {
  mo: 'Monday',
  mon: 'Monday',
  monday: 'Monday',
  di: 'Tuesday',
  tue: 'Tuesday',
  tuesday: 'Tuesday',
  mi: 'Wednesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  do: 'Thursday',
  thu: 'Thursday',
  thursday: 'Thursday',
  fr: 'Friday',
  fri: 'Friday',
  friday: 'Friday',
}
const START_HOUR = 8
const END_HOUR = 20
const MINUTES_PER_HOUR = 60
const PIXELS_PER_HOUR = 56

interface PlannerBlock {
  blockId: string
  courseId: string
  title: string
  day: (typeof DAY_ORDER)[number]
  startMinutes: number
  endMinutes: number
  label: string
  room: string
  hasOverlap: boolean
}

function normalizeWeekday(value: string): (typeof DAY_ORDER)[number] | null {
  return DAY_ALIASES[value.trim().toLowerCase()] ?? null
}

function parseTimeRange(timeText: string): { startMinutes: number; endMinutes: number } | null {
  const match = timeText.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
  if (!match) {
    return null
  }

  const [startHour, startMinute] = match[1].split(':').map(Number)
  const [endHour, endMinute] = match[2].split(':').map(Number)
  return {
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute,
  }
}

function buildPlannerBlocks(courses: Course[]): PlannerBlock[] {
  const blocks: PlannerBlock[] = []

  courses.forEach((course) => {
    course.schedule.forEach((slot, index) => {
      const normalizedDay = normalizeWeekday(slot.day)
      const timeRange = parseTimeRange(slot.time)
      if (!normalizedDay || !timeRange) {
        return
      }
      blocks.push({
        blockId: `${course.id}-${index}`,
        courseId: course.id,
        title: course.title,
        day: normalizedDay,
        startMinutes: timeRange.startMinutes,
        endMinutes: timeRange.endMinutes,
        label: slot.type,
        room: slot.room,
        hasOverlap: false,
      })
    })
  })

  return blocks.map((block) => {
    const hasOverlap = blocks.some((candidate) => {
      if (candidate.blockId === block.blockId || candidate.day !== block.day) {
        return false
      }
      return candidate.startMinutes < block.endMinutes && block.startMinutes < candidate.endMinutes
    })
    return { ...block, hasOverlap }
  })
}

function DraggableCandidateCard({
  course,
}: {
  course: Course
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/planner-course-id', course.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      className="cursor-grab rounded-[10px] border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-hover active:cursor-grabbing"
    >
      <div className="text-[13px] font-semibold text-fg">{course.title}</div>
      <div className="text-[12px] text-fg-muted">
        {course.number} · {course.ects ?? '–'} ECTS
      </div>
      <div className="mt-1 text-[11px] text-fg-muted">
        {course.schedule.at(0)?.day ?? 'Day tba'} · {course.schedule.at(0)?.time ?? 'Time tba'}
      </div>
    </div>
  )
}

function EmptyGridState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-fg-muted">
      Drag a favorite course into this grid to place its scheduled blocks in your weekly plan.
    </div>
  )
}

function PlannerGrid({
  plannedCourses,
  onDropCourse,
  onRemoveCourse,
}: {
  plannedCourses: Course[]
  onDropCourse: (courseId: string) => void
  onRemoveCourse: (courseId: string) => void
}) {
  const blocks = useMemo(() => buildPlannerBlocks(plannedCourses), [plannedCourses])
  const totalHeight = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR

  return (
    <div
      className="rounded-[10px] border border-border bg-surface px-6 py-5.5"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const courseId = event.dataTransfer.getData('text/planner-course-id')
        if (courseId) {
          onDropCourse(courseId)
        }
      }}
    >
      <div className="mb-3 text-[14px] font-semibold text-fg">Weekly planner grid</div>
      <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-2">
        <div />
        {DAY_ORDER.map((day) => (
          <div key={day} className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            {DAY_LABELS[day]}
          </div>
        ))}

        <div className="relative h-full">
          {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
            <div
              key={index}
              className="absolute left-0 text-[11px] text-fg-muted"
              style={{ top: `${index * PIXELS_PER_HOUR - 8}px` }}
            >
              {String(START_HOUR + index).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="col-span-5 grid grid-cols-5 gap-2">
          {DAY_ORDER.map((day) => (
            <div key={day} className="relative overflow-hidden rounded-lg border border-border-light" style={{ height: `${totalHeight}px` }}>
              {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                <div
                  key={`${day}-${index}`}
                  className="absolute inset-x-0 border-t border-border-light/70"
                  style={{ top: `${index * PIXELS_PER_HOUR}px` }}
                />
              ))}

              {blocks
                .filter((block) => block.day === day)
                .map((block) => {
                  const top = ((block.startMinutes - START_HOUR * MINUTES_PER_HOUR) / MINUTES_PER_HOUR) * PIXELS_PER_HOUR
                  const height = ((block.endMinutes - block.startMinutes) / MINUTES_PER_HOUR) * PIXELS_PER_HOUR
                  return (
                    <div
                      key={block.blockId}
                      className={`absolute inset-x-1 rounded-md border px-2 py-1 text-[11px] shadow-sm ${
                        block.hasOverlap
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-border bg-white/90 text-fg dark:bg-surface-hover'
                      }`}
                      style={{ top: `${top}px`, height: `${Math.max(height, 34)}px` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{block.title}</div>
                          <div className="truncate text-[10px] opacity-80">{block.label}</div>
                          <div className="truncate text-[10px] opacity-80">{block.room}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveCourse(block.courseId)}
                          className="rounded-sm px-1 text-[10px] font-semibold opacity-70 hover:opacity-100"
                        >
                          ×
                        </button>
                      </div>
                      {block.hasOverlap ? <div className="mt-1 text-[10px] font-semibold">Overlap</div> : null}
                    </div>
                  )
                })}

              {blocks.length === 0 ? <EmptyGridState /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SemesterPlanner() {
  const { isAuthenticated } = useAuth()
  const { favoriteIds } = useFavorites()
  const { courses, isLoading, error } = useCatalogCourses('')
  const [plannedCourseIds, setPlannedCourseIds] = useState<string[]>([])

  if (!isAuthenticated) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
            Semester Planner
          </h1>
          <p className="text-[13.5px] text-fg-muted">
            Build and save your personal weekly semester plan.
          </p>
        </div>
        <PersonalFeatureNotice
          title="Planning is account-based"
          description="Your weekly semester plan belongs to your account. Sign in to drag favorite courses into a personal plan and save the result per semester."
        />
      </div>
    )
  }

  const favoriteCourses = courses.filter((course) => favoriteIds.includes(course.id))
  const plannedCourses = courses.filter((course) => plannedCourseIds.includes(course.id))

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Semester Planner
        </h1>
        <p className="text-[13.5px] text-fg-muted">
          Planning mode is active. Drag favorite courses into the weekly grid to build your plan.
        </p>
      </div>

      <div className="grid gap-4.5 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
          <div className="mb-3 text-[14px] font-semibold text-fg">Favorite course candidates</div>
          <p className="mb-4 text-[12.5px] text-fg-muted">
            These favorites are draggable planner candidates.
          </p>

          {isLoading ? (
            <div className="text-[13px] text-fg-muted">Loading your favorite course candidates...</div>
          ) : error ? (
            <div className="text-[13px] text-primary">Failed to load planner candidates. {error}</div>
          ) : favoriteCourses.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-fg-muted">
              Add some favorites in the catalog first, then come back here to plan with them.
            </div>
          ) : (
            <div className="grid gap-2.5">
              {favoriteCourses.map((course) => (
                <DraggableCandidateCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>

        <PlannerGrid
          plannedCourses={plannedCourses}
          onDropCourse={(courseId) =>
            setPlannedCourseIds((previousCourseIds) =>
              previousCourseIds.includes(courseId)
                ? previousCourseIds
                : [...previousCourseIds, courseId],
            )
          }
          onRemoveCourse={(courseId) =>
            setPlannedCourseIds((previousCourseIds) =>
              previousCourseIds.filter((plannedCourseId) => plannedCourseId !== courseId),
            )
          }
        />
      </div>
    </div>
  )
}
