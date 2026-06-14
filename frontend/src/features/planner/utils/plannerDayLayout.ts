import type { PlannerBlock } from './plannerFeedback.ts'

export const START_HOUR = 8
export const END_HOUR = 18
export const MINUTES_PER_HOUR = 60
const PLANNER_START_MINUTES = START_HOUR * MINUTES_PER_HOUR
const PLANNER_END_MINUTES = END_HOUR * MINUTES_PER_HOUR
export const PIXELS_PER_HOUR = 56
export const MAX_VISIBLE_OVERLAP_COLUMNS = 3

interface PositionedPlannerBlock extends PlannerBlock {
  columnIndex: number
  visibleColumnCount: number
  overlapGroupKey: string
}

interface OverflowIndicator {
  overlapGroupKey: string
  day: PlannerBlock['day']
  top: number
  hiddenBlocks: PlannerBlock[]
}

interface PlannerDayLayout {
  visibleBlocks: PositionedPlannerBlock[]
  overflowIndicators: OverflowIndicator[]
}

export function clampPlannerTimeRange(
  startMinutes: number,
  endMinutes: number,
): { startMinutes: number; endMinutes: number } | null {
  const clampedStartMinutes = Math.max(startMinutes, PLANNER_START_MINUTES)
  const clampedEndMinutes = Math.min(endMinutes, PLANNER_END_MINUTES)
  if (clampedEndMinutes <= clampedStartMinutes) {
    return null
  }
  return { startMinutes: clampedStartMinutes, endMinutes: clampedEndMinutes }
}

// Greedy interval-graph coloring per overlap cluster: blocks that overlap in
// time share columns; anything beyond the visible column limit is collapsed
// into a "+n" overflow indicator instead of shrinking blocks unreadably.
export function buildDayLayout(dayBlocks: PlannerBlock[]): PlannerDayLayout {
  if (dayBlocks.length === 0) {
    return { visibleBlocks: [], overflowIndicators: [] }
  }

  const sortedBlocks = [...dayBlocks].sort(
    (left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes,
  )
  const clusters: PlannerBlock[][] = []

  sortedBlocks.forEach((block) => {
    const currentCluster = clusters.at(-1)
    if (!currentCluster) {
      clusters.push([block])
      return
    }

    const currentClusterEnd = Math.max(...currentCluster.map((candidate) => candidate.endMinutes))
    if (block.startMinutes < currentClusterEnd) {
      currentCluster.push(block)
      return
    }

    clusters.push([block])
  })

  const visibleBlocks: PositionedPlannerBlock[] = []
  const overflowIndicators: OverflowIndicator[] = []

  clusters.forEach((cluster, clusterIndex) => {
    const columnEndMinutes: number[] = []
    const positionedClusterBlocks: Array<PlannerBlock & { columnIndex: number }> = []

    cluster.forEach((block) => {
      let columnIndex = columnEndMinutes.findIndex((endMinutes) => endMinutes <= block.startMinutes)
      if (columnIndex < 0) {
        columnIndex = columnEndMinutes.length
        columnEndMinutes.push(block.endMinutes)
      } else {
        columnEndMinutes[columnIndex] = block.endMinutes
      }

      positionedClusterBlocks.push({ ...block, columnIndex })
    })

    const visibleColumnCount = Math.min(columnEndMinutes.length, MAX_VISIBLE_OVERLAP_COLUMNS)
    const hiddenBlocks = positionedClusterBlocks.filter(
      (block) => block.columnIndex >= MAX_VISIBLE_OVERLAP_COLUMNS,
    )
    const overlapGroupKey = `${cluster[0].day}-${cluster[0].startMinutes}-${clusterIndex}`

    positionedClusterBlocks
      .filter((block) => block.columnIndex < MAX_VISIBLE_OVERLAP_COLUMNS)
      .forEach((block) => {
        visibleBlocks.push({
          ...block,
          visibleColumnCount,
          overlapGroupKey,
        })
      })

    if (hiddenBlocks.length > 0) {
      overflowIndicators.push({
        overlapGroupKey,
        day: cluster[0].day,
        top:
          ((Math.min(...cluster.map((block) => block.startMinutes)) - START_HOUR * MINUTES_PER_HOUR)
            / MINUTES_PER_HOUR)
          * PIXELS_PER_HOUR,
        hiddenBlocks,
      })
    }
  })

  return { visibleBlocks, overflowIndicators }
}

export function buildBlockWidth(visibleColumnCount: number): string {
  return `calc(${100 / visibleColumnCount}% - 0.5rem)`
}

export function buildBlockLeft(columnIndex: number, visibleColumnCount: number): string {
  return `calc(${(100 / visibleColumnCount) * columnIndex}% + 0.25rem)`
}
