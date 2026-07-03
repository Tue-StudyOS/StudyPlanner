import type { MasterCat } from '../../features/courses'

/** Muted area tints — readable category hint without loud saturation. */
export const CAT_BADGE_CLASSES: Record<MasterCat, string> = {
  TECH: 'text-cat-tech/45 border-cat-tech/18 bg-cat-tech/5',
  THEO: 'text-cat-theo/42 border-cat-theo/16 bg-cat-theo/4',
  PRAK: 'text-cat-prak/45 border-cat-prak/18 bg-cat-prak/5',
  INFO: 'text-cat-info/55 border-cat-info/25 bg-cat-info/10 dark:text-[#c4a8e8] dark:border-[#9b7cc4]/45 dark:bg-cat-info/20',
  BASIS: 'text-cat-basis/42 border-cat-basis/16 bg-cat-basis/4',
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
