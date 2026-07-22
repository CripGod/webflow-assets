/* ── Layered Skin renderer — the lab's second rendering mode ───────────────
   The v64 single shell derives rim and face by shrinking one silhouette, so
   every notch and lobe repeats inward — great for simple candy, wrong for
   the reference art, which is an ASSEMBLY of separate pieces. This module
   renders a data-driven recipe instead:

     1  shadow from the hull          5  independent central face
     2  extrusion from the hull       6  foreground clamps / accents
     3  rear decorative parts         7  per-part gloss and specular
     4  chassis / frame               8  label

   Everything is generic: a recipe is pure data (paths + material roles +
   z-order + mirroring) authored in the same 0 0 200 100 system as the
   imported hulls. No shape-specific components exist anywhere — a new
   design is a new recipe file entry, nothing else.

   The hull keeps the strict one-path importer contract and acts as the
   footprint, shadow mask, extrusion body and maximum clipping boundary.
   Cap-preserving stretch runs EVERY part through the same piecewise x-map,
   so mirrored end-caps stay rigid while only the center band stretches. */

import { transformPath, transformPathCapAware } from "./bevel";
import { flattenPath, bounds } from "./importedShapes";
import { lighten, darken, desaturate, hexMix, hexRgba, fontByName } from "./model";
import type { GenStateName } from "./model";

export type MaterialRole = "face" | "frame" | "metal" | "plastic" | "accent";

export interface MaterialSpec {
  base: string;
  light: string;
  dark: string;
  finish: "gloss" | "matte" | "metal";
}

export interface SkinPart {
  id: string;
  /** Absolute-coordinate path in the 0 0 200 100 recipe space (M L C Q Z). */
  path: string;
  material: MaterialRole;
  zIndex: number;
  /** Per-part extrusion depth in recipe units (0 = flat on the stack). */
  depth: number;
  bevel: number;
  mirrorX?: boolean;
  glossOn?: boolean;
  specularOn?: boolean;
  /** Gloss band depth as a fraction of the part's height (default 0.42).
   *  Staggering this across parts breaks the "shared waterline" read when
   *  several parts are vertically centered together. */
  glossFrac?: number;
}

export interface ButtonSkinRecipe {
  id: string;
  name: string;
  /** One-path importer silhouette — footprint, shadow, extrusion, max clip. */
  hull: string;
  parts: SkinPart[];
  materials: Record<MaterialRole, MaterialSpec>;
  safeArea: { x: number; y: number; width: number; height: number };
  stretch: { leftCap: number; rightCap: number };
  label: string;
}

const VB: [number, number, number, number] = [0, 0, 200, 100];
let SUID = 0;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Mirror an absolute-coordinate recipe path across the vertical center of
 *  the 200-unit space. Recipes author LEFT pieces; mirrorX makes the right. */
export function mirrorPathX(d: string): string {
  const toks = d.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: string[] = [];
  let i = 0, cmd = "";
  while (i < toks.length) {
    if (/^[a-z]$/i.test(toks[i])) { cmd = toks[i++].toUpperCase(); out.push(cmd); if (cmd === "Z") continue; }
    const pairs = cmd === "C" ? 3 : cmd === "Q" ? 2 : 1;
    for (let p = 0; p < pairs; p++) {
      const X = parseFloat(toks[i++]), Y = parseFloat(toks[i++]);
      out.push((200 - X).toFixed(2), Y.toFixed(2));
    }
  }
  return out.join(" ");
}

/** One material region — the reusable treatment the note asks for. Fill
 *  gradient + inner bevel strokes + finish-specific gloss and specular, all
 *  clipped to the part. `mk` maps recipe space → target space so gloss and
 *  specular geometry stay part-relative under any stretch mode. */
