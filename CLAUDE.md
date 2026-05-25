# CLAUDE.md

Claude Code project instructions.

Read and follow the shared agent instructions:

@AGENTS.md

Read the agent overview when a task needs specialized expertise:

@agents/main.md

## Claude Code rules

- Use Plan Mode for larger or risky changes.
- Prefer the smallest correct solution.
- Explain which specialized agent profile is relevant when using one.
- Do not add production dependencies without asking.
- Do not run destructive git commands unless explicitly requested.
- Keep changes small and reviewable.
- For backlog or multi-feature tasks: one shared branch, one commit per group, merge once into main. See AGENTS.md → Workflow rule 7.

## Code Review

When asked to review code, act as a senior React developer and check:
- Dead code and duplication
- TypeScript correctness and type safety
- React best practices (hooks, state, props, component responsibilities)
- Naming conventions (PascalCase for components, camelCase for functions/variables)
- Inline styles and magic numbers
- Component structure and separation of concerns
- Unnecessary prop-drilling

Deliver a prioritized list: file, issue, and why it matters.

## Design

- The app must visually match `StudyOS.html` exactly — always use its colors, typography, spacing, and component styles as the reference.
- Before implementing any UI, read `StudyOS.html` to extract the relevant styles.
- Do not invent new styles; replicate what is in `StudyOS.html`.
- Use Tailwind classes whenever its possible.