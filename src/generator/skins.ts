/* ── Layered Skin renderer — the lab's second rendering mode ───────────────
   The v64 single shell derives rim and face by shrinking one silhouette, so
   every notch and lobe repeats inward — great for simple candy, wrong for
   the reference art, which is an ASSEMBLY of separate pieces. This module
   renders a data-driven recipe instead:

     1  shadow from the hull          5  independent central face
     2  extrusion from the hull       6  foreground clamps / accents
     3  rear decorative parts         7  per-part finish, gloss, specular
     4  chassis / frame               8  label

   Everything is generic: a recipe is pure data (paths + material roles +
   z-order + mirroring + finish controls) authored in the same 0 0 200 100
   system as the imported hulls. No shape-specific components exist anywhere
   — a new design is a new recipe file entry, nothing else.

   REFINEMENT PASS (post-first-proof feedback): the first proof layered
   correctly but every part shared one gloss/specular response, so the
   assembly collapsed back into a single planar object. Parts now resolve an
   independent finish — finish type, bevel profile, gloss strength, specular
   mode, highlight bias, edge darkening, bounce light, lower-body saturation
   — plus a local contact shadow so front parts visibly sit ON the parts
   behind them. Mirrored copies re-map the authored LEFT geometry through
   the mirror, so highlights mirror with the part exactly like toy art.

   The hull keeps the strict one-path importer contract and acts as the
   footprint, shadow mask, extrusion body and maximum clipping boundary.
   Cap-preserving stretch runs EVERY part through the same piecewise x-map,
   so mirrored end-caps stay rigid while only the center band stretches. */

import { transformPath, transformPathCapAware } from "./bevel";
import { flattenPath, bounds } from "./importedShapes";
import { lighten, darken, desaturate, saturate, hexMix, hexRgba, fontByName } from "./model";
import type { GenStateName } from "./model";
import { COMPOUND_ASSETS, patternDef } from "./compound";
import type { CompoundVectorAsset, CompoundSkin } from "./compound";

export type MaterialRole = "face" | "frame" | "metal" | "plastic" | "accent";
export type FinishType = "plastic" | "metal" | "glass" | "matte";
export type BevelProfile = "soft-pill" | "hard-frame" | "metal-ridge";
export type PartSpecular = "dot" | "streak" | "arc" | "none";

export interface MaterialSpec {
  base: string;
  light: string;
  dark: string;
  finish: FinishType;
}

/** Per-part finish controls. Everything optional — unset fields fall back
 *  to the resolved finish type's house defaults, so simple parts stay
 *  simple while hero parts can be fully art-directed. */
export interface PartFinish {
  /** Overrides the material's finish for this part only. */
  finish?: FinishType;
  /** Bevel CHARACTER, not just amount: soft-pill rolls, hard-frame insets,
   *  metal-ridge returns a bright machined edge. */
  bevelProfile?: BevelProfile;
  /** 0..1 multiplier on the gloss band. */
  glossStrength?: number;
  /** Gloss band depth as a fraction of the part's height. */
  glossFrac?: number;
  /** Extra downward belly of the gloss band's bottom edge, as a fraction of
   *  part height (0 = straight waterline). Staggering this across parts
   *  kills the shared-waterline read. */
  glossDip?: number;
  /** Highlight event shape: lens dot, diagonal streak, contour arc, none. */
  specularMode?: PartSpecular;
  /** Shifts gloss + specular placement, in part-bbox fractions (-1..1). */
  highlightBias?: [number, number];
  /** 0..1 ambient-occlusion rim inside the part's own edge. */
  edgeDarkening?: number;
  /** 0..1 saturation push on the part's lower body (candy depth). */
  saturationBoost?: number;
  /** 0..1 bottom bounce-light strength (the lit floor reflecting back). */
  bounce?: number;
  /** 0..1 local contact shadow this part casts on whatever is behind it —
   *  the strongest single lever for front/back hierarchy. */
  shadowDensity?: number;
}

