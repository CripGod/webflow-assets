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
   *  used by the front wrap to seat itself on the frame. */
  castShadow?: number;
  opacity?: number;
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
    /* The footprint is the EXACT union trace of the bodies: it reuses the
       upper loop's crown/outer segments, dips into the authored notch at
       J1 (10,34), follows the tail's outer edge through the fishtail V
       (2.5,47 → 9,50 → 2.5,53), mirrors through J2 (10,66) and the lower
       loop, and closes across the attachment tips (excused by the
       attachmentZone under the frame). */
    footprint:
      "M 54 36 C 52 22 44 8 33 3.5 C 21 -0.5 8 5 5.5 15 C 3.5 24 5 30.5 10 34 C 5 38 2.5 43 2.5 47 L 9 50 L 2.5 53 C 2.5 57 5 62 10 66 C 5 69.5 3.5 76 5.5 85 C 8 95 21 100.5 33 96.5 C 44 92 52 78 54 64 C 54.5 56 54.5 44 54 36 Z",
    anchors: {
      innerAttachment: { x: 54, y: 50 },
      opticalCenter: { x: 24, y: 50 },
    },
    attachmentZone: { x: 42, y: 28, width: 15, height: 44 },
    layers: [
      /* rear: fishtail dart between the loops */
      { id: "tail", kind: "material", slot: "base", patternSurface: true, path:
        "M 52 50 C 48 41 40 36 28 35.5 C 20 35.2 13 34.6 10 34 C 5 38 2.5 43 2.5 47 L 9 50 L 2.5 53 C 2.5 57 5 62 10 66 C 13 65.4 20 64.8 28 64.5 C 40 64 48 59 52 50 Z" },
      { id: "tailCrease", kind: "overlay", slot: "fold", clipTo: "tail", path:
        "M 50 50 C 44 46 37 44 30 44 C 36 46.5 41 48.5 45 50 C 41 51.5 36 53.5 30 56 C 37 56 44 54 50 50 Z" },
      { id: "tailShine", kind: "detail", slot: "highlight", clipTo: "tail", path:
        "M 6 43 C 9 39.5 14 37.5 19 38 C 14 39.5 10 42 7.5 45.5 C 7 44.7 6.5 43.8 6 43 Z" },
      /* lower loop behind upper at the knot */
      { id: "lowerLoop", kind: "material", slot: "base", patternSurface: true, path:
        "M 54 64 C 52 78 44 92 33 96.5 C 21 100.5 8 95 5.5 85 C 3.5 76 5 69.5 10 66 C 20 60 38 58 54 64 Z" },
      { id: "lowerCavity", kind: "overlay", slot: "cavity", clipTo: "lowerLoop", path:
        "M 14 64 C 22 60.5 34 59 46 61 C 32 56 18 57.5 14 64 Z" },
      { id: "lowerFold", kind: "overlay", slot: "fold", clipTo: "lowerLoop", path:
        "M 52 62.5 C 46 66 41 72 39 80 C 44 75.5 49 69.5 51 64.5 Z" },
      { id: "lowerShine", kind: "detail", slot: "highlight", clipTo: "lowerLoop", path:
        "M 8 86 C 12 93.5 22 97.5 31 95.5 C 23 94.5 14 91 10 84.5 C 9.3 85 8.6 85.5 8 86 Z" },
      /* upper loop */
      { id: "upperLoop", kind: "material", slot: "base", patternSurface: true, path:
        "M 54 36 C 52 22 44 8 33 3.5 C 21 -0.5 8 5 5.5 15 C 3.5 24 5 30.5 10 34 C 20 40 38 42 54 36 Z" },
      { id: "upperCavity", kind: "overlay", slot: "cavity", clipTo: "upperLoop", path:
        "M 14 36 C 22 39.5 34 41 46 39 C 32 44 18 42.5 14 36 Z" },
      { id: "upperFold", kind: "overlay", slot: "fold", clipTo: "upperLoop", path:
        "M 52 37.5 C 46 34 41 28 39 20 C 44 24.5 49 30.5 51 35.5 Z" },
      { id: "upperShine", kind: "detail", slot: "highlight", clipTo: "upperLoop", path:
        "M 8 14 C 12 6.5 22 2.5 31 4.5 C 23 5.5 14 9 10 15.5 C 9.3 15 8.6 14.5 8 14 Z" },
      /* front: the compact gathering collar, seated over the frame edge */
      { id: "frontWrap", kind: "material", slot: "base", zSlot: "front", patternSurface: true, castShadow: 0.45, path:
        "M 43 36 C 49 37.5 50.5 42 50.5 50 C 50.5 58 49 62.5 43 64 C 38.5 60 36 55 36 50 C 36 45 38.5 40 43 36 Z" },
      { id: "wrapFold", kind: "overlay", slot: "fold", clipTo: "frontWrap", zSlot: "front", path:
        "M 48 41 C 46 45.5 46 54.5 48 59 C 44.5 55.5 44.5 44.5 48 41 Z" },
      { id: "wrapShine", kind: "detail", slot: "highlight", clipTo: "frontWrap", zSlot: "front", path:
        "M 41 38.5 C 44.5 40.5 47 43.5 48 47.5 C 45 44 42.5 41.5 39.5 40.5 C 40 39.8 40.5 39.2 41 38.5 Z" },
    ],
    exposedControls: { baseColor: true, secondaryColor: true, pattern: true, finish: true, gloss: true, contrast: true },
  },
};

/** Convenience for renderers/diagnostics: physical material layers only. */
export const materialLayers = (asset: CompoundVectorAsset, zPass?: "body" | "front") =>
  asset.layers.filter((l) => l.kind === "material" && (zPass === undefined || (zPass === "front") === (l.zSlot === "front")));
