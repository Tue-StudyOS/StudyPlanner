import type { MasterCat } from '../../features/courses'

export const CAT_BADGE_CLASSES: Record<MasterCat, string> = {
  TECH: 'text-cat-tech border-cat-tech/35 bg-cat-tech/12',
  THEO: 'text-cat-theo border-cat-theo/30 bg-cat-theo/10',
  PRAK: 'text-cat-prak border-cat-prak/35 bg-cat-prak/12',
  INFO: 'text-cat-info border-cat-info/30 bg-cat-info/10 dark:text-[#b89adf] dark:border-[#8b6bb8] dark:bg-cat-info/15',
  BASIS: 'text-cat-basis border-cat-basis/30 bg-cat-basis/10',
}
