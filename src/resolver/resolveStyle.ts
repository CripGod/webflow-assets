import type { MasterComponent, StateName, StateDelta } from "@/model/types";

// Pure resolver: (master, state) → concrete CSS layer values.
// Both the React renderer and the HTML export consume this output, so canvas /
// HTML preview / export can never drift apart.
//
// Material model (rework): the button is built from distinct physical layers —
//   outer contour → secondary machined rim → main face → inner bevel →
//   inner highlight line → matte grain → rim light → embossed content.
// Depth comes from directional, low-blur, upper-left-lit layers, not one gradient.

export interface ResolvedComponent {
  state: StateName;
  root: {
    width: string;
    height: string;
    borderRadius: string;
    transform: string;
    opacity: number;
    filter: string;
    transition: string;
    cursor: string;
    background: string;
    boxShadow: string;
  };
  innerLine: string; // box-shadow — fine inner highlight (upper) + dark lower edge
  rimLight: { background: string; opacity: number }; // thin cool top highlight
  grainOpacity: number;
  content: { iconRegion: number; labelGap: number };
  icon: { color: string; strokeWidth: number; size: number; filter: string; nudgeX: number; nudgeY: number };
  divider: { width: number; height: number; background: string; boxShadow: string };
  label: {
    color: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing: string;
    fontWeight: number;
    textShadow: string;
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }
function rgba(r: number, g: number, b: number, alpha: number) { return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`; }
function hexToRgb(h: string) { h = h.replace("#", ""); const n = parseInt(h, 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }; }
function darkenHex(hex: string, frac: number) {
  const c = hexToRgb(hex); const k = 1 - frac;
  const to = (v: number) => Math.max(0, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
}

const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const STATE_DURATION: Record<StateName, number> = { default: 160, hover: 160, pressed: 90, disabled: 180 };

export function resolveStyle(m: MasterComponent, state: StateName): ResolvedComponent {
  const d: StateDelta = m.states[state] ?? {};
  const p = m.palette;
  const g = m.geometry;
  const L = m.lighting;
  const emboss = m.content.emphasis === "emboss";
  const sgn = emboss ? 1 : -1; // relief direction

  const depthK = m.material.depth / 12;
  const distK = (L.shadowDistance + (d.shadowDistanceDelta ?? 0)) / 24;
  const outerK = d.outerShadowOpacityScale ?? 1;
  const contactK = d.contactShadowScale ?? 1;
  const lowerBoost = d.insetLowerBoost ?? 1;
  const relief = d.reliefScale ?? 1;
  const hK = clamp01((m.material.highlight + (d.highlightDelta ?? 0)) / 100) / 0.62; // 1.0 at default 62%
  const rimK = clamp01((L.rimLight + (d.rimDelta ?? 0)) / 100) / 0.36;

  const faceDarken = d.faceDarken ?? 0;
  const stops = p.gradient.map(([off, col]) => `${faceDarken ? darkenHex(col, faceDarken) : col} ${off}%`).join(", ");

  // ── FACE: layered — convex top catch-light + edge/lower vignette + vertical base.
  const background = [
    `radial-gradient(118% 80% at 50% -16%, ${rgba(228, 236, 246, 0.14 * hK)}, ${rgba(228, 236, 246, 0)} 44%)`,
    `radial-gradient(152% 138% at 50% 50%, ${rgba(0, 0, 0, 0)} 34%, ${rgba(4, 6, 9, 0.36)} 100%)`,
    `linear-gradient(179deg, ${stops})`,
  ].join(", ");

  // ── PERIMETER + SHADOW hierarchy on the root box-shadow.
  const edgeW = 5.5 * depthK;
  const shadow = [
    // three distinct grounding shadows (tight contact / medium / broad ambient)
    `0 ${(8 * distK).toFixed(1)}px ${(10 * distK).toFixed(1)}px ${rgba(3, 5, 8, 0.34 * contactK)}`,
    `0 ${(20 * distK).toFixed(1)}px ${(26 * distK).toFixed(1)}px ${rgba(3, 5, 8, 0.3 * outerK)}`,
    `0 ${(40 * distK).toFixed(1)}px ${(60 * distK).toFixed(1)}px ${rgba(3, 5, 8, 0.2 * outerK)}`,
    // outer contour (thick, physical) — brighter hairline sits just inside via inner line
    `0 0 0 ${edgeW.toFixed(1)}px #05070A`,
    `0 0 0 ${(edgeW + 1).toFixed(1)}px ${rgba(0, 0, 0, 0.55)}`,
    // secondary machined rim — directional: upper-left bright, lower-right dark
    `inset 3px 3px 4px ${rgba(206, 218, 232, 0.17 * hK)}`,
    `inset -3px -4px 5px ${rgba(0, 0, 0, 0.62)}`,
    // inner bevel — top light, denser dark lower edge, side densification
    `inset 0 3px 3px ${rgba(255, 255, 255, 0.09 * hK)}`,
    `inset 0 -14px 20px ${rgba(0, 0, 0, 0.44 * lowerBoost)}`,
    `inset 11px 0 24px ${rgba(0, 0, 0, 0.13)}`,
    `inset -13px 0 26px ${rgba(0, 0, 0, 0.16)}`,
  ].join(", ");

