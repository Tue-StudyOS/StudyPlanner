# StudyPlanner MCP Worker

Hosted, stateless MCP adapter for the public StudyPlanner AI catalog facade.

First version exposes read-only public catalog tools only:

- `studyplanner_search_courses`
- `studyplanner_get_course_detail`

It does not access D1 directly and does not store or accept OpenAI/Anthropic API keys. External agents call this Worker, and the Worker calls the existing StudyPlanner AI HTTPS endpoints.

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
