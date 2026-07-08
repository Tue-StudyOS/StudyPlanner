import type { MasterCat } from '../../features/courses'

/** Muted area tints — readable category hint without loud saturation. */
export const CAT_BADGE_CLASSES: Record<MasterCat, string> = {
  TECH: 'border-[#B8D9E6] bg-[#EEF8FB] text-[#315F73] dark:border-[#4A6470] dark:bg-[#253239] dark:text-[#A8C7D3]',
  THEO: 'border-[#EBC3D6] bg-[#FCF0F5] text-[#8A4968] dark:border-[#714B5E] dark:bg-[#382932] dark:text-[#D8A9C0]',
  PRAK: 'border-[#B7E1DA] bg-[#EFF9F6] text-[#3D6E66] dark:border-[#486B65] dark:bg-[#263633] dark:text-[#A8D2CA]',
  INFO: 'border-[#D3C4E6] bg-[#F6F1FB] text-[#654F83] dark:border-[#5E526F] dark:bg-[#302A39] dark:text-[#C4B4D9]',
  BASIS: 'border-[#E8C7C4] bg-[#FCF1EF] text-[#8A504B] dark:border-[#704F4B] dark:bg-[#392B29] dark:text-[#D9ABA6]',
}

/** Matches tag intensity — soft fills for credited ECTS in the auto-assign panel. */
export const CAT_PROGRESS_CREDITED_CLASSES: Record<MasterCat, string> = {
  TECH: 'bg-cat-tech/18',
  THEO: 'bg-cat-theo/15',
  PRAK: 'bg-cat-prak/18',
  INFO: 'bg-cat-info/15',
  BASIS: 'bg-cat-basis/15',
}

export const CAT_PROGRESS_DOT_CLASSES: Record<MasterCat, string> = {
  TECH: 'bg-cat-tech/40',
  THEO: 'bg-cat-theo/38',
  PRAK: 'bg-cat-prak/40',
  INFO: 'bg-cat-info/38',
  BASIS: 'bg-cat-basis/38',
}

export function catProgressPlannedStyle(masterCat: MasterCat | null): {
  backgroundColor: string
  backgroundImage: string
  opacity: number
} {
  const baseColor = masterCat === 'TECH'
    ? 'var(--color-cat-tech)'
    : masterCat === 'THEO'
      ? 'var(--color-cat-theo)'
      : masterCat === 'PRAK'
        ? 'var(--color-cat-prak)'
        : masterCat === 'INFO'
          ? 'var(--color-cat-info)'
          : masterCat === 'BASIS'
            ? 'var(--color-cat-basis)'
            : 'var(--color-border)'
  return {
    backgroundColor: baseColor,
    backgroundImage:
      'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 6px)',
    opacity: 0.22,
  }
}

