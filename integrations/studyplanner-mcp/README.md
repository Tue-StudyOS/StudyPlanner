# StudyPlanner MCP Worker

Hosted, stateless MCP adapter for the public StudyPlanner AI catalog facade.

First version exposes read-only public catalog tools only:

- `studyplanner_search_courses`
- `studyplanner_resolve_course`
- `studyplanner_get_course_detail`

External agents call the deployed Worker endpoint, normally `https://studyplanner-mcp.ben-tischberger.workers.dev/mcp` (or `/sse` for older clients). The Worker calls the existing StudyPlanner AI HTTPS endpoints.

It does not access D1 directly and does not store or accept StudyPlanner passwords, browser session tokens, OpenAI keys, or Anthropic API keys.

## Development

```bash
npm run test
npm run build
```

## Deploy

```bash
npm run db:verify-config          # from repo root, before Cloudflare deploys
cd integrations/studyplanner-mcp
npx wrangler deploy
```

Use an existing StudyPlanner Cloudflare domain/subdomain for the Worker route if available. Otherwise the generated `*.workers.dev` URL is fine for the first version.
