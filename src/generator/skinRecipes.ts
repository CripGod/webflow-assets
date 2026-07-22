/* ── Layered Skin recipes — the two-design architecture proof ──────────────
   Twin Grip (mirrored side assembly) and Prize Bow (front/behind ordering):
   the two opposite construction problems from the brief. Each recipe is
   PURE DATA — hull from the imported registry, plus independently authored
   part paths in the same 0 0 200 100 space. No component knows these ids.

   Authoring rules: absolute M L C Q Z only; author LEFT pieces and set
   mirrorX for their right-hand twins; every part must live inside the hull
   (the hull is the maximum clipping boundary — parts may hug it, and the
   clip marries them to the silhouette edge).

   REFINEMENT PASS notes (why these paths look the way they do):
   · Rear masses are authored to FILL their hull cap minus a ~2.5u margin,
     so the silhouette's own lobes read as part volume, not as chassis.
   · Front pieces overlap the parts behind them by 10–24u and declare a
     shadowDensity, so the stack reads as stacked, not aligned.
   · Face plates are pillowed — every edge bows outward 1–2u — instead of
     literal rounded rects, and sit inside an explicit socket/frame part.
   · Finishes are deliberately mixed per part (plastic drums, glass faces,
     cylinder-gradient metal clamps, matte sockets) so no two neighboring
     parts share one lighting response. */

import type { ButtonSkinRecipe } from "./skins";
import { IMPORTED_SHAPES } from "./importedShapes";

export const SKIN_RECIPES: ButtonSkinRecipe[] = [
  {
    id: "twinGrip",
    name: "Twin Grip Command Bar",
    hull: IMPORTED_SHAPES.twinGrip.path,
    label: "PLAY",
    extrusion: 9,
    /* rear drum grips fill the hull's double-lobe caps → matte navy socket
       recesses the center → pillowed glass face → thick gold clamp
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
    hull: IMPORTED_SHAPES.prizeBow.path,
    label: "CLAIM",
    extrusion: 9,
    /* rear COMPOUND ribbon asset (baked loops/tail/folds/cavities/authored
       highlights, live skin) → thick ornamental gold frame overlapping the
       ribbons by ~24u → puffed glass face inside the frame → gold knob
       jewel seated on the frame's top band */
    parts: [
      { id: "ribbon", material: "plastic", zIndex: 1, depth: 5, bevel: 2.6, mirrorX: true,
        asset: "prizeBowRibbon",
        assetSkin: { finish: "plastic", glossStrength: 1, contrast: 1 } },
      { id: "frame", material: "metal", zIndex: 2, depth: 3.5, bevel: 2.6,
        specularMode: "streak", highlightBias: [-0.3, -0.28],
        edgeDarkening: 0.5, bounce: 0.5, shadowDensity: 0.6, path:
        "M 71 12 L 129 12 C 140 12 146 18 146 29 L 146 71 C 146 82 140 88 129 88 L 71 88 C 60 88 54 82 54 71 L 54 29 C 54 18 60 12 71 12 Z" },
      { id: "face", material: "face", zIndex: 3, depth: 0, bevel: 3,
        glossFrac: 0.5, glossDip: 0.18, specularMode: "dot", highlightBias: [-0.12, -0.08],
        edgeDarkening: 0.1, saturationBoost: 0.4, bounce: 0.6, path:
        "M 78 19.5 C 92 18.3 108 18.3 122 19.5 C 131 19.5 136.5 24 137 31 C 138.3 38 138.3 62 137 69 C 136.5 76 131 80.5 122 80.5 C 108 81.7 92 81.7 78 80.5 C 69 80.5 63.5 76 63 69 C 61.7 62 61.7 38 63 31 C 63.5 24 69 19.5 78 19.5 Z" },
      { id: "jewel", material: "accent", zIndex: 4, depth: 0, bevel: 2,
        bevelProfile: "soft-pill", glossStrength: 0.8, glossFrac: 0.45, specularMode: "dot", highlightBias: [-0.2, -0.24],
        edgeDarkening: 0.35, bounce: 0.5, shadowDensity: 0.5, path:
        "M 100 12.1 C 104.58 12.1 108.3 15.82 108.3 20.4 C 108.3 24.98 104.58 28.7 100 28.7 C 95.42 28.7 91.7 24.98 91.7 20.4 C 91.7 15.82 95.42 12.1 100 12.1 Z" },
    ],
    materials: {
      face:    { light: "#FFA8DB", base: "#F45CAE", dark: "#B5206F", finish: "glass" },
      plastic: { light: "#FF8FCE", base: "#E13D97", dark: "#8C1157", finish: "plastic" },
      metal:   { light: "#FFE58C", base: "#F0AC14", dark: "#8F4900", finish: "metal" },
      frame:   { light: "#93265F", base: "#701048", dark: "#4A0630", finish: "matte" },
      accent:  { light: "#FFF0B8", base: "#FFCE45", dark: "#A66300", finish: "metal" },
    },
    safeArea: { x: 68, y: 30, width: 64, height: 40 },
    stretch: { leftCap: 70, rightCap: 70 },
  },
];
