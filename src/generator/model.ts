// The UI Generator — canonical model (v9, "hard candy").
// A layered candy-shell surface model: every visual layer of the button
// (shadow, extrusion, rim, bevel wall, face gradient, inner edge, inner glow,
// gloss, specular, bloom, texture, content) is driven by explicit tokens.
// One config drives canvas, code copy, HTML download, and exports.

export type GenStateName = "default" | "hover" | "pressed" | "disabled";
export const STATE_NAMES: GenStateName[] = ["default", "hover", "pressed", "disabled"];

export type EffectRole = "Bevel" | "Glow" | "Highlight" | "Shadow" | "Inner Fill";
export const EFFECT_ROLES: EffectRole[] = ["Bevel", "Glow", "Highlight", "Shadow", "Inner Fill"];
export const ROLE_HINT: Record<EffectRole, string> = {
  Bevel: "shell & wall", Glow: "inner glow", Highlight: "gloss & specular", Shadow: "grounding", "Inner Fill": "candy face",
};

export type Shape = "chamfer" | "pill" | "sharp" | "round";
export const SHAPES: { id: Shape; name: string }[] = [
  { id: "round", name: "Round" },
  { id: "pill", name: "Pill" },
  { id: "chamfer", name: "Chamfer" },
  { id: "sharp", name: "Sharp" },
];
/** Neutral canvas surfaces only — the stage never competes with the component. */
export const CANVAS_BGS = [
  { id: "#FFFFFF", name: "White" },
  { id: "#F4F5F7", name: "Light" },
  { id: "#B9BEC6", name: "Gray" },
  { id: "#1C1D22", name: "Dark" },
  { id: "#000000", name: "Black" },
] as const;
export type CanvasBg = (typeof CANVAS_BGS)[number]["id"];

/** Editable per-state treatment — edits apply to the selected state only. */
export interface StateAdjust {
  brightness: number; // -30..30
  glow: number;       // 0..100 (outer aura)
  lift: number;       // -10..10 px (negative = raised, positive = depressed)
  opacity: number;    // 0..100
}

/* Icons are parked while the hard-candy surface gets dialed in. The whole
   icon system stays intact underneath — flip this to bring it back. */
export const ICONS_ENABLED = false;

/* ── candy surface tokens — the layered shell ─────────────────── */
export type SpecularMode = "soft" | "hard" | "line" | "dual" | "anime" | "sweep";
export const SPECULAR_MODES: { id: SpecularMode; name: string }[] = [
  { id: "soft", name: "Soft spot" },
  { id: "hard", name: "Hard spot" },
  { id: "line", name: "Line streak" },
  { id: "dual", name: "Dual spot" },
  { id: "anime", name: "Anime" },
  { id: "sweep", name: "Edge sweep" },
];

export type PatternType = "none" | "stripes" | "dots" | "stars" | "checker" | "halftone";
export const PATTERN_TYPES: { id: PatternType; name: string }[] = [
  { id: "none", name: "None" },
  { id: "stripes", name: "Stripes" },
  { id: "dots", name: "Polka dots" },
  { id: "stars", name: "Stars" },
  { id: "checker", name: "Checker" },
  { id: "halftone", name: "Halftone — comic fade" },
];

export interface CandyTokens {
  extrusion: { depth: number; darkness: number; glow: number };   // px, 0..100, 0..100 (base glow)
  rim: { width: number; brightness: number };                     // px, 0..100
  innerEdge: { strength: number; width: number };                 // 0..100, px
  innerGlow: { opacity: number; size: number; color: string | null };   // null = Glow well
  aura: { color: string | null };                                       // state glow color; null = Glow well
  gloss: {
    on: boolean; height: number; curve: number; opacity: number; softness: number;
    layer: "below" | "above";
    fill: "highlight" | "custom" | "gradient";  // highlight = Highlight well
    tint: string; tint2: string;                // custom color / gradient top & bottom
  };
  specular: {
    on: boolean; mode: SpecularMode;
    size: number;       // px
    stretch: number;    // 10..100 — height as % of width (shape)
    intensity: number;  // 0..100
    softness: number;   // 0..100 — falloff
    angle: number;      // -80..80° on top of the light-driven tilt
    gap: number;        // 50..300 — spacing between the two events (dual / anime)
    ox: number; oy: number; // -50..50 position nudges
  };
  bloom: { opacity: number; size: number };                       // 0..100 ×2 (bounce light, unlit side)
  contact: { opacity: number };                                   // tight shadow where body meets ground
  texture: { amount: number; scale: number };                     // 0..100 ×2 (micro grain)
  pattern: { type: PatternType; scale: number; angle: number; opacity: number; color: string | null }; // null = tone-on-tone
}

