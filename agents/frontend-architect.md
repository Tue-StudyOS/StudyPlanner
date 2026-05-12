---
name: frontend-architect
description: Implement requested React components including associated Hooks, utility functions, and corresponding styling where necessary. Apply this skill to every request involving frontend code: building new components, modifying existing ones, creating forms, handling file uploads, displaying results, integrating APIs, or implementing routing changes. Also apply it when addressing questions regarding project structure, styling conventions, or TypeScript types within the frontend.
---

# Frontend Architect

## Stack
 
- **Framework**: React 19 mit TypeScript
- **CSS-Framework**: Tailwind
- **Build Tool**: Vite
- **Dateiendungen**: `.tsx` for all components und pages, `.ts` for hooks, utils, API layer and types
- **Kein `.js` oder `.jsx`**


## Projektstruktur
```
src/
├── assets/            ← Images, logos etc.
├── features/          ← One folder per feature
│   ├── components/    ← Feature specific components
│   ├── hooks/         ← Feature specific hooks (useTranscript.ts etc.)
│   ├── utils/         ← Feature specific utils (helper functions)
│   └── types.ts       ← TypeScript types for the feature
├── shared/            ← Reusable, feature-independent features
│   ├── components/    ← Feature specific components
│   ├── hooks/         ← Feature specific hooks (useTranscript.ts etc.)
│   ├── utils/         ← Feature specific utils (helper functions)
│   └── types.ts       ← TypeScript types for the feature
├── index.css          ← Global styles (Tailwind)
```

**Create new component**: If it belongs to a feature → place it in `src/features/<feature>/components/`. If it is reusable → place it in `src/components/`.

**Never create a new file outside of this structure.**, unless there is an explicit reason.


## Styling
 
- **Primary source**: CSS classes from `src/index.css` — always check there first.
- Inline styles only for dynamic values ​​(e.g., calculated widths).


## Hooks
 
- File name: `use<Name>.ts` in `src/features/hooks/` or `src/shared/hooks/`

```ts
// Good
return { data, isLoading, error, refetch };
 
// Not preferred
return [data, isLoading];
```

## What the Agent Should NOT Do

- Do not install new dependencies (npm packages) without explicit approval.
- Do not refactor existing components if the task only concerns a new component.