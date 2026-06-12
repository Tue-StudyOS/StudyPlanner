// Approximate rendered line heights of the block title (font size * line-height).
const MOBILE_LINE_HEIGHT_PX = 9
const DESKTOP_LINE_HEIGHT_PX = 14
const MOBILE_VERTICAL_PADDING_PX = 4
const DESKTOP_VERTICAL_PADDING_PX = 10
// Space the type line occupies on desktop when present.
const DESKTOP_TYPE_LINE_PX = 13

/**
 * How many title lines fit into a planner block of the given pixel height.
 * Short blocks must never overflow their box, tall blocks may use the room.
 */
export function getBlockTitleLineClamp(
  blockHeightPx: number,
  isMobile: boolean,
  hasTypeLine: boolean = false,
): number {
  const lineHeight = isMobile ? MOBILE_LINE_HEIGHT_PX : DESKTOP_LINE_HEIGHT_PX
  const padding = isMobile ? MOBILE_VERTICAL_PADDING_PX : DESKTOP_VERTICAL_PADDING_PX
  const reserved = !isMobile && hasTypeLine ? DESKTOP_TYPE_LINE_PX : 0
  const availableHeight = blockHeightPx - padding - reserved
  return Math.max(1, Math.floor(availableHeight / lineHeight))
}
