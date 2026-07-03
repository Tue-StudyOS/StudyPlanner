// The catalog list and its detail drawer share one URL scheme:
// '<catalogBasePath>/<encoded course id>'. Kept as pure helpers so the main
// '/catalog' surface and the '/test/catalog' surface behave identically and
// the parsing stays unit-testable.
export function encodeCatalogDetailSegment(courseId: string): string {
  return encodeURIComponent(courseId)
}

export function extractCatalogDetailCourseId(
  pathname: string,
  catalogBasePath: string,
): string | null {
  const base = catalogBasePath.endsWith('/') ? catalogBasePath.slice(0, -1) : catalogBasePath
  if (!pathname.startsWith(`${base}/`)) {
    return null
  }
  const segment = pathname.slice(base.length + 1).replace(/\/+$/, '')
  if (segment.length === 0 || segment.includes('/')) {
    return null
  }
  try {
    return decodeURIComponent(segment)
  } catch {
    // A malformed escape sequence in a hand-edited URL must not crash the
    // catalog; keep the raw segment and let the detail fetch report the error.
    return segment
  }
}