/* Universal defaults — Chevon's approved settings (uigeneratorsettings_2). */
export function defaultCandy(): CandyTokens {
  return {
    extrusion: { depth: 15, darkness: 94, glow: 69 },
    rim: { width: 3, brightness: 80 },
    innerEdge: { strength: 45, width: 3 },
    innerGlow: { opacity: 55, size: 55, color: null },
    aura: { color: null },
    gloss: { on: true, height: 42, curve: 26, opacity: 72, softness: 95, layer: "above", fill: "gradient", tint: "#3391b2", tint2: "#DFF7FF" },
    specular: { on: true, mode: "anime", size: 32, stretch: 10, intensity: 38, softness: 0, angle: 0, gap: 300, ox: 33, oy: -30 },
    bloom: { opacity: 45, size: 60 },
    contact: { opacity: 32 },
    texture: { amount: 25, scale: 50 },
    pattern: { type: "stripes", scale: 100, angle: 45, opacity: 71, color: "#1d819a" },
  };
}

/* ── typography tokens ────────────────────────────────────────── */
export type TextCase = "none" | "upper" | "lower" | "title";
export interface TypeCfg {
  font: string;
  customFonts: string[];  // user-added Google Font family names
  size: number;        // px at master scale
  weight: number;      // 400..900
  italic: boolean;
  spacing: number;     // letter-spacing, em/100 (-5..20)
  case: TextCase;
  fillMode: "auto" | "solid" | "gradient";
  fill: string;
  fill2: string;       // gradient bottom
  fillOpacity: number; // 0..100 — translucent fills read as glass
  outline: { on: boolean; color: string; color2: string | null; width: number };       // color2 set = gradient stroke
  shadow: { on: boolean; color: string; x: number; y: number; blur: number; opacity: number };
  /** Relief follows the master light: highlight toward it, shade away from it.
   *  strength -100..100 (negative = deboss/engrave); distance = offset px;
   *  softness = blur; hiOpacity/shOpacity control each side independently. */
  emboss: { on: boolean; strength: number; softness: number; distance: number; hiOpacity: number; shOpacity: number };
  glow: { on: boolean; color: string; size: number; opacity: number };
  preset: string;
}

export const TEXT_PRESETS: { id: string; name: string }[] = [
  { id: "none", name: "None" },
  { id: "outline", name: "Outline" },
  { id: "shadow", name: "Shadow" },
  { id: "emboss", name: "Emboss" },
  { id: "innerbevel", name: "Inner Bevel" },
  { id: "glow", name: "Glow" },
  { id: "outshadow", name: "Outline + Shadow" },
  { id: "outemboss", name: "Outline + Emboss" },
  { id: "candy", name: "Candy" },
  { id: "arcade", name: "Arcade" },
  { id: "chiseled", name: "Chiseled" },
  { id: "glass", name: "Glass" },
];

