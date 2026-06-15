// ALMA stores course detail links as host-relative paths (e.g.
// "/alma/pages/startFlow.xhtml?...&unitId=...&periodId=..."). Rendered directly
// as an href they resolve against the app origin and 404, so they must be
// joined with the ALMA host to become working deep links. The stable unitId and
// periodId in this path keep the link valid, unlike the absolute "detailPageUrl"
// variant whose _flowExecutionKey is session-bound and expires.
const ALMA_BASE_URL = 'https://alma.uni-tuebingen.de'

export function buildAlmaCourseUrl(detailUrl: string | null | undefined): string | null {
  const trimmed = detailUrl?.trim()
  if (!trimmed) {
    return null
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${ALMA_BASE_URL}${path}`
}
