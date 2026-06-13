import type { Ref } from 'react'

/**
 * Self-contained replica of a catalog course card used by the tour to always
 * show a correct example of the two special states: a dashed border for a
 * "likely to run again" course and a faded card for one with no current data.
 * It mirrors the real card styling without depending on live catalog data.
 */
export function TourSampleCard({
  variant,
  innerRef,
}: {
  variant: 'likely' | 'unknown'
  innerRef: Ref<HTMLDivElement>
}) {
  const isUnknown = variant === 'unknown'
  return (
    <div
      ref={innerRef}
      aria-hidden="true"
      className={`pointer-events-none w-[300px] max-w-full rounded-[10px] border bg-surface px-4.5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
        isUnknown ? 'border-border opacity-60' : 'border-dashed border-border'
      }`}
    >
      <h3 className="text-[15.5px] font-semibold leading-tight text-fg">
        {isUnknown ? 'Selected Topics in Robotics' : 'Advanced Machine Learning'}
      </h3>
      <span className="mt-1 block text-[12px] text-fg-muted">Schmidt</span>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text">
          Lecture
        </span>
        {isUnknown ? (
          <span className="whitespace-nowrap rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10.5px] font-medium text-fg-muted">
            No current data
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="shrink-0 text-[13px] font-bold text-fg">
          6 <span className="text-[11px] font-normal text-fg-muted">ECTS</span>
        </span>
      </div>
    </div>
  )
}
