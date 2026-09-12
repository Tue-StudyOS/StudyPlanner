# Frontend source structure

- `App.tsx`: lazy-loaded routes and shared providers; / redirects to /catalog.
- `main.tsx`: React entry point.
- `features/`: feature components, hooks, API clients, types and utilities.
  Prefer each feature's index.ts public exports when importing across features.
- `shared/`: reusable components and utilities, including HTTP, API URL resolution,
  browser storage, caching and diagnostics.
- `assets/`: imported assets and local fonts.
- `index.css`: Tailwind, theme tokens and global styles.

Use the existing relative import convention; no @/ alias is configured in Vite
or TypeScript. Tests belong in frontend/tests/, outside src/. Tested modules
use explicit .ts extensions for runtime imports.

See the [frontend guide](../README.md) for commands and
[AGENTS.md](../../AGENTS.md) for coding and responsive-layout requirements.
