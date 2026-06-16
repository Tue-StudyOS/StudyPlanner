/**
 * Number of columns for a strip of `itemCount` items so they split into balanced
 * rows instead of leaving a lopsided final row (e.g. 6 items become 3 + 3 rather
 * than 4 + 2). Uses the fewest rows that keep every row at or below `maxColumns`,
 * then spreads the items evenly across those rows.
 */
export function getBalancedColumnCount(itemCount: number, maxColumns = 5): number {
  const cappedMax = Math.max(1, maxColumns)
  if (itemCount <= 0) {
    return 1
  }
  if (itemCount <= cappedMax) {
    return itemCount
  }
  const rows = Math.ceil(itemCount / cappedMax)
  return Math.ceil(itemCount / rows)
}
