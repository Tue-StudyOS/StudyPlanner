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

## Responsive rules

Every new feature must work on phone and desktop. These rules are non-negotiable.

**Forbidden — never introduce:**
- Horizontal overflow or viewport-breaking scroll
- Clipped cards, images, or boxes that hide content
- Modals or drawers that exceed viewport height or width without scroll
- Buttons or interactive elements that are partially hidden or unreachable

**Implementation checks:**
- Containers: prefer `w-full`, `max-w-full`, `min-w-0`; never use a fixed width without a paired `max-w-*`
- Text: long German labels, long course names, and email strings must wrap or truncate safely at 320px
- Grids: prefer `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` over fixed-column layouts
- Flex rows: add `flex-wrap` unless items are guaranteed to fit; never rely on content fitting at a fixed width
- Sticky headers, bottom bars, drawers, and modals: account for mobile browser chrome and `safe-area-inset-*`
- Inline width values are only acceptable for animations or JS-calculated dimensions

**Viewport checks before finishing any feature:**
- Minimum widths to verify: 320px, 375px, 768px, 1024px, desktop
- Both light and dark mode
- With long German text and long course names

## What the Agent Should NOT Do

- Do not install new dependencies (npm packages) without explicit approval.
- Do not refactor existing components if the task only concerns a new component.