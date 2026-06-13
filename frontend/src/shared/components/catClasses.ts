import type { MasterCat } from '../../features/courses'

export const CAT_BADGE_CLASSES: Record<MasterCat, string> = {
  TECH: 'text-cat-tech/65 border-cat-tech/25 bg-cat-tech/5',
  THEO: 'text-cat-theo/55 border-cat-theo/20 bg-cat-theo/5',
  PRAK: 'text-cat-prak/65 border-cat-prak/25 bg-cat-prak/5',
  // INFO was visually dominant; keep it deliberately softer than the rest.
  INFO: 'text-cat-info/45 border-cat-info/15 bg-cat-info/5 dark:text-[#aa8dcd] dark:border-[#6f4d96] dark:bg-cat-info/10',
  BASIS: 'text-cat-basis/55 border-cat-basis/20 bg-cat-basis/5',
}
