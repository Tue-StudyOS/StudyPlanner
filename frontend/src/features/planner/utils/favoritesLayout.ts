export const PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY = '(min-width: 1100px)'

type PlannerFavoritesLayout = 'stacked' | 'sidebar'

export function getPlannerFavoritesLayout(hasSidebarSpace: boolean): PlannerFavoritesLayout {
  return hasSidebarSpace ? 'sidebar' : 'stacked'
}
