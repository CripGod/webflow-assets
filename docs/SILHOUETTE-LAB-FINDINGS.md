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

---

# Addendum (v66): Layered Skin — the assembly architecture

The single-shell test proved the limitation; the follow-up direction was to
stop forcing every design through inward repeats of one silhouette and add a
second, curated rendering mode. Implemented in the lab as **Layered Skin**:

- `renderMaterialPath()` (`src/generator/skins.ts`) — the reusable material
  treatment: gradient body, inner bevel strokes, finish-specific gloss band
  and specular, all clipped to the part. Metal / gloss / matte finishes.
- `renderSkinRecipe()` — pure `(recipe, state, size) → SVG`:
  hull shadow → hull extrusion → parts by zIndex → label. The one-path
  importer hull keeps its jobs: footprint, hit area, shadow mask, extrusion
  body, maximum clipping boundary.
- `ButtonSkinRecipe` (`src/generator/skinRecipes.ts`) — pure data: authored
  part paths in the same 0 0 200 100 space, material roles
  (face / frame / metal / plastic / accent), zIndex, per-part depth and
  bevel, `mirrorX` (author left, mirror right), per-part gloss depth,
  safeArea, stretch caps. No shape-specific components anywhere.
- Cap-preserving stretch runs EVERY part through the same piecewise x-map —
  verified byte-identical left-grip geometry at 2:1 vs 4:1.

**Proof pair** (per the recommendation, opposites first):

- *Twin Grip*: hull + independent center face + one grip path mirrored +
  one gold clamp path mirrored — 4 material roles. Reads as the reference's
  drum-grips-with-clamps assembly; the face is 36% of hull width (measured),
  not an inset clone.
- *Prize Bow*: rear ribbon (mirrored) → gold frame → face plate → knot
  jewel — the front/behind ordering test. The bow read comes from parts
  behind a smooth plate, exactly what one outline could never do.

Two product modes now coexist in the lab: **Simple Shell** (v64 — automatic,
any imported path) and **Layered Skin** (curated recipes, reference-grade).
The remaining six designs need only new recipe entries. Production remains
untouched; everything lives behind `?lab=silhouettes`.

---

# Addendum (v67): Layered Skin refinement — per-part finish & toy proportions

The first Layered Skin proof was structurally correct but read too clean, too
planar and too uniform: every part shared one gloss/specular response, the
face plates were generic rounded rects, and the overlaps were too polite. This
pass keeps the architecture untouched and refines only the renderer's material
language and the two recipes. No new modes, no shape-specific JSX.

## Renderer: per-part finish control (`resolveFinish` in `skins.ts`)

Every part now resolves an independent finish over house defaults:

- **`finish`** — `plastic | metal | glass | matte`, per material with per-part
  override. Each has its own gradient build; metal on a tall part becomes a
  **cylinder** (horizontal axis, off-center bright core, dark edge returns).
- **`bevelProfile`** — bevel *character*, not just amount: `soft-pill`
  (rolled toy edges), `hard-frame` (crisp inset ring — sockets, recesses),
  `metal-ridge` (machined bright ridge inside a dark return).
- **`glossStrength` / `glossFrac` / `glossDip`** — the gloss band is now a
  vertical white fade with a per-part waterline and belly; staggering these
  killed the shared-waterline flattening.
- **`specularMode`** — `dot` (double lens blob), `streak` (diagonal highlight
  run), `arc` (contour-following top highlight, used on the bow loops),
  `none`; plus **`highlightBias`** to place the event per part.
- **`edgeDarkening`** (ambient-occlusion rim), **`saturationBoost`** (lower
  body candy depth), **`bounce`** (bottom bounce light).
- **`shadowDensity`** — a local blurred **contact shadow** the part casts on
  whatever is behind it. This is the single strongest depth lever: clamps now
  visibly sit ON drums and face, the frame sits ON the ribbons.

Mirrored copies re-map the *authored left* geometry through the mirror
(`mk = map ∘ mirror`), so gloss and specular mirror with the part — matching
how toy art lights symmetric assemblies.

One generic correctness fix: the label band is now mapped through the same
piecewise x-map as the geometry, so type respects the compressed center band
under cap-preserving stretch (it used to scale linearly and could spill onto
rigid caps at wide/narrow aspects).

## Recipes: exaggerated toy construction

- *Twin Grip*: drums re-authored to FILL the hull's double-lobe caps minus a
  2.5u margin (the silhouette's lobes now read as drum volume, not chassis);
  a matte navy **socket** part recesses the center; the face is **pillowed**
  (every edge bows 1–2u) and brighter than the drums; the gold clamps are
  chunky sharp-notched cylinder bands overlapping drum AND face by 10u+ each
  side, casting contact shadows both ways.
- *Prize Bow*: the rear ribbon is a real bow now — upper/lower loops with a
  soft fold notch pinching to 30u at mid-height, hull lobes carrying the tail
  read; arc specular traces the upper loop; the face is puffed and glassy;
  the thicker gold frame (metal-ridge) overlaps the ribbons by ~24u and casts
  onto them; the knot jewel is a deliberate gold knob seated on the frame's
  top band, tangent inside the hull.

## Verification

`tsc -b` clean, `vite build` clean, lab page renders with zero console
errors. States (hover lift/glow, pressed, disabled desaturation), the four
aspect ratios under cap-preserving stretch, part wireframe overlays and the
v64 single-shell comparison all render from the same recipes. Deliverable
unchanged: only the two proof cards — the remaining six designs stay gated
until this pair is approved.
