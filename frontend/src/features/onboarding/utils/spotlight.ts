export interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

export const SPOTLIGHT_DIM_BOX_SHADOW = [
  '0 0 0 9999px rgba(0, 0, 0, 0.58)',
  '0 18px 44px rgba(0, 0, 0, 0.34)',
].join(', ')

export const SPOTLIGHT_HALO_BOX_SHADOW = '0 0 34px rgba(255, 255, 255, 0.52)'

export function buildSpotlightFrameStyle(rect: SpotlightRect): Record<string, string> {
  return {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    boxShadow: SPOTLIGHT_DIM_BOX_SHADOW,
  }
}

export function buildSpotlightHaloStyle(rect: SpotlightRect): Record<string, string> {
  const haloPadding = 6
  return {
    top: `${rect.top - haloPadding}px`,
    left: `${rect.left - haloPadding}px`,
    width: `${rect.width + haloPadding * 2}px`,
    height: `${rect.height + haloPadding * 2}px`,
    boxShadow: SPOTLIGHT_HALO_BOX_SHADOW,
  }
}
