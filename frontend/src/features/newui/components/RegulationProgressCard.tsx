import type { MasterCat } from '../../courses'
import type { RegulationAreaProgress } from '../../dashboard/types'
import { areaProgressPercent } from '../utils/regulationProgress'

// Reuses the existing category color tokens; areas without a category (e.g. the
// thesis) fall back to a neutral grey, matching the reference design.
const CAT_BAR_CLASS: Record<MasterCat, string> = {
  TECH: 'bg-cat-tech',
  THEO: 'bg-cat-theo',
  PRAK: 'bg-cat-prak',
  INFO: 'bg-cat-info',
  BASIS: 'bg-cat-basis',
}

const CAT_COLOR_VAR: Record<MasterCat, string> = {
  TECH: 'var(--color-cat-tech)',
  THEO: 'var(--color-cat-theo)',
  PRAK: 'var(--color-cat-prak)',
  INFO: 'var(--color-cat-info)',
  BASIS: 'var(--color-cat-basis)',
}

function barClass(masterCat: MasterCat | null): string {
  return (masterCat && CAT_BAR_CLASS[masterCat]) || 'bg-[#c2bcac] dark:bg-neutral-600'
}

function areaColor(masterCat: MasterCat | null): string {
  return masterCat ? CAT_COLOR_VAR[masterCat] : '#c2bcac'
}

/** Sum of planned ECTS across all raw rule-group codes an area covers. */
function plannedEctsForArea(area: RegulationAreaProgress, plannedEctsByArea: Map<string, number>): number {
  const codes = area.rawAreaCodes && area.rawAreaCodes.length > 0 ? area.rawAreaCodes : [area.code]
  return codes.reduce((sum, code) => sum + (plannedEctsByArea.get(code) ?? 0), 0)
}

interface RegulationProgressCardProps {
  areas: RegulationAreaProgress[]
  plannedEctsByArea: Map<string, number>
}

export function RegulationProgressCard({ areas, plannedEctsByArea }: RegulationProgressCardProps) {
  if (areas.length === 0) {
    return null
  }

  return (
    <section className="mt-5 rounded-3xl border border-[#ece7db] bg-white p-6 shadow-[0_2px_10px_rgba(60,50,20,0.04)] dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-[#221f19] dark:text-neutral-100">
          Prüfungsordnungs-Fortschritt
        </h2>
        <div className="flex items-center gap-4 text-[11.5px] font-semibold text-[#8a8478]">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-sm bg-[#8a8478]" />
            abgeschlossen
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-3.5 rounded-sm"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg,#8a847899,#8a847899 3px,#8a847830 3px,#8a847830 6px)',
              }}
            />
            geplant
          </span>
        </div>
      </div>
      <p className="mb-6 text-[12.5px] text-[#a39d90]">
        Voller Balken = abgeschlossen · schraffiert = was das aktuelle Semester hinzufügt.
      </p>

      <div className="flex flex-col gap-4.25">
        {areas.map((area) => {
          const earnedPct = areaProgressPercent(area.earnedEcts, area.requiredEcts)
          const planned = plannedEctsForArea(area, plannedEctsByArea)
          const plannedPct =
            area.requiredEcts > 0
              ? Math.min(100 - earnedPct, Math.round((planned / area.requiredEcts) * 100))
              : 0
          const color = areaColor(area.masterCat)
          return (
            <div key={area.code}>
              <div className="mb-2 flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${barClass(area.masterCat)}`} />
                <span className="w-16 shrink-0 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.02em] text-[#4a473f] dark:text-neutral-300">
                  {area.code}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#6b6558] dark:text-neutral-400">
                  {area.name}
                </span>
                <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-[#221f19] dark:text-neutral-100">
                  {area.earnedEcts}
                  {planned > 0 ? <span className="text-[#6a3ef0]"> +{planned}</span> : null} / {area.requiredEcts}
                </span>
              </div>
              <div className="flex h-2.25 overflow-hidden rounded-full bg-[#f0ece1] dark:bg-neutral-800">
                <span className={`h-full ${barClass(area.masterCat)}`} style={{ width: `${earnedPct}%` }} />
                {plannedPct > 0 ? (
                  <span
                    className="h-full"
                    style={{
                      width: `${plannedPct}%`,
                      backgroundImage: `repeating-linear-gradient(45deg, ${color}, ${color} 3px, transparent 3px, transparent 6px)`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
