import { useMemo, useState } from 'react'
import type { Course } from '../../courses'
import { cleanCourseTitle } from '../../courses'
import { DAY_LABELS, DAY_ORDER } from '../utils/plannerFeedback.ts'
import type { ManualPlannerSlot } from '../types.ts'

interface ManualSlotDialogProps {
  courses: Course[]
  onClose: () => void
  onAdd: (slot: ManualPlannerSlot) => void
}

const DEFAULT_TIME = '10:00 - 12:00'

export function ManualSlotDialog({ courses, onClose, onAdd }: ManualSlotDialogProps) {
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? '')
  const [day, setDay] = useState<ManualPlannerSlot['day']>('Monday')
  const [time, setTime] = useState<string>(DEFAULT_TIME)
  const [room, setRoom] = useState<string>('')

  const sortedCourses = useMemo(
    () => [...courses].sort((left, right) =>
      cleanCourseTitle(left.title, left.number).localeCompare(
        cleanCourseTitle(right.title, right.number),
        'de',
      ),
    ),
    [courses],
  )

  function handleSubmit(): void {
    if (!courseId) {
      return
    }
    onAdd({
      id: crypto.randomUUID(),
      courseId,
      day,
      time: time.trim() || DEFAULT_TIME,
      room: room.trim() || null,
      label: 'Manual',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-slot-title"
        className="w-full max-w-md rounded-[12px] border border-border bg-surface p-5 shadow-xl"
      >
        <h2 id="manual-slot-title" className="text-[15px] font-semibold text-fg">
          Add manual time slot
        </h2>
        <p className="mt-1 text-[12px] text-fg-muted">
          Place a course without catalog times — or a custom appointment — on the weekly grid.
        </p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Course</span>
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-fg outline-none focus:border-primary"
            >
              {sortedCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {cleanCourseTitle(course.title, course.number)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Day</span>
            <div className="flex flex-wrap gap-1.5">
              {DAY_ORDER.map((weekday) => (
                <button
                  key={weekday}
                  type="button"
                  onClick={() => setDay(weekday)}
                  className={`rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                    day === weekday
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-surface text-fg-mid hover:border-primary/30'
                  }`}
                >
                  {DAY_LABELS[weekday]}
                </button>
              ))}
            </div>
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Time</span>
            <input
              type="text"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              placeholder="10:00 - 12:00"
              className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-fg outline-none focus:border-primary"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">Room (optional)</span>
            <input
              type="text"
              value={room}
              onChange={(event) => setRoom(event.target.value)}
              className="rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-fg outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!courseId}
            className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add slot
          </button>
        </div>
      </div>
    </div>
  )
}