/** Presets populate the typography controls — nothing locks; keep tweaking after. */
export function applyTextPreset(t: TypeCfg, id: string, palette: { dark: string; glow: string }) {
  t.preset = id;
  t.fillOpacity = 100;
  t.outline = { on: false, color: palette.dark, color2: null, width: 2.5 };
  t.shadow = { on: false, color: palette.dark, x: 0, y: 3, blur: 2, opacity: 50 };
  t.emboss = { on: false, strength: 55, softness: 30, distance: 2, hiOpacity: 70, shOpacity: 60 };
  t.glow = { on: false, color: palette.glow, size: 8, opacity: 80 };
  if (id === "none") { t.fillMode = "auto"; return; }
  if (id === "outline") { t.outline.on = true; return; }
  if (id === "shadow") { t.shadow.on = true; return; }
  if (id === "emboss") { t.emboss.on = true; return; }
  if (id === "innerbevel") { t.emboss = { on: true, strength: -60, softness: 30, distance: 2, hiOpacity: 65, shOpacity: 65 }; return; }
  if (id === "glow") { t.glow.on = true; return; }
  if (id === "outshadow") { t.outline.on = true; t.shadow.on = true; return; }
  if (id === "outemboss") { t.outline.on = true; t.emboss.on = true; return; }
  if (id === "candy") {
    t.fillMode = "solid"; t.fill = "#FFFFFF";
    t.outline = { on: true, color: palette.dark, color2: null, width: 2.6 };
    t.shadow = { on: true, color: palette.dark, x: 0, y: 3, blur: 1.5, opacity: 45 };
    t.emboss = { on: true, strength: 30, softness: 25, distance: 2, hiOpacity: 75, shOpacity: 60 };
    return;
  }
  if (id === "arcade") {
    t.fillMode = "gradient"; t.fill = "#FFE45C"; t.fill2 = "#FF9A3D";
    t.outline = { on: true, color: "#5A2B00", color2: null, width: 3.4 };
    t.shadow = { on: true, color: "#000000", x: 0, y: 4, blur: 0, opacity: 65 };
    return;
  }
  if (id === "chiseled") {
    t.fillMode = "gradient"; t.fill = "#F4F6F8"; t.fill2 = "#B9C0CC";
    t.emboss = { on: true, strength: -70, softness: 20, distance: 2.5, hiOpacity: 65, shOpacity: 70 };
    t.shadow = { on: true, color: palette.dark, x: 0, y: 2, blur: 1, opacity: 35 };
    return;
  }
  if (id === "glass") {
    // frosted label sealed in the shell: translucent fill, soft engrave
    t.fillMode = "solid"; t.fill = "#FFFFFF"; t.fillOpacity = 34;
    t.emboss = { on: true, strength: -48, softness: 72, distance: 2, hiOpacity: 60, shOpacity: 60 };
    t.shadow = { on: true, color: "#FFFFFF", x: 0, y: 1, blur: 0.5, opacity: 35 };
    return;
  }
}

/* ── icon tokens ──────────────────────────────────────────────── */
/** Normalized icon: enough raw SVG to render deterministically anywhere. */
export interface IconDef { lib: string; name: string; viewBox: string; inner: string; mode: "stroke" | "fill" }

export interface IconCfg {
  show: boolean;
  def: IconDef | null;
  placement: "left" | "right";
  only: boolean;              // icon-only (hides the label)
  size: number;               // 40..170 % of base
  strokeWidth: number;        // ×10 (5..40 → 0.5..4) for stroke libraries
  color: string | null;       // null = match text
  opacity: number;            // 0..100
  rotation: number;           // 0..360
  gap: number;                // px between text and icon
  ox: number; oy: number;     // nudge, px
  fx: { shadow: boolean; glow: boolean; emboss: boolean };
}

export const DEFAULT_ICON: IconDef = {
  lib: "lucide", name: "Play", viewBox: "0 0 24 24",
  inner: '<polygon points="6 3 20 12 6 21 6 3"/>', mode: "stroke",
};

export function defaultIconCfg(): IconCfg {
  return {
    show: true, def: { ...DEFAULT_ICON }, placement: "right", only: false,
    size: 100, strokeWidth: 24, color: null, opacity: 100, rotation: 0,
    gap: 18, ox: 0, oy: 0, fx: { shadow: false, glow: false, emboss: false },
  };
}

/** Popular game-UI faces from Google Fonts. `factor` ≈ average glyph advance
 *  (em) used for auto-width; `css` is the families query for fonts.googleapis. */
