function areAssignmentsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) {
    return false
  }
  return leftKeys.every((key) => left[key] === right[key])
}

export function reconcileSavedPlanAssignments(
  currentAssignments: Record<string, string>,
  submittedAssignments: Record<string, string>,
  savedAssignments: Record<string, string>,
): Record<string, string> {
  return areAssignmentsEqual(currentAssignments, submittedAssignments)
    ? savedAssignments
    : currentAssignments
}
