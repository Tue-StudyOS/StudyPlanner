import type { CourseTermType } from '../../features/courses'

const SUMMER_CLASSES =
  'border-amber-500/40 bg-amber-400/15 text-amber-700 dark:border-amber-300/40 dark:bg-amber-300/15 dark:text-amber-300'
const WINTER_CLASSES =
  'border-sky-500/40 bg-sky-400/15 text-sky-700 dark:border-sky-300/40 dark:bg-sky-300/15 dark:text-sky-300'

function Tag({ label, classes }: { label: string; classes: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes}`}
    >
      {label}
    </span>
  )
}

/**
 * Season tags use warm summer / cool winter colors so the term is readable at
 * a glance; courses running in both terms get both tags.
 */
export function SeasonTags({ termType }: { termType: CourseTermType | undefined }) {
  if (termType === 'summer') {
    return <Tag label="Summer" classes={SUMMER_CLASSES} />
  }
  if (termType === 'winter') {
    return <Tag label="Winter" classes={WINTER_CLASSES} />
  }
  if (termType === 'both') {
    return (
      <>
        <Tag label="Summer" classes={SUMMER_CLASSES} />
        <Tag label="Winter" classes={WINTER_CLASSES} />
      </>
    )
  }
  return null
}
