/* ── Compound Vector Assets — baked construction, live skin ────────────────
   A compound asset is the lab's answer to "authored detail without one-off
   illustrations": the ASSET bakes the geometry that makes something look
   professionally drawn — loop shapes, tail direction, fold locations,
   cavity openings, crease geometry, authored highlight masks, layer
   overlap — while every visual decision stays live and generator-driven:
   base color, secondary/fold color, pattern (type, scale, angle,
   placement), finish, gloss strength, fold contrast, edge color, states.

   Three cleanly separated concerns:
     · Asset definition (this file's data)  — geometry + semantic masks
     · Skin configuration (CompoundSkin)    — colors, pattern, finish, state
     · Recipe (skinRecipes.ts)              — how the asset combines with
                                              faces, frames and other parts

   v69 alignment contract:
     · `footprint` is the EXACT authored union outline of the physical
       material layers — not a generalized blob. Its outer segments reuse
       the material layers' own curve segments, so the validator can hold
       it to ≤1u of unexplained excess.
     · Physical material layers extrude individually (depthMode
       "per-material-layer"); overlays, cavities, highlights and patterns
       never extrude.
     · One palette resolver (resolveCompoundSkin) feeds surfaces, folds,
       cavities, edges AND extrusion — a recolored ribbon recolors its
       depth with it.
     · `anchors` + `attachmentZone` are baked metadata: where the center
       assembly attaches and where hidden overlap is intentional (the
       validator excuses that zone instead of counting it as excess).
     · Layers carry a zSlot — rear/body render at the containing part's
       zIndex, `front` layers (the gathering wrap) render at the part's
       `frontZIndex`, so a ribbon can put loops behind the frame and its
       collar in front, all through data. */

import { darken } from "./model";
import { flattenPath, bounds } from "./importedShapes";
import { transformPathCapAware } from "./bevel";
import type { Pt } from "./importedShapes";

export type CompoundSlot =
  | "base"       // primary material surface (receives gradient + bevel)
  | "fold"       // soft dark creases where the form gathers
  | "cavity"     // deep interior openings (loop holes)
  | "highlight"  // authored gloss masks (replace procedural specular)
  | "crease"     // thin bright accent slivers
  | "edge";      // reserved: explicit edge geometry (default is procedural)

export type CompoundZSlot = "rear" | "body" | "front";
export type CompoundDepthMode = "footprint" | "per-material-layer";

/** Per-layer material character — generic compound-layer data, never
 *  asset-specific conditionals. `soft-pill` is the inflated house default;
 *  `flat-satin` reads flatter (thin bevel, damped veil) for hanging tails;
 *  `cylinder` runs a horizontal rolled gradient for vertical collars. */
export type LayerProfile = "soft-pill" | "flat-satin" | "cylinder";

export interface CompoundLayer {
  id: string;
  /** Absolute-coordinate path, recipe space, M L C Q Z only. */
  path: string;
  kind: "material" | "overlay" | "detail";
  slot: CompoundSlot;
  /** rear/body paint at the part's zIndex; front paints at frontZIndex. */
  zSlot?: CompoundZSlot;
  /** Clip this layer inside another layer's geometry (by layer id) so
   *  shading can never escape its surface. */
  clipTo?: string;
  /** Marks a material layer as a fabric surface the pattern may fill. */
  patternSurface?: boolean;
  /** Local soft shadow this layer casts on whatever is behind it (0..1) —
   *  the collar seats on the frame, the loop seats on the tail. */
  castShadow?: number;
  opacity?: number;
  /** Material character for this layer (material kind only). */
  profile?: LayerProfile;
  /** Multiplies the part bevel for this layer (default 1). */
  bevelScale?: number;
  /** Multiplies the part extrusion depth for this layer (default 1). */
  depthScale?: number;
  /** Multiplies veil/bevel-light strength for this layer (default 1). */
  glossScale?: number;
}