export interface SkinPart extends PartFinish {
  id: string;
  /** Absolute-coordinate path in the 0 0 200 100 recipe space (M L C Q Z).
   *  Required unless `asset` names a compound asset, whose baked geometry
   *  then replaces the single path entirely. */
  path?: string;
  /** Compound vector asset id (COMPOUND_ASSETS) — baked multi-layer
   *  construction with semantic slots; skinned live via `assetSkin`. */
  asset?: string;
  /** Live skin for the compound asset. Colors default to this part's
   *  material role, so recipes stay palette-driven. */
  assetSkin?: CompoundSkin;
  /** Any key of the recipe's materials map (the five house roles + extras). */
  material: string;
  zIndex: number;
  /** Per-part extrusion depth in recipe units (0 = flat on the stack). */
  depth: number;
  bevel: number;
  mirrorX?: boolean;
}

export interface ButtonSkinRecipe {
  id: string;
  name: string;
  /** One-path importer silhouette — footprint, shadow, extrusion, max clip. */
  hull: string;
  parts: SkinPart[];
  materials: Record<MaterialRole, MaterialSpec> & Record<string, MaterialSpec>;
  safeArea: { x: number; y: number; width: number; height: number };
  stretch: { leftCap: number; rightCap: number };
  label: string;
  /** Hull extrusion depth in recipe units (default 8). */
  extrusion?: number;
}

/** House defaults per finish type — the baseline each part starts from
 *  before its own overrides. Deliberately DIFFERENT per finish so that a
 *  mixed-material assembly never shares one lighting response. */
const FINISH_DEFAULTS: Record<FinishType, Required<Omit<PartFinish, "finish" | "highlightBias" | "glossDip">> & { glossDip: number }> = {
  plastic: { bevelProfile: "soft-pill", glossStrength: 0.78, glossFrac: 0.42, glossDip: 0.1, specularMode: "dot", edgeDarkening: 0.3, saturationBoost: 0.22, bounce: 0.3, shadowDensity: 0 },
  glass: { bevelProfile: "soft-pill", glossStrength: 1, glossFrac: 0.46, glossDip: 0.16, specularMode: "dot", edgeDarkening: 0.2, saturationBoost: 0.32, bounce: 0.5, shadowDensity: 0 },
  metal: { bevelProfile: "metal-ridge", glossStrength: 0.5, glossFrac: 0.34, glossDip: 0, specularMode: "streak", edgeDarkening: 0.5, saturationBoost: 0.12, bounce: 0.4, shadowDensity: 0 },
  matte: { bevelProfile: "hard-frame", glossStrength: 0, glossFrac: 0.4, glossDip: 0, specularMode: "none", edgeDarkening: 0.42, saturationBoost: 0, bounce: 0, shadowDensity: 0 },
};

export interface ResolvedFinish {
  finish: FinishType;
  bevelProfile: BevelProfile;
  glossStrength: number;
  glossFrac: number;
  glossDip: number;
  specularMode: PartSpecular;
  highlightBias: [number, number];
  edgeDarkening: number;
  saturationBoost: number;
  bounce: number;
  shadowDensity: number;
}

/** Merge a part's finish overrides over its material's finish defaults. */
export function resolveFinish(part: PartFinish, mat: MaterialSpec): ResolvedFinish {
  const finish = part.finish ?? mat.finish;
  const d = FINISH_DEFAULTS[finish];
  return {
    finish,
    bevelProfile: part.bevelProfile ?? d.bevelProfile,
    glossStrength: part.glossStrength ?? d.glossStrength,
    glossFrac: part.glossFrac ?? d.glossFrac,
    glossDip: part.glossDip ?? d.glossDip,
    specularMode: part.specularMode ?? d.specularMode,
    highlightBias: part.highlightBias ?? [0, 0],
    edgeDarkening: part.edgeDarkening ?? d.edgeDarkening,
    saturationBoost: part.saturationBoost ?? d.saturationBoost,
    bounce: part.bounce ?? d.bounce,
    shadowDensity: part.shadowDensity ?? d.shadowDensity,
  };
}

const VB: [number, number, number, number] = [0, 0, 200, 100];
let SUID = 0;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const N = (v: number) => v.toFixed(1);

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