export const GAME_FONTS: { name: string; css: string | null; factor: number }[] = [
  { name: "Inter", css: null, factor: 0.6 },
  { name: "Bangers", css: "Bangers", factor: 0.5 },
  { name: "Luckiest Guy", css: "Luckiest+Guy", factor: 0.58 },
  { name: "Press Start 2P", css: "Press+Start+2P", factor: 1.05 },
  { name: "Bungee", css: "Bungee", factor: 0.72 },
  { name: "Righteous", css: "Righteous", factor: 0.58 },
  { name: "Russo One", css: "Russo+One", factor: 0.64 },
  { name: "Black Ops One", css: "Black+Ops+One", factor: 0.7 },
  { name: "Orbitron", css: "Orbitron:wght@700", factor: 0.74 },
  { name: "Cinzel", css: "Cinzel:wght@700", factor: 0.62 },
  { name: "Creepster", css: "Creepster", factor: 0.48 },
  { name: "Titan One", css: "Titan+One", factor: 0.6 },
  { name: "Lilita One", css: "Lilita+One", factor: 0.55 },
  { name: "Chewy", css: "Chewy", factor: 0.52 },
  { name: "Baloo 2", css: "Baloo+2:wght@700", factor: 0.58 },
  { name: "Fredoka", css: "Fredoka:wght@600", factor: 0.6 },
  { name: "Passion One", css: "Passion+One:wght@700", factor: 0.5 },
  { name: "Sigmar One", css: "Sigmar+One", factor: 0.66 },
  { name: "Rubik Mono One", css: "Rubik+Mono+One", factor: 0.85 },
  { name: "Audiowide", css: "Audiowide", factor: 0.68 },
  { name: "Silkscreen", css: "Silkscreen:wght@700", factor: 0.72 },
  { name: "Pixelify Sans", css: "Pixelify+Sans:wght@600", factor: 0.58 },
];
/* User-added Google Fonts — registered at runtime, names persisted in the
   config. Any family from fonts.google.com works; we request the full weight
   range and estimate width with a neutral factor. */
const customFontRegistry = new Map<string, { css: string; factor: number }>();
export function registerCustomFont(name: string) {
  const clean = name.trim();
  if (!clean || GAME_FONTS.some((f) => f.name === clean)) return;
  customFontRegistry.set(clean, { css: clean.replace(/ /g, "+") + ":wght@400;500;600;700;800;900", factor: 0.62 });
}
export function customFontNames(): string[] { return [...customFontRegistry.keys()]; }

export function fontByName(name: string) {
  const custom = customFontRegistry.get(name);
  if (custom) return { name, ...custom };
  return GAME_FONTS.find((f) => f.name === name) ?? GAME_FONTS[0];
}

export type GridStyle = "dots" | "lines" | "both" | "off";

/** The full visual design of one state — everything that shapes the artwork.
 *  The base config holds Default's design; other states mirror it live until
 *  the user edits them with that state selected, which forks a copy. */
export interface StateDesign {
  shape: Shape;
  effects: Partial<Record<EffectRole, string>>;
  face: { mode: "light" | "dark"; contrast: number; midpoint: number };
  bevel: { width: number; softness: number };
  candy: CandyTokens;
  lighting: { angle: number; highlight: number; lowlight: number };
  shadow: { distance: number; blur: number; opacity: number };
  transparency: { frame: number; interior: number; content: number };
  type: TypeCfg;
}

export const DESIGN_KEYS = ["shape", "effects", "face", "bevel", "candy", "lighting", "shadow", "transparency", "type"] as const;

export function pickDesign(src: StateDesign): StateDesign {
  return JSON.parse(JSON.stringify({
    shape: src.shape, effects: src.effects, face: src.face, bevel: src.bevel, candy: src.candy,
    lighting: src.lighting, shadow: src.shadow, transparency: src.transparency, type: src.type,
  })) as StateDesign;
}

export interface GenConfig extends StateDesign {
  presetId: string;
  /** Forked designs for non-default states. Absent = live mirror of Default. */
  stateDesigns: Partial<Record<Exclude<GenStateName, "default">, StateDesign>>;
  content: { label: string };
  icon: IconCfg;
  states: Record<GenStateName, StateAdjust>;
  visible: Record<Exclude<GenStateName, "default">, boolean>;
  canvas: CanvasBg;
}

export interface Preset {
  id: string;
  name: string;
  shape: Shape;
  bevel: { width: number; softness: number };
  effects: Record<EffectRole, string>;
  candy?: Partial<{ [K in keyof CandyTokens]: Partial<CandyTokens[K]> }>;
}

