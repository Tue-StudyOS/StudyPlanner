export const STUDYPLANNER_APP_RESOURCE_URI = 'ui://studyplanner/catalog-results.html'
export const STUDYPLANNER_APP_HTTP_PATH = '/app/catalog-results.html'

export interface McpResourceDefinition {
  uri: string
  name: string
  description: string
  mimeType: string
  _meta?: Record<string, unknown>
}

export interface McpResourceContent {
  uri: string
  mimeType: string
  text: string
  _meta?: Record<string, unknown>
}

const APP_COMPONENT_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: transparent;
      color: #111827;
    }
    @media (prefers-color-scheme: dark) {
      :root { color: #f3f4f6; }
      .card { background: rgba(17, 24, 39, 0.72); border-color: rgba(75, 85, 99, 0.72); }
      .muted { color: #9ca3af; }
    }
    body { margin: 0; padding: 12px; }
    .shell { display: grid; gap: 10px; }
    .header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
    .title { font-size: 14px; font-weight: 700; }
    .muted { color: #6b7280; font-size: 12px; }
    .grid { display: grid; gap: 8px; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; padding: 10px 12px; }
    .course-title { font-size: 13px; font-weight: 650; line-height: 1.35; }
    .meta { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; }
    .pill { border: 1px solid #d1d5db; border-radius: 999px; padding: 2px 7px; color: #4b5563; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 11px; }
  </style>
</head>
<body>
  <main id="root" class="shell">
    <div class="muted">StudyPlanner results will appear here when ChatGPT runs a catalog tool.</div>
  </main>
  <script>
    const root = document.getElementById('root')

    function readOutput() {
      const bridge = window.openai || {}
      return bridge.toolOutput || bridge.structuredContent || bridge.toolResponse?.structuredContent || null
    }

    function asCourseList(output) {
      if (!output || typeof output !== 'object') return []
      if (Array.isArray(output.courses)) return output.courses
      if (output.course && typeof output.course === 'object') return [output.course]
      if (Array.isArray(output.matches)) return output.matches
      return []
    }

    function text(value) {
      return value === null || value === undefined ? '' : String(value)
    }

    function escapeHtml(value) {
      return text(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
    }

    function renderCourse(course) {
      const number = escapeHtml(course.number || course.courseNumber)
      const title = escapeHtml(course.title || course.name || 'Untitled course')
      const ects = course.ects ?? course.ectsCredits
      const term = escapeHtml(course.termType || course.term || '')
      const id = course.id ?? course.courseId
      const detailUrl = escapeHtml(course.detailUrl || course.url)
      const titlePrefix = number ? number + ' · ' : ''
      const metaParts = []
      if (ects !== undefined && ects !== null) metaParts.push('<span class="pill">' + escapeHtml(ects) + ' ECTS</span>')
      if (term) metaParts.push('<span class="pill">' + term + '</span>')
      if (id) metaParts.push('<span class="pill">ID ' + escapeHtml(id) + '</span>')
      if (detailUrl) metaParts.push('<a href="' + detailUrl + '" target="_blank" rel="noreferrer">Open</a>')
      return [
        '<article class="card">',
        '<div class="course-title">' + titlePrefix + title + '</div>',
        '<div class="meta">' + metaParts.join('') + '</div>',
        '</article>',
      ].join('')
    }

    function render() {
      const output = readOutput()
      const courses = asCourseList(output)
      if (courses.length > 0) {
        const count = output?.count ?? courses.length
        root.innerHTML = [
          '<section class="header">',
          '<div class="title">StudyPlanner catalog</div>',
          '<div class="muted">' + escapeHtml(count) + ' result' + (Number(count) === 1 ? '' : 's') + '</div>',
          '</section>',
          '<section class="grid">' + courses.slice(0, 8).map(renderCourse).join('') + '</section>',
        ].join('')
        return
      }
      if (output) {
        root.innerHTML = '<section class="card"><pre>' + escapeHtml(JSON.stringify(output, null, 2)) + '</pre></section>'
        return
      }
      root.innerHTML = '<div class="muted">StudyPlanner results will appear here when ChatGPT runs a catalog tool.</div>'
    }

    window.addEventListener('message', render)
    render()
  </script>
</body>
</html>`

export const STUDYPLANNER_APP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: STUDYPLANNER_APP_RESOURCE_URI,
    name: 'StudyPlanner catalog results',
    description: 'Inline ChatGPT App component for public StudyPlanner course search and detail results.',
    mimeType: 'text/html+skybridge',
    _meta: {
      'openai/widgetDescription': 'Shows public StudyPlanner catalog results returned by the MCP tools.',
      'openai/widgetPrefersBorder': true,
      'openai/widgetCSP': {
        connect_domains: [
          'https://studyplanner-api.ben-tischberger.workers.dev',
          'https://studyplanner-mcp.ben-tischberger.workers.dev',
        ],
        resource_domains: [],
      },
    },
  },
]

export function readStudyPlannerAppResource(uri: string): McpResourceContent | null {
  if (uri !== STUDYPLANNER_APP_RESOURCE_URI) {
    return null
  }

  return {
    uri: STUDYPLANNER_APP_RESOURCE_URI,
    mimeType: 'text/html+skybridge',
    text: APP_COMPONENT_HTML,
    _meta: STUDYPLANNER_APP_RESOURCES[0]._meta,
  }
}
