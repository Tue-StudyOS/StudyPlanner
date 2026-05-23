import type { MasterCat } from '../../courses'
import { useTranscript } from '../../transcript'
import { MASTER_CATEGORY_META } from '../masterCategoryMeta'
import type { CategoryProgress, ThesisProgress } from '../types'

const CORE_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO']
const ELECTIVE_CATEGORIES: MasterCat[] = ['FOKUS', 'BASIS']
const REQUIRED_ECTS_PER_CATEGORY = 18
const REQUIRED_ECTS_THESIS = 30

export function useCategoryProgress(): {
  core: CategoryProgress[]
  electives: CategoryProgress[]
  thesis: ThesisProgress
} {
  const { completedCourses } = useTranscript()

  const earnedByCat = new Map<MasterCat, number>()
  for (const completed of completedCourses) {
    earnedByCat.set(
      completed.masterCat,
      (earnedByCat.get(completed.masterCat) ?? 0) + completed.ects,
    )
  }

  const toProgress = (cat: MasterCat): CategoryProgress => {
    // FOKUS and BASIS are alternatives — a student does one or the other —
    // but both count toward degree progress.
    const earned = earnedByCat.get(cat) ?? 0
    return {
      cat,
      label: MASTER_CATEGORY_META[cat].fullLabel,
      // Earned ECTS may exceed the requirement; the progress bar caps at 100%.
      earnedEcts: earned,
      requiredEcts: REQUIRED_ECTS_PER_CATEGORY,
    }
  }

  return {
    core: CORE_CATEGORIES.map(toProgress),
    electives: ELECTIVE_CATEGORIES.map(toProgress),
    thesis: { label: 'Master Thesis', earnedEcts: 0, requiredEcts: REQUIRED_ECTS_THESIS },
  }
}
