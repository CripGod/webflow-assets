/* ── Layered Skin recipes — the two-design architecture proof ──────────────
   Twin Grip (mirrored side assembly) and Prize Bow (front/behind ordering):
   the two opposite construction problems from the brief. Each recipe is
   PURE DATA — footprint, optional chassis, plus independently authored
   part paths in the same 0 0 200 100 space. No component knows these ids.

   Authoring rules: absolute M L C Q Z only; author LEFT pieces and set
   mirrorX for their right-hand twins; every part must live inside the
   footprint (the footprint is the maximum clipping boundary — parts may
   hug it, and the clip marries them to the silhouette edge).

   v69 GEOMETRY RESPONSIBILITIES:
   · `footprint` — hit area, bounds, max clip, hover aura, cast shadow.
     Never painted, never extruded.
   · `chassis` — declared explicitly ONLY where a visible whole body
     exists. Twin Grip has one (the navy body the drums and clamps mount
     on). Prize Bow has none: the ribbon asset and the center assembly
     provide every visible surface and its depth, so nothing paints
     behind them and no legacy hull slab can ghost.
   · Prize Bow uses TARGET PROPORTIONS: a wide, low center plate
     (frame x 42–158, y 22–78 ≈ 58% of width; face aspect ≈ 2.3:1) with
     the ribbon reading as support, not butterfly wings around a badge.
     The ribbon asset overlaps the frame by ~12u — its baked
     innerAttachment anchor sits at x≈52.5 against the frame edge at
     x=42 — and its front wrap collar rides OVER the frame edge via the
     part's frontZIndex. */

import type { ButtonSkinRecipe } from "./skins";
import { IMPORTED_SHAPES } from "./importedShapes";

/** Layered Skin designs approved for the PRODUCTION picker. Twin Grip is
 *  deliberately absent — it has not passed art direction yet and stays
 *  behind the lab page until it does. */
export const PRODUCTION_SKINS: string[] = ["prizeBow"];

/** Resolve a production `skin:` Shape to its recipe. Anything not on the
 *  approved list (including every lab-only recipe) returns undefined, so
 *  unapproved designs can never leak into the app. */
export function productionSkinRecipe(shape: string): ButtonSkinRecipe | undefined {
  if (!shape.startsWith("skin:")) return undefined;
  const id = shape.slice(5);
  if (!PRODUCTION_SKINS.includes(id)) return undefined;
  return SKIN_RECIPES.find((r) => r.id === id);
}

