import { useMemo } from 'react'
import type { Course } from '../../courses'
import { DAY_LABELS, calculatePlannerFeedback } from '../utils/plannerFeedback'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] border border-border-light bg-surface-hover/60 px-4 py-3 dark:bg-surface-hover/80">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{label}</div>
      <div className="mt-1 text-[20px] font-semibold text-fg">{value}</div>
      {sub ? <div className="text-[12px] text-fg-muted">{sub}</div> : null}
    </div>
  )
}

interface PlannerFeedbackProps {
  plannedCourses: Course[]
  studyProgramCode: string | null
}

export function PlannerFeedback({ plannedCourses, studyProgramCode }: PlannerFeedbackProps) {
  const feedback = useMemo(
    () => calculatePlannerFeedback(plannedCourses, studyProgramCode),
    [plannedCourses, studyProgramCode],
  )

  return (
    <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1 inline-flex rounded-full border border-border bg-surface-hover/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Live planning feedback
          </div>
          <p className="text-[12.5px] text-fg-muted">
            ECTS, elective coverage, and scheduled course times update immediately.
          </p>
        </div>
        <div className="text-[12px] text-fg-muted">{feedback.totalCourses} planned course(s)</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Planned ECTS" value={String(feedback.totalEcts)} sub="Current semester total" />
        <StatCard label="Scheduled blocks" value={String(feedback.totalBlocks)} sub="Weekly course slots" />
        <StatCard
          label="Weekly hours"
          value={feedback.scheduledHours.toFixed(1)}
          sub="Across all scheduled blocks"
        />
        <StatCard
          label="Overlap alerts"
          value={String(feedback.overlapCount)}
          sub={feedback.overlapCount > 0 ? 'Conflicts need attention' : 'No conflicts yet'}
        />
      </div>

      <div className="mt-4.5 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-[10px] border border-border-light bg-surface-hover/35 px-4 py-4">
          <div className="mb-3 text-[13px] font-semibold text-fg">{feedback.coverageLabel}</div>
          {!studyProgramCode ? (
            <div className="mb-3 rounded-md border border-border-light bg-surface px-3 py-2 text-[12px] text-fg-muted">
              Set your study profile to unlock study-program-specific coverage.
            </div>
          ) : null}
          {feedback.coverageItems.length === 0 ? (
            <div className="text-[12.5px] text-fg-muted">
              Add courses to the planner to see how they cover your elective blocks.
            </div>
          ) : (
            <div className="grid max-h-[18rem] gap-2 overflow-y-auto pr-1">
              {feedback.coverageItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border-light bg-surface px-3 py-2"
                >
                  <div>
                    <div className="text-[12.5px] font-medium text-fg">{item.label}</div>
                    <div className="text-[11.5px] text-fg-muted">{item.courseCount} course(s)</div>
                  </div>
                  <div className="text-[12.5px] font-semibold text-fg">{item.ects} ECTS</div>
                </div>
              ))}
            </div>
          )}

          {feedback.unscheduledCourses.length > 0 ? (
            <div className="mt-4 rounded-md border border-border-light px-3 py-3 text-[12px] text-fg-muted">
              {feedback.unscheduledCourses.length} course(s) do not expose a parsable weekly schedule yet.
            </div>
          ) : null}
        </div>

        <div className="rounded-[10px] border border-border-light bg-surface-hover/35 px-4 py-4">
          <div className="mb-3 text-[13px] font-semibold text-fg">Scheduled course times</div>
          {feedback.scheduledBlocks.length === 0 ? (
            <div className="text-[12.5px] text-fg-muted">
              Planned course times will appear here once you add scheduled favorites.
            </div>
          ) : (
            <div className="grid max-h-[18rem] gap-2 overflow-y-auto pr-1">
              {feedback.scheduledBlocks.map((block) => (
                <div
                  key={block.blockId}
                  className={`rounded-md border px-3 py-2 ${
                    block.hasOverlap
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-border-light bg-surface'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12.5px] font-medium">{block.courseTitle}</div>
                      <div className="text-[11.5px] opacity-80">{block.label}</div>
                    </div>
                    <div className="text-right text-[11.5px] opacity-80">
                      <div>{DAY_LABELS[block.day]}</div>
                      <div>{block.room || 'Room tba'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
