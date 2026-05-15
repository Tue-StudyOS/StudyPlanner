---
name: frontend
description: Implement React components, pages, hooks, and UI features for the transcript analysis web application. Use this skill for ANY frontend task: building new components, editing existing ones, forms, file uploads, result displays, routing, or TypeScript types. Also use when the user asks about folder structure, styling conventions, or where to put a new file. This skill enforces the agreed project structure, TypeScript conventions, and React best practices — always consult it before writing any frontend code.
---

# Frontend Agent — Transcript Analysis App

This skill governs all frontend development for the project. It encodes the agreed architecture, folder conventions, and React best practices. Read it fully before writing any `.tsx` or `.ts` file.

---

## Workflow — Required for Every Task

Before writing any code, and after finishing, follow this two-step workflow:

### Step 1: Create a plan (before writing code)

At the start of every task, present a short numbered plan of what will be done — which files will be created or edited, in what order, and why. Wait for confirmation before proceeding.

Example plan format:
```
📋 Plan for: "Add a profile page"

1. Create `src/features/auth/components/ProfilePage.tsx` — page component
2. Create `src/features/auth/hooks/useProfile.ts` — state & logic
3. Add `ProfilePage` export to `src/features/auth/index.ts`
4. Register route `/profile` in `src/App.tsx`

Anything to adjust before I start?
```

### Step 2: Write a summary (after finishing)

After all files are written, provide a brief summary of everything that was done:

Example summary format:
```
✅ Summary

Created:
- `src/features/auth/components/ProfilePage.tsx` — displays user name and upload count
- `src/features/auth/hooks/useProfile.ts` — fetches profile data with loading state

Modified:
- `src/features/auth/index.ts` — added ProfilePage export
- `src/App.tsx` — added /profile route

The profile page is now accessible at /profile for logged-in users.
```

---

## Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vite | latest | Build tool & dev server |
| React | 18+ | UI framework |
| TypeScript | 5+ | All files use `.tsx` (JSX) or `.ts` (no JSX) — never `.js` or `.jsx` |
| Tailwind CSS | v4 | Styling via utility classes — no separate `.css` files per component |
| react-router-dom | v6+ | Client-side routing |

---

## Folder Structure

```
src/
├── features/          ← one folder per app feature
│   ├── auth/
│   │   ├── components/    .tsx files — UI only
│   │   ├── hooks/         .ts files  — logic & state
│   │   ├── types.ts       TypeScript interfaces for this feature
│   │   └── index.ts       public interface — ONLY file others import from
│   └── transcript/
│       ├── components/
│       ├── hooks/
│       ├── types.ts
│       └── index.ts
├── shared/            ← reusable across features, no business logic
│   ├── components/    Button, Modal, Spinner, Input …
│   ├── hooks/         useDebounce, useWindowSize …
│   └── utils/         formatDate …
├── config/            routes, constants, env helpers
├── App.tsx            root component, routing setup
├── main.tsx           entry point — rarely edited
└── index.css          Tailwind import + CSS theme variables only
```

---

## Non-Negotiable Rules

### 1. File extensions
- `.tsx` — any file containing JSX (components, pages)
- `.ts` — hooks, types, utils, config
- Never create `.js` or `.jsx` files

### 2. The index.ts boundary
Every feature exports **only** through its `index.ts`. No other file in the codebase imports directly from inside a feature folder.

When adding a new export from a feature, always add it to `index.ts`.

### 3. Layer separation inside a feature
Each layer has exactly one job — never mix them:

| Layer | File | Does | Does NOT |
|-------|------|------|----------|
| UI | `components/*.tsx` | render, handle events | contain business logic or state beyond local UI state |
| Logic | `hooks/*.ts` | state, side effects, business logic | render JSX |
| Types | `types.ts` | interfaces & types | logic of any kind |

### 4. Styling with Tailwind only
No `.css` files per component. All styles are Tailwind utility classes in the JSX. The only CSS file is `src/index.css`.

```tsx
// ✅ Correct
<button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
  Upload
</button>

// ❌ Wrong — no separate CSS file
import './Button.css'
```

---

## Component Checklist

Before finishing any new component, verify:

- [ ] File uses `.tsx` extension with a named export
- [ ] Props are typed with an explicit `type` or `interface` — no `any`
- [ ] No business logic in the component — that goes in a hook
- [ ] Component is in the right folder (`features/<name>/components/` or `shared/components/`)
- [ ] If it's a new public export, it's added to the feature's `index.ts`
- [ ] Styling uses only Tailwind classes

---

## Hook Checklist

Before finishing any new hook:

- [ ] File uses `.ts` extension (no JSX in hooks)
- [ ] File name starts with `use` (e.g. `useTranscript.ts`)
- [ ] Returns a typed object — no implicit `any`
- [ ] Lives in `features/<name>/hooks/` or `shared/hooks/`

---

## TypeScript Conventions

```ts
// ✅ Named interface for all data shapes
interface Course {
  id: number
  courseName: string
  ects: number
  grade: number
  topic: string
  assignedAt: string
}

// ✅ Explicit return types on hooks
function useTranscript(): { courses: Course[]; loading: boolean }

// ❌ Never use any
const data: any = ...

// ❌ Never use non-null assertion without a comment explaining why
const el = document.getElementById('root')!
```

---

## Routing

Routes are defined in `src/config/routes.ts` and registered in `App.tsx` using `react-router-dom`. Protected routes use the `ProtectedRoute` component from `features/auth`.

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/features/auth'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}
```

---

## Where to Put a New File — Decision Tree

```
Is it used in only one feature?
  └─ YES → goes inside that feature folder
       Is it JSX?          → features/<name>/components/
       Is it logic/state?  → features/<name>/hooks/
       Is it a type?       → features/<name>/types.ts

  └─ NO (used in 2+ features) → goes in shared/
       Is it a component?  → shared/components/
       Is it a hook?       → shared/hooks/
       Is it a helper fn?  → shared/utils/
```

When in doubt: start in the feature. Move to `shared/` only when a second feature actually needs it.

---

## CSS Theme

Global design tokens are defined in `src/index.css` using Tailwind's `@theme` block. Add new color or spacing tokens here — never as hardcoded values in components.

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-primary:   #3B82F6;
  --color-secondary: #8B5CF6;
  --color-danger:    #EF4444;
  --font-sans: 'Inter', sans-serif;
}
```

---

## Common Pitfalls to Avoid

| Pitfall | Why it's wrong | Correct approach |
|---------|---------------|-----------------|
| Importing directly from inside a feature | Breaks encapsulation | Import from `index.ts` only |
| Business logic inside a component | Mixes UI and logic layers | Move to a hook |
| `.js` or `.jsx` file extension | Project uses TypeScript everywhere | Always `.ts` or `.tsx` |
| Separate `.css` file for a component | Inconsistent with Tailwind approach | Use Tailwind classes in JSX |
| `any` type | Defeats TypeScript | Define an interface |
| Starting to code without a plan | Hard to review, easy to miss files | Always write the plan first |