export function renderMaterialPath(o: {
  id: string;
  path: string;                     // recipe-space part path
  mk: (d: string) => string;        // recipe → target mapper
  mat: MaterialSpec;
  bevel: number;
  P: (c: string) => string;         // state color transform
  sy: number;                       // vertical scale (bevel px per recipe unit)
  glossFrac?: number;
}): { defs: string; body: string } {
  const { id, mat, P } = o;
  const d = o.mk(o.path);
  const bb = bounds(flattenPath(o.path).flat());
  const bpx = o.bevel * o.sy;
  const light = P(mat.light), base = P(mat.base), dark = P(mat.dark);
  const metal = mat.finish === "metal";
  const defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${
    metal
      ? `<stop offset="0" stop-color="${light}"/><stop offset="0.42" stop-color="${base}"/><stop offset="0.6" stop-color="${hexMix(base, dark, 0.55)}"/><stop offset="0.8" stop-color="${base}"/><stop offset="1" stop-color="${darken(dark, 0.1)}"/>`
      : `<stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${base}"/><stop offset="1" stop-color="${dark}"/>`
  }</linearGradient>
  <clipPath id="${id}c"><path d="${d}"/></clipPath>`;
  // gloss band + specular live in recipe space (part-relative), then map —
  // so they follow the part through mirroring and cap-aware stretch. The
  // curved band bottom only suits WIDE parts; tall parts (clamps, rings)
  // take a straight band or they read pinched at the waist.
  const gw = bb.maxX - bb.minX, gh = bb.maxY - bb.minY;
  const frac = o.glossFrac ?? 0.42;
  const dip = gw >= gh * 0.3 ? Math.min(gh * 0.14, gw * 0.3) : 0;
  const glossD = o.mk(`M ${bb.minX} ${bb.minY} L ${bb.maxX} ${bb.minY} L ${bb.maxX} ${(bb.minY + gh * frac).toFixed(1)} Q ${(bb.minX + gw / 2).toFixed(1)} ${(bb.minY + gh * frac + dip).toFixed(1)} ${bb.minX} ${(bb.minY + gh * frac).toFixed(1)} Z`);
  const spCx = bb.minX + gw * 0.24, spCy = bb.minY + gh * 0.18, spR = Math.min(gw, gh) * 0.11;
  const specD = o.mk(`M ${(spCx - spR).toFixed(1)} ${spCy.toFixed(1)} C ${(spCx - spR).toFixed(1)} ${(spCy - spR * 0.6).toFixed(1)} ${(spCx + spR).toFixed(1)} ${(spCy - spR * 0.6).toFixed(1)} ${(spCx + spR).toFixed(1)} ${spCy.toFixed(1)} C ${(spCx + spR).toFixed(1)} ${(spCy + spR * 0.6).toFixed(1)} ${(spCx - spR).toFixed(1)} ${(spCy + spR * 0.6).toFixed(1)} ${(spCx - spR).toFixed(1)} ${spCy.toFixed(1)} Z`);
  const body = `<g clip-path="url(#${id}c)">
    <path d="${d}" fill="url(#${id}g)"/>
    <path d="${d}" fill="none" stroke="${hexRgba(lighten(light, 0.35), metal ? 0.9 : 0.6)}" stroke-width="${(bpx * 2).toFixed(1)}" transform="translate(0 ${(bpx * 0.9).toFixed(1)})"/>
    <path d="${d}" fill="none" stroke="${hexRgba(darken(dark, 0.35), 0.5)}" stroke-width="${(bpx * 2).toFixed(1)}" transform="translate(0 ${(-bpx * 0.9).toFixed(1)})"/>
    ${o.mat.finish !== "matte" ? `<path d="${glossD}" fill="#FFFFFF" opacity="${metal ? 0.22 : 0.3}"/>` : ""}
    ${mat.finish === "gloss" ? `<path d="${specD}" fill="#FFFFFF" opacity="0.6"/>` : ""}
  </g>
  <path d="${d}" fill="none" stroke="${darken(dark, 0.3)}" stroke-width="1.4" opacity="0.85"/>`;
  return { defs, body };
}

const STATE_ADJ: Record<GenStateName, { tone: number; lift: number; glow: number; opacity: number }> = {
  default: { tone: 0, lift: 0, glow: 0, opacity: 1 },
  hover: { tone: 0.07, lift: -3, glow: 0.5, opacity: 1 },
  pressed: { tone: -0.07, lift: 3, glow: 0.15, opacity: 1 },
  disabled: { tone: 0, lift: 0, glow: 0, opacity: 0.62 },
};

/** Render a full layered-skin assembly at an exact frame. Pure
 *  (recipe, state, size) → SVG string, like every engine entry point. */
export function renderSkinRecipe(recipe: ButtonSkinRecipe, state: GenStateName, w: number, h: number, opts: {
  label?: string; font?: string; caps?: boolean; wireframe?: boolean;
} = {}): string {
  const id = "sk" + SUID++;
  const adj = STATE_ADJ[state];
  const disabled = state === "disabled";
  const P = (c: string): string => {
    if (disabled) return lighten(desaturate(c, 0.8), 0.08);
    return adj.tone > 0 ? lighten(c, adj.tone) : adj.tone < 0 ? darken(c, -adj.tone) : c;
  };
  const x = 40, y = 32;
  const sy = h / 100;
  const capSrc = recipe.stretch.leftCap;
  const mk = (d: string) => (opts.caps ?? true)
    ? transformPathCapAware(d, VB, x, y, w, h, capSrc)
    : transformPath(d, VB, x, y, w, h);

  const depth = 7 * sy;
  const pad = 60; // glow / shadow air
  const W = x * 2 + w, H = y * 2 + h + depth + 14;
  const hullD = mk(recipe.hull);
  const chassis = recipe.materials.frame;

  /* 1 · cast shadow + 2 · hull extrusion (the proven translated-path hull) */
  const shadow = `<path d="${hullD}" transform="translate(0 ${(depth + 5 + Math.max(0, adj.lift)).toFixed(1)})" fill="#04060C" opacity="${disabled ? 0.2 : 0.42}" filter="url(#${id}sb)"/>`;
  const nSl = Math.max(2, Math.ceil(depth / 2.5));
  const slabs = Array.from({ length: nSl }, (_, i) =>
    `<path d="${hullD}" transform="translate(0 ${((depth * (i + 1)) / nSl).toFixed(1)})" fill="${P(darken(chassis.dark, 0.12))}"${i === nSl - 1 ? ` stroke="${darken(chassis.dark, 0.4)}" stroke-width="1"` : ""}/>`).join("");

  /* 3–6 · parts by z-order, mirrored copies expanded, all inside the hull */
  const expanded = recipe.parts.flatMap((p) => {
    const list = [{ ...p, path: p.path, key: p.id }];
    if (p.mirrorX) list.push({ ...p, path: mirrorPathX(p.path), key: p.id + "-r" });
    return list;
  }).sort((a, b) => a.zIndex - b.zIndex);

  let defs = "", stack = "";
  expanded.forEach((p, i) => {
    const mat = recipe.materials[p.material];
    if (p.depth > 0) {
      const dpx = p.depth * sy;
      stack += `<path d="${mk(p.path)}" transform="translate(0 ${dpx.toFixed(1)})" fill="${P(darken(mat.dark, 0.25))}" data-part-depth="${p.key}"/>`;
    }
    const m = renderMaterialPath({ id: `${id}p${i}`, path: p.path, mk, mat, bevel: p.bevel, P, sy, glossFrac: p.glossFrac });
    defs += m.defs;
    stack += `<g data-part="${p.key}" data-material="${p.material}">${m.body}</g>`;
  });

  /* 8 · label — sized to the recipe's safe area, mapped through mk */
  const label = esc((opts.label ?? recipe.label).toUpperCase());
  const font = opts.font ?? "Russo One";
  const factor = fontByName(font).factor * 1.08;
  const bandPx = (recipe.safeArea.width / 200) * w;
  const fs = Math.min((recipe.safeArea.height / 100) * h * 0.72, bandPx / Math.max(1, label.length * factor));
  const cxT = x + w / 2, cyT = y + ((recipe.safeArea.y + recipe.safeArea.height / 2) / 100) * h;
  const faceMat = recipe.materials.face;
  const text = `<g data-skin-label="1" opacity="${disabled ? 0.55 : 1}">
    <text x="${cxT.toFixed(1)}" y="${(cyT + fs * 0.06).toFixed(1)}" font-family="'${font}', Inter, sans-serif" font-size="${fs.toFixed(1)}" font-weight="700" font-style="italic" text-anchor="middle" dominant-baseline="central" fill="${darken(faceMat.dark, 0.4)}" opacity="0.85" transform="translate(0 ${(fs * 0.07).toFixed(1)})">${label}</text>
    <text x="${cxT.toFixed(1)}" y="${cyT.toFixed(1)}" font-family="'${font}', Inter, sans-serif" font-size="${fs.toFixed(1)}" font-weight="700" font-style="italic" text-anchor="middle" dominant-baseline="central" fill="url(#${id}tg)">${label}</text>
  </g>`;

  /* hover aura from the hull */
  const aura = adj.glow > 0.01 && !disabled
    ? `<path d="${hullD}" fill="${P(recipe.materials.metal.light)}" opacity="${(adj.glow * 0.55).toFixed(2)}" filter="url(#${id}gb)"/>`
    : "";

  const wire = opts.wireframe
    ? `<g data-skin-wire="1" fill="none" stroke-width="1.3">
        <path d="${hullD}" stroke="#FF3B30"/>
        ${expanded.map((p, i) => `<path d="${mk(p.path)}" stroke="${["#32E6FF", "#FFCC00", "#5BE49B", "#EC68FF", "#FF9A3D", "#EAF5FF"][i % 6]}" stroke-dasharray="4 3"/>`).join("")}
      </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad * 2}" height="${H + pad * 2}" viewBox="${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}" data-skin="${recipe.id}" data-shell="${x} ${y + adj.lift} ${w} ${h}" role="img" aria-label="${esc(recipe.name)}, ${state} state">
<defs>
  ${defs}
  <linearGradient id="${id}tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${disabled ? "#C9CCD6" : hexMix(faceMat.light, "#FFFFFF", 0.55)}"/></linearGradient>
  <clipPath id="${id}hc"><path d="${hullD}"/></clipPath>
  <filter id="${id}sb" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
  ${aura ? `<filter id="${id}gb" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="16"/></filter>` : ""}
</defs>
<g opacity="${adj.opacity.toFixed(2)}">
  ${shadow}
  ${aura}
  <g transform="translate(0 ${adj.lift})">
    ${slabs}
    <g clip-path="url(#${id}hc)" data-skin-stack="1">
      <path d="${hullD}" fill="${P(chassis.base)}"/>
      ${stack}
    </g>
    <path d="${hullD}" fill="none" stroke="${P(darken(chassis.dark, 0.3))}" stroke-width="1.6"/>
    ${text}
    ${wire}
  </g>
</g>
</svg>`;
}