/** Each preset is a different candy *construction*, not just a palette. */
export const PRESETS: Preset[] = [
  { id: "hard-candy", name: "Hard Candy", shape: "round", bevel: { width: 10, softness: 78 },
    effects: { Bevel: "#0E9CC9", Glow: "#8FF0FF", Highlight: "#FFFFFF", Shadow: "#0A4A62", "Inner Fill": "#2CC5F0" },
    candy: { gloss: { height: 46, curve: 26, opacity: 72 }, specular: { on: true, mode: "hard" }, extrusion: { depth: 10 } } },
  { id: "grape-jelly", name: "Grape Jelly", shape: "pill", bevel: { width: 9, softness: 100 },
    effects: { Bevel: "#8B34D8", Glow: "#E29CFF", Highlight: "#FFFFFF", Shadow: "#4A1178", "Inner Fill": "#A855F7" },
    candy: { gloss: { height: 54, curve: 40, opacity: 62, softness: 46 }, specular: { mode: "dual", softness: 55 }, innerGlow: { opacity: 72, size: 66 }, bloom: { opacity: 60, size: 72 }, extrusion: { depth: 12 } } },
  { id: "hero-chisel", name: "Hero Chisel", shape: "chamfer", bevel: { width: 14, softness: 24 },
    effects: { Bevel: "#D97706", Glow: "#FDE68A", Highlight: "#FFF7E6", Shadow: "#7C2D12", "Inner Fill": "#F59E0B" },
    candy: { gloss: { height: 38, curve: 10, opacity: 44, softness: 10 }, specular: { mode: "sweep", size: 18, intensity: 62 }, extrusion: { depth: 14, darkness: 62 }, innerEdge: { strength: 62, width: 3 }, texture: { amount: 10, scale: 50 } } },
  { id: "bubble-pop", name: "Bubble Pop", shape: "round", bevel: { width: 8, softness: 100 },
    effects: { Bevel: "#E1408F", Glow: "#FFC1DE", Highlight: "#FFFFFF", Shadow: "#8C1D53", "Inner Fill": "#F868B1" },
    candy: { gloss: { height: 50, curve: 34, opacity: 78, softness: 30 }, specular: { mode: "anime", size: 30, intensity: 92 }, bloom: { opacity: 62, size: 68 }, extrusion: { depth: 9 } } },
];

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function defaultStates(): Record<GenStateName, StateAdjust> {
  return {
    default: { brightness: 5, glow: 0, lift: 0, opacity: 100 },
    hover: { brightness: 8, glow: 38, lift: -3, opacity: 100 },
    pressed: { brightness: -6, glow: 12, lift: 3, opacity: 100 },
    disabled: { brightness: 0, glow: 0, lift: 0, opacity: 62 },
  };
}

/* Universal default type treatment — Chevon's approved look (v12):
   Russo One italic, white→ice gradient, soft shadow + emboss. */
export function defaultType(): TypeCfg {
  return {
    font: "Russo One", customFonts: [], size: 76, weight: 700, italic: true, spacing: 2, case: "upper",
    fillMode: "gradient", fill: "#00b5c2", fill2: "#0f96c2", fillOpacity: 100,
    outline: { on: false, color: "#0B6183", color2: null, width: 0.5 },
    shadow: { on: true, color: "#659db3", x: 0, y: 3, blur: 1.5, opacity: 45 },
    emboss: { on: true, strength: -74, softness: 0, distance: 2, hiOpacity: 70, shOpacity: 60 },
    glow: { on: true, color: "#8FF0FF", size: 15, opacity: 100 },
    preset: "candy",
  };
}

export function defaultConfig(): GenConfig {
  const p = PRESETS[0];
  const candy = defaultCandy();
  applyPresetCandy(candy, p);
  return {
    presetId: p.id,
    stateDesigns: {},
    shape: "pill",
    effects: { ...p.effects },
    face: { mode: "light", contrast: 55, midpoint: 50 },
    bevel: { width: 19, softness: 78 },
    candy,
    lighting: { angle: 90, highlight: 78, lowlight: 46 },
    shadow: { distance: 28, blur: 14, opacity: 40 },
    transparency: { frame: 100, interior: 100, content: 100 },
    content: { label: "PLAY" },
    type: defaultType(),
    icon: defaultIconCfg(),
    states: defaultStates(),
    visible: { hover: true, pressed: true, disabled: true },
    canvas: "#000000",
  };
}

