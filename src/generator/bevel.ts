import type { GenConfig, GenStateName, EffectRole, Shape, KitComponentId, KitSize } from "./model";
import { lighten, darken, hexMix, desaturate } from "./model";
import { iconGroup } from "./icons";

// Bevel engine v4 — shape-aware construction (chamfer / pill / sharp / round),
// key light + extra lights (each with angle + intensity), highlight/lowlight,
// surface noise. Pure (config, state) → SVG string shared by canvas + exports.

let UID = 0;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
export function shapePath(shape: Shape, x: number, y: number, w: number, h: number, softness: number): string {
  if (shape === "pill") return roundRect(x, y, w, h, h / 2);
  if (shape === "round") return roundRect(x, y, w, h, 10 + softness * 0.34);
  const cut = shape === "sharp" ? Math.min(34, h * 0.22) : Math.min(28, h * 0.17);
  const r = shape === "sharp" ? 1.5 : 3 + softness * 0.14;
  const v: [number, number][] = [
    [x + cut, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + h - cut],
    [x + w - cut, y + h], [x + cut, y + h], [x, y + h - cut], [x, y + cut],
  ];
  return polyRounded(v, r);
}

function effect(cfg: GenConfig, role: EffectRole): string {
  const e = cfg.effects[role];
  if (e) return e;
  const bevel = cfg.effects.Bevel ?? "#7C3AED";
  switch (role) {
    case "Bevel": return bevel;
    case "Glow": return bevel;
    case "Highlight": return "#FFFFFF";
    case "Shadow": return lighten(bevel, 0.55);
    case "Inner Fill": return lighten(bevel, 0.92);
  }
}

interface Geom { x: number; y: number; w: number; h: number; vw: number; vh: number; fs: number; iconSize: number }

