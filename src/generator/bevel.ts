import type { GenConfig, GenStateName, EffectRole, Shape, KitComponentId, KitSize, IconDef, StateDesign } from "./model";
import { lighten, darken, hexMix, desaturate, saturate, hexRgba, fontByName, DEFAULT_ICON, ICONS_ENABLED, STOCK_ICONS } from "./model";
import { iconGroup } from "./icons";
import rough from "roughjs";

/* Rough.js draws the hand-drawn *line character* over the approved outline —
   it never designs the silhouette. Fixed seed keeps every render, state card,
   copied code and download byte-identical. Results are memoized per path. */
let roughGen: ReturnType<typeof rough.generator> | null = null;
const inkCache = new Map<string, string>();
function roughInk(d: string, color: string, sw: number): string {
  const key = `${d}|${color}|${sw}`;
  const hit = inkCache.get(key);
  if (hit !== undefined) return hit;
  roughGen ??= rough.generator();
  const drawable = roughGen.path(d, { seed: 7, roughness: 1.7, bowing: 0.9 });
  const out = `<g data-layer="ink" opacity="0.8">` + roughGen.toPaths(drawable)
    .map((p) => `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`)
    .join("") + `</g>`;
  if (inkCache.size > 80) inkCache.clear();
  inkCache.set(key, out);
  return out;
}

// Candy engine v9 — a hard-candy shell built from ordered, independently
// tokenized layers:
//   1 cast shadow   2 extrusion   3 outer rim   4 bevel wall   5 face gradient
//   6 inner edge    7 inner glow  8 curved gloss 9 sharp specular
//   10 lower bloom  11 micro texture  12 text & icon treatment
// Pure (config, state) → SVG string for canvas + copy + exports. The lighting
// angle is the single source of truth: every gradient, the shadow direction,
// the gloss side and the specular position derive from it.

let UID = 0;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ── shape paths ─────────────────────────────────────────────── */
function norm(dx: number, dy: number): [number, number] {
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}
function polyRounded(v: [number, number][], r: number): string {
  const n = v.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = v[i], prev = v[(i + n - 1) % n], next = v[(i + 1) % n];
    const inV = norm(p[0] - prev[0], p[1] - prev[1]);
    const outV = norm(next[0] - p[0], next[1] - p[1]);
    const a = [p[0] - inV[0] * r, p[1] - inV[1] * r], b = [p[0] + outV[0] * r, p[1] + outV[1] * r];
    d += (i === 0 ? `M ${a[0].toFixed(1)} ${a[1].toFixed(1)} ` : `L ${a[0].toFixed(1)} ${a[1].toFixed(1)} `);
    d += `Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)} `;
  }
  return d + "Z";
}
function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.min(r, h / 2, w / 2);
  return `M ${x + rr} ${y} H ${x + w - rr} A ${rr} ${rr} 0 0 1 ${x + w} ${y + rr} V ${y + h - rr} A ${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h} H ${x + rr} A ${rr} ${rr} 0 0 1 ${x} ${y + h - rr} V ${y + rr} A ${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`;
}
/* Deterministic hash for authored irregularity (hand-drawn) — same output
   every render, every export, every reload. */
function silhash(i: number): number {
  return ((((i + 7) * 2654435761) >>> 0) % 1000) / 1000 - 0.5;
}
/* One straight run broken into gently wobbling segments — the hand-drawn ink
   line. Offsets are seeded, never random. */
function inkRun(x1: number, y1: number, x2: number, y2: number, wob: number, salt: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(2, Math.round(len / 56));
  const nx = -(y2 - y1) / (len || 1), ny = (x2 - x1) / (len || 1);
  let d = "";
  for (let i = 0; i < n; i++) {
    const tm = (i + 0.5) / n, t1 = (i + 1) / n;
    const off = silhash(salt + i) * 2 * wob;
    d += `Q ${(x1 + (x2 - x1) * tm + nx * off).toFixed(1)} ${(y1 + (y2 - y1) * tm + ny * off).toFixed(1)} ${(x1 + (x2 - x1) * t1).toFixed(1)} ${(y1 + (y2 - y1) * t1).toFixed(1)} `;
  }
  return d;
}

