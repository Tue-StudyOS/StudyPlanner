import type { MasterCat } from '../../features/courses'

export const CAT_BADGE_CLASSES: Record<MasterCat, string> = {
  TECH: 'text-cat-tech border-cat-tech bg-cat-tech/20',
  THEO: 'text-cat-theo border-cat-theo bg-cat-theo/20',
  PRAK: 'text-cat-prak border-cat-prak bg-cat-prak/20',
  // The fixed INFO purple is too dark on dark surfaces; lift it there.
  INFO: 'text-cat-info border-cat-info bg-cat-info/20 dark:text-[#b886ec] dark:border-[#b886ec] dark:bg-cat-info/30',
  BASIS: 'text-cat-basis border-cat-basis bg-cat-basis/20',
}
