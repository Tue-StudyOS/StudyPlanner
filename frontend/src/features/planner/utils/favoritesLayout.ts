export const PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY = '(min-width: 1100px)'

export type PlannerFavoritesLayout = 'drawer' | 'stacked' | 'sidebar'

export function getPlannerFavoritesLayout(
  isMobilePlanner: boolean,
  hasSidebarSpace: boolean,
): PlannerFavoritesLayout {
  if (isMobilePlanner) {
    return 'drawer'
  }

  return hasSidebarSpace ? 'sidebar' : 'stacked'
}
