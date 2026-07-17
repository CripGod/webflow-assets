# FrameKit — the assembler architecture (roadmap)

Direction locked per advisor guidance: **the AI never draws vectors; it only
assembles approved parts through a closed schema.** A deterministic renderer
guarantees the artwork; strict schemas guarantee the recipe.

```
User request → constrained UI recipe (enums only) → schema validation
            → deterministic FrameKit renderer
            → approved SVG assets + procedural shapes + Lucide icons
            → finished HTML/SVG interface
```

## Where we already comply
The current Bevel engine **is** layer 1+2 of FrameKit:
- Shape primitives are hand-written functions (`chamferedRect`, `capsule`,
  `sharpOctagon`, `roundedRect`) taking safe numeric params. No freeform paths.
- Material recipes (face / bevel band / sheen / hard highlight / noise /
  glow / shadow) are code that interprets tokens — gradient stops and filters
  are never invented per-render.
- Icons come exclusively from the Lucide library.
- The config is a closed TypeScript model; exports/copy/canvas share one
  renderer.

## To build (in order)
1. **Shape primitive expansion** — notchedRect, ticketRect, trapezoid,
   hexPanel, tombstone, ribbon, scroll, paperCard, steppedPixelPanel,
   speechBubble. Each: pure function, few safe params.
2. **3-slice / 9-slice renderer** — `capInsets`, `edgeMode`
   (stretch/repeat/round), `contentInsets`, minimum sizes; CSS
   `border-image-slice` for HTML output, `<symbol>/<use>` composition for SVG.
   3-slice for buttons/bars/banners; 9-slice for panels/modals/cards.
3. **Curated skin library** — authored frame SVGs (torn paper, stone, ornate
   metal, storybook, tombstone, wood) each with a JSON frame definition
   (id, source, capInsets, edgeMode, min sizes, contentInsets, ornamentSlots).
   Ornaments NEVER live in stretchable regions.
4. **Ornament library** — wax-seal, rivet, skull, chain-link, bookmark, etc.
   Fixed SVGs with allowed color tokens, scale bounds, approved slots.
5. **Frame Foundry** — internal deterministic authoring tool exporting
   frame.svg + frame-definition.json + previews + per-state json.
6. **Strict recipe schema** — enum FrameIds/OrnamentIds,
   `additionalProperties: false`; if driven via the Claude API, strict tool
   mode enforces it. `assetNeeded` escape hatch instead of improvisation.

## Style families → renderer strategy
- Fully procedural: Arcade Combat HUD, Glossy Casual (current engine),
  Low-Poly 8-Bit (steppedPixelPanel).
- Hybrid: Handmade Paper, Storybook Toybox (procedural base + curated
  seals/tabs/bindings).
- Mostly curated: Gothic Industrial, Theatrical Dark Fantasy — approved panel
  families with size variants (small-square / medium-portrait /
  medium-landscape / large-landscape), never infinite stretching.

## Non-negotiables (already in force for this codebase)
- No freeform SVG path data for decorative artwork — primitives, frame IDs,
  ornament IDs, material recipes only.
- Layout, text, hierarchy, spacing, states, token selection: allowed.
- Unknown asset → closest supported primitive or `assetNeeded`; never
  improvised vectors.
- Every recipe passes schema validation before render.
