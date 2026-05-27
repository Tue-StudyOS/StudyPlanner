import type { VisualizationCategoryProgress } from './types'

export const EMPTY_VISUALIZATION_CATEGORIES: VisualizationCategoryProgress[] = [
  { code: 'SOFTWARE_ENG', name: 'Software Eng.', referenceEcts: 12, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'THEORY', name: 'Theory', referenceEcts: 18, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'MATHEMATICS', name: 'Mathematics', referenceEcts: 18, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'SYSTEMS_SECURITY', name: 'Network & Security', referenceEcts: 12, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'DATA_DATABASES', name: 'Data Science', referenceEcts: 12, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'AI_ML', name: 'AI & ML', referenceEcts: 18, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'VISION', name: 'Vision', referenceEcts: 12, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'HCI_UX', name: 'UI & UX', referenceEcts: 12, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'ROBOTICS', name: 'Robotics', referenceEcts: 12, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
  { code: 'CLOUD_DEV', name: 'Cloud Dev', referenceEcts: 12, earnedEcts: 0, progressRatio: 0, progressPercentage: 0 },
]

export const VISUALIZATION_CATEGORY_COLORS: Record<string, string> = {
  SOFTWARE_ENG: '#4cc9f0',
  THEORY: '#f72585',
  MATHEMATICS: '#ef233c',
  SYSTEMS_SECURITY: '#0077b6',
  DATA_DATABASES: '#7209b7',
  AI_ML: '#ef233c',
  VISION: '#4cc9f0',
  HCI_UX: '#7209b7',
  ROBOTICS: '#0077b6',
  CLOUD_DEV: '#06d6a0',
}

const LIGHT_MODE_VISUALIZATION_CATEGORY_OVERRIDES: Record<string, string> = {
  SOFTWARE_ENG: '#169fd6',
  VISION: '#1296cc',
  CLOUD_DEV: '#05b487',
}

export function getVisualizationCategoryColor(code: string, isDark: boolean): string {
  if (!isDark && LIGHT_MODE_VISUALIZATION_CATEGORY_OVERRIDES[code]) {
    return LIGHT_MODE_VISUALIZATION_CATEGORY_OVERRIDES[code]
  }

  return VISUALIZATION_CATEGORY_COLORS[code] ?? 'rgb(147 13 42)'
}
