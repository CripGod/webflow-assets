import type { Shape } from "./model";

/* ── Silhouette Library metadata ──────────────────────────────────
   Every silhouette in the app is registered here with its provenance,
   license, slice behavior and safe content area — the contract the
   silhouette memo asks for. Geometry itself lives in shapePath()
   (bevel.ts); nothing here is generated at runtime.

   `capScale`   — fixed end-cap width as a fraction of component height
                  (the three-slice boundary; center stretches, caps don't).
   `content`    — safe-area insets as fractions of height (t/r/b/l);
                  labels and icons must stay inside this region.
   `source`     — where the geometry came from. "custom" entries were
                  authored in-project; imported entries name their pack.
                  To import Kenney/OpenGameArt geometry, add the cleaned
                  SVG under docs/silhouette-sources/ and register it here.
*/
export type SilhouetteCategory = "Buttons" | "Rails & HUD" | "Banners & Labels" | "Plaques & Frames";
export const SILHOUETTE_CATEGORIES: SilhouetteCategory[] = ["Buttons", "Rails & HUD", "Banners & Labels", "Plaques & Frames"];

export interface SilhouetteMeta {
  id: Shape;
  name: string;
  category: SilhouetteCategory;
  source: string;
  license: string;
  renderer: "procedural";
  capScale: number;
  content: { top: number; right: number; bottom: number; left: number };
  minWidth: number;
  minHeight: number;
  supports: string[];
  character: string;
}

const BTN = ["button", "chip", "badge", "tab", "toggle", "progress", "slider", "input"];

