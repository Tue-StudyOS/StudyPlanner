export type TourSampleCardVariant = 'confirmed' | 'likely' | 'unknown'

export interface TourStep {
  id: string
  title: string
  body: string
  /** Route to navigate to before showing this step. */
  route?: string
  /** data-tour anchor candidates, first one found in the DOM wins. */
  targets?: string[]
  /** Limit a step to one viewport class; omitted steps show everywhere. */
  viewport?: 'mobile' | 'desktop'
  /** Preferred viewport top for target positioning before measuring the spotlight. */
  targetTopOffsetPx?: number
  /** Mobile-only viewport top when fixed phone chrome would cover the target. */
  mobileTargetTopOffsetPx?: number
  /** Override the default spotlight padding for edge-aligned fixed bars. */
  spotlightPaddingPx?: number
  /** Keep the page exactly where it is and only move the spotlight frame. */
  preserveScroll?: boolean
  /** Reset the page to the top once when this step becomes visible. */
  resetScroll?: boolean
  /** On phones, scroll this target into view even when desktop keeps context fixed. */
  allowMobileScroll?: boolean
  /** Skip this step silently when no target shows up (data-dependent examples). */
  optional?: boolean
  /**
   * Adds the active tour-only sample course to the catalog so the card state
   * being explained is always present at the top of the live card grid.
   */
  sample?: TourSampleCardVariant
}
