export interface TourStep {
  id: string
  title: string
  body: string
  /** Route to navigate to before showing this step. */
  route?: string
  /** data-tour anchor candidates, first one found in the DOM wins. */
  targets?: string[]
  /** Skip this step silently when no target shows up (data-dependent examples). */
  optional?: boolean
  /**
   * Renders a self-contained example card instead of pointing at live data, so
   * the dashed ("likely") and faded ("no data") card states are always shown
   * correctly regardless of what the catalog currently contains.
   */
  sample?: 'likely' | 'unknown'
}