export function applyPresetCandy(candy: CandyTokens, p: Preset) {
  if (!p.candy) return;
  for (const k of Object.keys(p.candy) as (keyof CandyTokens)[]) {
    Object.assign(candy[k] as object, p.candy[k]);
  }
}

/* ── color utils ───────────────────────────────────────────────── */
export function hexMix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sa: number, sb: number) => Math.round(sa + (sb - sa) * t);
  const r = ch((pa >> 16) & 255, (pb >> 16) & 255), g = ch((pa >> 8) & 255, (pb >> 8) & 255), bl = ch(pa & 255, pb & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}
export const lighten = (c: string, t: number) => hexMix(c, "#ffffff", t);
export const darken = (c: string, t: number) => hexMix(c, "#000000", t);
export function desaturate(c: string, t: number): string {
  const p = parseInt(c.slice(1), 16);
  const r = (p >> 16) & 255, g = (p >> 8) & 255, b = p & 255;
  const gr = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const gray = `#${((1 << 24) | (gr << 16) | (gr << 8) | gr).toString(16).slice(1)}`;
  return hexMix(c, gray, t);
}
export function hexRgba(c: string, alpha: number): string {
  const p = parseInt(c.slice(1), 16);
  return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${alpha.toFixed(2)})`;
}
export function hslHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/* Color harmony engine — random rolls follow game-UI color theory instead of
   free-for-all hues. Every scheme keeps the guardrails that make candy read:
   a saturated mid-light face, a same-family darker shell, a luminous accent
   glow, a deep grounded shadow, and a near-white highlight with a hint of the
   accent temperature. */
type Harmony = "analogous" | "complementary" | "split" | "triadic" | "monochrome";
const HARMONIES: Harmony[] = ["analogous", "complementary", "split", "triadic", "monochrome"];

export function randomizeConfig(c: GenConfig): GenConfig {
  const r = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
  const h = r(0, 359);
  const scheme = HARMONIES[r(0, HARMONIES.length - 1)];
  const accentHue =
    scheme === "analogous" ? (h + r(25, 45)) % 360 :
    scheme === "complementary" ? (h + 180 + r(-12, 12) + 360) % 360 :
    scheme === "split" ? (h + (Math.random() < 0.5 ? 150 : 210) + 360) % 360 :
    scheme === "triadic" ? (h + 120) % 360 :
    h; // monochrome
  const shellHue = (h + r(-8, 8) + 360) % 360;
  return {
    ...c,
    effects: {
      "Inner Fill": hslHex(h, r(76, 94), r(52, 60)),          // the candy face: vivid, mid-light
      Bevel: hslHex(shellHue, r(66, 84), r(38, 46)),          // shell: same family, one step deeper
      Glow: hslHex(accentHue, r(82, 96), r(72, 84)),          // accent light per the harmony
      Shadow: hslHex(shellHue, r(52, 68), r(16, 24)),         // deep grounded shade, never gray mud
      Highlight: hslHex(accentHue, r(8, 16), 98),             // near-white, tinted by the accent
    },
    lighting: { ...c.lighting, angle: [70, 90, 110][r(0, 2)], highlight: r(64, 90), lowlight: r(34, 60) },
  };
}

/* ── kit ───────────────────────────────────────────────────────── */
export type KitComponentId = "primary" | "secondary" | "iconbtn" | "toggle" | "progress";
export type KitSize = "s" | "m" | "l";
export const KIT_COMPONENTS: { id: KitComponentId; name: string }[] = [
  { id: "primary", name: "Primary button" },
  { id: "secondary", name: "Secondary button" },
  { id: "iconbtn", name: "Icon button" },
  { id: "toggle", name: "Toggle" },
  { id: "progress", name: "Progress bar" },
];