export interface CompoundVectorAsset {
  id: string;
  name: string;
  viewBox: [number, number, number, number];
  /** EXACT union outline of the physical material layers — contact shadow,
   *  wireframe footprint, validator ground truth. Never extruded when
   *  depthMode is "per-material-layer". */
  footprint: string;
  depthMode: CompoundDepthMode;
  /** Painted in array order (rear → front) within each zSlot pass. */
  layers: CompoundLayer[];
  /** Baked attachment metadata — never user-facing sliders. */
  anchors: {
    innerAttachment: { x: number; y: number };
    opticalCenter: { x: number; y: number };
  };
  /** Region where hidden overlap under the center assembly is intentional;
   *  the validator excuses footprint excess inside it. */
  attachmentZone: { x: number; y: number; width: number; height: number };
  /** Which knobs the generator should surface for this asset. */
  exposedControls: {
    baseColor: boolean; secondaryColor: boolean; pattern: boolean;
    finish: boolean; gloss: boolean; contrast: boolean;
  };
}

/* ── live skin configuration ──────────────────────────────────────────── */

export type PatternType = "none" | "stripes" | "dots" | "stars" | "scales";

export interface PatternSpec {
  type: PatternType;
  color: string;
  /** 0..1 */
  opacity: number;
  /** 10..100, tile size multiplier (50 ≈ house scale). */
  scale: number;
  /** degrees */
  angle: number;
  /** `continuous` flows one composition across the whole button;
   *  `mirrored` reflects the motif on the mirrored copy so directional
   *  patterns stay clean on both sides. */
  placement: "continuous" | "mirrored";
}

export interface CompoundSkin {
  /** Base surface colors; defaults to the part's bound material role. */
  primary?: { light: string; base: string; dark: string };
  /** Fold color; defaults to a deepened primary. */
  secondary?: string;
  finish?: "plastic" | "metal" | "glass" | "matte";
  /** Multiplies authored highlight mask opacity (0..1, default 1). */
  glossStrength?: number;
  /** Multiplies fold + cavity density (0..2, default 1). */
  contrast?: number;
  /** Edge stroke override; defaults to a deepened primary dark. */
  edge?: string;
  pattern?: PatternSpec;
}

/** The ONE place compound colors are derived. Everything downstream —
 *  surfaces, outlines, per-layer extrusion, depth edges, bounce, contact
 *  tint — reads from this, so a live recolor recolors ALL of it. */
export interface ResolvedCompoundPalette {
  primaryLight: string;
  primaryBase: string;
  primaryDark: string;
  fold: string;
  cavity: string;
  edge: string;
  extrusionLight: string;
  extrusionDark: string;
}

export function resolveCompoundSkin(
  skin: CompoundSkin,
  fallback: { light: string; base: string; dark: string },
): ResolvedCompoundPalette {
  const primary = skin.primary ?? fallback;
  return {
    primaryLight: primary.light,
    primaryBase: primary.base,
    primaryDark: primary.dark,
    fold: skin.secondary ?? darken(primary.dark, 0.18),
    cavity: darken(primary.dark, 0.45),
    edge: skin.edge ?? darken(primary.dark, 0.32),
    extrusionLight: darken(primary.dark, 0.22),
    extrusionDark: darken(primary.dark, 0.38),
  };
}

/** Mirror an absolute-coordinate recipe path across the vertical center of
 *  the 200-unit space. Assets and parts author LEFT pieces; mirrorX makes
 *  the right-hand twin. */
export function mirrorPathX(d: string): string {
  const toks = d.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: string[] = [];
  let i = 0, cmd = "";
  while (i < toks.length) {
    if (/^[a-z]$/i.test(toks[i])) { cmd = toks[i++].toUpperCase(); out.push(cmd); if (cmd === "Z") continue; }
    const pairs = cmd === "C" ? 3 : cmd === "Q" ? 2 : 1;
    for (let p = 0; p < pairs; p++) {
      const X = parseFloat(toks[i++]), Y = parseFloat(toks[i++]);
      out.push((200 - X).toFixed(2), Y.toFixed(2));
    }
  }
  return out.join(" ");
}

/* ── procedural pattern tiles (userSpaceOnUse target px) ──────────────── */

const starD = (cx: number, cy: number, ro: number, ri: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
};

/** Build one <pattern> def. `transform` carries placement (rotation and,
 *  for mirrored right-hand copies, the reflection about the button axis). */
