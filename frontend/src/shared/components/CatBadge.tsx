import type { MasterCat } from '../../features/courses'

// Static class strings per category so Tailwind can detect them at build time.
const CAT_BADGE_CLASSES: Record<MasterCat, string> = {
  TECH: 'text-cat-tech border-cat-tech bg-cat-tech/20',
  THEO: 'text-cat-theo border-cat-theo bg-cat-theo/20',
  PRAK: 'text-cat-prak border-cat-prak bg-cat-prak/20',
  INFO: 'text-cat-info border-cat-info bg-cat-info/20',
  FOKUS: 'text-cat-fokus border-cat-fokus bg-cat-fokus/20',
  BASIS: 'text-cat-basis border-cat-basis bg-cat-basis/20',
}

interface CatBadgeProps {
  cat: MasterCat
}

/** Small colored badge showing a master category code (e.g. TECH). */
export function CatBadge({ cat }: CatBadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.04em] ${CAT_BADGE_CLASSES[cat]}`}
    >
      {cat}
    </span>
  )
}