export const SILHOUETTES: SilhouetteMeta[] = [
  { id: "round", name: "Round", category: "Buttons", source: "custom", license: "original", renderer: "procedural",
    capScale: 0.3, content: { top: 0.14, right: 0.3, bottom: 0.14, left: 0.3 }, minWidth: 72, minHeight: 40,
    supports: BTN, character: "Soft rectangle — the neutral baseline." },
  { id: "pill", name: "Flat Pill", category: "Buttons", source: "custom", license: "original", renderer: "procedural",
    capScale: 0.5, content: { top: 0.14, right: 0.5, bottom: 0.14, left: 0.5 }, minWidth: 88, minHeight: 40,
    supports: BTN, character: "True capsule — semicircular ends." },
  { id: "sharp", name: "Sharp", category: "Buttons", source: "custom", license: "original", renderer: "procedural",
    capScale: 0.24, content: { top: 0.14, right: 0.26, bottom: 0.14, left: 0.26 }, minWidth: 80, minHeight: 40,
    supports: BTN, character: "Hard-edged chamfer, no rounding." },
  { id: "hex", name: "Hex", category: "Buttons", source: "custom", license: "original", renderer: "procedural",
    capScale: 0.24, content: { top: 0.14, right: 0.3, bottom: 0.14, left: 0.3 }, minWidth: 96, minHeight: 40,
    supports: BTN, character: "Single point at each end." },
  { id: "trapezoid", name: "Trapezoid", category: "Buttons", source: "custom", license: "original", renderer: "procedural",
    capScale: 0.16, content: { top: 0.14, right: 0.24, bottom: 0.14, left: 0.24 }, minWidth: 88, minHeight: 40,
    supports: BTN, character: "Top edge narrower than the base." },
  { id: "notch", name: "Notch", category: "Buttons", source: "custom", license: "original", renderer: "procedural",
    capScale: 0.28, content: { top: 0.14, right: 0.28, bottom: 0.14, left: 0.28 }, minWidth: 88, minHeight: 40,
    supports: BTN, character: "Opposing diagonal corner cuts." },
  { id: "chunky", name: "Heavy Rounded Capsule", category: "Buttons", source: "custom (Crewmate study)", license: "original", renderer: "procedural",
    capScale: 0.44, content: { top: 0.16, right: 0.44, bottom: 0.16, left: 0.44 }, minWidth: 110, minHeight: 48,
    supports: BTN, character: "Toy-thick shoulders, soft inset breaks top and bottom." },
  { id: "cutline", name: "Sport Cutline", category: "Buttons", source: "custom (broadcast study)", license: "original", renderer: "procedural",
    capScale: 0.3, content: { top: 0.16, right: 0.3, bottom: 0.16, left: 0.3 }, minWidth: 96, minHeight: 40,
    supports: BTN, character: "Athletic rectangle, clipped end caps." },
  { id: "polybar", name: "Racing Polybar", category: "Rails & HUD", source: "custom (automotive study)", license: "original", renderer: "procedural",
    capScale: 0.48, content: { top: 0.18, right: 0.5, bottom: 0.16, left: 0.5 }, minWidth: 130, minHeight: 44,
    supports: BTN, character: "Deep top chamfers, stepped lower corners." },
  { id: "explorer", name: "Cosmic Explorer", category: "Rails & HUD", source: "custom (sci-fi study)", license: "original", renderer: "procedural",
    capScale: 0.42, content: { top: 0.16, right: 0.44, bottom: 0.16, left: 0.44 }, minWidth: 120, minHeight: 44,
    supports: BTN, character: "Faceted end housings instead of arcs." },
  { id: "mazepill", name: "Retro Maze Pill", category: "Buttons", source: "custom (arcade study)", license: "original", renderer: "procedural",
    capScale: 0.42, content: { top: 0.14, right: 0.44, bottom: 0.14, left: 0.44 }, minWidth: 100, minHeight: 40,
    supports: BTN, character: "Elliptical ends flatter than a pill." },
  { id: "fighthud", name: "Fighting HUD", category: "Rails & HUD", source: "custom (versus study)", license: "original", renderer: "procedural",
    capScale: 0.55, content: { top: 0.16, right: 0.58, bottom: 0.16, left: 0.58 }, minWidth: 140, minHeight: 44,
    supports: BTN, character: "Arrow brackets with inward notches." },
  { id: "crest", name: "Blade Crest", category: "Plaques & Frames", source: "custom (ceremonial study)", license: "original", renderer: "procedural",
    capScale: 0.34, content: { top: 0.16, right: 0.36, bottom: 0.28, left: 0.36 }, minWidth: 120, minHeight: 48,
    supports: ["button", "badge", "tab"], character: "Sloped shoulders, shallow center point below." },
  { id: "blade", name: "Persian Blade", category: "Banners & Labels", source: "custom (ornamental study)", license: "original", renderer: "procedural",
    capScale: 0.5, content: { top: 0.2, right: 0.55, bottom: 0.2, left: 0.55 }, minWidth: 150, minHeight: 44,
    supports: ["button", "badge", "tab"], character: "Swept side tips, concave top and bottom." },
  { id: "tavern", name: "Concave Fantasy Plaque", category: "Plaques & Frames", source: "custom (tavern study)", license: "original", renderer: "procedural",
    capScale: 0.3, content: { top: 0.2, right: 0.32, bottom: 0.2, left: 0.32 }, minWidth: 120, minHeight: 48,
    supports: BTN, character: "Bowed edges, softly concave side walls." },
  { id: "handdrawn", name: "Hand-Drawn Frame", category: "Plaques & Frames", source: "custom + Rough.js ink (seeded)", license: "original / MIT", renderer: "procedural",
    capScale: 0.24, content: { top: 0.18, right: 0.26, bottom: 0.18, left: 0.26 }, minWidth: 110, minHeight: 48,
    supports: BTN, character: "Seeded ink wobble; Rough.js draws the line character only." },
  { id: "banner", name: "Pointed Banner", category: "Banners & Labels", source: "custom (ribbon study)", license: "original", renderer: "procedural",
    capScale: 0.55, content: { top: 0.16, right: 0.6, bottom: 0.16, left: 0.6 }, minWidth: 140, minHeight: 44,
    supports: ["button", "badge", "tab"], character: "Swallowtail V cut into each end." },
  { id: "shield", name: "Shield Plaque", category: "Plaques & Frames", source: "custom (heraldic study)", license: "original", renderer: "procedural",
    capScale: 0.2, content: { top: 0.14, right: 0.22, bottom: 0.34, left: 0.22 }, minWidth: 96, minHeight: 52,
    supports: ["button", "badge", "iconbtn"], character: "Flat top, walls converging to a bottom point." },
  { id: "pixelstep", name: "Pixel-Stepped Frame", category: "Buttons", source: "custom (8-bit study)", license: "original", renderer: "procedural",
    capScale: 0.24, content: { top: 0.16, right: 0.26, bottom: 0.16, left: 0.26 }, minWidth: 96, minHeight: 44,
    supports: BTN, character: "Staircase-quantized corners." },
  { id: "kenneyRect", name: "Crisp Panel", category: "Buttons", source: "custom study (after a CC0 pack rectangle)", license: "original", renderer: "procedural",
    capScale: 0.12, content: { top: 0.12, right: 0.16, bottom: 0.12, left: 0.16 }, minWidth: 80, minHeight: 40,
    supports: BTN, character: "The pack's signature crisp rectangle — corner radius measured at 9.4% of height." },
  { id: "kenneyTag", name: "Pointer Tag", category: "Banners & Labels", source: "custom study (after a CC0 pack handle)", license: "original", renderer: "procedural",
    capScale: 0.31, content: { top: 0.14, right: 0.36, bottom: 0.14, left: 0.18 }, minWidth: 96, minHeight: 40,
    supports: ["button", "chip", "badge", "tab"], character: "Pointer tag — 45° shoulders and tip rounding measured proportions, drawn as an original study." },
  { id: "doboBracket", name: "Bracket Label", category: "Banners & Labels", source: "custom study (after an itch.io label)", license: "original", renderer: "procedural",
    capScale: 0.36, content: { top: 0.14, right: 0.42, bottom: 0.14, left: 0.42 }, minWidth: 120, minHeight: 44,
    supports: ["button", "chip", "badge", "tab", "progress"], character: "Bar with half-round side lobes and meeting notches — measured proportions, drawn as an original study." },
];

export function silhouetteMeta(id: Shape): SilhouetteMeta | undefined {
  return SILHOUETTES.find((s) => s.id === id);
}
