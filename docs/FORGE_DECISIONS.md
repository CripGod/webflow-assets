# FORGE — Implementation Decisions & Deviation Report

Reference viewport: **1672 × 941**, DPR 1. Validation via Playwright against the
approved reference image + the written design lock. Where the written spec and
the image disagree, **the written spec wins** (per the design-lock preamble).

## Architecture decisions

- **Single canonical model** (`src/model`) → **pure resolver** (`src/resolver/resolveStyle.ts`)
  → consumed by the React canvas renderer (`src/render/HeroButton.tsx`) **and** the
  HTML export/preview (`src/export/toHtml.ts`). Canvas, HTML preview, state preview,
  and export cannot diverge — they call the same resolver.
- **Real semantic HTML + CSS** for the component (`<button>` + layered `<span>`s).
  No image renderer, no SVG-string renderer. SVG/PNG are *derived* exports (planned).
- **State store**: Zustand, one store, tracks doc vs. saved doc for unsaved-change
  protection. States authored as deltas.
- **Icons**: Lucide (locked). **Type**: Inter Variable, self-hosted via Fontsource
  (`@fontsource-variable/inter`) — no system-font substitution.
- **Libraries**: React, Zustand, Lucide, Fontsource only. No competing UI kits at
  runtime; editor controls are native elements styled to the lock.
- Legacy `README.md`, `pb-internal.js`, `pb-particles.js`, `pb-picker.js` are
  untouched and excluded from the build.

## Verified exact (measured in-browser at 1672×941)

Top bar 64px · icon rail 58px · settings panel 340px · help bar 176px ·
hero 860×214 · radius 107 · canvas bg #F8F9FB · Inter Variable active ·
lighting defaults 315°/48%/36%/24% · material 62/18/107/12 · no JS errors · no 404s.

## Deviation report (§15)

### Geometry
- Hero centered at 56% of usable canvas height (cy≈472) — matches spec. ✔
- Responsive width uses `clamp(680px, 71.97vw, 860px)`; at 1672 → 860 (exact). At
  1280 the spec text is internally inconsistent (72% of usable ≈ 628–636 vs. the
  stated "710–740"); current formula floors at 680. **Open:** confirm the intended
  1280 width so I can pin the clamp.

### Typography
- Hero label char counter shows **12/32** for "Launch Forge" (actual length incl.
  space). Reference image showed 11/32. Using true length. Minor.

### Color / Material
- **Radius control shows 107px**, the reference *image* panel showed 22px. §11
  mandates a 107px pill, and spec overrides image → 107 is correct. Reported as an
  image/spec conflict, resolved toward spec.

### Interaction (states)
- States are implemented as **deltas over Default**, not the *chained* inheritance
  the spec describes (Hover←Default, Pressed←Hover, Disabled←Pressed). Visual result
  is close and each state is distinct; Disabled does not currently inherit Pressed's
  +3px translate. **Planned:** switch to true seeded inheritance so authored edits
  in one state flow into the next.
- Hover/Pressed/Disabled currently render on state-selector change (design
  inspection). Real interactive hover/press behavior is gated behind an explicit
  Interactive Preview (not yet built), per §13.

### Not yet implemented (next milestones, gated on approval)
- HTML Preview currently renders the generated markup as a code view; a *live*
  rendered HTML preview (with injected Lucide SVG) + SVG/PNG export + export-parity
  tests are M5.
- Section collapse chevrons are visual only (no collapse yet).
- Light-direction dial affects the top-highlight angle only; full directional
  re-lighting of every layer is partial.
- Build Kit phase not started (gated on Master approval, per directive).
- `docs/FORGE_PRODUCT_SPEC.md`, `FORGE_IMPLEMENTATION_CHECKLIST.md`, and
  `docs/reference/forge-master-component-editor.png` did not exist in the repo; the
  pasted image + this lock are the source. Ask if you want these authored to disk.

## Milestone status
- M0 Foundations ✔ · M1 Model+resolver+hero ✔ · M2 Shell (visual lock) ✔ ·
  M3 Control sections ✔ · M4 State system ✔ (delta form) ·
  M5 Export parity ▢ · M6 Registry/adapters ▢ · M7 Build Kit ▢ (gated) · M8 Tests ▢
