# StudyPlanner MCP Worker

Hosted, stateless MCP adapter for the public StudyPlanner AI catalog facade.

The adapter exposes read-only public catalog tools only:

- `studyplanner_search_courses`
- `studyplanner_resolve_course`
- `studyplanner_get_course_detail`

External agents call the deployed Worker endpoint, normally `https://studyplanner-mcp.ben-tischberger.workers.dev/mcp` (or `/sse` for older clients). The Worker reaches the existing StudyPlanner AI facade through the `STUDYPLANNER_API` **service binding** (see `wrangler.toml`). A direct `workers.dev` subrequest to the API worker on the same Cloudflare account returns 404, so the binding is required for `tools/call` to work; the public `STUDYPLANNER_AI_BASE_URL` is only a fallback for local dev and for building request paths.

## ChatGPT App preparation

The MCP descriptors include the OpenAI Apps metadata needed for ChatGPT App testing:

- `_meta["openai/outputTemplate"]` points to `ui://studyplanner/catalog-results.html`.
- `resources/list` and `resources/read` expose that HTML component as `text/html+skybridge`.
- Tool results include `structuredContent` for the component and text content for normal MCP clients.
- A direct preview route is available at `/app/catalog-results.html`.

To test in ChatGPT developer mode, connect the MCP endpoint above. No StudyPlanner user token or API key is required because the app is public catalog read-only.

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
