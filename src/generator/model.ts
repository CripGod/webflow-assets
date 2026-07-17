// The UI Generator — canonical model (v6).
// Per-state adjustments, one key light + hard highlight, explicit shadow,
// per-part transparency, text effects, auto-sizing label. One config drives
// canvas, code copy, and exports.

export type GenStateName = "default" | "hover" | "pressed" | "disabled";
export const STATE_NAMES: GenStateName[] = ["default", "hover", "pressed", "disabled"];

export type EffectRole = "Bevel" | "Glow" | "Highlight" | "Shadow" | "Inner Fill";
export const EFFECT_ROLES: EffectRole[] = ["Bevel", "Glow", "Highlight", "Shadow", "Inner Fill"];
export const ROLE_HINT: Record<EffectRole, string> = {
  Bevel: "edge frame", Glow: "outer aura", Highlight: "face sheen", Shadow: "grounding", "Inner Fill": "body",
};

export type Shape = "chamfer" | "pill" | "sharp" | "round";
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
  glow: number;       // 0..100
  lift: number;       // -10..10 px (negative = raised)
  opacity: number;    // 0..100
}

export interface TextFx { emboss: boolean; glow: boolean; outline: boolean; shadow: boolean }

export interface GenConfig {
  presetId: string;
  shape: Shape;
  effects: Partial<Record<EffectRole, string>>;
  face: { mode: "light" | "dark"; finish: number; noise: number };
  bevel: { width: number; softness: number };
  lighting: { angle: number; highlight: number; lowlight: number; hardHighlight: number };
  shadow: { distance: number; blur: number; opacity: number };
  transparency: { frame: number; interior: number; content: number };
  content: { label: string; icon: string; placement: "left" | "right" | "none"; fx: TextFx };
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
}

export const PRESETS: Preset[] = [
  { id: "arcane-bevel", name: "Arcane Bevel", shape: "chamfer", bevel: { width: 14, softness: 36 },
    effects: { Bevel: "#7C3AED", Glow: "#C026D3", Highlight: "#FFFFFF", Shadow: "#5B21B6", "Inner Fill": "#F6F3FC" } },
  { id: "power-pill", name: "Power Pill", shape: "pill", bevel: { width: 12, softness: 100 },
    effects: { Bevel: "#DB2777", Glow: "#F472B6", Highlight: "#FFF1F8", Shadow: "#9D174D", "Inner Fill": "#FDF4F9" } },
  { id: "hard-chisel", name: "Hard Chisel", shape: "sharp", bevel: { width: 16, softness: 4 },
    effects: { Bevel: "#EA580C", Glow: "#F59E0B", Highlight: "#FFF7ED", Shadow: "#9A3412", "Inner Fill": "#FFF8F2" } },
  { id: "soft-round", name: "Soft Round", shape: "round", bevel: { width: 12, softness: 70 },
    effects: { Bevel: "#0891B2", Glow: "#22D3EE", Highlight: "#F0FDFF", Shadow: "#155E75", "Inner Fill": "#F2FBFD" } },
];

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function defaultStates(): Record<GenStateName, StateAdjust> {
  return {
    default: { brightness: 0, glow: 42, lift: 0, opacity: 100 },
    hover: { brightness: 10, glow: 62, lift: -4, opacity: 100 },
    pressed: { brightness: -8, glow: 30, lift: 2, opacity: 100 },
    disabled: { brightness: 0, glow: 0, lift: 0, opacity: 58 },
  };
}

export function defaultConfig(): GenConfig {
  const p = PRESETS[0];
  return {
    presetId: p.id,
    shape: p.shape,
    effects: { ...p.effects },
    face: { mode: "light", finish: 62, noise: 12 },
    bevel: { ...p.bevel },
    lighting: { angle: 135, highlight: 78, lowlight: 46, hardHighlight: 0 },
    shadow: { distance: 14, blur: 18, opacity: 45 },
    transparency: { frame: 100, interior: 100, content: 100 },
    content: { label: "PLAY", icon: "Play", placement: "right", fx: { emboss: false, glow: false, outline: false, shadow: false } },
    states: defaultStates(),
    visible: { hover: true, pressed: true, disabled: true },
    canvas: "#F4F5F7",
  };
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

export function randomizeConfig(c: GenConfig): GenConfig {
  const h = Math.round(Math.random() * 360);
  const r = (min: number, max: number) => Math.round(min + Math.random() * (max - min));
  return {
    ...c,
    effects: {
      Bevel: hslHex(h, r(70, 90), r(45, 58)),
      Glow: hslHex((h + r(10, 40)) % 360, r(80, 95), r(55, 65)),
      Highlight: hslHex(h, r(15, 35), 97),
      Shadow: hslHex(h, r(45, 65), r(24, 38)),
      "Inner Fill": hslHex(h, r(15, 30), 96),
    },
    lighting: { ...c.lighting, angle: [45, 90, 135][r(0, 2)], highlight: r(60, 92), lowlight: r(30, 65), hardHighlight: r(0, 2) ? 0 : r(40, 80) },
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
