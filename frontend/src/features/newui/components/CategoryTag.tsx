import type { MasterCat } from '../../courses'

/** Reuses the existing category color tokens from index.css. */
const CAT_COLOR_VAR: Record<MasterCat, string> = {
  TECH: 'var(--color-cat-tech)',
  THEO: 'var(--color-cat-theo)',
  PRAK: 'var(--color-cat-prak)',
  INFO: 'var(--color-cat-info)',
  BASIS: 'var(--color-cat-basis)',
}

interface CategoryTagProps {
  category: MasterCat
}

/** Static, read-only category badge (the interactive picker comes later). */
export function CategoryTag({ category }: CategoryTagProps) {
  return (
    <span
      className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-neutral-200 bg-white pl-2 pr-2.5 dark:border-neutral-700 dark:bg-neutral-800"
      style={{ boxShadow: `inset 3px 0 0 ${CAT_COLOR_VAR[category]}` }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CAT_COLOR_VAR[category] }} />
      <span className="text-[10px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300">
        {category}
      </span>
    </span>
  )
}
