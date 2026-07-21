# Run The UI Generator locally

```bash
npm install
npm run dev
```

Open the printed URL (http://localhost:5175/). Best at a wide window (~1672px).

## What works (all of it)
- **Style preset** (a collection: surface + bevel + lighting + effect colors) —
  Arcane, Ember, Tide, Verdant Bevel.
- **Effect colors (component only)** — Bevel / Glow / Highlight / Shadow /
  Inner Fill chips; click any chip to edit, +/− to add/remove. Component-only,
  never the shell.
- **Surface** — Light/Dark face mode (visible in the header row) + Finish sheen.
- **Bevel** — width, depth, edge softness (open by default).
- **Lighting** — draggable angle dial + numeric °, highlight, shadow, and
  “Add light” (rim → edge glow, fill → softer ambient), each removable.
- **Color Mapping** — live strip + per-role mapping list.
- **Content** — label, icon placement (left/right/none), current icon.
- **States** — visibility checkboxes; States dropdown in the top bar (4/3/2/1).
- **Randomize** — new effect-color treatment + lighting nudge.
- **Icon search** — the full Lucide set, searchable; click to apply; “Explore
  the full icon set ↗” opens the library.
- **Canvas** — Default hero + right-side stacked Hover/Pressed/Disabled cards;
  pan, zoom, dotted-grid toggle.
- **Design ↔ HTML Preview** — code view shows the exact SVG the canvas renders.
- **⋯ menu** — Export SVG / PNG 2× / Copy code / Reset. Autosave to localStorage.

One `(config, state) → SVG` renderer drives the canvas, code view, and exports.

Node 18+ (built on Node 22).
