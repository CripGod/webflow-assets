/* ── Layered Skin recipes — the two-design architecture proof ──────────────
   Twin Grip (mirrored side assembly) and Prize Bow (front/behind ordering):
   the two opposite construction problems from the brief. Each recipe is
   PURE DATA — hull from the imported registry, plus independently authored
   part paths in the same 0 0 200 100 space. No component knows these ids.

   Authoring rules: absolute M L C Q Z only; author LEFT pieces and set
   mirrorX for their right-hand twins; every part must live inside the hull
   (the hull is the maximum clipping boundary). */

import type { ButtonSkinRecipe } from "./skins";
import { IMPORTED_SHAPES } from "./importedShapes";

export const SKIN_RECIPES: ButtonSkinRecipe[] = [
  {
    id: "twinGrip",
    name: "Twin Grip Command Bar",
    hull: IMPORTED_SHAPES.twinGrip.path,
    label: "PLAY",
    /* rear chassis (hull base coat) is painted by the renderer; the parts:
       drum grips behind, gold clamps in front, independent center face */
    parts: [
      { id: "grip", material: "plastic", zIndex: 2, depth: 4, bevel: 2.6, mirrorX: true, glossFrac: 0.56, path:
        "M 32 4 C 45 4 54 12 54 26 L 54 74 C 54 88 45 96 32 96 C 19 96 10 88 10 74 L 10 26 C 10 12 19 4 32 4 Z" },
      { id: "face", material: "face", zIndex: 3, depth: 0, bevel: 3, path:
        "M 76 12 L 124 12 C 130 12 136 16 136 24 L 136 76 C 136 84 130 88 124 88 L 76 88 C 70 88 64 84 64 76 L 64 24 C 64 16 70 12 76 12 Z" },
      { id: "clamp", material: "metal", zIndex: 4, depth: 3, bevel: 2.2, mirrorX: true, glossFrac: 0.34, path:
        "M 59 10 C 64 10 68 14 68 19 L 68 81 C 68 86 64 90 59 90 C 54 90 50 86 50 81 L 50 19 C 50 14 54 10 59 10 Z" },
    ],
    materials: {
      face:    { light: "#3EA3FF", base: "#0867DF", dark: "#063B9B", finish: "gloss" },
      plastic: { light: "#2E8BF0", base: "#0F5CC0", dark: "#083A80", finish: "gloss" },
      metal:   { light: "#FFD65A", base: "#F6A800", dark: "#8A4300", finish: "metal" },
      frame:   { light: "#12408F", base: "#0A2B66", dark: "#081A4C", finish: "matte" },
      accent:  { light: "#FFF3C4", base: "#FFD65A", dark: "#B87400", finish: "metal" },
    },
    safeArea: { x: 68, y: 24, width: 64, height: 52 },
    stretch: { leftCap: 76, rightCap: 76 },
  },
  {
    id: "prizeBow",
    name: "Prize Bow Power Bar",
    hull: IMPORTED_SHAPES.prizeBow.path,
    label: "CLAIM",
    /* rear ribbons → gold frame → independent face plate → knot jewel:
       the front/behind ordering test */
    parts: [
      { id: "ribbon", material: "plastic", zIndex: 1, depth: 4, bevel: 2.4, mirrorX: true, glossFrac: 0.5, path:
        "M 78 50 C 70 20 48 4 28 8 C 10 12 2 28 4 46 C 2 72 10 88 28 92 C 48 96 70 80 78 50 Z" },
      { id: "frame", material: "metal", zIndex: 2, depth: 3, bevel: 2.4, path:
        "M 74 8 L 126 8 C 138 8 146 16 146 28 L 146 72 C 146 84 138 92 126 92 L 74 92 C 62 92 54 84 54 72 L 54 28 C 54 16 62 8 74 8 Z" },
      { id: "face", material: "face", zIndex: 3, depth: 0, bevel: 3, path:
        "M 78 15 L 122 15 C 132 15 138 21 138 30 L 138 70 C 138 79 132 85 122 85 L 78 85 C 68 85 62 79 62 70 L 62 30 C 62 21 68 15 78 15 Z" },
      { id: "jewel", material: "accent", zIndex: 4, depth: 0, bevel: 1.8, glossOn: true, path:
        "M 100 12 C 104.5 12 108 15.5 108 20 C 108 24.5 104.5 28 100 28 C 95.5 28 92 24.5 92 20 C 92 15.5 95.5 12 100 12 Z" },
    ],
    materials: {
      face:    { light: "#FF8CCB", base: "#F12D91", dark: "#A60B59", finish: "gloss" },
      plastic: { light: "#E9509E", base: "#C41E75", dark: "#7C0E49", finish: "gloss" },
      metal:   { light: "#FFE38A", base: "#EFA900", dark: "#7A3800", finish: "metal" },
      frame:   { light: "#8A2058", base: "#65043E", dark: "#43022A", finish: "matte" },
      accent:  { light: "#FFF3C4", base: "#FFD65A", dark: "#B87400", finish: "metal" },
    },
    safeArea: { x: 66, y: 30, width: 68, height: 44 },
    stretch: { leftCap: 70, rightCap: 70 },
  },
];
