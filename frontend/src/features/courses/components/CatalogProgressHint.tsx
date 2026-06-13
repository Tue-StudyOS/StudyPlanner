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
    // First element of the scroll column on every breakpoint: both the mobile
    // scroll container (<main>, made scrollable by overflow-x-hidden) and the
    // desktop scroll pane start right below the sticky top bar, so top-0 keeps
    // the bar flush under it with no gap and nothing scrolling through.
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1.5 border-b border-border bg-bg px-4 py-2 sm:px-8">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        Still open
      </span>
      {openAreas.map((area) => (
        <span
          key={area.code}
          title={area.name}
          className="whitespace-nowrap rounded-full border border-border bg-surface px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-fg-mid"
        >
          {formatRegulationAreaShortLabel(area.code)} {formatEctsValue(area.earnedEcts)}/
          {formatEctsValue(area.requiredEcts)}
        </span>
      ))}
    </div>
  )
}
