# Run FORGE locally

This archive is the FORGE Component Kit Builder (Vite + React + TypeScript).
The unrelated legacy files (`README.md`, `pb-*.js`) are untouched and not part
of the app.

## Quick start

```bash
npm install
npm run dev
```

Then open the printed URL (defaults to http://localhost:5175/).

For the intended visual, view at the reference viewport **1672 × 941**, 100% zoom.

## Scripts
- `npm run dev` — start the dev server (hot reload)
- `npm run build` — typecheck + production build to `dist/`
- `npm run preview` — serve the production build
- `npm run typecheck` — TypeScript only

## What you're looking at
- Flat, quiet application shell (top bar, icon rail, settings panel, ruler/grid
  canvas, floating toolbar, auto-collapsing help bar).
- The **hero** ("FORGE CARBON MATTE") is real semantic HTML+CSS rendered from one
  canonical model (`src/model` → `src/resolver` → `src/render`/`src/export`).
- Top-bar **State** selector switches Default / Hover / Pressed / Disabled.
- **Design / HTML Preview** toggle shows the generated markup from the same model.

Node 18+ recommended (built and validated on Node 22).
