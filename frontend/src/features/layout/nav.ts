import type { ComponentType } from 'react'
import type { TranslationKey } from '../i18n'
import { ROUTES, type RoutePath } from '../routes'
import { CatalogIcon, DashboardIcon, PlannerIcon, TranscriptIcon } from './components/icons'

interface NavEntry {
  path: RoutePath
  labelKey: TranslationKey
  Icon: ComponentType<{ filled?: boolean }>
}

export const NAV: NavEntry[] = [
  { path: ROUTES.planner, labelKey: 'nav.planner', Icon: PlannerIcon },
  { path: ROUTES.catalog, labelKey: 'nav.catalog', Icon: CatalogIcon },
  { path: ROUTES.overview, labelKey: 'nav.progress', Icon: DashboardIcon },
  { path: ROUTES.transcript, labelKey: 'nav.transcript', Icon: TranscriptIcon },
]
