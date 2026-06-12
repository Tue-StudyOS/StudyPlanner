import type { CourseTermType } from '../../features/courses'

function Tag({ label, dotClasses }: { label: string; dotClasses: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[10.5px] font-medium text-fg-muted">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClasses}`} />
      {label}
    </span>
  )
}

/**
 * Subtle season markers: a small warm dot for summer, a cool one for winter.
 * Courses running in both terms get both markers.
 */
export function SeasonTags({ termType }: { termType: CourseTermType | undefined }) {
  if (termType === 'summer') {
    return <Tag label="Summer" dotClasses="bg-amber-500 dark:bg-amber-300" />
  }
  if (termType === 'winter') {
    return <Tag label="Winter" dotClasses="bg-sky-500 dark:bg-sky-300" />
  }
  if (termType === 'both') {
    return (
      <>
        <Tag label="Summer" dotClasses="bg-amber-500 dark:bg-amber-300" />
        <Tag label="Winter" dotClasses="bg-sky-500 dark:bg-sky-300" />
      </>
    )
  }
  return null
}
