import { formatRegulationAreaShortLabel } from '../../../shared/utils/regulation'
import { useAuth } from '../../auth'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'

function formatEctsValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * Slim sticky reminder of the regulation areas that are still open, so the
 * missing parts of the degree stay visible while scrolling the catalog.
 */
export function CatalogProgressHint() {
  const { isAuthenticated } = useAuth()
  const { progressSnapshot } = useProgressSnapshot()

  if (!isAuthenticated || !progressSnapshot) {
    return null
  }

  const openAreas = progressSnapshot.regulationProgress.filter(
    (area) =>
      area.code.trim().toUpperCase() !== 'THESIS'
      && area.requiredEcts > 0
      && area.earnedEcts < area.requiredEcts,
  )

  if (openAreas.length === 0) {
    return null
  }

  return (
    <>
      <div className="h-[4.25rem] md:hidden" aria-hidden="true" />
      <div
        data-tour="catalog-progress-hint"
        className="fixed inset-x-0 top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-[70] flex min-h-[4.25rem] flex-wrap items-center gap-1.5 border-b border-border bg-bg px-4 py-2 md:sticky md:top-0 md:z-30 md:min-h-0 md:px-8"
      >
        {openAreas.map((area) => (
          <span
            key={area.code}
            title={area.name}
            className="shrink-0 whitespace-nowrap rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-fg-mid"
          >
            {formatRegulationAreaShortLabel(area.code)} {formatEctsValue(area.earnedEcts)}/
            {formatEctsValue(area.requiredEcts)}
          </span>
        ))}
      </div>
    </>
  )
}
