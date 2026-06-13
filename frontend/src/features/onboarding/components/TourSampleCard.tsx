import type { Ref } from 'react'
import type { CourseTermType, MasterCat } from '../../courses'
import { AreaBadge } from '../../../shared/components/AreaBadge'
import { SeasonTags } from '../../../shared/components/SeasonTag'
import type { TourSampleCardVariant } from '../types.ts'

interface TourSampleAreaTag {
  label: string
  masterCat: MasterCat | null
}

interface TourSampleCourseCard {
  title: string
  lecturer: string
  termType: CourseTermType
  typeLabel: string
  areaTags: TourSampleAreaTag[]
  ects: number
}

const SAMPLE_CARDS: Record<TourSampleCardVariant, TourSampleCourseCard> = {
  confirmed: {
    title: 'Software Engineering for Web Applications',
    lecturer: 'Dr. Anna Keller',
    termType: 'summer',
    typeLabel: 'Lecture',
    areaTags: [
      { label: 'TECH', masterCat: 'TECH' },
      { label: 'PRAK', masterCat: 'PRAK' },
    ],
    ects: 6,
  },
  likely: {
    title: 'Deep Learning for Language Technologies',
    lecturer: 'Prof. Michael Frank',
    termType: 'winter',
    typeLabel: 'Lecture/Exercise',
    areaTags: [
      { label: 'INFO', masterCat: 'INFO' },
      { label: 'TECH', masterCat: 'TECH' },
    ],
    ects: 6,
  },
  unknown: {
    title: 'Human-Centered Security Seminar',
    lecturer: 'Dr. Lena Hoffmann',
    termType: 'winter',
    typeLabel: 'Seminar',
    areaTags: [
      { label: 'INFO', masterCat: 'INFO' },
      { label: 'PRAK', masterCat: 'PRAK' },
    ],
    ects: 3,
  },
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text">
      {label}
    </span>
  )
}

function OfferingStatusTag() {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10.5px] font-medium text-fg-muted">
      No current data
    </span>
  )
}

/**
 * Self-contained catalog course cards used by the tour. They mirror the real
 * card styling without depending on whichever catalog data happens to be live.
 */
export function TourSampleCard({
  variant,
  innerRef,
}: {
  variant: TourSampleCardVariant
  innerRef: Ref<HTMLDivElement>
}) {
  const sampleCard = SAMPLE_CARDS[variant]
  const isLikely = variant === 'likely'
  const isUnknown = variant === 'unknown'

  return (
    <div
      ref={innerRef}
      aria-hidden="true"
      className={`pointer-events-none flex h-full w-[320px] max-w-full flex-col gap-3 rounded-[10px] border bg-surface px-4.5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${
        isLikely ? 'border-dashed border-border' : 'border-border'
      } ${isUnknown ? 'opacity-60' : ''}`}
    >
      <div className="min-w-0">
        <h3 className="min-w-0 break-words text-[15.5px] font-semibold leading-tight text-fg">
          {sampleCard.title}
        </h3>
        <span className="mt-1 block min-w-0 truncate text-[12px] text-fg-muted">
          {sampleCard.lecturer}
        </span>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <SeasonTags termType={sampleCard.termType} />
        <TypePill label={sampleCard.typeLabel} />
        <span className="flex flex-wrap gap-0.75">
          {sampleCard.areaTags.map((tag) => (
            <AreaBadge key={tag.label} label={tag.label} masterCat={tag.masterCat} />
          ))}
          {isUnknown ? <OfferingStatusTag /> : null}
        </span>
        <span className="flex-1" />
        <span className="shrink-0 text-[13px] font-bold text-fg">
          {sampleCard.ects} <span className="text-[11px] font-normal text-fg-muted">ECTS</span>
        </span>
      </div>
    </div>
  )
}
