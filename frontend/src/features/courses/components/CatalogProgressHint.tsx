import { formatRegulationAreaShortLabel } from '../../../shared/utils/regulation'
import { useAuth } from '../../auth'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'
import { useOnboarding } from '../../onboarding'
import { TOUR_CATALOG_OPEN_AREAS, type TourCatalogOpenArea } from '../../onboarding/utils/tourPreviewData.ts'

function formatEctsValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

interface CatalogProgressHintProps {
  /** Area codes currently active in the catalog's study-area filter. */
  selectedAreaCodes?: string[]
  onSelectArea?: (code: string) => void
}

/**
 * Slim sticky reminder of the regulation areas that are still open, so the
 * missing parts of the degree stay visible while scrolling the catalog.
 * Each chip doubles as a shortcut that filters the catalog to its area.
 */
export function CatalogProgressHint({ selectedAreaCodes, onSelectArea }: CatalogProgressHintProps = {}) {
  const { isAuthenticated } = useAuth()
  const { isOpen: isOnboardingOpen } = useOnboarding()
  const { progressSnapshot } = useProgressSnapshot()

  const realOpenAreas: TourCatalogOpenArea[] = (progressSnapshot?.regulationProgress ?? [])
    .filter(
      (area) =>
        area.code.trim().toUpperCase() !== 'THESIS'
        && area.requiredEcts > 0
        && area.earnedEcts < area.requiredEcts,
    )
    .map((area) => ({
      code: area.code,
      name: area.name,
      earnedEcts: area.earnedEcts,
      requiredEcts: area.requiredEcts,
    }))

  // During the tour the opening catalog step highlights this bar, so fall back
  // to preview chips when the signed-in user has no real open areas yet.
  const openAreas = realOpenAreas.length > 0
    ? realOpenAreas
    : isOnboardingOpen ? TOUR_CATALOG_OPEN_AREAS : []

  if (!isAuthenticated || openAreas.length === 0) {
    return null
  }

  return (
    <>
      <div className="h-[4.25rem] md:hidden" aria-hidden="true" />
      <div
        data-tour="catalog-progress-hint"
        className="fixed inset-x-0 top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-[70] min-h-[4.25rem] border-b border-border bg-bg px-4 py-2 md:sticky md:top-0 md:z-30 md:min-h-0"
      >
        <div className="mx-auto flex w-full max-w-[64rem] flex-wrap items-center justify-center gap-1.5">
          {openAreas.map((area) => {
            const isActive = selectedAreaCodes?.includes(area.code) ?? false
            return (
              <button
                key={area.code}
                type="button"
                title={area.name}
                aria-pressed={isActive}
                onClick={() => onSelectArea?.(area.code)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-medium tabular-nums transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-white'
                    : 'border-border bg-surface text-fg-mid hover:border-primary/40 hover:bg-surface-hover hover:text-fg'
                }`}
              >
                {formatRegulationAreaShortLabel(area.code)} {formatEctsValue(area.earnedEcts)}/
                {formatEctsValue(area.requiredEcts)}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
