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
    <div className="sticky top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-20 mb-4 md:top-0">
      <div className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-border bg-surface/95 px-3.5 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.05)] backdrop-blur">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Still open
        </span>
        {openAreas.map((area) => (
          <span
            key={area.code}
            title={area.name}
            className="whitespace-nowrap rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10.5px] font-medium text-fg-mid"
          >
            {formatRegulationAreaShortLabel(area.code)} {formatEctsValue(area.earnedEcts)}/
            {formatEctsValue(area.requiredEcts)}
          </span>
        ))}
      </div>
    </div>
  )
}