  // fine inner highlight line (upper) + dark lower edge — the "second rim" read
  const innerLine = [
    `inset 0 1px 0 ${rgba(228, 238, 250, 0.24 * hK)}`,
    `inset 0 -1px 0 ${rgba(0, 0, 0, 0.5)}`,
    `inset 1px 0 0 ${rgba(210, 222, 236, 0.1 * hK)}`,
  ].join(", ");

  // thin cool rim light near the top edge — strongest upper-left, fading right
  const rimLight = {
    background: `radial-gradient(135% 48% at 28% -2%, ${rgba(212, 226, 242, 0.55 * hK)}, transparent 56%)`,
    opacity: clamp01(0.5 * rimK + 0.15),
  };

  // matte grain (subtle, soft-light) — 0.05..0.10 window
  const grainOpacity = 0.05 + (m.material.noise / 100) * 0.05;

  // ── EMBOSS: physically raised (or recessed) content, coherent with UL light.
  const label = {
    color: p.labelColor,
    fontSize: 66,
    lineHeight: 72,
    letterSpacing: "-0.025em",
    fontWeight: 600,
    textShadow: [
      `${-1 * sgn}px ${-1 * sgn}px 0.5px ${rgba(233, 239, 247, 0.55 * relief)}`, // fine UL relief highlight
      `${1 * sgn}px ${1 * sgn}px 0 ${rgba(0, 0, 0, 0.5 * relief)}`, // immediate contact
      `${1 * sgn}px ${2 * sgn}px 1px ${rgba(3, 5, 9, 0.9 * relief)}`, // tight LR contact shadow
      `${2 * sgn}px ${4 * sgn}px 3px ${rgba(3, 5, 9, 0.6 * relief)}`, // deeper extrusion
      `${3 * sgn}px ${7 * sgn}px 8px ${rgba(3, 5, 9, 0.35 * relief)}`, // soft grounding
    ].join(", "),
  };

  const icon = {
    color: p.iconColor,
    strokeWidth: m.content.iconWeight,
    size: 84,
    nudgeX: -1,
    nudgeY: -2,
    filter: [
      `drop-shadow(${-1 * sgn}px ${-1 * sgn}px 0.5px ${rgba(233, 239, 247, 0.5 * relief)})`,
      `drop-shadow(${1 * sgn}px ${2 * sgn}px 1px ${rgba(3, 5, 9, 0.85 * relief)})`,
      `drop-shadow(${2 * sgn}px ${4 * sgn}px 4px ${rgba(3, 5, 9, 0.5 * relief)})`,
      `drop-shadow(0 ${6 * sgn}px 7px ${rgba(3, 5, 9, 0.3 * relief)})`,
    ].join(" "),
  };

  // recessed divider groove — dark center, UL highlight, LR shadow, inner shadow
  const divider = {
    width: 3,
    height: 116,
    background: `linear-gradient(180deg, ${rgba(12, 16, 21, 0.72)}, ${rgba(8, 11, 15, 0.9)})`,
    boxShadow: [
      `inset 1px 1px 1.5px ${rgba(0, 0, 0, 0.65)}`,
      `-1px -1px 0 ${rgba(200, 212, 228, 0.16 * hK)}`,
      `1px 1px 0 ${rgba(0, 0, 0, 0.42)}`,
    ].join(", "),
  };

  const width = `clamp(680px, calc((100vw - 400px) * 0.78), 860px)`;
  const height = "clamp(170px, calc(var(--forge-hero-w) / 4.02), 214px)";

  const filterParts: string[] = [];
  if (d.saturation != null && d.saturation !== 1) filterParts.push(`saturate(${d.saturation})`);

  return {
    state,
    root: {
      width, height, borderRadius: `${g.radius}px`,
      transform: `translateY(${d.translateY ?? 0}px)`,
      opacity: d.opacity ?? 1,
      filter: filterParts.join(" "),
      transition: `transform ${STATE_DURATION[state]}ms ${EASE}, box-shadow ${STATE_DURATION[state]}ms ${EASE}, opacity ${STATE_DURATION[state]}ms ${EASE}, filter ${STATE_DURATION[state]}ms ${EASE}`,
      cursor: d.cursor ?? "default",
      background, boxShadow: shadow,
    },
    innerLine, rimLight, grainOpacity,
    content: { iconRegion: g.iconRegion, labelGap: g.labelGap },
    icon, divider, label,
  };
}
