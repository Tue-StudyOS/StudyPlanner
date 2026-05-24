# AGENTS.md

Project-wide instructions for AI coding agents.

## Core principles

- Simple solution first: prefer the smallest clear change that solves the problem.
- Do not over-engineer. Add abstractions only when they remove real duplication or complexity.
- Keep changes focused, reviewable, and easy to revert.
- Prefer readability over cleverness.
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

## Workflow

Before changing code:
1. Read the relevant files.
2. Identify the smallest safe change.
3. Pick the relevant agent profile from `agents/main.md` if the task is specialized.
4. For each feature, bug fix or change has to be one single commit with a clear message. Dont do multiple unrelated changes in the same commit.

After changing code:
1. Run or suggest the relevant test, lint, or typecheck command.
2. Summarize what changed.
3. Mention any risk, assumption, or follow-up.

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