export function patternDef(id: string, spec: PatternSpec, color: string, transform: string): string {
  const T = 26 * (spec.scale / 50);
  const t = (n: number) => (T * n).toFixed(2);
  let tile = "";
  if (spec.type === "stripes") tile = `<rect x="0" y="0" width="${t(0.46)}" height="${t(1)}" fill="${color}"/>`;
  else if (spec.type === "dots") tile = `<circle cx="${t(0.25)}" cy="${t(0.25)}" r="${t(0.16)}" fill="${color}"/><circle cx="${t(0.75)}" cy="${t(0.75)}" r="${t(0.16)}" fill="${color}"/>`;
  else if (spec.type === "stars") tile = `<path d="${starD(T * 0.3, T * 0.3, T * 0.24, T * 0.1)}" fill="${color}"/><path d="${starD(T * 0.8, T * 0.78, T * 0.13, T * 0.055)}" fill="${color}"/>`;
  else if (spec.type === "scales") tile = `<path d="M 0 ${t(0.5)} Q ${t(0.25)} ${t(0.14)} ${t(0.5)} ${t(0.5)} Q ${t(0.75)} ${t(0.14)} ${t(1)} ${t(0.5)}" fill="none" stroke="${color}" stroke-width="${t(0.09)}"/><path d="M ${t(-0.25)} ${t(1)} Q 0 ${t(0.64)} ${t(0.25)} ${t(1)} Q ${t(0.5)} ${t(0.64)} ${t(0.75)} ${t(1)} Q ${t(1)} ${t(0.64)} ${t(1.25)} ${t(1)}" fill="none" stroke="${color}" stroke-width="${t(0.09)}"/>`;
  return `<pattern id="${id}" width="${t(1)}" height="${t(1)}" patternUnits="userSpaceOnUse" patternTransform="${transform}">${tile}</pattern>`;
}

/* ── geometry validation (pure, no DOM) ───────────────────────────────── */

function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distToPoly(p: Pt, poly: Pt[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
    const ex = a.x + t * dx - p.x, ey = a.y + t * dy - p.y;
    best = Math.min(best, Math.hypot(ex, ey));
  }
  return best;
}

export interface CompoundAuditResult {
  checks: { name: string; pass: boolean; note: string }[];
  materialEscape: number;
  footprintExcess: number;
}

/** Measure the v69 alignment contract: every physical material path inside
 *  the footprint; footprint never visibly beyond the material union; both
 *  bounded after mirroring and cap-aware transformation. Overlap inside
 *  the declared attachmentZone is an attachment, not an error. */
export function validateCompoundAsset(asset: CompoundVectorAsset): CompoundAuditResult {
  const zone = asset.attachmentZone;
  const inZone = (p: Pt) => p.x >= zone.x && p.x <= zone.x + zone.width && p.y >= zone.y && p.y <= zone.y + zone.height;
  const foot = flattenPath(asset.footprint, 18).flat();
  const mats = asset.layers.filter((l) => l.kind === "material").map((l) => flattenPath(l.path, 18).flat());

  let materialEscape = 0;
  for (const poly of mats)
    for (const p of poly)
      if (!pointInPoly(p, foot) && !inZone(p)) materialEscape = Math.max(materialEscape, distToPoly(p, foot));

  let footprintExcess = 0;
  let excessAt: Pt | null = null;
  for (const p of foot) {
    if (inZone(p)) continue;
    if (mats.some((poly) => pointInPoly(p, poly))) continue;
    const d = Math.min(...mats.map((poly) => distToPoly(p, poly)));
    if (d > footprintExcess) { footprintExcess = d; excessAt = p; }
  }

  const VB: [number, number, number, number] = [0, 0, 200, 100];
  const mirrored = bounds(flattenPath(mirrorPathX(asset.footprint), 12).flat());
  const capped = bounds(flattenPath(transformPathCapAware(asset.footprint, VB, 0, 0, 400, 100, 70), 12).flat());
  const mirrorOk = mirrored.minX >= -0.5 && mirrored.maxX <= 200.5 && mirrored.minY >= -0.5 && mirrored.maxY <= 100.5;
  const capOk = capped.minX >= -0.5 && capped.maxX <= 400.5 && capped.minY >= -0.5 && capped.maxY <= 100.5;

  return {
    materialEscape,
    footprintExcess,
    checks: [
      { name: "material ⊂ footprint", pass: materialEscape <= 0.35, note: `escape ${materialEscape.toFixed(2)}u` },
      { name: "footprint excess ≤1u", pass: footprintExcess <= 1, note: `excess ${footprintExcess.toFixed(2)}u${excessAt ? ` at (${excessAt.x.toFixed(0)},${excessAt.y.toFixed(0)})` : ""}` },
      { name: "mirror bounds", pass: mirrorOk, note: `${mirrored.minX.toFixed(1)}..${mirrored.maxX.toFixed(1)}` },
      { name: "cap-map bounds", pass: capOk, note: `${capped.minX.toFixed(1)}..${capped.maxX.toFixed(1)}` },
    ],
  };
}

