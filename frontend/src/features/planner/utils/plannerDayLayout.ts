import type { PlannerBlock } from './plannerFeedback.ts'

export const START_HOUR = 8
export const END_HOUR = 20
export const MINUTES_PER_HOUR = 60
const PLANNER_START_MINUTES = START_HOUR * MINUTES_PER_HOUR
const PLANNER_END_MINUTES = END_HOUR * MINUTES_PER_HOUR
export const PIXELS_PER_HOUR = 64

interface PositionedPlannerBlock extends PlannerBlock {
  columnIndex: number
  visibleColumnCount: number
  overlapGroupKey: string
}

interface PlannerDayLayout {
  visibleBlocks: PositionedPlannerBlock[]
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

// Greedy interval-graph coloring per overlap cluster: every overlapping block
// remains directly visible in its own column instead of being hidden behind a
// disruptive "+n" badge.
export function buildDayLayout(dayBlocks: PlannerBlock[]): PlannerDayLayout {
  if (dayBlocks.length === 0) {
    return { visibleBlocks: [] }
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

    const visibleColumnCount = columnEndMinutes.length
    const overlapGroupKey = `${cluster[0].day}-${cluster[0].startMinutes}-${clusterIndex}`

    positionedClusterBlocks.forEach((block) => {
      visibleBlocks.push({
        ...block,
        visibleColumnCount,
        overlapGroupKey,
      })
    })
  })

  return { visibleBlocks }
}

export function buildBlockWidth(visibleColumnCount: number, gapRem: number = 0.5): string {
  return `calc(${100 / visibleColumnCount}% - ${gapRem}rem)`
}

export function buildBlockLeft(
  columnIndex: number,
  visibleColumnCount: number,
  gapRem: number = 0.5,
): string {
  return `calc(${(100 / visibleColumnCount) * columnIndex}% + ${gapRem / 2}rem)`
}