/** Ellipse as two cubics — M/L/C/Q/Z only, so it survives mirrorPathX. */
const blob = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${N(cx - rx)} ${N(cy)} C ${N(cx - rx)} ${N(cy - ry * 1.35)} ${N(cx + rx)} ${N(cy - ry * 1.35)} ${N(cx + rx)} ${N(cy)} C ${N(cx + rx)} ${N(cy + ry * 1.35)} ${N(cx - rx)} ${N(cy + ry * 1.35)} ${N(cx - rx)} ${N(cy)} Z`;

/** Diagonal highlight capsule (a short highlight "run"). */
function streak(cx: number, cy: number, len: number, th: number): string {
  const dx = 0.966, dy = 0.259; // ~15° downhill, matching the house light
  const nx = -dy, ny = dx;
  const hx = (len / 2) * dx, hy = (len / 2) * dy, tx = nx * (th / 2), ty = ny * (th / 2);
  const ax = cx - hx + tx, ay = cy - hy + ty, bx = cx + hx + tx, by = cy + hy + ty;
  const cx2 = cx + hx - tx, cy2 = cy + hy - ty, dx2 = cx - hx - tx, dy2 = cy - hy - ty;
  const k = th * 0.9;
  return `M ${N(ax)} ${N(ay)} L ${N(bx)} ${N(by)} C ${N(bx + dx * k)} ${N(by + dy * k)} ${N(cx2 + dx * k)} ${N(cy2 + dy * k)} ${N(cx2)} ${N(cy2)} L ${N(dx2)} ${N(dy2)} C ${N(dx2 - dx * k)} ${N(dy2 - dy * k)} ${N(ax - dx * k)} ${N(ay - dy * k)} ${N(ax)} ${N(ay)} Z`;
}

/** Vertical finish gradient stops — shared by single-path parts and
 *  compound-asset surfaces so every finish keeps one house look. */
export function finishStopsV(mat: { light: string; base: string; dark: string }, finish: FinishType, P: (c: string) => string, satBoost: number): string {
  const deepDark = saturate(mat.dark, satBoost * 0.9);
  if (finish === "metal")
    return `<stop offset="0" stop-color="${P(lighten(mat.light, 0.2))}"/><stop offset="0.28" stop-color="${P(lighten(mat.light, 0.45))}"/><stop offset="0.55" stop-color="${P(mat.base)}"/><stop offset="0.85" stop-color="${P(deepDark)}"/><stop offset="1" stop-color="${P(darken(deepDark, 0.2))}"/>`;
  if (finish === "glass")
    return `<stop offset="0" stop-color="${P(lighten(mat.light, 0.22))}"/><stop offset="0.45" stop-color="${P(hexMix(mat.light, mat.base, 0.62))}"/><stop offset="0.72" stop-color="${P(mat.base)}"/><stop offset="1" stop-color="${P(deepDark)}"/>`;
  if (finish === "matte")
    return `<stop offset="0" stop-color="${P(lighten(mat.base, 0.14))}"/><stop offset="0.55" stop-color="${P(mat.base)}"/><stop offset="1" stop-color="${P(mat.dark)}"/>`;
  return `<stop offset="0" stop-color="${P(mat.light)}"/><stop offset="0.52" stop-color="${P(mat.base)}"/><stop offset="1" stop-color="${P(deepDark)}"/>`;
}

/** One material region — the reusable per-part treatment. Fill gradient +
 *  profile bevel strokes + finish-specific gloss, specular, edge and bounce
 *  events, all clipped to the part. `mk` maps recipe space → target space
 *  (including mirroring), so every lighting event follows the part through
 *  mirrorX and cap-aware stretch. */
export function renderMaterialPath(o: {
  id: string;
  path: string;                     // recipe-space part path (authored LEFT)
  mk: (d: string) => string;        // recipe → target mapper (may mirror)
  mat: MaterialSpec;
  fin: ResolvedFinish;
  bevel: number;
  P: (c: string) => string;         // state color transform
  sy: number;                       // vertical scale (bevel px per recipe unit)
}): { defs: string; body: string } {
  const { id, mat, fin, P } = o;
  const d = o.mk(o.path);
  const bb = bounds(flattenPath(o.path).flat());
  const gw = bb.maxX - bb.minX, gh = bb.maxY - bb.minY;
  const bpx = o.bevel * o.sy;
  const [bx, by] = fin.highlightBias;
  const metal = fin.finish === "metal";
  const glass = fin.finish === "glass";
  const deepDark = saturate(mat.dark, fin.saturationBoost * 0.9);

  /* fill gradient — metal on a tall part becomes a CYLINDER (horizontal
     axis, bright off-center core, dark edge returns); everything else runs
     top light → deep saturated bottom. */
  const cylinder = metal && gh > gw * 1.15;
  const axis = cylinder ? `x1="0" y1="0" x2="1" y2="0"` : `x1="0" y1="0" x2="0" y2="1"`;
  const stops = cylinder
    ? `<stop offset="0" stop-color="${P(darken(mat.base, 0.32))}"/><stop offset="0.16" stop-color="${P(mat.base)}"/><stop offset="0.38" stop-color="${P(lighten(mat.light, 0.42))}"/><stop offset="0.52" stop-color="${P(mat.light)}"/><stop offset="0.78" stop-color="${P(mat.base)}"/><stop offset="1" stop-color="${P(darken(deepDark, 0.28))}"/>`
    : finishStopsV(mat, fin.finish, P, fin.saturationBoost);

  let defs = `<linearGradient id="${id}g" ${axis}>${stops}</linearGradient>
  <clipPath id="${id}c"><path d="${d}"/></clipPath>`;

  /* profile bevel strokes — the CHARACTER of the edge, not just its size */
  const hi = P(lighten(mat.light, metal ? 0.4 : 0.32));
  const lo = P(darken(mat.dark, 0.35));
  let bevels = "";
  if (fin.edgeDarkening > 0.01)
    bevels += `<path d="${d}" fill="none" stroke="${hexRgba(P(darken(mat.dark, 0.45)), fin.edgeDarkening * 0.66)}" stroke-width="${N(bpx * 3)}"/>`;
  if (fin.bevelProfile === "soft-pill") {
    bevels += `<path d="${d}" fill="none" stroke="${hexRgba(hi, 0.2)}" stroke-width="${N(bpx * 4)}" transform="translate(0 ${N(bpx * 1.8)})"/>
    <path d="${d}" fill="none" stroke="${hexRgba(hi, glass ? 0.85 : 0.7)}" stroke-width="${N(bpx * 2.4)}" transform="translate(0 ${N(bpx * 1.1)})"/>
    <path d="${d}" fill="none" stroke="${hexRgba(lo, 0.5)}" stroke-width="${N(bpx * 2.2)}" transform="translate(0 ${N(-bpx)})"/>`;
  } else if (fin.bevelProfile === "hard-frame") {
    bevels += `<path d="${d}" fill="none" stroke="${hexRgba(lo, 0.9)}" stroke-width="${N(bpx * 2)}"/>
    <path d="${d}" fill="none" stroke="${hexRgba(P(lighten(mat.light, 0.4)), 0.8)}" stroke-width="${N(bpx * 1.1)}" transform="translate(0 ${N(bpx * 1.9)})"/>
    <path d="${d}" fill="none" stroke="${hexRgba(lo, 0.32)}" stroke-width="${N(bpx * 2.6)}" transform="translate(0 ${N(-bpx * 1.2)})"/>`;
  } else { // metal-ridge
    bevels += `<path d="${d}" fill="none" stroke="${hexRgba(P(darken(mat.dark, 0.25)), 0.85)}" stroke-width="${N(bpx * 1.7)}"/>
    <path d="${d}" fill="none" stroke="${hexRgba(P(lighten(mat.light, 0.38)), 0.95)}" stroke-width="${N(bpx * 1.5)}" transform="translate(0 ${N(bpx * 1.7)})"/>
    <path d="${d}" fill="none" stroke="${hexRgba(P(hexMix(mat.light, "#FFFFFF", 0.3)), 0.5)}" stroke-width="${N(bpx * 1.2)}" transform="translate(0 ${N(-bpx * 1.5)})"/>`;
  }
  if (glass)
    bevels += `<path d="${d}" fill="none" stroke="${hexRgba(P(lighten(mat.light, 0.5)), 0.45)}" stroke-width="${N(bpx * 0.9)}" transform="translate(0 ${N(bpx * 0.5)})"/>`;
  if (fin.bounce > 0.01)
    bevels += `<path d="${d}" fill="none" stroke="${hexRgba(P(hexMix(mat.light, "#FFFFFF", 0.45)), fin.bounce * 0.55)}" stroke-width="${N(bpx * 1.3)}" transform="translate(0 ${N(-bpx * 2.1)})"/>`;

  /* gloss band + specular in recipe space (part-relative), then mapped — a
     vertical white fade, not a flat sheet, with a per-part waterline. */
  let sheen = "";
  if (fin.glossStrength > 0.01) {
    const frac = fin.glossFrac + by * 0.08;
    const yb = bb.minY + gh * frac;
    const dip = gh * fin.glossDip + (gw >= gh * 0.35 ? Math.min(gh * 0.05, gw * 0.12) : 0);
    const inset = gw * 0.035;
    defs += `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.62"/><stop offset="0.72" stop-color="#FFFFFF" stop-opacity="0.2"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.05"/></linearGradient>`;
    sheen += `<path d="${o.mk(`M ${N(bb.minX + inset)} ${N(bb.minY)} L ${N(bb.maxX - inset)} ${N(bb.minY)} L ${N(bb.maxX - inset)} ${N(yb)} Q ${N(bb.minX + gw / 2)} ${N(yb + dip)} ${N(bb.minX + inset)} ${N(yb)} Z`)}" fill="url(#${id}s)" opacity="${N(Math.min(0.95, fin.glossStrength))}"/>`;
  }
  const spCx = bb.minX + gw * (0.26 + bx * 0.2), spCy = bb.minY + gh * (0.17 + by * 0.2);
  if (fin.specularMode === "dot") {
    const rx = Math.min(gw * 0.14, gh * 0.24), ry = rx * 0.5;
    sheen += `<path d="${o.mk(blob(spCx, spCy, rx, ry))}" fill="#FFFFFF" opacity="0.78"/>
    <path d="${o.mk(blob(spCx + rx * 1.7, spCy + ry * 0.9, rx * 0.38, ry * 0.42))}" fill="#FFFFFF" opacity="0.5"/>`;
  } else if (fin.specularMode === "streak") {
    sheen += `<path d="${o.mk(streak(spCx, spCy, Math.min(gw * 0.4, gh * 0.7), Math.min(gh * 0.1, gw * 0.16)))}" fill="#FFFFFF" opacity="0.62"/>`;
  } else if (fin.specularMode === "arc") {
    defs += `<clipPath id="${id}a"><path d="${o.mk(`M ${N(bb.minX)} ${N(bb.minY)} L ${N(bb.maxX)} ${N(bb.minY)} L ${N(bb.maxX)} ${N(bb.minY + gh * 0.4)} L ${N(bb.minX)} ${N(bb.minY + gh * 0.4)} Z`)}"/></clipPath>`;
    sheen += `<g clip-path="url(#${id}a)"><path d="${d}" fill="none" stroke="#FFFFFF" stroke-width="${N(bpx * 1.5)}" opacity="0.6" transform="translate(0 ${N(bpx * 2.4)})"/></g>`;
  }

  const body = `<g clip-path="url(#${id}c)">
    <path d="${d}" fill="url(#${id}g)"/>
    ${bevels}
    ${sheen}
  </g>
  <path d="${d}" fill="none" stroke="${P(darken(mat.dark, 0.3))}" stroke-width="1.5" opacity="0.9"/>`;
  return { defs, body };
}

