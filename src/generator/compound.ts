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

   Layers paint in array order and point at SEMANTIC SLOTS, never colors.
   The renderer resolves each slot from the skin's primary/secondary pair,
   so the same baked ribbon can be pink candy, blue satin with stars, or
   gold metal without touching a path. Patterns clip to the layers flagged
   `patternSurface` — fabric surfaces only, never shadows, highlights,
   cavities or extrusion.

   Authoring rules match recipe parts: absolute M L C Q Z only, authored
   LEFT in the 0 0 200 100 recipe space (the recipe's mirrorX makes the
   right-hand twin, re-mapping geometry through the mirror so folds and
   highlights mirror like real toy art). Everything must live inside the
   recipe hull — the hull remains the maximum clipping boundary. */

export type CompoundSlot =
  | "base"       // primary material surface (receives gradient + bevel)
  | "fold"       // soft dark crease shading where the form folds
  | "cavity"     // deep interior openings (loop holes, recesses)
  | "highlight"  // authored gloss masks (replaces procedural specular)
  | "crease"     // thin bright accent slivers
  | "edge";      // reserved: explicit edge geometry (default is procedural)

export interface CompoundLayer {
  id: string;
  /** Absolute-coordinate path, recipe space, M L C Q Z only. */
  path: string;
  kind: "material" | "overlay" | "detail";
  slot: CompoundSlot;
  /** Clip this layer inside another layer's geometry (by layer id) so
   *  shading can never escape its surface. */
  clipTo?: string;
  /** Marks a material layer as a fabric surface the pattern may fill. */
  patternSurface?: boolean;
  opacity?: number;
}

export interface CompoundVectorAsset {
  id: string;
  name: string;
  viewBox: [number, number, number, number];
  /** Union outline — extrusion slab, contact shadow, wireframe footprint. */
  silhouette: string;
  /** Painted in array order (rear → front). */
  layers: CompoundLayer[];
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

/* ── the first production-capable compound asset: the Prize Bow ribbon ──
   Baked: two loops with interior cavities, an outer tail pair, fold wedges
   gathering toward the knot, a V-crease at the tail tip, authored top-edge
   highlight masks. Live: everything else. Geometry hugs the recipe hull's
   bow lobes — the hull clip marries the outer edges to the silhouette. */

export const COMPOUND_ASSETS: Record<string, CompoundVectorAsset> = {
  prizeBowRibbon: {
    id: "prizeBowRibbon",
    name: "Prize Bow ribbon",
    viewBox: [0, 0, 200, 100],
    silhouette:
      "M 78 50 C 76 30 64 10 44 4 C 24 0 6 10 3 26 C 1.5 37 7 44.5 18 46.5 C 23 47.5 27.5 48.5 30 50 C 27.5 51.5 23 52.5 18 53.5 C 7 55.5 1.5 63 3 74 C 6 90 24 100 44 96 C 64 90 76 70 78 50 Z",
    layers: [
      /* rear: outer tail pair (one mass, V-notched by the loops above it) */
      { id: "tail", kind: "material", slot: "base", patternSurface: true, path:
        "M 44 50 C 40 41 30 36 19 36 C 8.5 36 2 41.5 2 50 C 2 58.5 8.5 64 19 64 C 30 64 40 59 44 50 Z" },
      { id: "tailCrease", kind: "overlay", slot: "fold", clipTo: "tail", path:
        "M 44 50 C 40 46 35 43.5 30 42.5 C 34 45 37.5 47.5 40 50 C 37.5 52.5 34 55 30 57.5 C 35 56.5 40 54 44 50 Z" },
      { id: "tailShine", kind: "detail", slot: "highlight", clipTo: "tail", path:
        "M 6 44 C 10 39 16 37 22 37.5 C 16 39 11 41.5 8 45.5 C 7.3 45 6.6 44.5 6 44 Z" },
      /* lower loop behind upper at the knot */
      { id: "lowerLoop", kind: "material", slot: "base", patternSurface: true, path:
        "M 74 58 C 66 74 52 90 38 95 C 24 99 10 92 8 80 C 6 70 12 60 24 55 C 38 50 60 51 74 58 Z" },
      { id: "lowerCavity", kind: "overlay", slot: "cavity", clipTo: "lowerLoop", path:
        "M 20 62 C 28 56 44 54 60 56 C 46 51 28 52 20 62 Z" },
      { id: "lowerFold", kind: "overlay", slot: "fold", clipTo: "lowerLoop", path:
        "M 58 53 C 51 57 45 64 42 73 C 48 69 54 63 57 57 Z" },
      { id: "lowerShine", kind: "detail", slot: "highlight", clipTo: "lowerLoop", path:
        "M 12 63 C 16 58 22 55.5 28 56 C 22 57.5 17 60 14 64 C 13.3 63.7 12.6 63.3 12 63 Z" },
      /* upper loop */
      { id: "upperLoop", kind: "material", slot: "base", patternSurface: true, path:
        "M 74 42 C 66 26 52 10 38 5 C 24 1 10 8 8 20 C 6 30 12 40 24 45 C 38 50 60 49 74 42 Z" },
      { id: "upperCavity", kind: "overlay", slot: "cavity", clipTo: "upperLoop", path:
        "M 20 38 C 28 44 44 46 60 44 C 46 49 28 48 20 38 Z" },
      { id: "upperFold", kind: "overlay", slot: "fold", clipTo: "upperLoop", path:
        "M 58 47 C 51 43 45 36 42 27 C 48 31 54 37 57 43 Z" },
      { id: "upperShine", kind: "detail", slot: "highlight", clipTo: "upperLoop", path:
        "M 13 19 C 18 9 30 3.5 41 5.5 C 32 7 22 12 16 20 C 15 19.7 14 19.4 13 19 Z" },
    ],
    exposedControls: { baseColor: true, secondaryColor: true, pattern: true, finish: true, gloss: true, contrast: true },
  },
};
