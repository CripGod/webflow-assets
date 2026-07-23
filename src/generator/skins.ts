/* ── Layered Skin renderer — the lab's second rendering mode ───────────────
   The v64 single shell derives rim and face by shrinking one silhouette, so
   every notch and lobe repeats inward — great for simple candy, wrong for
   the reference art, which is an ASSEMBLY of separate pieces. This module
   renders a data-driven recipe instead:

     1  cast shadow from the footprint   5  independent central face
     2  optional chassis + extrusion     6  foreground clamps / accents
     3  rear decorative parts            7  per-part finish, gloss, specular
     4  frames / sockets                 8  front compound layers, label

   Everything is generic: a recipe is pure data (paths + material roles +
   z-order + mirroring + finish controls) authored in the same 0 0 200 100
   system as the imported hulls. No shape-specific components exist anywhere
   — a new design is a new recipe file entry, nothing else.

   v69 GEOMETRY CONTRACT — footprint vs chassis:
   The old `hull` did five jobs at once (hit area, max clip, shadow, painted
   fill, full-object extrusion), which left a dark ghost slab behind
   assemblies whose parts carry their own depth. Now:
     · `footprint` — hit area, overall bounds, MAXIMUM CLIP, hover aura,
       cast shadow. Never painted, never extruded.
     · `chassis?` — an explicitly declared painted+extruded body for
       recipes that genuinely have one (Twin Grip). Recipes whose parts
       provide all visible depth (Prize Bow) simply omit it.
   Compound-asset parts extrude per physical material layer (each dark
   lower edge follows its own ribbon contour), colored by the LIVE resolved
   compound palette — never by the recipe material after a reskin.

   Cap-preserving stretch runs EVERY part through the same piecewise x-map,
   so mirrored end-caps stay rigid while only the center band stretches. */

import { transformPath, transformPathCapAware } from "./bevel";
import { flattenPath, bounds } from "./importedShapes";
import { lighten, darken, desaturate, saturate, hexMix, hexRgba, fontByName } from "./model";
import type { GenStateName } from "./model";
import { COMPOUND_ASSETS, patternDef, mirrorPathX, resolveCompoundSkin, materialLayers } from "./compound";
import type { CompoundVectorAsset, CompoundSkin } from "./compound";

export { mirrorPathX };

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
  finish?: FinishType;
  bevelProfile?: BevelProfile;
  glossStrength?: number;
  glossFrac?: number;
  glossDip?: number;
  specularMode?: PartSpecular;
  highlightBias?: [number, number];
  edgeDarkening?: number;
  saturationBoost?: number;
  bounce?: number;
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
  /** Stack position for the asset's `front` zSlot layers (the gathering
   *  wrap) — lets one asset put loops behind the frame and its collar in
   *  front, all through data. */
  frontZIndex?: number;
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
  /** Hit area, overall bounds, maximum clip, hover aura, cast shadow.
   *  NOT painted, NOT extruded. */
  footprint: string;
  /** Explicit visible body for recipes that genuinely have one — painted
   *  with the material's gradient and extruded by `depth`. Omit when the
   *  parts provide all visible depth themselves. */
  chassis?: { path: string; material: string; depth: number };
  parts: SkinPart[];
  materials: Record<MaterialRole, MaterialSpec> & Record<string, MaterialSpec>;
  safeArea: { x: number; y: number; width: number; height: number };
  stretch: { leftCap: number; rightCap: number };
  label: string;
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

