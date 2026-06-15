import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n'

interface LegendItem {
  // Swatch classes mirror the matching CourseCard border/dimming states so the
  // legend stays a faithful preview of how the cards actually look.
  swatchClassName: string
  labelKey: TranslationKey
}

const LEGEND_ITEMS: LegendItem[] = [
  { swatchClassName: 'border border-border', labelKey: 'catalog.legend.confirmed' },
  { swatchClassName: 'border-2 border-dashed border-fg-muted', labelKey: 'catalog.legend.likely' },
  { swatchClassName: 'border border-border bg-surface-hover opacity-60', labelKey: 'catalog.legend.unknown' },
]

export function CatalogLegend() {
  const { t } = useTranslation()

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border-light pt-3 text-[11px] text-fg-muted">
      {LEGEND_ITEMS.map((item) => (
        <li key={item.labelKey} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className={`h-3 w-4.5 shrink-0 rounded-[4px] bg-surface ${item.swatchClassName}`}
          />
          <span className="min-w-0 break-words">{t(item.labelKey)}</span>
        </li>
      ))}
    </ul>
  )
}