export const SKIN_RECIPES: ButtonSkinRecipe[] = [
  {
    id: "twinGrip",
    name: "Twin Grip Command Bar",
    footprint: IMPORTED_SHAPES.twinGrip.path,
    chassis: { path: IMPORTED_SHAPES.twinGrip.path, material: "frame", depth: 9 },
    label: "PLAY",
    /* rear drum grips fill the footprint's double-lobe caps → matte navy
       socket recesses the center → pillowed glass face → thick gold clamp
       cylinders overlap drum AND face by >10u each side */
    parts: [
      { id: "drum", material: "plastic", zIndex: 1, depth: 5, bevel: 2.8, mirrorX: true,
        glossFrac: 0.36, glossDip: 0.05, specularMode: "dot", highlightBias: [-0.22, -0.16],
        edgeDarkening: 0.36, saturationBoost: 0.26, bounce: 0.38, path:
        "M 2.5 50 C 2.5 35.5 10 26 21.5 22.5 C 19.5 11 27 2.5 38 2.5 C 48.5 2.5 55 9.5 57 19 C 58.5 23 59.5 27 59.5 32 L 59.5 68 C 59.5 73 58.5 77 57 81 C 55 90.5 48.5 97.5 38 97.5 C 27 97.5 19.5 89 21.5 77.5 C 10 74 2.5 64.5 2.5 50 Z" },
      { id: "socket", material: "frame", zIndex: 2, depth: 0, bevel: 2.6,
        bevelProfile: "hard-frame", edgeDarkening: 0.6, path:
        "M 74 8 L 126 8 C 134 8 140 14 140 22 L 140 78 C 140 86 134 92 126 92 L 74 92 C 66 92 60 86 60 78 L 60 22 C 60 14 66 8 74 8 Z" },
      { id: "face", material: "face", zIndex: 3, depth: 0, bevel: 3.2,
        glossFrac: 0.48, glossDip: 0.14, specularMode: "dot", highlightBias: [-0.1, -0.06],
        edgeDarkening: 0.18, saturationBoost: 0.36, bounce: 0.55, shadowDensity: 0.38, path:
        "M 80 14 C 91 13.2 109 13.2 120 14 C 128.5 14 133.5 18.5 134 26.5 C 135.2 34 135.2 66 134 73.5 C 133.5 81.5 128.5 86 120 86 C 109 86.8 91 86.8 80 86 C 71.5 86 66.5 81.5 66 73.5 C 64.8 66 64.8 34 66 26.5 C 66.5 18.5 71.5 14 80 14 Z" },
      { id: "clamp", material: "metal", zIndex: 4, depth: 3, bevel: 2.4, mirrorX: true,
        specularMode: "streak", highlightBias: [-0.05, -0.3],
        edgeDarkening: 0.55, bounce: 0.45, shadowDensity: 0.62, path:
        "M 59.5 5 C 67.5 5 71.5 9.5 71.5 17 L 71.5 44 L 69.3 50 L 71.5 56 L 71.5 83 C 71.5 90.5 67.5 95 59.5 95 C 51.5 95 47.5 90.5 47.5 83 L 47.5 56 L 49.7 50 L 47.5 44 L 47.5 17 C 47.5 9.5 51.5 5 59.5 5 Z" },
    ],
    materials: {
      face:    { light: "#9AD6FF", base: "#47A0F8", dark: "#0D57C2", finish: "glass" },
      plastic: { light: "#54A8FA", base: "#1B6BD8", dark: "#093E92", finish: "plastic" },
      metal:   { light: "#FFDD66", base: "#F5A80C", dark: "#8F4A00", finish: "metal" },
      frame:   { light: "#2B57B0", base: "#0E2F6E", dark: "#081C49", finish: "matte" },
      accent:  { light: "#FFF3C4", base: "#FFD65A", dark: "#B87400", finish: "metal" },
    },
    safeArea: { x: 74, y: 28, width: 52, height: 44 },
    stretch: { leftCap: 76, rightCap: 76 },
  },
  {
    id: "prizeBow",
    name: "Prize Bow Power Bar",
    /* Smooth authored outline containing the bow asset and the wide
       plate. Clip + shadow + aura only — the asset's own footprint and the
       plate define every visible edge; nothing is painted behind them. */
    footprint:
      "M 0 50 C 0 24 6 6 22 1.5 Q 32 -1 42 3 L 58 22 L 86 22 L 100 12.5 L 114 22 L 142 22 L 158 3 Q 168 -1 178 1.5 C 194 6 200 24 200 50 C 200 76 194 94 178 98.5 Q 168 101 158 97 L 142 78 L 114 78 L 100 87.5 L 86 78 L 58 78 L 42 97 Q 32 101 22 98.5 C 6 94 0 76 0 50 Z",
    label: "CLAIM",
    /* V72 bow: rear COMPOUND ribbon asset (hollow loop, hanging fishtail,
       hidden knot bridge — per-layer profiles and depth) → thin saturated
       gold frame → low pillowed glass face → the asset's tall front
       COLLAR rides over the frame edge at frontZIndex 4 */
    parts: [
      { id: "ribbon", material: "plastic", zIndex: 1, depth: 5, bevel: 2.6, mirrorX: true,
        asset: "prizeBowRibbon", frontZIndex: 4,
        assetSkin: { finish: "plastic", glossStrength: 1, contrast: 1 } },
      { id: "frame", material: "metal", zIndex: 2, depth: 3.2, bevel: 2.2,
        specularMode: "streak", highlightBias: [-0.3, -0.28],
        edgeDarkening: 0.5, bounce: 0.5, shadowDensity: 0.6, path:
        "M 50 22 L 150 22 C 157 22 162 26.5 162 33 L 162 67 C 162 73.5 157 78 150 78 L 50 78 C 43 78 38 73.5 38 67 L 38 33 C 38 26.5 43 22 50 22 Z" },
      { id: "face", material: "face", zIndex: 3, depth: 0, bevel: 3,
        glossFrac: 0.5, glossDip: 0.18, specularMode: "dot", highlightBias: [-0.12, -0.08],
        edgeDarkening: 0.1, saturationBoost: 0.4, bounce: 0.6, path:
        "M 55 28 C 85 26.9 115 26.9 145 28 C 152 28 156.5 31.5 157 36.5 C 158.1 40.5 158.1 59.5 157 63.5 C 156.5 68.5 152 72 145 72 C 115 73.1 85 73.1 55 72 C 48 72 43.5 68.5 43 63.5 C 41.9 59.5 41.9 40.5 43 36.5 C 43.5 31.5 48 28 55 28 Z" },
      { id: "jewelTop", material: "accent", zIndex: 5, depth: 0, bevel: 1.6,
        specularMode: "dot", highlightBias: [-0.15, -0.2], edgeDarkening: 0.4, shadowDensity: 0.3, path:
        "M 100 14.5 C 103.5 17 106.5 19.5 109 22 C 106.5 24.5 103.5 27 100 29.5 C 96.5 27 93.5 24.5 91 22 C 93.5 19.5 96.5 17 100 14.5 Z" },
      { id: "jewelBottom", material: "accent", zIndex: 5, depth: 0, bevel: 1.6,
        specularMode: "dot", highlightBias: [-0.15, -0.2], edgeDarkening: 0.4, shadowDensity: 0.3, path:
        "M 100 70.5 C 103.5 73 106.5 75.5 109 78 C 106.5 80.5 103.5 83 100 85.5 C 96.5 83 93.5 80.5 91 78 C 93.5 75.5 96.5 73 100 70.5 Z" },
    ],
    materials: {
      face:    { light: "#FFA8DB", base: "#F45CAE", dark: "#B5206F", finish: "glass" },
      plastic: { light: "#FF8FCE", base: "#E13D97", dark: "#8C1157", finish: "plastic" },
      metal:   { light: "#FFD84D", base: "#F29D0D", dark: "#9A4E00", finish: "metal" },
      frame:   { light: "#93265F", base: "#701048", dark: "#4A0630", finish: "matte" },
      accent:  { light: "#FFF0B8", base: "#FFCE45", dark: "#A66300", finish: "metal" },
    },
    safeArea: { x: 54, y: 33, width: 92, height: 34 },
    stretch: { leftCap: 52, rightCap: 52 },
    layout: { idealAspect: 2.6, minAspect: 2.4, maxAspect: 3.2, minHeroWidth: 420 },
  },
];