/** Render one zSlot pass of a compound vector asset — baked construction,
 *  live skin. Painted per SURFACE GROUP (each material layer's own
 *  extrusion slab, then its surface, then its clipped overlays), so folds,
 *  cavities and authored highlights always shade the pattern, later
 *  surfaces occlude earlier ones, and every dark lower edge follows its
 *  own contour. All colors come from resolveCompoundSkin — a reskinned
 *  ribbon reskins its depth with it. */
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
  /** Which layers to paint: rear+body at the part's zIndex, front at
   *  frontZIndex. */
  zPass: "body" | "front";
  /** Part extrusion in target px, applied per material layer. */
  dpx: number;
  shadowFilterId: string;
  shadeTint: string;
}): { defs: string; body: string } {
  const { id, asset, skin, P } = o;
  const pal = resolveCompoundSkin(skin, { light: o.mat.light, base: o.mat.base, dark: o.mat.dark });
  const primary = { light: pal.primaryLight, base: pal.primaryBase, dark: pal.primaryDark };
  const finish = skin.finish ?? "plastic";
  const gloss = skin.glossStrength ?? 1;
  const contrast = skin.contrast ?? 1;
  const pat = skin.pattern;
  const bpx = o.bevel * o.sy;

  /* each pass carries its own defs — pass ids are unique per call */
  let defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1">${finishStopsV(primary, finish, P, 0.3)}</linearGradient>
  <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.24"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="${darken(pal.primaryDark, 0.3)}" stop-opacity="0.3"/></linearGradient>`;
  if (pat && pat.type !== "none") {
    const reflect = o.mirror && pat.placement === "mirrored";
    const transform = `${reflect ? `translate(${N(o.axisX * 2)} 0) scale(-1 1) ` : ""}rotate(${pat.angle})`;
    defs += patternDef(`${id}pat`, pat, P(pat.color), transform);
  }
  const gradRef = id;

  /* per-layer clip defs, created lazily for clip targets */
  const clipIds = new Map<string, string>();
  const clipFor = (layerId: string): string => {
    let cid = clipIds.get(layerId);
    if (!cid) {
      cid = `${id}c${clipIds.size}`;
      const l = asset.layers.find((x) => x.id === layerId);
      defs += `<clipPath id="${cid}"><path d="${o.mk(l?.path ?? asset.footprint)}"/></clipPath>`;
      clipIds.set(layerId, cid);
    }
    return cid;
  };

  const slotPaint: Record<string, { fill: string; opacity: number }> = {
    fold: { fill: P(pal.fold), opacity: Math.min(1, 0.6 * contrast) },
    cavity: { fill: P(pal.cavity), opacity: Math.min(1, 0.58 * contrast) },
    highlight: { fill: "#FFFFFF", opacity: Math.min(1, 0.85 * gloss) },
    crease: { fill: P(lighten(pal.primaryLight, 0.35)), opacity: 0.8 },
    edge: { fill: P(pal.edge), opacity: 0.9 },
  };

  const inPass = (zSlot?: string) => (zSlot === "front") === (o.zPass === "front");
  let body = "";
  let lastMaterial = "";

  /* legacy whole-footprint depth mode, for assets that want one slab */
  if (o.zPass === "body" && asset.depthMode === "footprint" && o.dpx > 0) {
    const fd = o.mk(asset.footprint);
    body += `<path d="${fd}" transform="translate(0 ${N(o.dpx)})" fill="${P(pal.extrusionDark)}" stroke="${darken(pal.extrusionDark, 0.3)}" stroke-width="0.8" data-asset-depth="footprint"/>`;
  }

  for (const l of asset.layers) {
    if (!inPass(l.zSlot)) continue;
    const d = o.mk(l.path);
    if (l.kind === "material") {
      lastMaterial = l.id;
      if (l.castShadow && l.castShadow > 0.01)
        body += `<path d="${d}" transform="translate(0 ${N(2.6 * o.sy)})" fill="${o.shadeTint}" opacity="${N(l.castShadow)}" filter="url(#${o.shadowFilterId})" data-asset-shadow="${l.id}"/>`;
      if (asset.depthMode === "per-material-layer" && o.dpx > 0) {
        body += `<path d="${d}" transform="translate(0 ${N(o.dpx)})" fill="${P(pal.extrusionDark)}" stroke="${darken(pal.extrusionDark, 0.3)}" stroke-width="0.8" data-asset-depth="${l.id}"/>`;
        if (o.dpx > 5 * o.sy * 0.8)
          body += `<path d="${d}" transform="translate(0 ${N(o.dpx * 0.55)})" fill="${P(pal.extrusionLight)}" data-asset-depth="${l.id}"/>`;
      }
      const cid = clipFor(l.id);
      body += `<g clip-path="url(#${cid})" data-asset-layer="${l.id}" data-slot="${l.slot}">
        <path d="${d}" fill="url(#${gradRef}g)"/>
        ${l.patternSurface && pat && pat.type !== "none" ? `<path d="${d}" fill="url(#${gradRef}pat)" opacity="${N(Math.min(1, pat.opacity))}"/>` : ""}
        <path d="${d}" fill="url(#${gradRef}v)"/>
        <path d="${d}" fill="none" stroke="${hexRgba(P(lighten(pal.primaryLight, 0.32)), 0.6)}" stroke-width="${N(bpx * 2.2)}" transform="translate(0 ${N(bpx)})"/>
        <path d="${d}" fill="none" stroke="${hexRgba(P(darken(pal.primaryDark, 0.35)), 0.45)}" stroke-width="${N(bpx * 2)}" transform="translate(0 ${N(-bpx * 0.9)})"/>
      </g>
      <path d="${d}" fill="none" stroke="${P(pal.edge)}" stroke-width="1.4" opacity="0.9"/>`;
    } else {
      const paint = slotPaint[l.slot] ?? { fill: P(pal.primaryBase), opacity: 1 };
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

interface RenderEntry {
  p: SkinPart;
  mirror: boolean;
  key: string;
  z: number;
  pass: "body" | "front";
}

/** Render a full layered-skin assembly at an exact frame. Pure
 *  (recipe, state, size) → SVG string, like every engine entry point. */
export function renderSkinRecipe(recipe: ButtonSkinRecipe, state: GenStateName, w: number, h: number, opts: {
  label?: string; font?: string; caps?: boolean; wireframe?: boolean; diagnostic?: boolean;
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

  const chassis = recipe.chassis;
  const chassisMat = chassis ? recipe.materials[chassis.material] : undefined;
  const shadeCore = recipe.materials.frame;
  const maxPartDepth = recipe.parts.reduce((m, p) => Math.max(m, p.depth), 0);
  const depth = (chassis ? chassis.depth : maxPartDepth) * sy;
  const pad = 60; // glow / shadow air
  const W = x * 2 + w, H = y * 2 + h + depth + 14;
  const footD = mk(recipe.footprint);

  /* 1 · cast shadow from the FOOTPRINT (hit area, bounds, clip, shadow —
     never painted, never extruded) */
  const shadow = `<path d="${footD}" transform="translate(0 ${N(depth + 5 + Math.max(0, adj.lift))})" fill="#04060C" opacity="${disabled ? 0.2 : 0.46}" filter="url(#${id}sb)"/>`;

  /* 2 · optional chassis — the only whole-body paint + extrusion left */
  let chassisArt = "", chassisSlabs = "";
  if (chassis && chassisMat) {
    const chD = mk(chassis.path);
    const nSl = Math.max(2, Math.ceil((chassis.depth * sy) / 2.5));
    chassisSlabs = Array.from({ length: nSl }, (_, i) =>
      `<path d="${chD}" transform="translate(0 ${N((chassis.depth * sy * (i + 1)) / nSl)})" fill="${P(darken(chassisMat.dark, 0.12))}"${i === nSl - 1 ? ` stroke="${darken(chassisMat.dark, 0.4)}" stroke-width="1"` : ""}/>`).join("");
    chassisArt = `<path d="${chD}" fill="url(#${id}hg)"/>`;
  }

  /* 3–8 · parts by z-order; compound assets contribute a body pass at
     their zIndex and (optionally) a front pass at frontZIndex */
  const entries: RenderEntry[] = recipe.parts.flatMap((p) => {
    const copies = p.mirrorX ? [false, true] : [false];
    return copies.flatMap((mirror): RenderEntry[] => {
      const key = p.id + (mirror ? "-r" : "");
      const list: RenderEntry[] = [{ p, mirror, key, z: p.zIndex, pass: "body" }];
      const asset = p.asset ? COMPOUND_ASSETS[p.asset] : undefined;
      if (asset && p.frontZIndex !== undefined && asset.layers.some((l) => l.zSlot === "front"))
        list.push({ p, mirror, key: key + "-front", z: p.frontZIndex, pass: "front" });
      return list;
    });
  }).sort((a, b) => a.z - b.z);

  let defs = "", stack = "";
  entries.forEach((e, i) => {
    const p = e.p;
    const mat = recipe.materials[p.material];
    const fin = resolveFinish(p, mat);
    const mkP = e.mirror ? (d: string) => mk(mirrorPathX(d)) : mk;
    const asset = p.asset ? COMPOUND_ASSETS[p.asset] : undefined;
    const pal = asset ? resolveCompoundSkin(p.assetSkin ?? {}, mat) : undefined;
    const shadeTint = pal ? darken(pal.extrusionDark, 0.25) : darken(shadeCore.dark, 0.4);
    if (e.pass === "body" && fin.shadowDensity > 0.01) {
      const dP = mkP(asset ? asset.footprint : p.path ?? "");
      stack += `<path d="${dP}" transform="translate(0 ${N(2.8 * sy)})" fill="${shadeTint}" opacity="${N(fin.shadowDensity * (disabled ? 0.5 : 1))}" filter="url(#${id}pb)" data-part-shadow="${e.key}"/>`;
    }
    if (asset) {
      const m = renderCompoundAsset({
        id: `${id}p${i}${e.pass === "front" ? "f" : ""}`, asset, skin: p.assetSkin ?? {}, mat,
        mk: mkP, P, sy, bevel: p.bevel, mirror: e.mirror, axisX: x + w / 2,
        zPass: e.pass, dpx: p.depth * sy, shadowFilterId: `${id}pb`, shadeTint,
      });
      defs += m.defs;
      stack += `<g data-part="${e.key}" data-material="${p.material}" data-asset="${asset.id}">${m.body}</g>`;
    } else {
      if (p.depth > 0) {
        const dP = mkP(p.path ?? "");
        const dpx = p.depth * sy;
        const nS = dpx > 5 ? 2 : 1;
        for (let s = nS; s >= 1; s--)
          stack += `<path d="${dP}" transform="translate(0 ${N((dpx * s) / nS)})" fill="${P(darken(mat.dark, s === nS ? 0.34 : 0.24))}"${s === nS ? ` stroke="${darken(mat.dark, 0.5)}" stroke-width="0.8"` : ""} data-part-depth="${e.key}"/>`;
      }
      const m = renderMaterialPath({ id: `${id}p${i}`, path: p.path ?? "", mk: mkP, mat, fin, bevel: p.bevel, P, sy });
      defs += m.defs;
      stack += `<g data-part="${e.key}" data-material="${p.material}" data-finish="${fin.finish}">${m.body}</g>`;
    }
  });

  /* label — sized to the recipe's safe area, mapped through the SAME
     piecewise x-map as the geometry, so type respects the compressed
     center band under cap-preserving stretch */
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

  /* hover aura from the footprint */
  const aura = adj.glow > 0.01 && !disabled
    ? `<path d="${footD}" fill="${P(recipe.materials.metal.light)}" opacity="${(adj.glow * 0.55).toFixed(2)}" filter="url(#${id}gb)"/>`
    : "";

  const wire = opts.wireframe
    ? `<g data-skin-wire="1" fill="none" stroke-width="1.3">
        <path d="${footD}" stroke="#FF3B30"/>
        ${entries.filter((e) => e.pass === "body").map((e, i) => {
      const mkW = e.mirror ? (d: string) => mk(mirrorPathX(d)) : mk;
      const col = ["#32E6FF", "#FFCC00", "#5BE49B", "#EC68FF", "#FF9A3D", "#EAF5FF"][i % 6];
      const a = e.p.asset ? COMPOUND_ASSETS[e.p.asset] : undefined;
      return a
        ? a.layers.map((l) => `<path d="${mkW(l.path)}" stroke="${col}" stroke-width="0.9" stroke-dasharray="3 2"/>`).join("")
        : `<path d="${mkW(e.p.path ?? "")}" stroke="${col}" stroke-dasharray="4 3"/>`;
    }).join("")}
      </g>`
    : "";

  /* alignment diagnostic — the SAME transforms, cap mapping and mirroring
     as the finished render (mk / mkP), never a separate approximation.
     red: recipe footprint · yellow: compound footprints · cyan: material
     layers · white: single-path parts · purple: actual depth contours ·
     orange fill: compound footprint minus its material surfaces. */
  let diag = "";
  if (opts.diagnostic) {
    let g = `<path d="${footD}" stroke="#FF3B30" stroke-width="1.6" fill="none"/>`;
    let dDefs = "";
    entries.forEach((e, i) => {
      const mkP = e.mirror ? (d: string) => mk(mirrorPathX(d)) : mk;
      const a = e.p.asset ? COMPOUND_ASSETS[e.p.asset] : undefined;
      if (a && e.pass === "body") {
        const mats = materialLayers(a);
        dDefs += `<mask id="${id}dm${i}"><path d="${mkP(a.footprint)}" fill="#FFFFFF"/>${mats.map((l) => `<path d="${mkP(l.path)}" fill="#000000"/>`).join("")}</mask>`;
        g += `<g mask="url(#${id}dm${i})"><path d="${mkP(a.footprint)}" fill="#FF9A3D" opacity="0.55"/></g>`;
        g += `<path d="${mkP(a.footprint)}" stroke="#FFCC00" stroke-width="1.4" fill="none"/>`;
        g += mats.map((l) => `<path d="${mkP(l.path)}" stroke="#32E6FF" stroke-width="1" fill="none"/>`).join("");
        if (e.p.depth > 0) {
          const dpx = e.p.depth * sy;
          const src = a.depthMode === "per-material-layer" ? mats.map((l) => l.path) : [a.footprint];
          g += src.map((pth) => `<path d="${mkP(pth)}" transform="translate(0 ${N(dpx)})" stroke="#EC68FF" stroke-width="1" fill="none" stroke-dasharray="3 2"/>`).join("");
        }
      } else if (!a && e.pass === "body" && e.p.path) {
        g += `<path d="${mkP(e.p.path)}" stroke="#FFFFFF" stroke-width="0.9" fill="none" stroke-dasharray="5 3"/>`;
        if (e.p.depth > 0) g += `<path d="${mkP(e.p.path)}" transform="translate(0 ${N(e.p.depth * sy)})" stroke="#EC68FF" stroke-width="1" fill="none" stroke-dasharray="3 2"/>`;
      }
    });
    if (chassis) g += `<path d="${mk(chassis.path)}" transform="translate(0 ${N(chassis.depth * sy)})" stroke="#EC68FF" stroke-width="1.2" fill="none" stroke-dasharray="6 3"/>`;
    diag = `<defs>${dDefs}</defs><g data-skin-diag="1">${g}</g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W + pad * 2}" height="${H + pad * 2}" viewBox="${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}" data-skin="${recipe.id}" data-shell="${x} ${y + adj.lift} ${w} ${h}" role="img" aria-label="${esc(recipe.name)}, ${state} state">
<defs>
  ${defs}
  ${chassisMat ? `<linearGradient id="${id}hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P(lighten(chassisMat.base, 0.16))}"/><stop offset="0.5" stop-color="${P(chassisMat.base)}"/><stop offset="1" stop-color="${P(chassisMat.dark)}"/></linearGradient>` : ""}
  <linearGradient id="${id}tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${disabled ? "#C9CCD6" : hexMix(faceMat.light, "#FFFFFF", 0.55)}"/></linearGradient>
  <clipPath id="${id}hc"><path d="${footD}"/></clipPath>
  <filter id="${id}sb" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
  <filter id="${id}pb" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${N(2 * sy)}"/></filter>
  ${aura ? `<filter id="${id}gb" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="16"/></filter>` : ""}
</defs>
<g opacity="${adj.opacity.toFixed(2)}">
  ${shadow}
  ${aura}
  <g transform="translate(0 ${adj.lift})">
    ${chassisSlabs}
    <g clip-path="url(#${id}hc)" data-skin-stack="1">
      ${chassisArt}
      ${stack}
    </g>
    ${chassis ? `<path d="${mk(chassis.path)}" fill="none" stroke="${P(darken((chassisMat as MaterialSpec).dark, 0.3))}" stroke-width="1.6"/>` : ""}
    ${text}
    ${wire}
    ${diag}
  </g>
</g>
</svg>`;
}