/* ── the first production-capable compound asset: the Prize Bow ribbon ──
   Baked: two loops with interior cavities, an outer tail pair with a
   V-crease, fold wedges gathering toward the knot, authored top-edge
   highlight masks, and a FRONT wrap collar that seats the ribbon on the
   center frame. The footprint's outer segments reuse the loop/tail curve
   segments verbatim, so union and bodies agree within tolerance. */

export const COMPOUND_ASSETS: Record<string, CompoundVectorAsset> = {
  prizeBowRibbon: {
    id: "prizeBowRibbon",
    name: "Prize Bow ribbon",
    viewBox: [0, 0, 200, 100],
    depthMode: "per-material-layer",
    /* V72 BOW TOPOLOGY — the candy-wrapper middle lobe is GONE. Each side
       is now: one large hollow upper loop (big dark cavity + rolled lip),
       one distinct hanging tail (diagonal, tapering, fishtail tip), one
       tall gathering collar in front, and a hidden rear knot bridge that
       exists only to close attachment seams under the collar and frame.
       The footprint is the exact union trace: collar right edge → tail
       lower edge → fishtail V → tail outer edge → the open NEGATIVE SPACE
       notch between tail and loop (closed at the collar's left edge) →
       loop bottom edge → loop outer/crown → loop inner sweep back to the
       collar crossing. */
    footprint:
      "M 51 17 C 55.5 20 58 26 58 34 C 56.8 40 56.2 45.5 56.2 50 C 56.2 54.5 56.8 60 58 66 C 58 74 55.5 80 51 83 C 48.5 82 46.5 81 44.7 79.5 C 43 85.5 38.5 92 34 97 L 26.5 90.5 L 17 99 C 20 92 24 84 29 76 C 33.3 69.2 38.2 63.1 43.9 58.1 C 44.1 56.4 44.2 54.6 44.3 53 C 36 55 25 53.5 17 48 C 6 40 1.5 28 4 17 C 7 5.5 21 -0.5 34 3.5 C 40.6 6 45.7 10.7 49.1 16.8 C 49.7 16.7 50.4 16.8 51 17 Z",
    anchors: {
      innerAttachment: { x: 50, y: 50 },
      opticalCenter: { x: 26, y: 38 },
    },
    attachmentZone: { x: 42, y: 12, width: 17, height: 74 },
    layers: [
      /* hidden rear knot bridge — closes seams behind collar and frame;
         never visibly a third lobe */
      { id: "rearKnotBridge", kind: "material", slot: "base", path:
        "M 56 30 C 50.5 34 47.5 41.5 47.5 50 C 47.5 58.5 50.5 66 56 70 C 57.5 62 57.5 38 56 30 Z" },
      /* lower hanging tail — narrow at the collar, FLARING down-outward
         to a fishtail end */
      { id: "lowerTail", kind: "material", slot: "base", patternSurface: true,
        profile: "flat-satin", bevelScale: 0.72, depthScale: 0.6, glossScale: 0.6, path:
        "M 52 56 C 50 66 46 78 40 88 C 38 91.5 36 94.5 34 97 L 26.5 90.5 L 17 99 C 20 92 24 84 29 76 C 34 68 40 61 47 55.5 C 49 55.5 50.8 55.7 52 56 Z" },
      { id: "tailFoldShadow", kind: "overlay", slot: "fold", clipTo: "lowerTail", path:
        "M 52 56 C 50.5 63 48 71 44.5 79 C 44 71.5 45 63.5 47.5 55.6 C 49.2 55.6 50.8 55.7 52 56 Z" },
      { id: "tailHighlight", kind: "detail", slot: "highlight", clipTo: "lowerTail", path:
        "M 29 76 C 25.5 81.5 22 89 19.5 95.5 C 23.5 88.5 27.5 81.5 31.5 76.5 C 30.7 76.3 29.8 76.2 29 76 Z" },
      /* hollow upper loop — tilted curled tube; the cavity overlaps the
         loop's inner-lower boundary so the clip makes the dark opening
         MEET the silhouette edge (looking into the tube) */
      { id: "upperLoop", kind: "material", slot: "base", patternSurface: true,
        profile: "soft-pill", bevelScale: 1.2, castShadow: 0.32, path:
        "M 54 34 C 53 20 46 8 34 3.5 C 21 -0.5 7 5.5 4 17 C 1.5 28 6 40 17 48 C 26 54.5 40 55.5 49 50 C 53 46 54.5 40 54 34 Z" },
      { id: "upperLoopCavity", kind: "overlay", slot: "cavity", clipTo: "upperLoop", path:
        "M 15 36 C 17 28.5 26 25.5 35 28.5 C 45 32 51 40 49 47.5 C 47 55 37 57.5 28 54 C 19 50.5 13 43.5 15 36 Z" },
      { id: "upperLoopInnerLip", kind: "detail", slot: "crease", clipTo: "upperLoop", path:
        "M 15 36 C 17 28.5 26 25.5 35 28.5 C 40 30.2 44.5 33.5 47 37.5 C 43.5 32 38 28.8 32.5 27.6 C 24.5 25.8 17.5 29.5 15 36 Z" },
      { id: "upperLoopFoldShadow", kind: "overlay", slot: "fold", clipTo: "upperLoop", path:
        "M 53 44 C 48.5 42.5 44.5 39 42.5 34 C 46.5 36.5 50.5 40 52.5 42.5 Z" },
      { id: "upperLoopHighlight", kind: "detail", slot: "highlight", clipTo: "upperLoop", path:
        "M 8 16 C 11.5 7 21 2.5 30.5 4.5 C 22.5 5.5 14 10 10.5 17.5 C 9.6 17 8.8 16.5 8 16 Z" },
      /* front: tall gathering collar over the frame edge, blunt ends */
      { id: "frontCollar", kind: "material", slot: "base", zSlot: "front", patternSurface: true,
        profile: "cylinder", bevelScale: 1.1, depthScale: 0.85, castShadow: 0.55, path:
        "M 51 17 C 55.5 20 58 26 58 34 C 56.8 40 56.2 45.5 56.2 50 C 56.2 54.5 56.8 60 58 66 C 58 74 55.5 80 51 83 C 45.5 80.5 42.5 74 42.5 66 C 43.8 60 44.3 54.5 44.3 50 C 44.3 45.5 43.8 40 42.5 34 C 42.5 26 45.5 19.5 51 17 Z" },
      { id: "collarFoldShadow", kind: "overlay", slot: "fold", clipTo: "frontCollar", zSlot: "front", path:
        "M 55 23 C 53.4 32 53.4 68 55 77 C 52 68 52 32 55 23 Z" },
      { id: "collarHighlight", kind: "detail", slot: "highlight", clipTo: "frontCollar", zSlot: "front", path:
        "M 47.5 23 C 46 32 46 68 47.5 77 C 45.3 68 45.3 32 47.5 23 Z" },
    ],
    exposedControls: { baseColor: true, secondaryColor: true, pattern: true, finish: true, gloss: true, contrast: true },
  },
};

/** Convenience for renderers/diagnostics: physical material layers only. */
export const materialLayers = (asset: CompoundVectorAsset, zPass?: "body" | "front") =>
  asset.layers.filter((l) => l.kind === "material" && (zPass === undefined || (zPass === "front") === (l.zSlot === "front")));
