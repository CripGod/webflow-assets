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
    /* Smooth authored outline containing the ribbon asset and the wide
       plate. Clip + shadow + aura only — the asset's own footprint and the
       plate define every visible edge; nothing is painted behind them. */
    footprint:
      "M 0 50 C 0 30 10 14 26 4 Q 34 0 44 4 L 58 22 L 142 22 L 156 4 Q 166 0 174 4 C 190 14 200 30 200 50 C 200 70 190 86 174 96 Q 166 100 156 96 L 142 78 L 58 78 L 44 96 Q 34 100 26 96 C 10 86 0 70 0 50 Z",
    label: "CLAIM",
    /* rear COMPOUND ribbon asset (baked loops/tail/folds/cavities/authored
       highlights, live skin, per-layer depth) → wide gold frame → low
       pillowed glass face → the asset's front wrap collar rides over the
       frame edge at frontZIndex 4 */
    parts: [
      { id: "ribbon", material: "plastic", zIndex: 1, depth: 5, bevel: 2.6, mirrorX: true,
        asset: "prizeBowRibbon", frontZIndex: 4,
        assetSkin: { finish: "plastic", glossStrength: 1, contrast: 1 } },
      { id: "frame", material: "metal", zIndex: 2, depth: 3.5, bevel: 2.6,
        specularMode: "streak", highlightBias: [-0.3, -0.28],
        edgeDarkening: 0.5, bounce: 0.5, shadowDensity: 0.6, path:
        "M 54 22 L 146 22 C 153 22 158 27 158 34 L 158 66 C 158 73 153 78 146 78 L 54 78 C 47 78 42 73 42 66 L 42 34 C 42 27 47 22 54 22 Z" },
      { id: "face", material: "face", zIndex: 3, depth: 0, bevel: 3,
        glossFrac: 0.5, glossDip: 0.18, specularMode: "dot", highlightBias: [-0.12, -0.08],
        edgeDarkening: 0.1, saturationBoost: 0.4, bounce: 0.6, path:
        "M 64 30 C 88 28.8 112 28.8 136 30 C 143 30 147.5 33.5 148 39 C 149.2 43 149.2 57 148 61 C 147.5 66.5 143 70 136 70 C 112 71.2 88 71.2 64 70 C 57 70 52.5 66.5 52 61 C 50.8 57 50.8 43 52 39 C 52.5 33.5 57 30 64 30 Z" },
    ],
    materials: {
      face:    { light: "#FFA8DB", base: "#F45CAE", dark: "#B5206F", finish: "glass" },
      plastic: { light: "#FF8FCE", base: "#E13D97", dark: "#8C1157", finish: "plastic" },
      metal:   { light: "#FFE58C", base: "#F0AC14", dark: "#8F4900", finish: "metal" },
      frame:   { light: "#93265F", base: "#701048", dark: "#4A0630", finish: "matte" },
      accent:  { light: "#FFF0B8", base: "#FFCE45", dark: "#A66300", finish: "metal" },
    },
    safeArea: { x: 58, y: 34, width: 84, height: 32 },
    stretch: { leftCap: 70, rightCap: 70 },
  },
];
