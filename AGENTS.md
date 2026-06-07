# AGENTS.md

Project-wide instructions for AI coding agents.

## Core principles

- Simple solution first: prefer the smallest clear change that solves the problem.
- Do not over-engineer. Add abstractions only when they remove real duplication or complexity.
- Keep changes focused, reviewable, and easy to revert.
- Prefer readability over cleverness.
- Keep feature files lean; split components, hooks, or utilities before a file becomes hard to scan.
- Follow existing project patterns before introducing new ones.
- Ask before adding new production dependencies.
- Never commit secrets, tokens, passwords, private keys, or generated credentials.

## Coding conventions

- Use English for all code, comments, variable names, function names, class names, commit messages, and documentation.
- All functions must have explicit types:
  - Python: type hints for parameters and return values.
- Prefer clear names over short names.
- Comments must explain why something exists, not repeat what the code already says.
- Keep functions small and single-purpose.
- Prefer pure functions where practical.
- Validate external input at boundaries.
- Handle errors explicitly; do not hide failures.

## Frontend compatibility

Every new frontend feature must work on both phone and desktop.

- No horizontal overflow, clipped cards, cut-off modals, or unreachable buttons on any viewport.
- Use `w-full`, `max-w-full`, `min-w-0` on containers; avoid fixed widths without a paired `max-w-*`.
- Long German labels, long course names, and user-facing strings must wrap or truncate safely at narrow widths (320px–375px).
- Prefer `flex-wrap` and responsive grid patterns over fixed-column layouts.
- Sticky and modal elements must account for mobile browser chrome and safe-area insets.
- Check at minimum: 320px, 375px, 768px, and desktop width; both light and dark mode.

## Workflow

Before changing code:
1. Read the relevant files.
2. Identify the smallest safe change.
3. Pick the relevant agent profile from `agents/main.md` if the task is specialized.
4. For each feature, bug fix or change has to be one single commit with a clear message. Dont do multiple unrelated changes in the same commit.
5. Never commit directly on `main`.
6. Always create or use a dedicated working branch, make commits there, and merge that branch back into `main`.
7. When working through a backlog or implementation file with multiple related features, use **one shared branch** for all of them. Make one commit per logical group. Merge that single branch into `main` once at the end — not one branch per feature.
8. If additional follow-up fixes are needed after review or deploy, do them on a new branch and merge again instead of adding direct commits to `main`.

After changing code:
1. Run or suggest the relevant test, lint, or typecheck command.
2. Deploy the affected frontend/backend after the change when deployment access is available. If automatic deployment is configured, verify or explicitly mention that the push/merge should trigger it. If deployment cannot be performed directly, state that clearly and document the exact deploy command or blocker.
3. Update or remove affected documentation in the same change so repo guidance stays current.
4. Summarize what changed.
5. Mention any risk, assumption, or follow-up.

## Agent profiles

Agent overview:

- `agents/main.md`

Specialized agents:

- `agents/system-architect.md`
- `agents/backend-architect.md`
- `agents/frontend-architect.md`
- `agents/security-engineer.md`
- `agents/performance-engineer.md`
- `agents/deep-research-agent.md`

Use the specialized agent profile when the task clearly matches it.