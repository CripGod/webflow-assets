// The UI Generator — canonical model (v4: shape presets, multi-light, kit).

export type GenStateName = "default" | "hover" | "pressed" | "disabled";
export const STATE_NAMES: GenStateName[] = ["default", "hover", "pressed", "disabled"];

export type EffectRole = "Bevel" | "Glow" | "Highlight" | "Shadow" | "Inner Fill";
export const EFFECT_ROLES: EffectRole[] = ["Bevel", "Glow", "Highlight", "Shadow", "Inner Fill"];

/** Bevel construction — presets differ in geometry, not just palette. */
export type Shape = "chamfer" | "pill" | "sharp" | "round";
export type CanvasBg = "light" | "white" | "deep" | "nebula";

export interface ExtraLight {
  id: string;
  kind: "rim" | "fill";
  angle: number;      // its own direction
  intensity: number;  // 0..100
}

export interface GenConfig {
  presetId: string;
  shape: Shape;
  effects: Partial<Record<EffectRole, string>>;
  face: { mode: "light" | "dark"; finish: number; noise: number };
  bevel: { width: number; depth: number; softness: number };
  lighting: {
    angle: number; highlight: number; lowlight: number; shadow: number;
    extras: ExtraLight[];
  };
  content: { label: string; icon: string; placement: "left" | "right" | "none" };
  visible: Record<Exclude<GenStateName, "default">, boolean>;
  canvas: CanvasBg;
}

export interface Preset {
  id: string;
  name: string;
  shape: Shape;
  bevel: { width: number; depth: number; softness: number };
  effects: Record<EffectRole, string>;
}

/** Style presets — distinct constructions (shape + bevel geometry) with a palette. */
export const PRESETS: Preset[] = [
  { id: "arcane-bevel", name: "Arcane Bevel", shape: "chamfer",
    bevel: { width: 14, depth: 24, softness: 36 },
    effects: { Bevel: "#7C3AED", Glow: "#C026D3", Highlight: "#FFFFFF", Shadow: "#C4B5FD", "Inner Fill": "#F6F3FC" } },
  { id: "power-pill", name: "Power Pill", shape: "pill",
    bevel: { width: 12, depth: 28, softness: 100 },
    effects: { Bevel: "#DB2777", Glow: "#F472B6", Highlight: "#FFF1F8", Shadow: "#FBCFE8", "Inner Fill": "#FDF4F9" } },
  { id: "hard-chisel", name: "Hard Chisel", shape: "sharp",
    bevel: { width: 16, depth: 18, softness: 4 },
    effects: { Bevel: "#EA580C", Glow: "#F59E0B", Highlight: "#FFF7ED", Shadow: "#FDBA74", "Inner Fill": "#FFF8F2" } },
  { id: "soft-round", name: "Soft Round", shape: "round",
    bevel: { width: 12, depth: 30, softness: 70 },
    effects: { Bevel: "#0891B2", Glow: "#22D3EE", Highlight: "#F0FDFF", Shadow: "#A5F3FC", "Inner Fill": "#F2FBFD" } },
];

export function presetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

export function defaultConfig(): GenConfig {
  const p = PRESETS[0];
  return {
    presetId: p.id,
    shape: p.shape,
    effects: { ...p.effects },
    face: { mode: "light", finish: 62, noise: 12 },
    bevel: { ...p.bevel },
    lighting: { angle: 135, highlight: 78, lowlight: 46, shadow: 42, extras: [] },
    content: { label: "Primary", icon: "ArrowRight", placement: "right" },
    visible: { hover: true, pressed: true, disabled: true },
    canvas: "light",
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
      Shadow: hslHex(h, r(35, 55), r(76, 84)),
      "Inner Fill": hslHex(h, r(15, 30), 96),
    },
    lighting: { ...c.lighting, angle: [45, 90, 135][r(0, 2)], highlight: r(60, 90), lowlight: r(30, 65), shadow: r(30, 55) },
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
