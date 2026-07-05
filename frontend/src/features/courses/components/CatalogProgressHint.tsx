import { formatRegulationAreaShortLabel, studyAreaCodeToMasterCat } from '../../../shared/utils/regulation'
import { CAT_BADGE_CLASSES } from '../../../shared/components/catClasses'
import { useAuth } from '../../auth'
import { useOnboarding } from '../../onboarding'
import { TOUR_CATALOG_OPEN_AREAS } from '../../onboarding/utils/tourPreviewData.ts'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'

function formatEctsValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

interface CatalogProgressHintProps {
  isAreaActive?: (code: string) => boolean
  onSelectArea?: (code: string) => void
}

/**
 * Slim sticky reminder of the regulation areas that are still open, so the
 * missing parts of the degree stay visible while scrolling the catalog.
 */
export function CatalogProgressHint({ isAreaActive, onSelectArea }: CatalogProgressHintProps = {}) {
  const { isAuthenticated } = useAuth()
  const { isOpen: isOnboardingOpen } = useOnboarding()
  const { progressSnapshot } = useProgressSnapshot()

  const realOpenAreas = (progressSnapshot?.regulationProgress ?? [])
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
      masterCat: area.masterCat,
    }))

  const openAreas = realOpenAreas.length > 0
    ? realOpenAreas
    : isOnboardingOpen
      ? TOUR_CATALOG_OPEN_AREAS.map((area) => ({
          ...area,
          masterCat: studyAreaCodeToMasterCat(area.code),
        }))
      : []

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
            const isActive = isAreaActive?.(area.code) ?? false
            const shortLabel = formatRegulationAreaShortLabel(area.code)
            const colorClass = area.masterCat ? CAT_BADGE_CLASSES[area.masterCat] : 'text-fg-mid border-border bg-surface-hover'
            return (
              <button
                key={area.code}
                type="button"
                title={area.name}
                aria-pressed={isActive}
                onMouseDown={(event) => event.preventDefault()}
                onClick={(event) => {
                  event.preventDefault()
                  onSelectArea?.(area.code)
                }}
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 text-[10.5px] font-medium tabular-nums transition-colors ${colorClass} ${
                  isActive ? 'border-current font-semibold' : 'hover:opacity-90'
                }`}
              >
                {shortLabel} {formatEctsValue(area.earnedEcts)}/{formatEctsValue(area.requiredEcts)}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