/** Core builder shared by the master button and kit components. */
function build(cfg: GenConfig, state: GenStateName, g0: Geom, opts: {
  label?: string; icon?: string | null; secondary?: boolean; shapeOverride?: Shape;
} = {}): string {
  const id = "b" + UID++;
  const disabled = state === "disabled", hover = state === "hover", pressed = state === "pressed";
  const P = (c: string) => (disabled ? lighten(desaturate(c, 0.85), 0.08) : c);
  const secondary = !!opts.secondary;
  const shape = opts.shapeOverride ?? cfg.shape;

  let bevelC = P(effect(cfg, "Bevel"));
  let glowC = P(effect(cfg, "Glow"));
  const hiC = P(effect(cfg, "Highlight"));
  const shC = P(effect(cfg, "Shadow"));
  let fillC = P(effect(cfg, "Inner Fill"));
  if (hover) { bevelC = lighten(bevelC, 0.10); fillC = lighten(fillC, 0.3); }
  if (pressed) { fillC = darken(fillC, 0.045); }

  const darkFace = cfg.face.mode === "dark";
  const face = darkFace ? hexMix(bevelC, "#0B0714", 0.78) : fillC;
  const labelC = disabled ? "#A7AAB4" : secondary ? (darkFace ? lighten(bevelC, 0.5) : darken(bevelC, 0.05)) : darkFace ? lighten(bevelC, 0.62) : darken(bevelC, pressed ? 0.18 : 0.06);

  const { x, y, w, h, vw, vh, fs, iconSize } = g0;
  const bw = secondary ? Math.max(4, cfg.bevel.width * 0.6) : cfg.bevel.width;
  const outer = shapePath(shape, x, y, w, h, cfg.bevel.softness);
  const inner = shapePath(shape, x + bw, y + bw, w - bw * 2, h - bw * 2, Math.max(0, cfg.bevel.softness - 8));

  // key light
  const A = ((cfg.lighting.angle % 360) + 360) % 360;
  const rad = (A * Math.PI) / 180;
  const lx = Math.cos(rad), ly = -Math.sin(rad);
  const gpos = (k: number) => (0.5 + k * 0.5).toFixed(3);
  const fillLights = cfg.lighting.extras.filter((l) => l.kind === "fill");
  const fillLift = fillLights.reduce((acc, l) => acc + l.intensity / 100, 0);
  const hiK = (disabled ? 0.35 : 1) * (cfg.lighting.highlight / 78) * (hover ? 1.15 : 1) * (1 + fillLift * 0.2);
  const lowK = Math.max(0.1, (cfg.lighting.lowlight / 46) * (1 - fillLift * 0.4));
  const shK = (disabled ? 0.35 : 1) * (cfg.lighting.shadow / 42) * (pressed ? 0.5 : 1) * (1 - Math.min(0.6, fillLift * 0.5));
  const depth = cfg.bevel.depth * (pressed ? 0.4 : hover ? 1.2 : 1);
  const sdx = (-lx * depth * 0.35).toFixed(1), sdy = (-ly * depth * 0.35 + depth * 0.28).toFixed(1);

  const glowDev = hover ? 15 : pressed ? 7 : 11;
  const glowOp = (disabled ? 0 : hover ? 0.6 : pressed ? 0.3 : 0.42) * (secondary ? 0.35 : 1);

  // extra rim lights — each gets its own gradient direction + strength
  const rims = cfg.lighting.extras.filter((l) => l.kind === "rim");
  const rimDefs = rims.map((l, i) => {
    const rr = (l.angle * Math.PI) / 180, rx2 = Math.cos(rr), ry2 = -Math.sin(rr);
    return `<linearGradient id="${id}rim${i}" x1="${gpos(rx2)}" y1="${gpos(ry2)}" x2="${gpos(-rx2)}" y2="${gpos(-ry2)}">
      <stop offset="0" stop-color="${glowC}" stop-opacity="${(l.intensity / 100).toFixed(2)}"/>
      <stop offset=".55" stop-color="${glowC}" stop-opacity="0"/>
    </linearGradient>`;
  }).join("");
  const rimStrokes = disabled ? "" : rims.map((_, i) =>
    `<path d="${outer}" fill="none" stroke="url(#${id}rim${i})" stroke-width="3"/>`).join("");

  // noise
  const noiseOp = (cfg.face.noise / 100) * 0.5 * (disabled ? 0.4 : 1);
  const noise = noiseOp > 0.005
    ? `<clipPath id="${id}nc"><path d="${inner}"/></clipPath>
       <g clip-path="url(#${id}nc)"><rect x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#${id}nz)" opacity="${noiseOp.toFixed(2)}" style="mix-blend-mode:soft-light"/></g>`
    : "";

  // content
  const label = esc(opts.label ?? cfg.content.label ?? "Primary");
  const iconName = opts.icon === null ? null : opts.icon ?? (cfg.content.placement !== "none" ? cfg.content.icon : null);
  const showText = opts.icon !== undefined ? !!opts.label : true;
  const gap = fs * 0.38;
  const textW = showText ? label.length * fs * 0.56 : 0;
  const total = textW + (iconName ? iconSize + (showText ? gap : 0) : 0);
  const cx = x + w / 2, cy = y + h / 2;
  const startX = cx - total / 2;
  const placeLeft = cfg.content.placement === "left" && opts.icon === undefined;
  const textX = placeLeft ? startX + iconSize + gap + textW / 2 : startX + textW / 2;
  const iconX = placeLeft ? startX : startX + textW + (showText ? gap : 0);
  const contentGlow = hover && !disabled ? ` filter="url(#${id}cg)"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" font-family="Inter, 'Inter Variable', -apple-system, sans-serif" role="img" aria-label="${label || "component"}, ${state} state">
<defs>
  <linearGradient id="${id}band" x1="${gpos(-lx)}" y1="${gpos(-ly)}" x2="${gpos(lx)}" y2="${gpos(ly)}">
    <stop offset="0" stop-color="${darken(bevelC, 0.32 * lowK)}"/>
    <stop offset=".45" stop-color="${bevelC}"/>
    <stop offset="1" stop-color="${lighten(bevelC, Math.min(0.85, 0.42 * hiK))}"/>
  </linearGradient>
  <linearGradient id="${id}face" x1="${gpos(-lx)}" y1="${gpos(-ly)}" x2="${gpos(lx)}" y2="${gpos(ly)}">
    <stop offset="0" stop-color="${darkFace ? darken(face, 0.3 * lowK) : darken(face, 0.08 * lowK)}"/>
    <stop offset="1" stop-color="${darkFace ? lighten(face, 0.08) : lighten(face, Math.min(0.8, 0.5 * hiK))}"/>
  </linearGradient>
  <linearGradient id="${id}sheen" x1="${gpos(-lx)}" y1="${gpos(-ly)}" x2="${gpos(lx)}" y2="${gpos(ly)}">
    <stop offset=".45" stop-color="${hiC}" stop-opacity="0"/>
    <stop offset="1" stop-color="${hiC}" stop-opacity="${(disabled ? 0 : (cfg.face.finish / 100) * 0.85 * Math.min(1.4, hiK)).toFixed(2)}"/>
  </linearGradient>
  <filter id="${id}nz"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  ${rimDefs}
  <filter id="${id}glow" x="-25%" y="-45%" width="150%" height="200%">
    <feDropShadow dx="${sdx}" dy="${sdy}" stdDeviation="${(depth * 0.42).toFixed(1)}" flood-color="${shC}" flood-opacity="${(0.85 * shK).toFixed(2)}"/>
    ${!disabled ? `<feDropShadow dx="0" dy="0" stdDeviation="${glowDev}" flood-color="${glowC}" flood-opacity="${glowOp.toFixed(2)}"/>` : ""}
  </filter>
  <filter id="${id}cg" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${glowC}" flood-opacity="0.85"/>
  </filter>
</defs>
<g transform="translate(0 ${hover ? -4 : pressed ? 2 : 0})" filter="url(#${id}glow)">
  <path d="${outer}" fill="${secondary ? (darkFace ? "#17121F" : "#FFFFFF") : `url(#${id}band)`}" stroke="${darken(bevelC, disabled ? 0.2 : 0.45)}" stroke-width="2"/>
  ${secondary ? `<path d="${outer}" fill="none" stroke="url(#${id}band)" stroke-width="${Math.max(3, bw * 0.7)}"/>` : ""}
  <path d="${inner}" fill="url(#${id}face)" stroke="${pressed ? darken(bevelC, 0.3) : hexMix(bevelC, face, 0.35)}" stroke-width="${pressed ? 2.4 : 1.6}"/>
  <path d="${inner}" fill="url(#${id}sheen)"/>
  ${noise}
  ${pressed ? `<path d="${inner}" fill="none" stroke="${glowC}" stroke-width="2.4" opacity="0.55"/>` : ""}
  ${rimStrokes}
  <g${contentGlow}>
    ${showText ? `<text x="${textX.toFixed(1)}" y="${cy + 1}" font-size="${fs}" font-weight="700" letter-spacing="-0.01em" fill="${labelC}" text-anchor="middle" dominant-baseline="central">${label}</text>` : ""}
    ${iconName ? iconGroup(iconName, iconX, cy - iconSize / 2, iconSize, labelC, 2.4) : ""}
  </g>
</g>
</svg>`;
}

/** Master component. */
export function renderBevel(cfg: GenConfig, state: GenStateName): string {
  return build(cfg, state, { x: 30, y: 24, w: 640, h: 168, vw: 700, vh: 216, fs: 52, iconSize: 46 });
}

/* ── kit components — the saved style applied to more parts ───── */
const SIZE_K: Record<KitSize, number> = { s: 0.72, m: 1, l: 1.22 };

export function renderKit(cfg: GenConfig, id: KitComponentId, size: KitSize, state: GenStateName = "default"): string {
  const k = SIZE_K[size];
  switch (id) {
    case "primary":
      return build(cfg, state, { x: 24, y: 20, w: 520 * k, h: 136 * k, vw: 520 * k + 48, vh: 136 * k + 40, fs: 42 * k, iconSize: 38 * k });
    case "secondary":
      return build(cfg, state, { x: 24, y: 20, w: 520 * k, h: 136 * k, vw: 520 * k + 48, vh: 136 * k + 40, fs: 42 * k, iconSize: 38 * k },
        { secondary: true, label: "Secondary" });
    case "iconbtn":
      return build(cfg, state, { x: 20, y: 18, w: 132 * k, h: 132 * k, vw: 132 * k + 40, vh: 132 * k + 34, fs: 0, iconSize: 56 * k },
        { icon: cfg.content.icon, label: "" });
    case "toggle": {
      const w = 210 * k, h = 108 * k, vw = w + 48, vh = h + 40;
      const track = build(cfg, state, { x: 24, y: 20, w, h, vw, vh, fs: 0, iconSize: 0 }, { shapeOverride: "pill", icon: null, label: "" });
      const knobR = (h - cfg.bevel.width * 2) / 2 - 6;
      const kx = 24 + w - cfg.bevel.width - 6 - knobR, ky = 20 + h / 2;
      const glow = effect(cfg, "Glow"), fill = effect(cfg, "Inner Fill");
      const knob = `<circle cx="${kx}" cy="${ky}" r="${knobR}" fill="${fill}" stroke="${darken(effect(cfg, "Bevel"), 0.3)}" stroke-width="2"/>
        <circle cx="${kx}" cy="${ky}" r="${Math.max(3, knobR * 0.28)}" fill="${state === "disabled" ? "#A7AAB4" : glow}"/>`;
      return track.replace("</g>\n</svg>", knob + "</g>\n</svg>");
    }
    case "progress": {
      const w = 520 * k, h = 64 * k, vw = w + 48, vh = h + 40;
      const track = build(cfg, state, { x: 24, y: 20, w, h, vw, vh, fs: 0, iconSize: 0 }, { shapeOverride: "pill", icon: null, label: "" });
      const bw = cfg.bevel.width;
      const bevel = effect(cfg, "Bevel"), glow = effect(cfg, "Glow");
      const fw = (w - bw * 2 - 8) * 0.62;
      const bar = `<defs><linearGradient id="pg${UID}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${bevel}"/><stop offset="1" stop-color="${glow}"/></linearGradient></defs>
        <path d="${roundRect(24 + bw + 4, 20 + bw + 4, fw, h - bw * 2 - 8, (h - bw * 2 - 8) / 2)}" fill="url(#pg${UID})" opacity="${state === "disabled" ? 0.35 : 0.95}"/>`;
      return track.replace("</g>\n</svg>", bar + "</g>\n</svg>");
    }
  }
}