export function shapePath(shape: Shape, x: number, y: number, w: number, h: number, softness: number): string {
  if (shape === "pill") return roundRect(x, y, w, h, h / 2);
  if (shape === "round") return roundRect(x, y, w, h, 10 + softness * 0.34);
  /* ── v19 silhouette library — every layer insets this same geometry ── */
  if (shape === "cutline") {
    // broadcast-clean rectangle: small vertical cuts, wider clipped end caps
    const cx = Math.min(w * 0.14, h * 0.42), cy = h * 0.2;
    const v: [number, number][] = [
      [x + cx, y], [x + w - cx, y], [x + w, y + cy], [x + w, y + h - cy],
      [x + w - cx, y + h], [x + cx, y + h], [x, y + h - cy], [x, y + cy],
    ];
    return polyRounded(v, 2 + softness * 0.06);
  }
  if (shape === "polybar") {
    // strong top chamfer caps, smaller stepped lower corners — automotive rail
    const c = Math.min(w * 0.16, h * 0.6), b = c * 0.45, s = h * 0.26;
    const v: [number, number][] = [
      [x + c, y], [x + w - c, y], [x + w, y + s], [x + w, y + h - s * 0.55],
      [x + w - b, y + h], [x + b, y + h], [x, y + h - s * 0.55], [x, y + s],
    ];
    return polyRounded(v, 2 + softness * 0.05);
  }
  if (shape === "explorer") {
    // capsule with faceted (not circular) end housings
    const c = Math.min(w * 0.13, h * 0.55);
    const v: [number, number][] = [
      [x + c, y], [x + w - c, y],
      [x + w - c * 0.22, y + h * 0.24], [x + w, y + h * 0.5], [x + w - c * 0.22, y + h * 0.76],
      [x + w - c, y + h], [x + c, y + h],
      [x + c * 0.22, y + h * 0.76], [x, y + h * 0.5], [x + c * 0.22, y + h * 0.24],
    ];
    return polyRounded(v, 3 + softness * 0.08);
  }
  if (shape === "fighthud") {
    // opposing arrow brackets with an inward notch — competitive HUD
    const c = Math.min(w * 0.13, h * 0.85), n = c * 0.42;
    const v: [number, number][] = [
      [x + c, y], [x + w - c, y],
      [x + w, y + h * 0.24], [x + w - n, y + h * 0.5], [x + w, y + h * 0.76],
      [x + w - c, y + h], [x + c, y + h],
      [x, y + h * 0.76], [x + n, y + h * 0.5], [x, y + h * 0.24],
    ];
    return polyRounded(v, 1.5 + softness * 0.03);
  }
  if (shape === "crest") {
    // ceremonial plaque: sloped upper corners, shallow center point below
    const c = Math.min(w * 0.18, h * 0.52);
    const v: [number, number][] = [
      [x + c, y], [x + w - c, y], [x + w, y + c * 0.75], [x + w, y + h * 0.82],
      [x + w * 0.5, y + h], [x, y + h * 0.82], [x, y + c * 0.75],
    ];
    return polyRounded(v, 2 + softness * 0.06);
  }
  if (shape === "chunky") {
    // toy capsule: big shoulders + soft inset breaks top and bottom center
    const r = Math.min(h * 0.42, w * 0.3);
    const nw = Math.min(w * 0.3, w - 2 * r - 10), nd = h * 0.05;
    const mid = x + w / 2;
    const dipTop = nw > 8 ? `H ${(mid - nw / 2).toFixed(1)} Q ${mid.toFixed(1)} ${(y + nd * 2).toFixed(1)} ${(mid + nw / 2).toFixed(1)} ${y} ` : "";
    const dipBot = nw > 8 ? `H ${(mid + nw / 2).toFixed(1)} Q ${mid.toFixed(1)} ${(y + h - nd * 2).toFixed(1)} ${(mid - nw / 2).toFixed(1)} ${(y + h).toFixed(1)} ` : "";
    return `M ${x + r} ${y} ${dipTop}H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} ${dipBot}H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  }
  if (shape === "kart") {
    // mechanical end caps taller than the center rail — clean stepped waist
    const capW = Math.min(h * 0.8, w * 0.26), inset = h * 0.1, rc = h * 0.3;
    const R = (n: number) => n.toFixed(1);
    return `M ${R(x + capW)} ${R(y + inset)} H ${R(x + w - capW)} V ${y} H ${R(x + w - rc)} `
      + `A ${R(rc)} ${R(rc)} 0 0 1 ${x + w} ${R(y + rc)} V ${R(y + h - rc)} A ${R(rc)} ${R(rc)} 0 0 1 ${R(x + w - rc)} ${y + h} `
      + `H ${R(x + w - capW)} V ${R(y + h - inset)} H ${R(x + capW)} V ${y + h} H ${R(x + rc)} `
      + `A ${R(rc)} ${R(rc)} 0 0 1 ${x} ${R(y + h - rc)} V ${R(y + rc)} A ${R(rc)} ${R(rc)} 0 0 1 ${R(x + rc)} ${y} `
      + `H ${R(x + capW)} Z`;
  }
  if (shape === "mazepill") {
    // arcade capsule — elliptical ends flatter than a true pill
    const rx = Math.min(h * 0.62, w * 0.24), ry = h / 2;
    return `M ${x + rx} ${y} H ${x + w - rx} A ${rx} ${ry} 0 0 1 ${x + w} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h} H ${x + rx} A ${rx} ${ry} 0 0 1 ${x} ${y + ry} A ${rx} ${ry} 0 0 1 ${x + rx} ${y} Z`;
  }
  if (shape === "blade") {
    // swept side tips, shallow concave top/bottom — regal and fluid
    const sh = Math.min(w * 0.16, h * 1.1), dip = h * 0.1, tipY = y + h / 2;
    return `M ${x} ${tipY} `
      + `Q ${(x + sh * 0.35).toFixed(1)} ${(y + h * 0.1).toFixed(1)} ${(x + sh).toFixed(1)} ${(y + dip * 0.55).toFixed(1)} `
      + `Q ${(x + w / 2).toFixed(1)} ${(y + dip * 1.9).toFixed(1)} ${(x + w - sh).toFixed(1)} ${(y + dip * 0.55).toFixed(1)} `
      + `Q ${(x + w - sh * 0.35).toFixed(1)} ${(y + h * 0.1).toFixed(1)} ${x + w} ${tipY} `
      + `Q ${(x + w - sh * 0.35).toFixed(1)} ${(y + h * 0.9).toFixed(1)} ${(x + w - sh).toFixed(1)} ${(y + h - dip * 0.55).toFixed(1)} `
      + `Q ${(x + w / 2).toFixed(1)} ${(y + h - dip * 1.9).toFixed(1)} ${(x + sh).toFixed(1)} ${(y + h - dip * 0.55).toFixed(1)} `
      + `Q ${(x + sh * 0.35).toFixed(1)} ${(y + h * 0.9).toFixed(1)} ${x} ${tipY} Z`;
  }
  if (shape === "tavern") {
    // carved plaque: gently bowed top/bottom, softly concave side walls
    const bow = h * 0.06, side = Math.max(1.5, w * 0.012), r = Math.min(w, h) * 0.14;
    return `M ${(x + r).toFixed(1)} ${(y + bow * 0.6).toFixed(1)} `
      + `Q ${(x + w / 2).toFixed(1)} ${(y - bow * 0.5).toFixed(1)} ${(x + w - r).toFixed(1)} ${(y + bow * 0.6).toFixed(1)} `
      + `Q ${(x + w).toFixed(1)} ${(y + bow * 0.8).toFixed(1)} ${(x + w - side).toFixed(1)} ${(y + h * 0.26).toFixed(1)} `
      + `Q ${(x + w - side * 2.6).toFixed(1)} ${(y + h / 2).toFixed(1)} ${(x + w - side).toFixed(1)} ${(y + h * 0.74).toFixed(1)} `
      + `Q ${(x + w).toFixed(1)} ${(y + h - bow * 0.8).toFixed(1)} ${(x + w - r).toFixed(1)} ${(y + h - bow * 0.6).toFixed(1)} `
      + `Q ${(x + w / 2).toFixed(1)} ${(y + h + bow * 0.5).toFixed(1)} ${(x + r).toFixed(1)} ${(y + h - bow * 0.6).toFixed(1)} `
      + `Q ${x.toFixed(1)} ${(y + h - bow * 0.8).toFixed(1)} ${(x + side).toFixed(1)} ${(y + h * 0.74).toFixed(1)} `
      + `Q ${(x + side * 2.6).toFixed(1)} ${(y + h / 2).toFixed(1)} ${(x + side).toFixed(1)} ${(y + h * 0.26).toFixed(1)} `
      + `Q ${x.toFixed(1)} ${(y + bow * 0.8).toFixed(1)} ${(x + r).toFixed(1)} ${(y + bow * 0.6).toFixed(1)} Z`;
  }
  if (shape === "deepchamfer") {
    // elongated octagon — cuts nearly half the height, unmistakably angular
    const c = Math.min(w * 0.24, h * 0.44);
    const v: [number, number][] = [
      [x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c],
      [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c],
    ];
    return polyRounded(v, 2 + softness * 0.05);
  }
  if (shape === "banner") {
    // ribbon with swallowtail ends — an inverted V cut into each end
    const c = Math.min(w * 0.13, h * 0.62);
    const v: [number, number][] = [
      [x, y], [x + w, y], [x + w - c, y + h * 0.5], [x + w, y + h],
      [x, y + h], [x + c, y + h * 0.5],
    ];
    return polyRounded(v, 1.5 + softness * 0.03);
  }
  if (shape === "shield") {
    // flat top, straight walls, converging to a bottom center point
    const drop = h * 0.55;
    const v: [number, number][] = [
      [x, y], [x + w, y], [x + w, y + drop],
      [x + w * 0.5, y + h], [x, y + drop],
    ];
    return polyRounded(v, 3 + softness * 0.1);
  }
  if (shape === "pixelstep") {
    // staircase-quantized corners — reads retro at any size
    const st = Math.max(4, Math.round(h / 14)), n = 3;
    let d = `M ${x + n * st} ${y} `;
    for (let i = 0; i < n; i++) d += `H ${x + w - (n - i) * st} V ${y + (i + 1) * st} `;   // top-right stairs down
    d += `H ${x + w} V ${y + h - n * st} `;
    for (let i = 0; i < n; i++) d += `H ${x + w - (i + 1) * st} V ${y + h - n * st + (i + 1) * st} `; // bottom-right stairs
    d += `H ${x + n * st} `;
    for (let i = 0; i < n; i++) d += `H ${x + (n - i) * st} V ${y + h - (i + 1) * st} `;   // bottom-left stairs up
    d += `H ${x} V ${y + n * st} `;
    for (let i = 0; i < n; i++) d += `H ${x + (i + 1) * st} V ${y + n * st - (i + 1) * st} `; // top-left stairs
    return d + "Z";
  }
  if (shape === "handdrawn") {
    // inked plaque: seeded wobble runs + deliberately uneven corner cuts
    const wob = Math.max(1, h * 0.015);
    const r = Math.min(14, h * 0.14);
    const c = [r * 1.2, r * 0.8, r * 1.05, r * 0.9]; // authored, not random
    return `M ${(x + c[0]).toFixed(1)} ${y} `
      + inkRun(x + c[0], y, x + w - c[1], y, wob, 11)
      + `Q ${x + w} ${y} ${x + w} ${(y + c[1]).toFixed(1)} `
      + inkRun(x + w, y + c[1], x + w, y + h - c[2], wob, 29)
      + `Q ${x + w} ${y + h} ${(x + w - c[2]).toFixed(1)} ${y + h} `
      + inkRun(x + w - c[2], y + h, x + c[3], y + h, wob, 47)
      + `Q ${x} ${y + h} ${x} ${(y + h - c[3]).toFixed(1)} `
      + inkRun(x, y + h - c[3], x, y + c[0], wob, 71)
      + `Q ${x} ${y} ${(x + c[0]).toFixed(1)} ${y} Z`;
  }
  if (shape === "hex") {
    const cut = Math.min(h * 0.5, w * 0.18);
    const v: [number, number][] = [
      [x + cut, y], [x + w - cut, y], [x + w, y + h / 2],
      [x + w - cut, y + h], [x + cut, y + h], [x, y + h / 2],
    ];
    return polyRounded(v, 2 + softness * 0.1);
  }
  if (shape === "trapezoid") {
    const t = Math.min(h * 0.28, w * 0.12);
    const v: [number, number][] = [
      [x + t, y], [x + w - t, y], [x + w, y + h], [x, y + h],
    ];
    return polyRounded(v, 3 + softness * 0.12);
  }
  if (shape === "notch") {
    const c = Math.min(34, h * 0.26);
    const v: [number, number][] = [
      [x + c, y], [x + w, y], [x + w, y + h - c],
      [x + w - c, y + h], [x, y + h], [x, y + c],
    ];
    return polyRounded(v, 2 + softness * 0.1);
  }
  const cut = shape === "sharp" ? Math.min(34, h * 0.22) : Math.min(28, h * 0.17);
  const r = shape === "sharp" ? 1.5 : 3 + softness * 0.14;
  const v: [number, number][] = [
    [x + cut, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + h - cut],
    [x + w - cut, y + h], [x + cut, y + h], [x, y + h - cut], [x, y + cut],
  ];
  return polyRounded(v, r);
}

/** Five-point star sized into a pattern cell. */
function starPath(cell: number): string {
  const k = (cell * 0.66) / 24, ox = cell * 0.17, oy = cell * 0.17;
  const pts = [[12, 2.2], [14.9, 8.6], [21.8, 9.2], [16.6, 13.9], [18.2, 20.8], [12, 17.2], [5.8, 20.8], [7.4, 13.9], [2.2, 9.2], [9.1, 8.6]];
  return "M " + pts.map(([px, py]) => `${(ox + px * k).toFixed(1)} ${(oy + py * k).toFixed(1)}`).join(" L ") + " Z";
}

function effect(effects: GenConfig["effects"], role: EffectRole): string {
  const e = effects[role];
  if (e) return e;
  const bevel = effects.Bevel ?? "#0E9CC9";
  switch (role) {
    case "Bevel": return bevel;
    case "Glow": return lighten(bevel, 0.55);
    case "Highlight": return "#FFFFFF";
    case "Shadow": return darken(bevel, 0.5);
    case "Inner Fill": return lighten(bevel, 0.15);
  }
}

const bright = (c: string, b: number) => (b >= 0 ? lighten(c, b / 100) : darken(c, -b / 100));

/** Resolve which design renders a state: forked snapshot, else live mirror of
 *  Default. Each field falls back independently so partial saves stay safe. */
function designFor(cfg: GenConfig, state: GenStateName): StateDesign {
  const d = state !== "default" ? cfg.stateDesigns?.[state as Exclude<GenStateName, "default">] : undefined;
  if (!d) return cfg;
  return {
    shape: d.shape ?? cfg.shape, effects: d.effects ?? cfg.effects, face: d.face ?? cfg.face,
    bevel: d.bevel ?? cfg.bevel, candy: d.candy ?? cfg.candy, lighting: d.lighting ?? cfg.lighting,
    shadow: d.shadow ?? cfg.shadow, transparency: d.transparency ?? cfg.transparency, type: d.type ?? cfg.type,
  };
}

interface Geom { x: number; y: number; h: number; fs: number; iconSize: number; minW?: number; maxW?: number }

/** Core builder — the candy stack. Width grows with the content. */
function build(cfg: GenConfig, state: GenStateName, g0: Geom, opts: {
  label?: string; iconDef?: IconDef | null; secondary?: boolean; shapeOverride?: Shape; fixedW?: number;
} = {}): string {
  const id = "b" + UID++;
  const disabled = state === "disabled";
  const adj = cfg.states[state];
  const P = (c: string) => {
    if (disabled) return lighten(desaturate(c, 0.82), 0.1);
    const sat = clamp(adj.saturation ?? 0, -100, 100);
    return bright(sat ? saturate(c, sat / 100) : c, adj.brightness);
  };
  const secondary = !!opts.secondary;
  const D = designFor(cfg, state);
  const shape = opts.shapeOverride ?? D.shape;
  const C = D.candy;
  const K = g0.h / 168; // token px scale for kit sizes

  const bevelC = P(effect(D.effects, "Bevel"));
  const glowC = disabled ? "#B9BEC6" : P(effect(D.effects, "Glow"));
  const hiC = P(effect(D.effects, "Highlight"));
  const shC = effect(D.effects, "Shadow");
  const fillC = P(effect(D.effects, "Inner Fill"));

  const darkFace = D.face.mode === "dark";
  let face = darkFace ? hexMix(bevelC, "#0B0714", 0.72) : fillC;
  if (secondary) face = hexMix(face, darkFace ? "#100A1C" : "#FFFFFF", 0.78);
  const autoLabel = disabled ? "#A7AAB4"
    : secondary ? (darkFace ? lighten(bevelC, 0.55) : darken(bevelC, 0.12))
    : darkFace ? lighten(bevelC, 0.66) : "#FFFFFF";

  /* ── auto-size geometry: the shape grows with the content ────── */
  const { x, y, h, iconSize: baseIcon } = g0;
  const T2 = D.type;
  const fontDef = fontByName(T2.font);
  const fs = g0.fs * (T2.size / 52);
  const rawLabel = opts.label ?? cfg.content.label ?? "PLAY";
  const cased = T2.case === "upper" ? rawLabel.toUpperCase()
    : T2.case === "lower" ? rawLabel.toLowerCase()
    : T2.case === "title" ? rawLabel.replace(/\b\w/g, (m) => m.toUpperCase())
    : rawLabel;
  const label = esc(cased);

  // Config-driven icons are parked behind ICONS_ENABLED; explicit kit icons
  // (opts.iconDef) still render so the icon-button component keeps working.
  const iconDef = opts.iconDef === null ? null
    : opts.iconDef ?? (ICONS_ENABLED && cfg.icon.show ? (cfg.icon.def ?? DEFAULT_ICON) : null);
  const iconOnly = opts.iconDef !== undefined ? !opts.label : (ICONS_ENABLED && cfg.icon.only && !!iconDef);
  const showText = !iconOnly && label.length > 0;
  const iconSize = baseIcon * (cfg.icon.size / 100);
  const gap = showText && iconDef ? cfg.icon.gap * K : 0;
  const spacingEm = T2.spacing / 100;
  const weightK = 1 + Math.max(0, T2.weight - 700) * 0.0004;
  const italicPad = T2.italic ? fs * 0.3 : 0; // slanted glyphs overhang their advance
  const textW = (showText ? label.length * fs * fontDef.factor * (1 + spacingEm) * weightK * 1.06 : 0) + italicPad;
  const contentW = textW + (iconDef ? iconSize : 0) + gap;
  const endRoom = shape === "pill" ? h * 0.16 : 0; // rounded ends eat width
  const padX = (iconOnly ? Math.max(24, h * 0.2) : Math.max(64 * K, h * 0.42)) + endRoom;
  const minW = opts.fixedW ?? (iconOnly ? Math.max(h, contentW + padX * 2) : Math.max(g0.minW ?? 230 * K, contentW + padX * 2));
  const w = opts.fixedW ?? Math.min(g0.maxW ?? 980, minW);

  /* ── extrusion & lift ─────────────────────────────────────────── */
  const depth = C.extrusion.depth * K * (secondary ? 0.55 : 1);
  const visDepth = Math.max(0, depth);
  const lift = adj.lift;

  const vw = x * 2 + w, vh = y * 2 + h + Math.ceil(depth) + 40; // generous room so big shadows never clip

  const bw = (secondary ? Math.max(4, D.bevel.width * 0.7) : D.bevel.width) * K;
  const rimW = C.rim.width * K;
  const outer = shapePath(shape, x, y, w, h, D.bevel.softness);
  const faceP = shapePath(shape, x + bw, y + bw, w - bw * 2, h - bw * 2, Math.max(0, D.bevel.softness - 8));
  const rimP = shapePath(shape, x + rimW / 2 + 0.8, y + rimW / 2 + 0.8, w - rimW - 1.6, h - rimW - 1.6, D.bevel.softness);

  /* ── key light — global source of truth ──────────────────────── */
  const A = ((D.lighting.angle % 360) + 360) % 360;
  const rad = (A * Math.PI) / 180;
  const lx = Math.cos(rad), ly = -Math.sin(rad); // +l points toward the light
  const gpos = (k: number) => (0.5 + clamp(k, -1, 1) * 0.5).toFixed(3);
  const axis = `x1="${gpos(-lx)}" y1="${gpos(-ly)}" x2="${gpos(lx)}" y2="${gpos(ly)}"`;
  const hiK = (disabled ? 0.35 : 1) * (D.lighting.highlight / 78);
  const lowK = Math.max(0.1, D.lighting.lowlight / 46);

  /* 1 ── cast shadow (grounded — does not travel with the lift) ── */
  const sd = D.shadow.distance * K;
  const sdx = -lx * sd * 0.55;
  const sdy = visDepth + Math.max(1.5, sd * 0.7 - ly * sd * 0.3) + Math.max(0, lift);
  const sBlur = Math.max(0.5, D.shadow.blur * 0.5);
  const shOp = (D.shadow.opacity / 100) * (disabled ? 0.35 : 1);
  const castShadow = shOp > 0.005
    ? `<path d="${outer}" transform="translate(${sdx.toFixed(1)} ${sdy.toFixed(1)})" fill="${shC}" opacity="${shOp.toFixed(2)}" filter="url(#${id}sb)"/>`
    : "";

  /* state aura (hover glow etc.) — own color, or the Glow well */
  const auraC = disabled ? "#B9BEC6" : C.aura.color ? P(C.aura.color) : glowC;
  const glowOp = (adj.glow / 100) * (secondary ? 0.4 : 1) * (disabled ? 0 : 1);
  const aura = glowOp > 0.01
    ? `<path d="${outer}" transform="translate(0 ${(lift + visDepth * 0.4).toFixed(1)})" fill="${auraC}" opacity="${glowOp.toFixed(2)}" filter="url(#${id}gb)"/>`
    : "";

  /* 2 ── extrusion body — a connected solid, not a dark underlay.
     The body keeps the shell's saturation, is lit by the same key light
     (lit flank brighter, far flank darker), darkens toward the ground and
     carries a thin bounce-light lip along its bottom curve. Interpolated
     copies keep the silhouette continuous on soft corners. */
  const dk = C.extrusion.darkness / 100;
  const deepC = hexMix(darken(bevelC, clamp(0.24 + 0.34 * dk, 0, 0.8)), bevelC, 0.18);
  // enough interpolated slices that the side stays a continuous wall even at
  // maximum depth — no scalloping between the cap and the base
  const nSlices = Math.max(2, Math.ceil(visDepth / 2.5));
  const slices = Array.from({ length: nSlices }, (_, i) => {
    const ty = (visDepth * (i + 1)) / nSlices;
    const last = i === nSlices - 1;
    return `<path d="${outer}" transform="translate(0 ${ty.toFixed(1)})" fill="url(#${id}ext)"${last ? ` stroke="${darken(deepC, 0.35)}" stroke-width="1"` : ""}/>`;
  }).join("");
  // base glow: light caught inside the body, centered under the face
  const egC = C.innerGlow.color ? P(C.innerGlow.color) : glowC;
  const egOp = (C.extrusion.glow / 100) * (disabled ? 0 : 1);
  const baseGlow = egOp > 0.01 && visDepth > 1
    ? `<g clip-path="url(#${id}ec)"><ellipse cx="${(x + w / 2).toFixed(1)}" cy="${(y + h + visDepth * 0.45).toFixed(1)}" rx="${(w * 0.32).toFixed(1)}" ry="${Math.max(8, visDepth * 1.1).toFixed(1)}" fill="url(#${id}eg)" opacity="${egOp.toFixed(2)}"/></g>`
    : "";
  const extrusion = visDepth > 0.3
    ? `<g>
        ${slices}
        <path d="${outer}" transform="translate(0 ${visDepth.toFixed(1)})" fill="url(#${id}extv)"/>
        ${baseGlow}
        <path d="${outer}" transform="translate(0 ${(visDepth - 0.8).toFixed(1)})" fill="none" stroke="${lighten(deepC, 0.38)}" stroke-width="1.2" opacity="0.45"/>
      </g>`
    : "";

  /* contact shadow — grounded occlusion right where the body meets the
     surface; fades as the button lifts, tightens when pressed */
  const contactOp = (C.contact.opacity / 100) * (disabled ? 0.4 : 1) * clamp(1 - Math.max(0, -lift) / 10, 0.25, 1);
  const contact = contactOp > 0.01
    ? `<ellipse cx="${(x + w / 2 + sdx * 0.35).toFixed(1)}" cy="${(y + h + visDepth + Math.max(0, lift) + 1.5).toFixed(1)}" rx="${(w * 0.47).toFixed(1)}" ry="${(5.5 * K + visDepth * 0.22).toFixed(1)}" fill="url(#${id}ct)" opacity="${contactOp.toFixed(2)}"/>`
    : "";

  /* face box (for screen-space layers) */
  const fx0 = x + bw, fy0 = y + bw, fw = w - bw * 2, fh = h - bw * 2;
  const faceCx = fx0 + fw / 2, faceCy = fy0 + fh / 2;

  /* 7 ── inner glow (own color, or the Glow well; unlit side) */
  const igC = C.innerGlow.color ? P(C.innerGlow.color) : glowC;
  const igOp = (C.innerGlow.opacity / 100) * (disabled ? 0 : 1);
  const igSize = clamp(C.innerGlow.size / 100, 0.05, 1);

  /* pattern overlay — tone-on-tone by default, like printed candy wrap.
     Halftone fades its dot grid along the light axis for that comic-print
     hard-gradient read. */
  const PT = C.pattern;
  const patC = PT.color ? P(PT.color) : darken(face, 0.2);
  const patOp = (PT.type !== "none" ? PT.opacity / 100 : 0) * (disabled ? 0.5 : 1);
  const ps = (8 + PT.scale * 0.9) * K;
  let patternDef = "", patternUse = "";
  if (patOp > 0.005) {
    const rot = ` patternTransform="rotate(${PT.angle})"`;
    const cell = `id="${id}pt" width="${ps.toFixed(1)}" height="${ps.toFixed(1)}" patternUnits="userSpaceOnUse"`;
    if (PT.type === "stripes") patternDef = `<pattern ${cell}${rot}><rect width="${(ps / 2).toFixed(1)}" height="${ps.toFixed(1)}" fill="${patC}"/></pattern>`;
    else if (PT.type === "dots") patternDef = `<pattern ${cell}${rot}><circle cx="${(ps / 2).toFixed(1)}" cy="${(ps / 2).toFixed(1)}" r="${(ps * 0.22).toFixed(1)}" fill="${patC}"/></pattern>`;
    else if (PT.type === "stars") patternDef = `<pattern ${cell}${rot}><path d="${starPath(ps)}" fill="${patC}"/></pattern>`;
    else if (PT.type === "checker") patternDef = `<pattern ${cell}${rot}><rect width="${(ps / 2).toFixed(1)}" height="${(ps / 2).toFixed(1)}" fill="${patC}"/><rect x="${(ps / 2).toFixed(1)}" y="${(ps / 2).toFixed(1)}" width="${(ps / 2).toFixed(1)}" height="${(ps / 2).toFixed(1)}" fill="${patC}"/></pattern>`;
    else if (PT.type === "halftone") {
      patternDef = `<pattern ${cell} patternTransform="rotate(45)"><circle cx="${(ps / 2).toFixed(1)}" cy="${(ps / 2).toFixed(1)}" r="${(ps * 0.3).toFixed(1)}" fill="${patC}"/></pattern>
      <linearGradient id="${id}pmg" ${axis}><stop offset="0" stop-color="#fff"/><stop offset=".85" stop-color="#000"/></linearGradient>
      <mask id="${id}pm"><rect x="${fx0 - 20}" y="${fy0 - 20}" width="${fw + 40}" height="${fh + 40}" fill="url(#${id}pmg)"/></mask>`;
    }
    if (patternDef) {
      const maskAttr = PT.type === "halftone" ? ` mask="url(#${id}pm)"` : "";
      patternUse = `<rect x="${fx0 - 20}" y="${fy0 - 20}" width="${fw + 40}" height="${fh + 40}" fill="url(#${id}pt)" opacity="${patOp.toFixed(2)}"${maskAttr}/>`;
    }
  }

  /* 8 ── broad curved gloss (screen space, flips if lit from below) */
  const flip = ly > 0.25; // light from below
  const gH = fh * clamp(C.gloss.height / 100, 0.08, 0.92);
  const bow = C.gloss.curve * K * (flip ? -1 : 1);
  const apexX = faceCx + lx * fw * 0.12;
  const gy = flip ? fy0 + fh - gH : fy0 + gH;
  const glossPath = flip
    ? `M ${fx0 - 2} ${fy0 + fh + 2} H ${fx0 + fw + 2} V ${gy.toFixed(1)} Q ${apexX.toFixed(1)} ${(gy + bow * 1.8).toFixed(1)} ${fx0 - 2} ${gy.toFixed(1)} Z`
    : `M ${fx0 - 2} ${fy0 - 2} H ${fx0 + fw + 2} V ${gy.toFixed(1)} Q ${apexX.toFixed(1)} ${(gy + bow * 1.8).toFixed(1)} ${fx0 - 2} ${gy.toFixed(1)} Z`;
  const gOpTop = (C.gloss.opacity / 100) * (disabled ? 0.35 : 1);
  const soft = clamp(C.gloss.softness / 100, 0, 1);
  const glossC1 = C.gloss.fill === "highlight" ? hiC : P(C.gloss.tint);
  const glossC2 = C.gloss.fill === "gradient" ? P(C.gloss.tint2) : glossC1;
  const gloss = C.gloss.on && gOpTop > 0.01
    ? `<path d="${glossPath}" fill="url(#${id}gl)"/>`
    : "";

  /* 9 ── specular — six art-directable reflective events, all keyed to the
     light: position sits toward the lit corner, tilt follows the light,
     softness shapes the falloff, stretch shapes the aspect. */
  const SP = C.specular;
  const spSize = SP.size * K;
  const spOp = (SP.intensity / 100) * (disabled ? 0.25 : 1);
  const spX = faceCx + lx * fw * 0.34 + (SP.ox / 100) * fw * 0.4;
  const spY = faceCy + ly * fh * 0.3 + (SP.oy / 100) * fh * 0.4;
  const spRot = clamp((90 - A) * 0.35, -40, 40) + SP.angle;
  const spAspect = clamp(SP.stretch / 100, 0.1, 1);
  const soft01 = clamp(SP.softness / 100, 0, 1);
  const effSoft = SP.mode === "hard" ? Math.min(soft01, 0.15)
    : SP.mode === "line" ? Math.min(soft01, 0.3)
    : SP.mode === "soft" ? Math.max(soft01, 0.35)
    : soft01;
  const spRx = SP.mode === "line" ? spSize * 2.1 : spSize;
  const spRy = SP.mode === "line" ? Math.max(1.6, spSize * 0.6 * spAspect) : Math.max(2, spSize * spAspect);
  let specular = "";
  if (SP.on && spOp > 0.01 && spSize > 0.5) {
    if (SP.mode === "anime") {
      // stylized crisp double-bar highlight: one long swoosh + one short block
      const bh = Math.max(3, spSize * 0.9 * Math.max(spAspect, 0.28));
      const b1w = spSize * 2.2, b2w = Math.max(bh, spSize * 0.66);
      const gapPx = b2w * 0.5 * (SP.gap / 100);
      specular = `<g transform="rotate(${spRot.toFixed(1)} ${spX.toFixed(1)} ${spY.toFixed(1)})" opacity="${spOp.toFixed(2)}">
        <rect x="${(spX - b1w / 2 - b2w * 0.75).toFixed(1)}" y="${(spY - bh / 2).toFixed(1)}" width="${b1w.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bh / 2).toFixed(1)}" fill="${hiC}"/>
        <rect x="${(spX + b1w / 2 - b2w * 0.75 + gapPx).toFixed(1)}" y="${(spY - bh / 2).toFixed(1)}" width="${b2w.toFixed(1)}" height="${bh.toFixed(1)}" rx="${(bh / 2).toFixed(1)}" fill="${hiC}"/>
      </g>`;
    } else if (SP.mode === "sweep") {
      // reflective event hugging the shell's edge curve on the lit side
      const swW = Math.max(2, spSize * 0.32);
      const sweepP = shapePath(shape, x + bw * 0.55, y + bw * 0.55, w - bw * 1.1, h - bw * 1.1, Math.max(0, D.bevel.softness - 4));
      specular = `<path d="${sweepP}" fill="none" stroke="url(#${id}sw)" stroke-width="${swW.toFixed(1)}" opacity="${spOp.toFixed(2)}"/>`;
    } else {
      const main = `<ellipse cx="${spX.toFixed(1)}" cy="${spY.toFixed(1)}" rx="${spRx.toFixed(1)}" ry="${spRy.toFixed(1)}" fill="url(#${id}sp)" opacity="${spOp.toFixed(2)}"/>`;
      const dualGap = SP.gap / 100;
      const sat = SP.mode === "dual"
        ? `<ellipse cx="${(spX - spRx * 1.8 * dualGap).toFixed(1)}" cy="${(spY + spRy * 2.2 * dualGap).toFixed(1)}" rx="${(spRx * 0.42).toFixed(1)}" ry="${(spRy * 0.5).toFixed(1)}" fill="url(#${id}sp)" opacity="${(spOp * 0.8).toFixed(2)}"/>`
        : SP.mode === "hard"
          ? `<ellipse cx="${(spX - spRx * 1.6).toFixed(1)}" cy="${(spY + spRy * 1.9).toFixed(1)}" rx="${(spRx * 0.3).toFixed(1)}" ry="${(spRy * 0.4).toFixed(1)}" fill="url(#${id}sp)" opacity="${(spOp * 0.6).toFixed(2)}"/>`
          : "";
      specular = `<g transform="rotate(${spRot.toFixed(1)} ${spX.toFixed(1)} ${spY.toFixed(1)})">${main}${sat}</g>`;
    }
  }

  /* 10 ── lower reflective bloom (bounce light, unlit side) */
  const blOp = (C.bloom.opacity / 100) * (disabled ? 0.3 : 1);
  const blS = clamp(C.bloom.size / 100, 0.05, 1.2);
  const blX = faceCx - lx * fw * 0.16;
  const blY = faceCy - ly * fh * 0.3;
  const bloom = blOp > 0.01
    ? `<ellipse cx="${blX.toFixed(1)}" cy="${blY.toFixed(1)}" rx="${(fw * 0.46 * blS).toFixed(1)}" ry="${(fh * 0.26 * blS).toFixed(1)}" fill="url(#${id}bl)" opacity="${blOp.toFixed(2)}"/>`
    : "";

  /* 11 ── micro texture — contrast-boosted grain that actually reads */
  const nzOp = (C.texture.amount / 100) * 0.6 * (disabled ? 0.4 : 1);
  const nzFreq = (0.25 + (C.texture.scale / 100) * 1.6).toFixed(2);
  const noise = nzOp > 0.005
    ? `<rect x="${fx0}" y="${fy0}" width="${fw}" height="${fh}" filter="url(#${id}nz)" opacity="${nzOp.toFixed(2)}" style="mix-blend-mode:overlay"/>`
    : "";

  /* 6 ── inner edge shading */
  const edgeOp = C.innerEdge.strength / 100;
  const innerEdge = edgeOp > 0.01 && C.innerEdge.width > 0.1
    ? `<path d="${faceP}" fill="none" stroke="url(#${id}ie)" stroke-width="${(C.innerEdge.width * K).toFixed(1)}" opacity="${clamp(edgeOp, 0, 1).toFixed(2)}"/>`
    : "";

  /* ── 12 · content: expanded text & icon treatment ────────────── */
  const tFill = T2.fillMode === "auto" ? autoLabel
    : T2.fillMode === "gradient" ? `url(#${id}tg)` : P(T2.fill);
  // Text effects render through a native SVG filter with a generous explicit
  // region — CSS filters on SVG text clip and misrender in Safari, which is
  // exactly the "cut-off italics / invisible emboss" failure. Geometry scales
  // with the type size so a 76px headline carries the same relief as 40px.
  const prims: string[] = [];
  const fds = (dx: number | string, dy: number | string, dev: number, color: string, op: number | string) =>
    `<feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${dev.toFixed(1)}" flood-color="${color}" flood-opacity="${op}"/>`;
  const fsc = fs / 40;
  if (T2.emboss.on && !disabled) {
    // emboss (raised) or deboss (engraved). The relief follows the master
    // light: the highlight offsets toward it, the shade away from it, and
    // deboss flips the pair. Distance, softness and each side's opacity are
    // all independently art-directable.
    const s = clamp(T2.emboss.strength / 100, -1, 1);
    if (s !== 0) {
      const a = Math.abs(s);
      const dist = (T2.emboss.distance ?? 2) * fsc * (0.6 + a * 0.8);
      const ebl = ((0.3 + ((T2.emboss.softness ?? 30) / 100) * 2.6) * fsc).toFixed(1);
      const sign = s > 0 ? 1 : -1;
      const hx = (lx * dist * sign).toFixed(1), hy = (ly * dist * sign).toFixed(1);
      const sxo = (-lx * dist * sign).toFixed(1), syo = (-ly * dist * sign).toFixed(1);
      const hiO = (a * ((T2.emboss.hiOpacity ?? 70) / 100)).toFixed(2);
      const shO = (a * ((T2.emboss.shOpacity ?? 60) / 100)).toFixed(2);
      prims.push(fds(hx, hy, Number(ebl) * 0.5, T2.emboss.hiColor ?? "#FFFFFF", hiO));
      prims.push(fds(sxo, syo, Number(ebl) * 0.5, T2.emboss.shColor ?? "#04080E", shO));
    }
  }
  if (T2.shadow.on) prims.push(fds((T2.shadow.x * fsc).toFixed(1), (T2.shadow.y * fsc).toFixed(1), T2.shadow.blur * fsc * 0.5, T2.shadow.color, (T2.shadow.opacity / 100).toFixed(2)));
  if (T2.glow.on && !disabled) {
    prims.push(fds(0, 0, T2.glow.size * 0.3, T2.glow.color, (T2.glow.opacity / 100).toFixed(2)));
    prims.push(fds(0, 0, T2.glow.size * 0.8, T2.glow.color, ((T2.glow.opacity / 100) * 0.6).toFixed(2)));
  }
  const textFxDef = prims.length
    ? `<filter id="${id}tf" x="-70%" y="-70%" width="240%" height="240%" color-interpolation-filters="sRGB">${prims.join("")}</filter>`
    : "";
  const textFilter = prims.length ? ` filter="url(#${id}tf)"` : "";
  const outlineStroke = T2.outline.color2 ? `url(#${id}og)` : P(T2.outline.color);
  const outlineAttrs = T2.outline.on
    ? ` stroke="${outlineStroke}" stroke-width="${(T2.outline.width * (fs / 52)).toFixed(1)}" stroke-linejoin="round" paint-order="stroke"`
    : "";

  const iFx = cfg.icon.fx;
  const iFilters: string[] = [];
  if (iFx.emboss && !disabled) iFilters.push(`drop-shadow(0 -1px 0.4px rgba(255,255,255,0.6)) drop-shadow(0 1.6px 1px rgba(4,8,14,0.5))`);
  if (iFx.shadow) iFilters.push(`drop-shadow(0 2px 1.5px rgba(0,0,0,0.4))`);
  if (iFx.glow && !disabled) iFilters.push(`drop-shadow(0 0 5px ${glowC}) drop-shadow(0 0 12px ${hexRgba(glowC, 0.6)})`);
  const iconFilter = iFilters.length ? iFilters.join(" ") : undefined;
  // explicit kit icons (icon button) inherit the typography treatment:
  // same fill resolution and the same effect filter as the label
  const inheritTypo = opts.iconDef !== undefined && !!iconDef && !showText;
  const iconColor = disabled ? "#A7AAB4"
    : inheritTypo ? (T2.fillMode === "auto" ? autoLabel : P(T2.fill))
    : cfg.icon.color ? P(cfg.icon.color) : (T2.fillMode === "solid" ? P(T2.fill) : autoLabel);


  /* layout */
  const cx = x + w / 2, cy = y + h / 2;
  const startX = cx - contentW / 2;
  const placeLeft = opts.iconDef === undefined && cfg.icon.placement === "left" && !iconOnly;
  const italicShift = T2.italic ? italicPad * 0.35 : 0; // rebalance the lean
  const textX = (placeLeft ? startX + (iconDef ? iconSize + gap : 0) + textW / 2 : startX + textW / 2) - italicShift;
  const iconX = (iconOnly ? cx - iconSize / 2 : placeLeft ? startX : startX + textW + gap) + cfg.icon.ox * K;
  const iconY = cy - iconSize / 2 + cfg.icon.oy * K;

  const T = D.transparency;
  const fontStyle = T2.italic ? ` font-style="italic"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" font-family="'${T2.font}', Inter, sans-serif" role="img" aria-label="${label || "component"}, ${state} state">
<defs>
  <linearGradient id="${id}band" ${axis}>
    <stop offset="0" stop-color="${darken(bevelC, clamp(0.3 * lowK, 0, 0.7))}"/>
    <stop offset=".5" stop-color="${bevelC}"/>
    <stop offset="1" stop-color="${lighten(bevelC, clamp(0.45 * hiK, 0, 0.75))}"/>
  </linearGradient>
  <linearGradient id="${id}ext" x1="${lx >= 0 ? 1 : 0}" y1="0.5" x2="${lx >= 0 ? 0 : 1}" y2="0.5">
    <stop offset="0" stop-color="${lighten(deepC, clamp(0.06 + 0.26 * Math.abs(lx) * hiK, 0, 0.5))}"/>
    <stop offset="0.55" stop-color="${deepC}"/>
    <stop offset="1" stop-color="${darken(deepC, clamp(0.05 + 0.2 * Math.abs(lx) * lowK, 0, 0.5))}"/>
  </linearGradient>
  <linearGradient id="${id}extv" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.5" stop-color="${darken(deepC, 0.55)}" stop-opacity="0"/>
    <stop offset="1" stop-color="${darken(deepC, 0.55)}" stop-opacity="0.38"/>
  </linearGradient>
  <radialGradient id="${id}ct">
    <stop offset="0" stop-color="${shC}" stop-opacity="1"/>
    <stop offset="1" stop-color="${shC}" stop-opacity="0"/>
  </radialGradient>
  ${baseGlow ? `<clipPath id="${id}ec"><path d="${outer}" transform="translate(0 ${visDepth.toFixed(1)})"/></clipPath>
  <radialGradient id="${id}eg"><stop offset="0" stop-color="${egC}" stop-opacity="1"/><stop offset="1" stop-color="${egC}" stop-opacity="0"/></radialGradient>` : ""}
  ${patternDef}
  <linearGradient id="${id}rim" ${axis}>
    <stop offset="0" stop-color="${hiC}" stop-opacity="0.45"/>
    <stop offset=".4" stop-color="${hiC}" stop-opacity="0.08"/>
    <stop offset="1" stop-color="${hiC}" stop-opacity="0.95"/>
  </linearGradient>
  <linearGradient id="${id}face" ${axis}>
    <stop offset="0" stop-color="${darken(face, clamp(0.24 * (D.face.contrast / 50) * lowK, 0, 0.6))}"/>
    <stop offset="${clamp(1 - D.face.midpoint / 100, 0.08, 0.92).toFixed(2)}" stop-color="${face}"/>
    <stop offset="1" stop-color="${lighten(face, clamp(0.3 * (D.face.contrast / 50) * hiK, 0, 0.7))}"/>
  </linearGradient>
  <linearGradient id="${id}ie" ${axis}>
    <stop offset="0" stop-color="${hexRgba(lighten(face, 0.55), 0.55)}"/>
    <stop offset=".55" stop-color="${hexRgba(darken(bevelC, 0.35), 0.35)}"/>
    <stop offset="1" stop-color="${hexRgba(darken(bevelC, 0.58), 0.9)}"/>
  </linearGradient>
  <linearGradient id="${id}ig" ${axis}>
    <stop offset="0" stop-color="${igC}" stop-opacity="${igOp.toFixed(2)}"/>
    <stop offset="${igSize.toFixed(2)}" stop-color="${igC}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="${id}gl" x1="0" y1="${flip ? 1 : 0}" x2="0" y2="${flip ? 0 : 1}">
    <stop offset="0" stop-color="${glossC1}" stop-opacity="${gOpTop.toFixed(2)}"/>
    <stop offset="${(1 - soft * 0.55).toFixed(2)}" stop-color="${hexMix(glossC1, glossC2, 0.6)}" stop-opacity="${(gOpTop * (1 - 0.3 * soft)).toFixed(2)}"/>
    <stop offset="1" stop-color="${glossC2}" stop-opacity="${(gOpTop * (1 - soft)).toFixed(2)}"/>
  </linearGradient>
  <radialGradient id="${id}sp">
    <stop offset="0" stop-color="${hiC}" stop-opacity="1"/>
    <stop offset="${clamp(0.85 - effSoft * 0.7, 0.1, 0.85).toFixed(2)}" stop-color="${hiC}" stop-opacity="1"/>
    <stop offset="${clamp(0.92 - effSoft * 0.35, 0.2, 0.95).toFixed(2)}" stop-color="${hiC}" stop-opacity="${(0.5 - effSoft * 0.25).toFixed(2)}"/>
    <stop offset="1" stop-color="${hiC}" stop-opacity="0"/>
  </radialGradient>
  ${SP.mode === "sweep" ? `<linearGradient id="${id}sw" ${axis}>
    <stop offset="0" stop-color="${hiC}" stop-opacity="0"/>
    <stop offset="${(0.5 + 0.22 * (1 - effSoft)).toFixed(2)}" stop-color="${hiC}" stop-opacity="0"/>
    <stop offset="${(0.66 + 0.18 * (1 - effSoft)).toFixed(2)}" stop-color="${hiC}" stop-opacity="0.85"/>
    <stop offset="1" stop-color="${hiC}" stop-opacity="1"/>
  </linearGradient>` : ""}
  <radialGradient id="${id}bl">
    <stop offset="0" stop-color="${hiC}" stop-opacity="1"/>
    <stop offset="1" stop-color="${hiC}" stop-opacity="0"/>
  </radialGradient>
  ${T2.fillMode === "gradient" ? `<linearGradient id="${id}tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P(T2.fill)}"/><stop offset="1" stop-color="${P(T2.fill2)}"/></linearGradient>` : ""}
  ${T2.outline.on && T2.outline.color2 ? `<linearGradient id="${id}og" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P(T2.outline.color)}"/><stop offset="1" stop-color="${P(T2.outline.color2)}"/></linearGradient>` : ""}
  ${textFxDef}
  <clipPath id="${id}fc"><path d="${faceP}"/></clipPath>
  ${castShadow ? `<filter id="${id}sb" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${sBlur.toFixed(1)}"/></filter>` : ""}
  ${aura ? `<filter id="${id}gb" x="-45%" y="-45%" width="190%" height="190%"><feGaussianBlur stdDeviation="11"/></filter>` : ""}
  ${noise ? `<filter id="${id}nz" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="${nzFreq}" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="2.6" intercept="-0.8"/><feFuncG type="linear" slope="2.6" intercept="-0.8"/><feFuncB type="linear" slope="2.6" intercept="-0.8"/></feComponentTransfer></filter>` : ""}
</defs>
<g opacity="${(adj.opacity / 100).toFixed(2)}">
  ${castShadow}
  ${contact}
  ${aura}
  <g transform="translate(0 ${lift})">
    ${extrusion}
    <g opacity="${(T.frame / 100).toFixed(2)}">
      <path d="${outer}" fill="url(#${id}band)" stroke="${darken(bevelC, disabled ? 0.25 : 0.5)}" stroke-width="1.5"/>
      ${rimW > 0.2 ? `<path d="${rimP}" fill="none" stroke="url(#${id}rim)" stroke-width="${rimW.toFixed(1)}" opacity="${((C.rim.brightness / 100) * (disabled ? 0.5 : 1)).toFixed(2)}"/>` : ""}
      ${shape === "handdrawn" && !disabled ? roughInk(outer, darken(bevelC, 0.58), 1.4 * K) : ""}
    </g>
    <g opacity="${(T.interior / 100).toFixed(2)}">
      <path d="${faceP}" fill="url(#${id}face)"/>
      <g clip-path="url(#${id}fc)">
        ${patternUse}
        ${igOp > 0.01 ? `<path d="${faceP}" fill="url(#${id}ig)"/>` : ""}
        ${bloom}
        ${C.gloss.layer === "above" ? "" : gloss}
        ${noise}
      </g>
      ${innerEdge}
    </g>
    <g opacity="${(T.content / 100).toFixed(2)}">
      ${showText ? `<text x="${textX.toFixed(1)}" y="${cy + 1}" font-size="${fs.toFixed(1)}" font-weight="${T2.weight}"${fontStyle} letter-spacing="${spacingEm.toFixed(3)}em" fill="${tFill}"${(T2.fillOpacity ?? 100) < 100 ? ` fill-opacity="${(T2.fillOpacity / 100).toFixed(2)}"` : ""}${outlineAttrs} text-anchor="middle" dominant-baseline="central"${textFilter}>${label}</text>` : ""}
      ${iconDef ? (inheritTypo && prims.length
        ? `<g filter="url(#${id}tf)">${iconGroup(iconDef, iconX, iconY, iconSize, iconColor, { strokeWidth: cfg.icon.strokeWidth / 10 })}</g>`
        : iconGroup(iconDef, iconX, iconY, iconSize, iconColor, {
            strokeWidth: cfg.icon.strokeWidth / 10,
            opacity: (cfg.icon.opacity / 100),
            rotation: cfg.icon.rotation,
            filter: iconFilter,
          })) : ""}
    </g>
    ${C.gloss.layer === "above" ? `<g opacity="${(T.interior / 100).toFixed(2)}" clip-path="url(#${id}fc)">${gloss}</g>` : ""}
    <g opacity="${(T.interior / 100).toFixed(2)}" clip-path="url(#${id}fc)">${specular}</g>
  </g>
</g>
</svg>`;
}

/** Master component — width follows the label. Margins are 1.5× so large
 *  shadow distances never clip against the invisible canvas bounds. */
export function renderBevel(cfg: GenConfig, state: GenStateName): string {
  return build(cfg, state, { x: 52, y: 36, h: 168, fs: 52, iconSize: 46 });
}

/* ── kit components ────────────────────────────────────────────── */
const SIZE_K: Record<KitSize, number> = { s: 0.72, m: 1, l: 1.22 };

/** Dimensional candy ball — knobs for toggles, switches and sliders. */
function candyKnob(cx: number, cy: number, r: number, base: string, dot?: string): string {
  const kid = "kn" + UID++;
  return `<defs><radialGradient id="${kid}" cx="0.35" cy="0.3" r="0.9">
    <stop offset="0" stop-color="#FFFFFF"/>
    <stop offset="0.55" stop-color="${lighten(base, 0.78)}"/>
    <stop offset="1" stop-color="${lighten(base, 0.3)}"/>
  </radialGradient></defs>
  <ellipse cx="${cx.toFixed(1)}" cy="${(cy + r * 0.6).toFixed(1)}" rx="${(r * 0.92).toFixed(1)}" ry="${(r * 0.3).toFixed(1)}" fill="rgba(0,0,0,0.38)"/>
  <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#${kid})" stroke="${darken(base, 0.38)}" stroke-width="1.5"/>
  ${dot ? `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${Math.max(3, r * 0.3).toFixed(1)}" fill="${dot}"/>` : ""}
  <ellipse cx="${(cx - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.44).toFixed(1)}" rx="${(r * 0.34).toFixed(1)}" ry="${(r * 0.19).toFixed(1)}" fill="#FFFFFF" opacity="0.85"/>`;
}

function inject(track: string, extra: string): string {
  return track.replace("</g>\n</svg>", extra + "</g>\n</svg>");
}

export function renderKit(cfg: GenConfig, id: KitComponentId, size: KitSize, state: GenStateName = "default", value?: number): string {
  const k = SIZE_K[size];
  const bw = cfg.bevel.width;
  const bevel = effect(cfg.effects, "Bevel"), glow = effect(cfg.effects, "Glow");
  const wellFill = darken(effect(cfg.effects, "Inner Fill"), 0.72);
  const font = cfg.type.font;
  const wellOf = (w: number, h: number, inset: number) =>
    shapePath(cfg.shape, 39 + inset, 30 + inset, w - inset * 2, h - inset * 2, Math.max(0, cfg.bevel.softness - 10));

  switch (id) {
    case "primary":
      return build(cfg, state, { x: 39, y: 30, h: 136 * k, fs: 42 * k, iconSize: 38 * k });
    case "secondary":
      return build(cfg, state, { x: 39, y: 30, h: 136 * k, fs: 42 * k, iconSize: 38 * k }, { secondary: true, label: "Secondary" });
    case "small":
      return build(cfg, state, { x: 39, y: 30, h: 100 * k, fs: 32 * k, iconSize: 26 * k }, { label: "GO", iconDef: null });
    case "ghost":
      return build(cfg, state, { x: 39, y: 30, h: 110 * k, fs: 34 * k, iconSize: 28 * k }, { secondary: true, label: "Ghost", iconDef: null });
    case "iconbtn":
      return build(cfg, state, { x: 33, y: 27, h: 132 * k, fs: 0, iconSize: 56 * k }, { iconDef: cfg.icon.def ?? DEFAULT_ICON, label: "", fixedW: 132 * k });
    case "chip":
      return build(cfg, state, { x: 39, y: 30, h: 86 * k, fs: 28 * k, iconSize: 24 * k }, { label: "NEW", iconDef: STOCK_ICONS.star });
    case "badge":
      return build(cfg, state, { x: 33, y: 27, h: 112 * k, fs: 40 * k, iconSize: 0 }, { label: "12", iconDef: null, fixedW: 118 * k });
    case "tab":
      return build(cfg, state, { x: 39, y: 30, h: 94 * k, fs: 30 * k, iconSize: 0 }, { label: "TAB", iconDef: null });
    case "segment": {
      const w = 560 * k, h = 106 * k;
      const track = build(cfg, state, { x: 39, y: 30, h, fs: 0, iconSize: 0 }, { iconDef: null, label: "", fixedW: w });
      const cy = 30 + h / 2 + 1;
      const segW = (w - bw * 2) / 3;
      const midX = 39 + bw + segW;
      const well = `<path d="${roundRect(midX + 4, 30 + bw + 4, segW - 8, h - bw * 2 - 8, (h - bw * 2 - 8) * 0.3)}" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>`;
      const t = (label: string, cx: number, op: number) =>
        `<text x="${cx.toFixed(1)}" y="${cy}" font-family="'${font}', Inter, sans-serif" font-size="${30 * k}" font-weight="800" fill="#FFFFFF" fill-opacity="${op}" text-anchor="middle" dominant-baseline="central">${label}</text>`;
      return inject(track, well + t("ONE", 39 + bw + segW * 0.5, 0.55) + t("TWO", 39 + bw + segW * 1.5, 1) + t("THREE", 39 + bw + segW * 2.5, 0.55));
    }
    case "checkbox":
      return build(cfg, state, { x: 33, y: 27, h: 118 * k, fs: 0, iconSize: 54 * k }, { iconDef: STOCK_ICONS.check, label: "", fixedW: 118 * k });
    case "radio":
      return build(cfg, state, { x: 33, y: 27, h: 118 * k, fs: 0, iconSize: 46 * k }, { iconDef: STOCK_ICONS.dot, label: "", fixedW: 118 * k });
    case "switchOn":
    case "switchOff":
    case "toggle": {
      const on = id !== "switchOff";
      const w = 210 * k, h = 108 * k;
      const track = build(cfg, state, { x: 39, y: 30, h, fs: 0, iconSize: 0 }, { iconDef: null, label: "", fixedW: w });
      const inset = bw + 4;
      const knobR = (h - bw * 2) / 2 - 12;
      const kx = on ? 39 + w - inset - 8 - knobR : 39 + inset + 8 + knobR;
      const ky = 30 + h / 2;
      const dot = state === "disabled" ? "#A7AAB4" : on ? glow : "#9AA1AC";
      return inject(track, `<path d="${wellOf(w, h, inset)}" fill="${wellFill}" opacity="${on ? 0.92 : 0.96}"/>` + candyKnob(kx, ky, knobR, bevel, dot));
    }
    case "slider": {
      const w = 460 * k, h = 64 * k;
      const track = build(cfg, state, { x: 39, y: 30, h, fs: 0, iconSize: 0 }, { iconDef: null, label: "", fixedW: w });
      const inset = bw * 0.7 + 3;
      const gapPad = 5 * k;
      const bh = h - inset * 2 - gapPad * 2;
      const bx = 39 + inset + gapPad, by = 30 + inset + gapPad;
      const fillW = (w - inset * 2 - gapPad * 2) * clamp(value ?? 0.62, 0, 1);
      const gid = "sl" + UID++;
      const knobX = bx + fillW, knobY = 30 + h / 2;
      return inject(track,
        `<path d="${wellOf(w, h, inset)}" fill="${wellFill}" opacity="0.92"/>
         <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${bevel}"/><stop offset="1" stop-color="${glow}"/></linearGradient></defs>
         <path d="${roundRect(bx, by, fillW, bh, bh / 2)}" fill="url(#${gid})" opacity="${state === "disabled" ? 0.35 : 0.95}"/>` +
        candyKnob(knobX, knobY, h * 0.42, bevel));
    }
    case "progress": {
      const w = 520 * k, h = 64 * k;
      const track = build(cfg, state, { x: 39, y: 30, h, fs: 0, iconSize: 0 }, { iconDef: null, label: "", fixedW: w });
      const inset = bw + 3;
      const gapPad = 6 * k;
      const bx = 39 + inset + gapPad, by = 30 + inset + gapPad;
      const bh = h - inset * 2 - gapPad * 2;
      const fw = (w - inset * 2 - gapPad * 2) * 0.62;
      const gid = "pg" + UID++;
      return inject(track,
        `<path d="${wellOf(w, h, inset)}" fill="${wellFill}" opacity="0.92"/>
         <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${bevel}"/><stop offset="1" stop-color="${glow}"/></linearGradient></defs>
         <path d="${roundRect(bx, by, fw, bh, bh / 2)}" fill="url(#${gid})" opacity="${state === "disabled" ? 0.35 : 0.95}"/>
         <path d="${roundRect(bx, by + bh * 0.08, fw, bh * 0.34, bh * 0.17)}" fill="#FFFFFF" opacity="0.3"/>`);
    }
    case "input": {
      const w = 460 * k, h = 108 * k;
      const track = build(cfg, state, { x: 39, y: 30, h, fs: 0, iconSize: 0 }, { iconDef: null, label: "", fixedW: w });
      const inset = bw + 4;
      const ph = `<text x="${39 + inset + 18 * k}" y="${30 + h / 2 + 1}" font-family="'${font}', Inter, sans-serif" font-size="${30 * k}" font-style="italic" font-weight="500" fill="rgba(255,255,255,0.55)" dominant-baseline="central">Type something…</text>`;
      return inject(track, `<path d="${wellOf(w, h, inset)}" fill="${wellFill}" opacity="0.9"/>` + ph);
    }
    case "dropdown":
      return build(cfg, state, { x: 39, y: 30, h: 110 * k, fs: 32 * k, iconSize: 30 * k }, { label: "Select option", iconDef: STOCK_ICONS.chevron });
    case "icondrop":
      return build(cfg, state, { x: 33, y: 27, h: 118 * k, fs: 0, iconSize: 44 * k }, { iconDef: STOCK_ICONS.chevron, label: "", fixedW: 122 * k });
  }
}
