import { getCourseDetail, resolveCourse, searchCourses, type StudyPlannerClientOptions } from './client.ts'

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

const SEARCH_COURSES_TOOL: McpToolDefinition = {
  name: 'studyplanner_search_courses',
  description: 'Search the public StudyPlanner course catalog. Read-only and unauthenticated.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Free-text query over course title, number, or organization.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 25,
        default: 10,
        description: 'Maximum number of matching courses to return.',
      },
      periodId: {
        type: 'string',
        default: 'all',
        description: "Catalog period id, or 'all' for the deduplicated multi-semester catalog.",
      },
      ects: {
        type: 'object',
        description: 'ECTS filter; use exact, or min/max for a range.',
        properties: {
          min: { type: 'number' },
          max: { type: 'number' },
          exact: { type: 'number' },
        },
      },
      weekdays: {
        type: 'array',
        items: { type: 'string' },
        description: "Weekdays a course must meet on, e.g. ['Monday','Mi'] (German or English).",
      },
      timeWindow: {
        type: 'object',
        description: 'Only courses whose slots fall fully inside this window.',
        properties: {
          start: { type: 'string', description: "'HH:MM'" },
          end: { type: 'string', description: "'HH:MM'" },
        },
      },
      courseTypes: {
        type: 'array',
        items: { type: 'string' },
        description: "Course-type keywords, e.g. ['lecture','seminar','Vorlesung'].",
      },
      studyAreaCodes: {
        type: 'array',
        items: { type: 'string' },
        description: "Regulation study-area codes, e.g. ['INFO-THEO','ML-FOUND'].",
      },
      termTypes: {
        type: 'array',
        items: { type: 'string', enum: ['summer', 'winter'] },
        description: 'Restrict to summer and/or winter courses.',
      },
    },
    additionalProperties: false,
  },
}

const RESOLVE_COURSE_TOOL: McpToolDefinition = {
  name: 'studyplanner_resolve_course',
  description:
    'Resolve a stable course number (and optional title hint) to the current numeric course id before quoting or linking a course.',
  inputSchema: {
    type: 'object',
    required: ['courseNumber'],
    properties: {
      courseNumber: { type: 'string', description: 'Course number such as "INFM1234".' },
      periodId: { type: 'string', default: 'all', description: "Catalog period id, or 'all'." },
      titleHint: { type: 'string', description: 'Optional title fragment to disambiguate.' },
    },
    additionalProperties: false,
  },
}

const GET_COURSE_DETAIL_TOOL: McpToolDefinition = {
  name: 'studyplanner_get_course_detail',
  description: 'Get compact public details for one StudyPlanner course by numeric course id.',
  inputSchema: {
    type: 'object',
    required: ['courseId'],
    properties: {
      courseId: {
        type: 'integer',
        minimum: 1,
        description: 'Numeric course id returned by studyplanner_search_courses.',
      },
    },
    additionalProperties: false,
  },
}

export const STUDYPLANNER_MCP_TOOLS: McpToolDefinition[] = [
  SEARCH_COURSES_TOOL,
  RESOLVE_COURSE_TOOL,
  GET_COURSE_DETAIL_TOOL,
]

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function requiredString(value: unknown, fieldName: string): string {
  const text = optionalString(value)
  if (!text) {
    throw new Error(`${fieldName} is required.`)
  }
  return text
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Expected an array of strings.')
  }
  return value as string[]
}

function passthroughObject(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object.')
  }
  return value as Record<string, unknown>
}

function optionalInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue)) {
    throw new Error('limit must be an integer.')
  }
  return Math.max(1, Math.min(numberValue, 25))
}

function requiredPositiveInteger(value: unknown, fieldName: string): number {
  const numberValue = Number(value)
  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`)
  }
  return numberValue
}

function jsonContent(payload: unknown): McpToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}

export async function callStudyPlannerTool(
  name: string,
  rawArguments: unknown,
  options: StudyPlannerClientOptions = {},
): Promise<McpToolResult> {
  const args = asObject(rawArguments)

  if (name === SEARCH_COURSES_TOOL.name) {
    const result = await searchCourses(
      {
        query: optionalString(args.query) ?? null,
        limit: optionalInteger(args.limit),
        periodId: optionalString(args.periodId) ?? 'all',
        ects: passthroughObject(args.ects) as
          | { min?: number; max?: number; exact?: number }
          | undefined,
        weekdays: optionalStringArray(args.weekdays),
        timeWindow: passthroughObject(args.timeWindow) as
          | { start?: string; end?: string }
          | undefined,
        courseTypes: optionalStringArray(args.courseTypes),
        studyAreaCodes: optionalStringArray(args.studyAreaCodes),
        termTypes: optionalStringArray(args.termTypes),
      },
      options,
    )
    return jsonContent(result)
  }

  if (name === RESOLVE_COURSE_TOOL.name) {
    const result = await resolveCourse(
      {
        courseNumber: requiredString(args.courseNumber, 'courseNumber'),
        periodId: optionalString(args.periodId) ?? 'all',
        titleHint: optionalString(args.titleHint),
      },
      options,
    )
    return jsonContent(result)
  }

  if (name === GET_COURSE_DETAIL_TOOL.name) {
    const result = await getCourseDetail(
      {
        courseId: requiredPositiveInteger(args.courseId, 'courseId'),
      },
      options,
    )
    return jsonContent(result)
  }

  throw new Error(`Unknown StudyPlanner MCP tool: ${name}`)
}
