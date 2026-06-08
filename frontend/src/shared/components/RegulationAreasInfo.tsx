import { useEffect, useState } from 'react'
import type { MasterCat } from '../../features/courses'
import { studyAreaCodeToMasterCat } from '../utils/regulation'
import { REGULATION_AREA_INFO } from '../utils/regulationAreaInfo'

const CAT_COLOR_CLASS: Partial<Record<MasterCat, string>> & { default: string } = {
  TECH: 'bg-cat-tech',
  THEO: 'bg-cat-theo',
  PRAK: 'bg-cat-prak',
  INFO: 'bg-cat-info',
  BASIS: 'bg-cat-basis',
  default: 'bg-border',
}

function dotColorClass(code: string): string {
  const masterCat = studyAreaCodeToMasterCat(code)
  return (masterCat ? CAT_COLOR_CLASS[masterCat] : undefined) ?? CAT_COLOR_CLASS.default
}

function RegulationAreasModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/45 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="regulation-areas-info-title"
      onClick={onClose}
    >
      <div
        className="mx-auto flex w-full max-w-2xl flex-col rounded-[14px] border border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h3 id="regulation-areas-info-title" className="text-[18px] font-semibold text-fg">
              Study areas explained
            </h3>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              What kinds of courses count toward each study area.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 px-6 py-5 sm:gap-3.5">
          {REGULATION_AREA_INFO.map((area) => (
            <div
              key={area.code}
              className="min-w-0 rounded-[10px] border border-border-light bg-surface-hover/35 px-4 py-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-xs ${dotColorClass(area.code)}`} />
                <span className="text-[13px] font-semibold text-fg">{area.code}</span>
                <span className="text-[12px] text-fg-muted">{area.name}</span>
              </div>
              <p className="mt-1.5 break-words text-[12.5px] leading-6 text-fg-mid">{area.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RegulationAreasInfo() {
  const [isOpen, setIsOpen] = useState<boolean>(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="What the study areas mean"
        className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold leading-none text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
      >
        ?
      </button>

      {isOpen ? <RegulationAreasModal onClose={() => setIsOpen(false)} /> : null}
    </>
  )
}
