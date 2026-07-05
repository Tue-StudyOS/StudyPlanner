import type { MasterCat } from '../../courses'
import type { RegulationAreaOption } from '../../../shared/utils/regulation'

const CATEGORY_ORDER: readonly MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

/** Distinct categories a planned course can be assigned to, in display order. */
export function categoriesFromOptions(options: RegulationAreaOption[]): MasterCat[] {
  const cats = new Set<MasterCat>()
  for (const option of options) {
    if (option.masterCat) {
      cats.add(option.masterCat)
    }
  }
  return CATEGORY_ORDER.filter((cat) => cats.has(cat))
}

/** The area code that assigns a planned course to the given category, if any. */
export function areaCodeForCategory(options: RegulationAreaOption[], category: MasterCat): string | null {
  return options.find((option) => option.masterCat === category)?.code ?? null
}
