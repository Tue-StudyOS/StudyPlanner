# StudyPlanner MCP Worker

Hosted, stateless MCP adapter for the public StudyPlanner AI catalog facade.

The adapter exposes read-only public catalog tools only:

- `studyplanner_search_courses`
- `studyplanner_resolve_course`
- `studyplanner_get_course_detail`

External agents should use the public Pages gateway:

```text
https://studyplaner.pages.dev/mcp
```

Older clients that ask for an SSE discovery endpoint can try:

```text
https://studyplaner.pages.dev/sse
```

The deployed MCP Worker reaches the StudyPlanner AI facade through the `STUDYPLANNER_API` **service binding** (see `wrangler.toml`). The public `STUDYPLANNER_AI_BASE_URL` fallback is `https://studyplaner.pages.dev` so integration metadata does not expose account-specific `workers.dev` subdomains. The Worker does not access D1 directly.

## ChatGPT App preparation

The MCP descriptors include the OpenAI Apps metadata needed for ChatGPT App testing:

- `_meta["openai/outputTemplate"]` points to `ui://studyplanner/catalog-results.html`.
- `resources/list` and `resources/read` expose that HTML component as `text/html+skybridge`.
- Tool results include `structuredContent` for the component and text content for normal MCP clients.
- A direct preview route is available at `https://studyplaner.pages.dev/app/catalog-results.html`.

To test in ChatGPT developer mode, connect the MCP endpoint above. No StudyPlanner user token or API key is required because the app is public catalog read-only.

It does not access D1 directly and does not store or accept StudyPlanner passwords, browser session tokens, OpenAI keys, or Anthropic API keys.

## Claude setup

If Claude supports remote MCP/connectors directly, add:

```text
Name: StudyPlanner
URL: https://studyplaner.pages.dev/mcp
Authentication: None
```

For Claude Desktop clients that need a local bridge, add this to `claude_desktop_config.json` and restart Claude Desktop:

```json
{
  "mcpServers": {
    "studyplanner": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://studyplaner.pages.dev/mcp"
      ]
    }
  }
}
```

Test prompt:

```text
Nutze StudyPlanner und suche Kurse zu Machine Learning.
```

## Development

```bash
npm run test
npm run build
```

Local gateway smoke test with the repo root instructions:

```bash
# terminal 1: backend at http://localhost:8787
cd ../../backend
npx wrangler dev

# terminal 2: MCP at http://localhost:8788
cd ../integrations/studyplanner-mcp
npx wrangler dev --port 8788

# terminal 3: Pages gateway at http://localhost:8789
cd ../../frontend
npm run build
npx wrangler pages dev dist --port 8789
```

Then verify:

```bash
curl -X POST http://localhost:8789/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Deploy

```bash
npm run db:verify-config          # from repo root, before Cloudflare deploys
cd integrations/studyplanner-mcp
npx wrangler deploy
```

Deploy the frontend Pages project after the MCP Worker so the public gateway can bind to it:

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name studyplaner
```
