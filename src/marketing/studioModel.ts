import { Play, Rocket, Zap, Trophy, Star, Heart, Check, Crown } from "lucide-react";
import type { CSSProperties } from "react";

/* Shared design state for the hero studio and the push-to-kit showcase — both
   render from the same object, so the kit below always reflects what you built
   above. Pure CSS custom properties; no engine import (keeps the page lean). */

export type Palette = { key: string; name: string; hi: string; mid: string; lo: string; glow: string; ink: string };

export const PALETTES: Palette[] = [
  { key: "purple", name: "Magenta", hi: "#e879f9", mid: "#c026d3", lo: "#7c1d9e", glow: "rgba(217,70,239,.75)", ink: "#ffffff" },
  { key: "blue",   name: "Blue",    hi: "#93c5fd", mid: "#3b82f6", lo: "#1d4ed8", glow: "rgba(59,130,246,.7)",  ink: "#ffffff" },
  { key: "teal",   name: "Teal",    hi: "#67e8f9", mid: "#22d3ee", lo: "#0e7490", glow: "rgba(56,224,255,.7)",  ink: "#052a37" },
  { key: "green",  name: "Green",   hi: "#86efac", mid: "#22c55e", lo: "#15803d", glow: "rgba(34,197,94,.65)",  ink: "#04240f" },
  { key: "orange", name: "Orange",  hi: "#fdba74", mid: "#f97316", lo: "#c2410c", glow: "rgba(249,115,22,.6)",  ink: "#3a1503" },
  { key: "gold",   name: "Gold",    hi: "#fde68a", mid: "#f59e0b", lo: "#b45309", glow: "rgba(251,191,36,.7)",  ink: "#422006" },
  { key: "silver", name: "Silver",  hi: "#f1f5f9", mid: "#cbd5e1", lo: "#94a3b8", glow: "rgba(203,213,225,.5)", ink: "#1e293b" },
];

export const ICONS = { Play, Rocket, Zap, Trophy, Star, Heart, Check, Crown } as const;
export type IconName = keyof typeof ICONS;

export const FONTS: Record<string, string> = {
  Rounded: 'ui-rounded, "Segoe UI Rounded", "Inter Variable", system-ui, sans-serif',
  Display: '"Inter Variable", Inter, system-ui, sans-serif',
  Slab: '"Rockwell", "Roboto Slab", Georgia, serif',
  Mono: 'ui-monospace, "SF Mono", Menlo, monospace',
};
export const WEIGHTS: Record<string, number> = { Regular: 400, Medium: 500, Bold: 700, Black: 900 };

export type Design = {
  palette: string; round: number; glow: number; shadow: number; // round/glow/shadow are 0..100
  label: string; icon: IconName; font: string; weight: string; size: number; track: number;
  state: "Default" | "Hover" | "Pressed" | "Disabled"; align: "left" | "center" | "right"; upper: boolean;
};

export const DEFAULT_DESIGN: Design = {
  palette: "purple", round: 88, glow: 62, shadow: 45,
  label: "PLAY", icon: "Play", font: "Rounded", weight: "Black", size: 44, track: 2,
  state: "Default", align: "center", upper: true,
};

/* attract-loop reel — diverse, all gorgeous, purple-forward to match the hero */
export const REEL: Design[] = [
  { ...DEFAULT_DESIGN },
  { ...DEFAULT_DESIGN, palette: "blue", round: 42, glow: 70, label: "GO", icon: "Rocket", size: 40 },
  { ...DEFAULT_DESIGN, palette: "teal", round: 22, glow: 74, label: "BOOST", icon: "Zap" },
  { ...DEFAULT_DESIGN, palette: "green", round: 100, glow: 56, label: "CLAIM", icon: "Check" },
  { ...DEFAULT_DESIGN, palette: "gold", round: 64, glow: 62, label: "WIN!", icon: "Trophy" },
  { ...DEFAULT_DESIGN, palette: "purple", round: 30, glow: 66, label: "START", icon: "Star" },
];

export const paletteOf = (key: string) => PALETTES.find((p) => p.key === key) ?? PALETTES[0];

/** CSS custom properties for a design — apply to the studio and the kit roots. */
export function vars(d: Design): CSSProperties {
  const p = paletteOf(d.palette);
  return {
    ["--c-hi" as string]: p.hi,
    ["--c-mid" as string]: p.mid,
    ["--c-lo" as string]: p.lo,
    ["--c-glow" as string]: p.glow,
    ["--c-ink" as string]: p.ink,
    ["--round" as string]: (d.round / 100) * 40,
    ["--glow" as string]: d.glow / 100,
    ["--shadow" as string]: d.shadow / 100,
    ["--fweight" as string]: WEIGHTS[d.weight] ?? 800,
    ["--fsize" as string]: d.size,
    ["--track" as string]: d.track,
    ["--ffam" as string]: FONTS[d.font] ?? FONTS.Display,
  };
}
