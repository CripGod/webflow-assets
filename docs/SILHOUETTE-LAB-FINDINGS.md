# Silhouette Feasibility Lab — Findings (v64)

Isolated dev harness at **`/?lab=silhouettes`** that renders the eight supplied
silhouettes through the production candy engine (`build()` in `bevel.ts`) with
**zero shape-specific rendering code** — the only per-shape data is the SVG
path, safe-area metadata and an engine-native material preset. Nothing in this
round touches the production silhouette picker; the `lab:` shape prefix is
reachable only from the lab page.

Per the brief's recommendation the first pass activates **Twin Grip, Slime
Surge, Cog-Lock and Monster Bite**. The other four are registered, validated,
skinned and rendered behind the "Second wave" toggle, with provisional ratings.

## The headline question: can the specular follow the silhouette?

**Yes — one mode already does.** The engine's `sweep` specular strokes an
inset copy of the *actual silhouette path* with a light-keyed gradient (only
the lit arc shows). Because imported shapes flow through the same
`shapePath()` pipeline, sweep follows their contours automatically — the lab's
Cog-Lock and Boss Crown skins use it, and the global "Specular mode" control
lets you flip any shape to it. The other five modes (soft / hard / line /
dual / anime) are light-positioned face events: they are **clipped by** the
silhouette (they can never leave the face) but their internal shape does not
trace the contour. The curved gloss behaves the same way — screen-space band,
silhouette-clipped.

## Honest feasibility ratings (measured, source units = 200×100 box)

| Shape | Rating | Measured |
|---|---|---|
| Twin Grip | **PASS** | face clean to ≈26u inset; worst crevice excursion 0.6u |
| Slime Surge | **PASS WITH PARAMETER LIMITS** | face kisses the outer past ≈2u in lobe crevices (1.6u at the default 7u); reads clean because the excursion hides under the shell + outer clip |
| Cog-Lock | **PASS** | clean to ≈26u; narrowest face feature 24u |
| Monster Bite | **NEEDS GENERIC ENGINE IMPROVEMENT** | face escapes ≈4.2u into the bite notches at the default inset — contained by the new outer clip, but notch shoulders lose their bevel wall |
| Boss Crown (w2) | **PASS WITH PARAMETER LIMITS** | clean only to ≈5u → `maxBevelRatio: 0.05` clamps it |
| Prize Bow (w2) | **PASS** | clean through the range; excursion ≤0.5u |
| Turbo Wing (w2) | **PASS WITH PARAMETER LIMITS** | clean to ≈9u → `maxBevelRatio: 0.09` |
| Gem Cluster (w2) | **PASS** | clean through the range |

The core engineering truth: **bounding-box re-scaling is not a geometric
offset.** On convex or gently-lobed outlines the difference is invisible; on
deep concavities (bite notches, crown crevices) the scaled face drifts toward
or across the outer edge. The lab measures this per shape instead of hiding it.

## Generic engine changes made (all metadata- or prefix-gated, production output byte-identical)

1. **`IMPORTED_SHAPES` registry** (`src/generator/importedShapes.ts`) + a
   `lab:` branch in `shapePath()` that feeds the paths through the existing
   `transformPath()`. No second transform implementation, no rasterizing.
2. **Metadata-driven face inset** in `build()`:
   `bwF = min(bw, h × maxBevelRatio) × faceInsetScale` — the brief's suggested
   mechanism, applied generically. Values for Boss Crown / Turbo Wing are the
   measured limits, not guesses.
3. **Outer-path clip on interior layers** for imported shapes: face, content,
   gloss and specular are clipped to the outer silhouette so an escaping inset
   can never paint outside the shell. No-op for every production shape.
4. **`transformPathCapAware()` — vector three-slice experiment**: a piecewise
   monotonic x-remap keeps both caps rigid (they scale with height only) while
   the center band stretches. One continuous outline, no seams. At 4:1 it
   keeps Twin Grip's lobes perfectly circular where uniform scaling smears
   them into blobs. Falls back to uniform scaling below ~1.6:1 where the caps
   wouldn't fit. Worth productizing.
5. **`shellPaths()` export** — the exact outer/rim/face derivation `build()`
   uses, so the lab's diagnostic overlays can never drift from the real
   render (the suite asserts the cyan overlay equals the hero's face path).
6. **Import validation + inset audit** (pure geometry, no DOM): single
   subpath, closed `Z`, command whitelist, bounds touching all four edges,
   self-intersection count, crevice-excursion depth, narrowest-feature width,
   max-clean-inset search.

## Approximations the single-shell engine imposes (visible in the lab notes)

- Face gradient derives from **one** Inner Fill hue + contrast — the brief's
  three-stop face ramps are approximated.
- Extrusion tone derives from the **Bevel role** — Twin Grip's "gold rim +
  navy extrusion" cannot both be literal without a new Extrusion color role.
- Corner softness shapes procedural silhouettes only; imported paths keep
  their authored geometry.
- Labels are sized to the mapped 60–140 safe band (these silhouettes reserve
  60u per side for ornament, so house type scale doesn't fit at 2:1 — the
  lab reports when the band, not the house scale, set the size).

## Verification

Suite `v64.mjs`: 29/29 — isolation both directions, registry-path truth,
overlay/build lockstep, 4 states, 4 aspects, caps-vs-uniform geometry, honest
warnings (Monster Bite flagged, not hidden), maxBevelRatio clamp, sweep
specular, copy-equals-canvas (clipboard vs DOM), production picker untouched.
All 13 prior suites (296 checks) still green.
