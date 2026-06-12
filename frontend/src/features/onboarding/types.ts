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
}
