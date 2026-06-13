export const DEFAULT_STUDYPLANNER_AI_BASE_URL = 'https://studyplanner-api.ben-tischberger.workers.dev'

export interface StudyPlannerClientOptions {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

export interface SearchCoursesArgs {
  query?: string | null
  limit?: number
  periodId?: string
  ects?: { min?: number; max?: number; exact?: number }
  weekdays?: string[]
  timeWindow?: { start?: string; end?: string }
  courseTypes?: string[]
  studyAreaCodes?: string[]
  termTypes?: string[]
}

export interface GetCourseDetailArgs {
  courseId: number
}

export interface ResolveCourseArgs {
  courseNumber: string
  periodId?: string
  titleHint?: string
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

export function resolveStudyPlannerBaseUrl(configuredBaseUrl: string | null | undefined): string {
  const normalized = configuredBaseUrl?.trim()
  return trimTrailingSlash(normalized && normalized.length > 0 ? normalized : DEFAULT_STUDYPLANNER_AI_BASE_URL)
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function requestStudyPlannerJson(
  path: string,
  init: RequestInit,
  options: StudyPlannerClientOptions,
): Promise<unknown> {
  const fetchImpl = options.fetchImpl ?? fetch
  const requestUrl = `${resolveStudyPlannerBaseUrl(options.baseUrl)}${path}`
  const response = await fetchImpl(requestUrl, init)
  const payload = await readJsonResponse(response)

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String((payload as { message?: unknown }).message)
      : `StudyPlanner AI request failed with status ${response.status}.`
    throw new Error(message)
  }

  return payload
}

export async function searchCourses(
  args: SearchCoursesArgs,
  options: StudyPlannerClientOptions = {},
): Promise<unknown> {
  return await requestStudyPlannerJson(
    '/api/ai/catalog/search',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: args.query ?? undefined,
        limit: args.limit,
        periodId: args.periodId,
        ects: args.ects,
        weekdays: args.weekdays,
        timeWindow: args.timeWindow,
        courseTypes: args.courseTypes,
        studyAreaCodes: args.studyAreaCodes,
        termTypes: args.termTypes,
      }),
    },
    options,
  )
}

export async function getCourseDetail(
  args: GetCourseDetailArgs,
  options: StudyPlannerClientOptions = {},
): Promise<unknown> {
  return await requestStudyPlannerJson(
    `/api/ai/catalog/courses/${encodeURIComponent(String(args.courseId))}`,
    { method: 'GET' },
    options,
  )
}

export async function resolveCourse(
  args: ResolveCourseArgs,
  options: StudyPlannerClientOptions = {},
): Promise<unknown> {
  return await requestStudyPlannerJson(
    '/api/ai/catalog/resolve-course',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseNumber: args.courseNumber,
        periodId: args.periodId,
        titleHint: args.titleHint,
      }),
    },
    options,
  )
}
