import type { ComponentType } from 'react'
import type { TranslationKey } from '../i18n'
import { ROUTES, type RoutePath } from '../routes'
import { CatalogIcon, PlannerIcon, TranscriptIcon } from './components/icons'

interface NavEntry {
  path: RoutePath
  labelKey: TranslationKey
  Icon: ComponentType<{ filled?: boolean }>
}

export const NAV: NavEntry[] = [
  { path: ROUTES.catalog, labelKey: 'nav.catalog', Icon: CatalogIcon },
  { path: ROUTES.planner, labelKey: 'nav.semester', Icon: PlannerIcon },
  { path: ROUTES.transcript, labelKey: 'nav.transcript', Icon: TranscriptIcon },
]
