import type { ComponentType } from 'react'
import { DashboardIcon, CatalogIcon, FavoritesIcon, TranscriptIcon } from './components/icons'
import { ROUTES, type RoutePath } from '../routes'

export interface NavEntry {
  path: RoutePath
  label: string
  Icon: ComponentType<{ filled?: boolean }>
}

export const NAV: NavEntry[] = [
  { path: ROUTES.dashboard,  label: 'Dashboard',  Icon: DashboardIcon  },
  { path: ROUTES.catalog,    label: 'Catalog',    Icon: CatalogIcon    },
  { path: ROUTES.favorites,  label: 'Favorites',  Icon: FavoritesIcon  },
  { path: ROUTES.transcript, label: 'Transcript', Icon: TranscriptIcon },
]
