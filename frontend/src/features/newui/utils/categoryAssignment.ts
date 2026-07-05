import type { MasterCat } from '../../courses'
import type { RegulationAreaProgress } from '../../dashboard/types'
import { studyAreaCodeToMasterCat } from '../../../shared/utils/regulation.ts'

const CATEGORY_ORDER: readonly MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'BASIS']

/** The rule-group code the backend accepts when assigning this area. */
function areaCodeOf(area: RegulationAreaProgress): string {
  return area.rawAreaCodes?.[0] ?? area.code
}

/** The master category an area counts toward (derived from its code, then the
 *  backend-provided category as a fallback). */
function areaCategory(area: RegulationAreaProgress): MasterCat | null {
  return studyAreaCodeToMasterCat(areaCodeOf(area)) ?? area.masterCat
}

/**
 * Maps each master category to a study-area code of the student's regulation.
 * This is what makes a category assignable: the backend derives the category
 * from the study area, so picking a category means assigning its area code.
 */
export function buildCategoryAreaMap(areas: RegulationAreaProgress[]): Map<MasterCat, string> {
  const map = new Map<MasterCat, string>()
  for (const area of areas) {
    const cat = areaCategory(area)
    if (cat && !map.has(cat)) {
      map.set(cat, areaCodeOf(area))
    }
  }
  return map
}

/** Categories the regulation supports, in canonical display order. */
export function selectableCategoriesFromMap(categoryAreaMap: Map<MasterCat, string>): MasterCat[] {
  return CATEGORY_ORDER.filter((cat) => categoryAreaMap.has(cat))
}
