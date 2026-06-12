import type { ComponentType } from 'react'
import { CatalogIcon, DashboardIcon, PlannerIcon, TranscriptIcon } from './components/icons'
import { ROUTES, type RoutePath } from '../routes'

export interface NavEntry {
  path: RoutePath
  label: string
  Icon: ComponentType<{ filled?: boolean }>
}

export const NAV: NavEntry[] = [
  { path: ROUTES.planner, label: 'Planner', Icon: PlannerIcon },
  { path: ROUTES.catalog, label: 'Catalog', Icon: CatalogIcon },
  { path: ROUTES.overview, label: 'Overview', Icon: DashboardIcon },
  { path: ROUTES.transcript, label: 'Transcript', Icon: TranscriptIcon },
]