/** Render a compound vector asset — baked construction, live skin. The
 *  asset supplies geometry and semantic slots; the skin supplies colors,
 *  pattern, finish, gloss, contrast. Painted per SURFACE GROUP (each
 *  material layer followed by its clipped overlays), so folds, cavities
 *  and authored highlights always shade the pattern, and later surfaces
 *  correctly occlude earlier ones. */
export function renderCompoundAsset(o: {
  id: string;
  asset: CompoundVectorAsset;
  skin: CompoundSkin;
  mat: MaterialSpec;               // part's bound material role (color default)
  mk: (d: string) => string;       // recipe → target mapper (may mirror)
  P: (c: string) => string;
  sy: number;
  bevel: number;
  mirror: boolean;
  /** Button's vertical axis in target px — mirrored pattern placement
   *  reflects the motif about this line. */
  axisX: number;
}): { defs: string; body: string } {
  const { id, asset, skin, P } = o;
  const primary = skin.primary ?? { light: o.mat.light, base: o.mat.base, dark: o.mat.dark };
  const finish = skin.finish ?? "plastic";
  const gloss = skin.glossStrength ?? 1;
  const contrast = skin.contrast ?? 1;
  const secondary = skin.secondary ?? darken(primary.dark, 0.18);
  const edgeC = skin.edge ?? darken(primary.dark, 0.32);
  const pat = skin.pattern;
  const bpx = o.bevel * o.sy;

  let defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${finishStopsV(primary, finish, P, 0.3)}</linearGradient>
  <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.24"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="${darken(primary.dark, 0.3)}" stop-opacity="0.3"/></linearGradient>`;
  if (pat && pat.type !== "none") {
    const reflect = o.mirror && pat.placement === "mirrored";
    const transform = `${reflect ? `translate(${N(o.axisX * 2)} 0) scale(-1 1) ` : ""}rotate(${pat.angle})`;
    defs += patternDef(`${id}pat`, pat, P(pat.color), transform);
  }

  /* per-layer clip defs, created lazily for clip targets */
  const clipIds = new Map<string, string>();
  const clipFor = (layerId: string): string => {
    let cid = clipIds.get(layerId);
    if (!cid) {
      cid = `${id}c${clipIds.size}`;
      const l = asset.layers.find((x) => x.id === layerId);
      defs += `<clipPath id="${cid}"><path d="${o.mk(l?.path ?? asset.silhouette)}"/></clipPath>`;
      clipIds.set(layerId, cid);
    }
    return cid;
  };

  const slotPaint: Record<string, { fill: string; opacity: number }> = {
    fold: { fill: P(secondary), opacity: Math.min(1, 0.6 * contrast) },
    cavity: { fill: P(darken(primary.dark, 0.45)), opacity: Math.min(1, 0.58 * contrast) },
    highlight: { fill: "#FFFFFF", opacity: Math.min(1, 0.85 * gloss) },
    crease: { fill: P(lighten(primary.light, 0.35)), opacity: 0.8 },
    edge: { fill: P(edgeC), opacity: 0.9 },
  };

  let body = "";
  let lastMaterial = "";
  for (const l of asset.layers) {
    const d = o.mk(l.path);
    if (l.kind === "material") {
      lastMaterial = l.id;
      const cid = clipFor(l.id);
      body += `<g clip-path="url(#${cid})" data-asset-layer="${l.id}" data-slot="${l.slot}">
        <path d="${d}" fill="url(#${id}g)"/>
        ${l.patternSurface && pat && pat.type !== "none" ? `<path d="${d}" fill="url(#${id}pat)" opacity="${N(Math.min(1, pat.opacity))}"/>` : ""}
        <path d="${d}" fill="url(#${id}v)"/>
        <path d="${d}" fill="none" stroke="${hexRgba(P(lighten(primary.light, 0.32)), 0.6)}" stroke-width="${N(bpx * 2.2)}" transform="translate(0 ${N(bpx)})"/>
        <path d="${d}" fill="none" stroke="${hexRgba(P(darken(primary.dark, 0.35)), 0.45)}" stroke-width="${N(bpx * 2)}" transform="translate(0 ${N(-bpx * 0.9)})"/>
      </g>
      <path d="${d}" fill="none" stroke="${P(edgeC)}" stroke-width="1.4" opacity="0.9"/>`;
    } else {
      const paint = slotPaint[l.slot] ?? { fill: P(primary.base), opacity: 1 };
      const cid = clipFor(l.clipTo ?? lastMaterial);
      body += `<g clip-path="url(#${cid})"><path d="${d}" fill="${paint.fill}" opacity="${N(Math.min(1, paint.opacity * (l.opacity ?? 1)))}" data-asset-layer="${l.id}" data-slot="${l.slot}"/></g>`;
    }
  }
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

  const depth = (recipe.extrusion ?? 8) * sy;
  const pad = 60; // glow / shadow air
  const W = x * 2 + w, H = y * 2 + h + depth + 14;
  const hullD = mk(recipe.hull);
  const chassis = recipe.materials.frame;

  /* 1 · cast shadow + 2 · hull extrusion (the proven translated-path hull) */
  const shadow = `<path d="${hullD}" transform="translate(0 ${N(depth + 5 + Math.max(0, adj.lift))})" fill="#04060C" opacity="${disabled ? 0.2 : 0.46}" filter="url(#${id}sb)"/>`;
  const nSl = Math.max(2, Math.ceil(depth / 2.5));
  const slabs = Array.from({ length: nSl }, (_, i) =>
    `<path d="${hullD}" transform="translate(0 ${N((depth * (i + 1)) / nSl)})" fill="${P(darken(chassis.dark, 0.12))}"${i === nSl - 1 ? ` stroke="${darken(chassis.dark, 0.4)}" stroke-width="1"` : ""}/>`).join("");

  /* 3–6 · parts by z-order; mirrored copies re-map the authored LEFT
     geometry through the mirror so lighting events mirror with the part */
  const expanded = recipe.parts.flatMap((p) => {
    const list = [{ p, mirror: false, key: p.id }];
    if (p.mirrorX) list.push({ p, mirror: true, key: p.id + "-r" });
    return list;
  }).sort((a, b) => a.p.zIndex - b.p.zIndex);

  let defs = "", stack = "", usedPartShadow = false;
  expanded.forEach((e, i) => {
    const p = e.p;
    const mat = recipe.materials[p.material];
    const fin = resolveFinish(p, mat);
    const mkP = e.mirror ? (d: string) => mk(mirrorPathX(d)) : mk;
    const asset = p.asset ? COMPOUND_ASSETS[p.asset] : undefined;
    const dP = mkP(asset ? asset.silhouette : p.path ?? "");
    if (fin.shadowDensity > 0.01) {
      usedPartShadow = true;
      stack += `<path d="${dP}" transform="translate(0 ${N(2.8 * sy)})" fill="${darken(chassis.dark, 0.4)}" opacity="${N(fin.shadowDensity * (disabled ? 0.5 : 1))}" filter="url(#${id}pb)" data-part-shadow="${e.key}"/>`;
    }
    if (p.depth > 0) {
      const dpx = p.depth * sy;
      const nS = dpx > 5 ? 2 : 1;
      for (let s = nS; s >= 1; s--)
        stack += `<path d="${dP}" transform="translate(0 ${N((dpx * s) / nS)})" fill="${P(darken(mat.dark, s === nS ? 0.34 : 0.24))}"${s === nS ? ` stroke="${darken(mat.dark, 0.5)}" stroke-width="0.8"` : ""} data-part-depth="${e.key}"/>`;
    }
    const m = asset
      ? renderCompoundAsset({ id: `${id}p${i}`, asset, skin: p.assetSkin ?? {}, mat, mk: mkP, P, sy, bevel: p.bevel, mirror: e.mirror, axisX: x + w / 2 })
      : renderMaterialPath({ id: `${id}p${i}`, path: p.path ?? "", mk: mkP, mat, fin, bevel: p.bevel, P, sy });
    defs += m.defs;
    stack += `<g data-part="${e.key}" data-material="${p.material}"${asset ? ` data-asset="${asset.id}"` : ` data-finish="${fin.finish}"`}>${m.body}</g>`;
  });

  /* 8 · label — sized to the recipe's safe area, mapped through the SAME
     piecewise x-map as the geometry, so the label respects the compressed
     center band under cap-preserving stretch instead of scaling linearly */
  const capW = capSrc * sy;
  const midSrc = 200 - capSrc * 2;
  const midW = w - capW * 2;
  const capsOn = (opts.caps ?? true) && midSrc > 4 && midW >= midSrc * sy * 0.25;
  const mapX = (X: number): number => !capsOn
    ? x + (X / 200) * w
    : X <= capSrc ? x + X * sy
      : X >= 200 - capSrc ? x + w - (200 - X) * sy
        : x + capW + (X - capSrc) * (midW / midSrc);
  const label = esc((opts.label ?? recipe.label).toUpperCase());
  const font = opts.font ?? "Russo One";
  const factor = fontByName(font).factor * 1.08;
  const bx0 = mapX(recipe.safeArea.x), bx1 = mapX(recipe.safeArea.x + recipe.safeArea.width);
  const bandPx = bx1 - bx0;
  const fs = Math.min((recipe.safeArea.height / 100) * h * 0.72, bandPx / Math.max(1, label.length * factor));
  const cxT = (bx0 + bx1) / 2, cyT = y + ((recipe.safeArea.y + recipe.safeArea.height / 2) / 100) * h;
  const faceMat = recipe.materials.face;
  const text = `<g data-skin-label="1" opacity="${disabled ? 0.55 : 1}">
    <text x="${N(cxT)}" y="${N(cyT + fs * 0.06)}" font-family="'${font}', Inter, sans-serif" font-size="${N(fs)}" font-weight="700" font-style="italic" text-anchor="middle" dominant-baseline="central" fill="${darken(faceMat.dark, 0.4)}" opacity="0.85" transform="translate(0 ${N(fs * 0.07)})">${label}</text>
    <text x="${N(cxT)}" y="${N(cyT)}" font-family="'${font}', Inter, sans-serif" font-size="${N(fs)}" font-weight="700" font-style="italic" text-anchor="middle" dominant-baseline="central" fill="url(#${id}tg)">${label}</text>
  </g>`;

  /* hover aura from the hull */
  const aura = adj.glow > 0.01 && !disabled
    ? `<path d="${hullD}" fill="${P(recipe.materials.metal.light)}" opacity="${(adj.glow * 0.55).toFixed(2)}" filter="url(#${id}gb)"/>`
    : "";

  const wire = opts.wireframe
    ? `<g data-skin-wire="1" fill="none" stroke-width="1.3">
        <path d="${hullD}" stroke="#FF3B30"/>
        ${expanded.map((e, i) => {
      const mkW = e.mirror ? (d: string) => mk(mirrorPathX(d)) : mk;
      const col = ["#32E6FF", "#FFCC00", "#5BE49B", "#EC68FF", "#FF9A3D", "#EAF5FF"][i % 6];
      const a = e.p.asset ? COMPOUND_ASSETS[e.p.asset] : undefined;
      return a
        ? a.layers.map((l) => `<path d="${mkW(l.path)}" stroke="${col}" stroke-width="0.9" stroke-dasharray="3 2"/>`).join("")
        : `<path d="${mkW(e.p.path ?? "")}" stroke="${col}" stroke-dasharray="4 3"/>`;
    }).join("")}
      </g>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad * 2}" height="${H + pad * 2}" viewBox="${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}" data-skin="${recipe.id}" data-shell="${x} ${y + adj.lift} ${w} ${h}" role="img" aria-label="${esc(recipe.name)}, ${state} state">
<defs>
  ${defs}
  <linearGradient id="${id}hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P(lighten(chassis.base, 0.16))}"/><stop offset="0.5" stop-color="${P(chassis.base)}"/><stop offset="1" stop-color="${P(chassis.dark)}"/></linearGradient>
  <linearGradient id="${id}tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${disabled ? "#C9CCD6" : hexMix(faceMat.light, "#FFFFFF", 0.55)}"/></linearGradient>
  <clipPath id="${id}hc"><path d="${hullD}"/></clipPath>
  <filter id="${id}sb" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
  ${usedPartShadow ? `<filter id="${id}pb" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${N(2 * sy)}"/></filter>` : ""}
  ${aura ? `<filter id="${id}gb" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="16"/></filter>` : ""}
</defs>
<g opacity="${adj.opacity.toFixed(2)}">
  ${shadow}
  ${aura}
  <g transform="translate(0 ${adj.lift})">
    ${slabs}
    <g clip-path="url(#${id}hc)" data-skin-stack="1">
      <path d="${hullD}" fill="url(#${id}hg)"/>
      ${stack}
    </g>
    <path d="${hullD}" fill="none" stroke="${P(darken(chassis.dark, 0.3))}" stroke-width="1.6"/>
    ${text}
    ${wire}
  </g>
</g>
</svg>`;
}
