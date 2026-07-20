import { create } from "zustand";
import type { GenConfig, GenStateName, KitComponentId, KitSize, GridStyle, CandyTokens, Shape, KitDesign } from "./model";
import { defaultConfig, defaultCandy, applyPresetCandy, randomizeConfig, presetById, darken, hexMix, registerCustomFont, pickDesign, GAME_FONTS, KIT_SHAPE, applyKitDesign, setUserShapes } from "./model";
import type { UserShape } from "./model";
import { renderBevel } from "./bevel";
import { getDef } from "./icons";
import siteDefaultJson from "./site-default.json";
import bubblePopJson from "./preset-bubble-pop.json";
import neonVersusJson from "./preset-neon-versus.json";
import grapeJellyJson from "./preset-grape-jelly.json";

/* Presets with fully authored default designs (Chevon's uploads). */
export const PRESET_DEFAULTS: Record<string, Record<string, any>> = {
  "bubble-pop": bubblePopJson as Record<string, any>,
  "neon-versus": neonVersusJson as Record<string, any>,
  "grape-jelly": grapeJellyJson as Record<string, any>,
};

/* Keep the text treatment's accent colors in step with the shell palette so a
   preset or color roll never leaves a stale outline color behind. */
export function retintText(c: GenConfig) {
  const bevel = c.effects.Bevel ?? "#0E9CC9";
  const glow = c.effects.Glow ?? darken(bevel, -0.4);
  c.type.outline.color = darken(bevel, 0.5);
  if (c.type.outline.color2) c.type.outline.color2 = darken(bevel, 0.7);
  c.type.shadow.color = darken(bevel, 0.62);
  c.type.glow.color = glow;
  // the typeface itself joins the harmony roll
  if (c.type.fillMode !== "auto") {
    c.type.fill = hexMix(glow, "#FFFFFF", 0.1);
    c.type.fill2 = hexMix(bevel, glow, 0.45);
  }
}

const LS_KEY = "ui-generator-v10"; // v10: specular modes, solid extrusion, gloss layering
const LS_KEY_V9 = "ui-generator-v9";
const LS_KEY_V8 = "ui-generator-v8";
// set once the user actually edits — an untouched visitor tracks the site default
const TOUCHED_KEY = "ui-generator-touched";
export function markTouched() { try { localStorage.setItem(TOUCHED_KEY, "1"); } catch { /* ignore */ } }

/* Deep-merge saved candy tokens over the current defaults so new fields
   (specular mode, gloss layer, contact…) always arrive with sane values. */
function mergeCandy(base: CandyTokens, saved?: Record<string, any>): CandyTokens {
  const out = JSON.parse(JSON.stringify(base)) as Record<string, any>;
  if (saved) {
    for (const k of Object.keys(base)) {
      if (saved[k] && typeof saved[k] === "object") out[k] = { ...out[k], ...saved[k] };
    }
    // v9 → v10: specular "opacity" became "intensity"
    if (saved.specular?.opacity !== undefined && saved.specular?.intensity === undefined) {
      out.specular.intensity = saved.specular.opacity;
    }
    delete out.specular.opacity;
  }
  return out as CandyTokens;
}

export function hydrate(parsed: Record<string, any>): GenConfig {
  const d = defaultConfig();
  const cfg = {
    ...d, ...parsed,
    candy: mergeCandy(d.candy, parsed.candy),
    type: { ...d.type, ...parsed.type },
    icon: { ...d.icon, ...parsed.icon },
    face: { ...d.face, ...parsed.face },
  } as GenConfig;
  if (!cfg.stateDesigns) cfg.stateDesigns = {};
  // state forks saved before newer candy tokens existed get them merged in
  for (const sd of Object.values(cfg.stateDesigns)) {
    if (sd?.candy) sd.candy = mergeCandy(d.candy, sd.candy);
  }
  if ((cfg.shape as string) === "shard") cfg.shape = "sharp";
  // retired silhouettes map to their closest living relatives
  const RETIRED: Record<string, GenConfig["shape"]> = { chamfer: "sharp", kart: "polybar", deepchamfer: "cutline", doboMarquee: "crest", doboRibbon: "banner" };
  if (RETIRED[cfg.shape as string]) cfg.shape = RETIRED[cfg.shape as string];
  for (const sd of Object.values(cfg.stateDesigns)) {
    if (sd && RETIRED[sd.shape as string]) sd.shape = RETIRED[sd.shape as string];
  }
  (cfg.type.customFonts ?? []).forEach(registerCustomFont);
  return cfg;
}

/* Carry what translates from a v8 save into the candy model. */
function migrateV8(old: Record<string, any>): GenConfig {
  const c = defaultConfig();
  try {
    if (old.effects) c.effects = { ...c.effects, ...old.effects };
    if (old.shape) c.shape = old.shape;
    if (old.presetId) c.presetId = old.presetId;
    if (old.canvas) c.canvas = old.canvas;
    if (old.bevel) c.bevel = { width: old.bevel.width ?? c.bevel.width, softness: old.bevel.softness ?? c.bevel.softness };
    if (old.lighting) c.lighting = {
      angle: old.lighting.angle ?? c.lighting.angle,
      highlight: old.lighting.highlight ?? c.lighting.highlight,
      lowlight: old.lighting.lowlight ?? c.lighting.lowlight,
    };
    if (old.shadow) c.shadow = { ...c.shadow, ...old.shadow };
    if (old.visible) c.visible = { ...c.visible, ...old.visible };
    if (old.states) c.states = { ...c.states, ...old.states };
    if (old.content?.label !== undefined) c.content.label = old.content.label;
    if (old.type) { c.type.font = old.type.font ?? c.type.font; c.type.size = old.type.size ?? c.type.size; }
    if (old.face?.mode) c.face.mode = old.face.mode;
    if (old.content?.placement === "none") c.icon.show = false;
    else if (old.content?.placement) c.icon.placement = old.content.placement;
    if (typeof old.content?.icon === "string") {
      const def = getDef("lucide", old.content.icon);
      if (def) c.icon.def = def;
    }
  } catch { /* fall back to whatever migrated */ }
  return c;
}

/* ── site default — the "admin" path ──────────────────────────────
   On boot the app fetches default-settings.json from its own origin. If
   present, that file IS the universal default: fresh sessions open with it
   and "Reset component" returns to it. Changing the site's default = export
   settings in the app, rename to default-settings.json, upload to the repo.
   No rebuild needed. */
/* The default ships inside the bundle (site-default.json) so first paint is
   always current, and ./default-settings.json — when reachable — overrides it,
   which keeps "upload one JSON" as the admin path. */
let siteDefault: GenConfig | null = hydrate(siteDefaultJson as Record<string, any>);
export function getDefault(): GenConfig {
  const d = siteDefault ?? defaultConfig();
  return (typeof structuredClone === "function" ? structuredClone(d) : JSON.parse(JSON.stringify(d))) as GenConfig;
}
export function fetchSiteDefault(): void {
  fetch("./default-settings.json?ts=" + Date.now(), { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (!j || typeof j !== "object" || !j.presetId || !j.candy) return;
      siteDefault = hydrate(j as Record<string, any>);
      adoptDefaultIfUntouched();
    })
    .catch(() => { adoptDefaultIfUntouched(); /* bundled default stands */ });
}
/* Anyone who has never edited (fresh visitor, or someone who only looked
   around) follows the site default — their library and board are untouched. */
function adoptDefaultIfUntouched(): void {
  if (localStorage.getItem(TOUCHED_KEY) === "1") return;
  const next = getDefault();
  if (JSON.stringify(useGen.getState().cfg) === JSON.stringify(next)) return;
  useGen.setState({ cfg: next });
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

function load(): GenConfig {
  try {
    for (const key of [LS_KEY, LS_KEY_V9]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GenConfig>;
        if (parsed.presetId && parsed.candy && parsed.type) return hydrate(parsed as Record<string, any>);
      }
    }
    const v8 = localStorage.getItem(LS_KEY_V8);
    if (v8) return migrateV8(JSON.parse(v8));
  } catch { /* ignore */ }
  return getDefault();
}

interface GenStore {
  cfg: GenConfig;
  selectedState: GenStateName;
  phase: "master" | "kit" | "board";
  kitSizes: Partial<Record<KitComponentId, KitSize>>;
  zoom: number;
  panMode: boolean;
  gridStyle: GridStyle;
  sectionFilter: string | null;
  saveStatus: "saved" | "saving";
  open: Record<string, boolean>;

  panelW: number;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  canvasMode: "design" | "play";
  setCanvasMode: (m: "design" | "play") => void;
  inheritDefaults: () => void;
  replaceConfig: (next: GenConfig) => void;
  library: LibItem[];
  addToLibrary: (name: string) => void;
  removeFromLibrary: (id: string) => void;
  loadFromLibrary: (id: string) => void;
  board: BoardItem[];
  addToBoard: (libId: string) => void;
  /** Drop a live kit component on the board — follows the master style. */
  addKitToBoard: (kitId: KitComponentId) => void;
  rotateBoardItem: (id: string, deg: number) => void;
  boardAspect: "169" | "mobile";
  setBoardAspect: (a: "169" | "mobile") => void;
  boardSnap: boolean;
  setBoardSnap: (v: boolean) => void;
  boardSel: string | null;
  setBoardSel: (id: string | null) => void;
  moveBoardItem: (id: string, x: number, y: number) => void;
  scaleBoardItem: (id: string, scale: number) => void;
  removeBoardItem: (id: string) => void;
  focus: KitComponentId | null;
  setFocus: (f: KitComponentId | null) => void;
  kitShapes: Partial<Record<KitComponentId, Shape>>;
  setKitShape: (id: KitComponentId, shape: Shape) => void;
  kitDesigns: Partial<Record<KitComponentId, KitDesign>>;
  setKitDesign: (id: KitComponentId, d: KitDesign | null) => void;
  /** Per-component vertical text adjustment, keyed `${id}:${size}` so Primary
   *  L/M/S adjust independently. Explicit values (including 0) always win;
   *  the theme's value applies only to components never adjusted. */
  kitTextOy: Partial<Record<string, number>>;
  setKitTextOy: (key: string, v: number | null) => void;
  /** Data rows (and objectives built from them) carry their own two-text-group
   *  content model — independent size, tracking and vertical placement per
   *  group, plus slot toggles. Too intricate for the generic text controls. */
  kitRow: RowCfg;
  setKitRow: (patch: Partial<RowCfg>) => void;
  /** Custom kit name for the guidelines page (null = derived from preset). */
  kitName: string | null;
  setKitName: (v: string | null) => void;
  /** Named full-design snapshots — created by renaming the kit. They appear
   *  at the top of the preset grid and never overwrite the built-ins. */
  userPresets: UserPreset[];
  saveUserPreset: (name: string) => void;
  applyUserPreset: (id: string) => void;
  removeUserPreset: (id: string) => void;
  /** Imported flat-vector silhouettes — see the spec in the Silhouette panel. */
  userShapes: UserShape[];
  addUserShape: (u: UserShape) => void;
  removeUserShape: (id: string) => void;
  styleLib: StyleItem[];
  saveStyle: (name: string) => void;
  applyStyle: (id: string) => void;
  removeStyle: (id: string) => void;
  bgImage: string | null;
  setBgImage: (url: string | null) => void;
  helpOn: boolean;
  setHelpOn: (v: boolean) => void;
  bgShow: boolean; bgOpacity: number; bgBlur: number;
  setBg: (p: Partial<{ bgShow: boolean; bgOpacity: number; bgBlur: number }>) => void;
  refreshLibraryItem: (id: string) => void;

  update: (fn: (c: GenConfig) => void) => void;
  undo: () => void;
  redo: () => void;
  setPanelW: (w: number) => void;
  setPreset: (id: string) => void;
  randomize: () => void;
  setSelectedState: (s: GenStateName) => void;
  setPhase: (p: "master" | "kit" | "board") => void;
  setKitSize: (id: KitComponentId, s: KitSize) => void;
  setZoom: (z: number) => void;
  setPanMode: (v: boolean) => void;
  setGridStyle: (v: GridStyle) => void;
  setSectionFilter: (v: string | null) => void;
  randomizeColors: () => void;
  toggle: (section: string) => void;
}

/** A saved component remembers *which* kit piece it is (when saved while one
 *  was focused), so the board can render and play it as that piece — a slider
 *  stays a slider. Absent = the master button (all older saves). */
export interface LibKit { id: KitComponentId; size: KitSize; shape?: Shape }
export interface UserPreset { id: string; name: string; cfg: GenConfig; thumb?: string }
export interface LibItem { id: string; name: string; cfg: GenConfig; kit?: LibKit }
export interface StyleItem {
  id: string; name: string;
  style: Pick<GenConfig, "effects" | "face" | "bevel" | "candy" | "lighting" | "shadow" | "transparency" | "type" | "states" | "stateDesigns">;
  /** Rendered at save time by the same engine — the style's face in the list. */
  thumb?: string;
}
export interface BoardItem {
  id: string; libId: string; x: number; y: number; scale?: number;
  /** degrees, applied around the piece center */
  rot?: number;
  /** kit-asset items render the CURRENT design live (no library snapshot) */
  kitId?: KitComponentId;
}
/** Two independent text groups + slot toggles for the Data Row family. */
export interface RowCfg {
  title: string; sub: string;
  titleSize: number; subSize: number;     // % of the base row type
  titleDy: number; subDy: number;         // vertical placement, px
  titleTrack: number; subTrack: number;   // letter-spacing, em/100
  avatar: boolean; progress: boolean; action: boolean;
  value: number;                          // progress fill %
}
export function defaultRow(): RowCfg {
  return {
    title: "Shadow Knight", sub: "Level 12 · Warrior",
    titleSize: 100, subSize: 100, titleDy: 0, subDy: 0, titleTrack: 0, subTrack: 0,
    avatar: true, progress: true, action: true, value: 40,
  };
}
const LIB_KEY = "ui-generator-library";
const BOARD_KEY = "ui-generator-board";
function loadJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } catch { /* ignore */ }
  return fallback;
}
function saveJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* quota — keep in memory */ }
}

let saveTimer: number | undefined;

/* Undo history — module-level so pushing snapshots never re-renders. Rapid
   slider drags coalesce into one step (350ms window). */
const past: GenConfig[] = [];
const future: GenConfig[] = [];
let lastPush = 0;

function loadPanelW(): number {
  const v = Number(localStorage.getItem("ui-generator-panelw"));
  return v >= 300 && v <= 560 ? v : 340;
}

export const useGen = create<GenStore>((set, get) => ({
  cfg: load(),
  selectedState: "default",
  phase: "master",
  kitSizes: {},
  zoom: 1,
  panMode: false,
  gridStyle: "dots" as GridStyle,
  sectionFilter: null,
  saveStatus: "saved",
  open: { state: true, shape: true, mapping: true, gloss: true },
  panelW: loadPanelW(),
  theme: (localStorage.getItem("ui-generator-theme") === "dark" ? "dark" : "light") as "light" | "dark",
  setTheme: (t) => {
    try { localStorage.setItem("ui-generator-theme", t); } catch { /* ignore */ }
    set({ theme: t });
    // the stage follows the shell — users can re-mix the canvas afterwards
    const cfg = (typeof structuredClone === "function" ? structuredClone(get().cfg) : JSON.parse(JSON.stringify(get().cfg))) as GenConfig;
    cfg.canvas = t === "dark" ? "#000000" : "#F4F5F7";
    get().replaceConfig(cfg);
  },
  canvasMode: "design" as const,
  setCanvasMode: (m) => set({ canvasMode: m }),
  library: loadJson<LibItem[]>(LIB_KEY, []),
  addToLibrary: (name) => {
    const { focus, kitSizes, kitShapes, kitDesigns, kitTextOy } = get();
    let cfg = (typeof structuredClone === "function" ? structuredClone(get().cfg) : JSON.parse(JSON.stringify(get().cfg))) as GenConfig;
    // a locked component saves with its locked look — the snapshot IS the piece
    if (focus && kitDesigns[focus]) cfg = applyKitDesign(cfg, kitDesigns[focus]);
    // a component-specific text adjustment bakes into the snapshot
    if (focus) {
      const oy = kitTextOy[`${focus}:${kitSizes[focus] ?? "m"}`];
      if (oy !== undefined) cfg.type.oy = oy;
    }
    const kit: LibKit | undefined = focus
      ? { id: focus, size: kitSizes[focus] ?? "m", shape: kitShapes[focus] ?? KIT_SHAPE[focus] }
      : undefined;
    const item: LibItem = { id: "lib" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, cfg, ...(kit ? { kit } : {}) };
    const library = [...get().library, item];
    saveJson(LIB_KEY, library);
    set({ library });
  },
  removeFromLibrary: (id) => {
    const library = get().library.filter((l) => l.id !== id);
    const board = get().board.filter((b) => b.libId !== id);
    saveJson(LIB_KEY, library); saveJson(BOARD_KEY, board);
    set({ library, board });
  },
  loadFromLibrary: (id) => {
    const item = get().library.find((l) => l.id === id);
    if (item) get().replaceConfig((typeof structuredClone === "function" ? structuredClone(item.cfg) : JSON.parse(JSON.stringify(item.cfg))) as GenConfig);
  },
  board: loadJson<BoardItem[]>(BOARD_KEY, []),
  addToBoard: (libId) => {
    const n = get().board.length;
    const item: BoardItem = { id: "bd" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), libId, x: 80 + (n % 3) * 340, y: 80 + Math.floor(n / 3) * 220 };
    const board = [...get().board, item];
    saveJson(BOARD_KEY, board);
    set({ board, phase: "board" });
  },
  addKitToBoard: (kitId) => {
    const n = get().board.length;
    const item: BoardItem = { id: "bd" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), libId: "", kitId, x: 640 + (n % 3) * 90, y: 420 + (n % 3) * 60 };
    const board = [...get().board, item];
    saveJson(BOARD_KEY, board);
    set({ board, boardSel: item.id });
  },
  rotateBoardItem: (id, deg) => {
    const board = get().board.map((b) => (b.id === id ? { ...b, rot: Math.max(-180, Math.min(180, Math.round(deg))) } : b));
    saveJson(BOARD_KEY, board);
    set({ board });
  },
  boardAspect: (loadJson<string>("ui-generator-boardaspect", "169") === "mobile" ? "mobile" : "169") as "169" | "mobile",
  setBoardAspect: (a) => { saveJson("ui-generator-boardaspect", a); set({ boardAspect: a }); },
  boardSnap: loadJson<boolean>("ui-generator-boardsnap", true),
  setBoardSnap: (v) => { saveJson("ui-generator-boardsnap", v); set({ boardSnap: v }); },
  boardSel: null,
  setBoardSel: (id) => set({ boardSel: id }),
  moveBoardItem: (id, x, y) => {
    const board = get().board.map((b) => (b.id === id ? { ...b, x, y } : b));
    set({ board });
    saveJson(BOARD_KEY, board);
  },
  scaleBoardItem: (id, scale) => {
    const board = get().board.map((b) => (b.id === id ? { ...b, scale: Math.max(0.3, Math.min(2, scale)) } : b));
    saveJson(BOARD_KEY, board);
    set({ board });
  },
  removeBoardItem: (id) => {
    const board = get().board.filter((b) => b.id !== id);
    saveJson(BOARD_KEY, board);
    set({ board });
  },
  focus: null,
  // choosing a piece to edit lifts any rail focus filter — the user asked
  // for THIS component, so every relevant section must be reachable
  setFocus: (f) => set({ focus: f, phase: "master", sectionFilter: null }),
  styleLib: loadJson<StyleItem[]>("ui-generator-styles", []),
  saveStyle: (name) => {
    markTouched();
    const c = get().cfg;
    const clone = (typeof structuredClone === "function" ? structuredClone : (x: unknown) => JSON.parse(JSON.stringify(x)));
    const style = clone({
      effects: c.effects, face: c.face, bevel: c.bevel, candy: c.candy, lighting: c.lighting,
      shadow: c.shadow, transparency: c.transparency, type: c.type, states: c.states, stateDesigns: c.stateDesigns,
    }) as StyleItem["style"];
    // thumbnail: the current look, rendered tight (no glow pad) with a short label
    const tc = clone(c) as GenConfig;
    for (const s of Object.values(tc.states)) s.glow = 0;
    tc.content.label = c.content.label || "Aa";
    const thumb = renderBevel(tc, "default");
    const styleLib = [...get().styleLib, { id: String(Date.now()), name, style, thumb }];
    saveJson("ui-generator-styles", styleLib);
    set({ styleLib });
  },
  applyStyle: (id) => {
    const item = get().styleLib.find((x) => x.id === id);
    if (!item) return;
    const next = (typeof structuredClone === "function" ? structuredClone : (x: unknown) => JSON.parse(JSON.stringify(x)))(get().cfg) as GenConfig;
    Object.assign(next, (typeof structuredClone === "function" ? structuredClone : (x: unknown) => JSON.parse(JSON.stringify(x)))(item.style));
    get().replaceConfig(next);
  },
  removeStyle: (id) => {
    const styleLib = get().styleLib.filter((x) => x.id !== id);
    saveJson("ui-generator-styles", styleLib);
    set({ styleLib });
  },
  kitShapes: loadJson<Partial<Record<KitComponentId, Shape>>>("ui-generator-kitshapes", {}),
  setKitShape: (id, shape) => {
    markTouched();
    const kitShapes = { ...get().kitShapes, [id]: shape };
    saveJson("ui-generator-kitshapes", kitShapes);
    set({ kitShapes });
  },
  kitDesigns: loadJson<Partial<Record<KitComponentId, KitDesign>>>("ui-generator-kitdesigns", {}),
  setKitDesign: (id, d) => {
    markTouched();
    const kitDesigns = { ...get().kitDesigns };
    if (d) kitDesigns[id] = d; else delete kitDesigns[id];
    saveJson("ui-generator-kitdesigns", kitDesigns);
    set({ kitDesigns });
  },
  userPresets: loadJson<UserPreset[]>("ui-generator-userpresets", []),
  saveUserPreset: (name) => {
    markTouched();
    const clone = (typeof structuredClone === "function" ? structuredClone : (x: unknown) => JSON.parse(JSON.stringify(x)));
    const cfg = clone(get().cfg) as GenConfig;
    const tc = clone(cfg) as GenConfig;
    for (const st of Object.values(tc.states)) st.glow = 0;
    tc.content.label = "PLAY"; tc.icon.show = false;
    const thumb = renderBevel(tc, "default");
    const existing = get().userPresets.find((u) => u.name === name);
    const userPresets = existing
      ? get().userPresets.map((u) => (u.name === name ? { ...u, cfg, thumb } : u))
      : [{ id: "up" + Date.now().toString(36), name, cfg, thumb }, ...get().userPresets];
    saveJson("ui-generator-userpresets", userPresets);
    set({ userPresets });
  },
  applyUserPreset: (id) => {
    const u = get().userPresets.find((x) => x.id === id);
    if (!u) return;
    const clone = (typeof structuredClone === "function" ? structuredClone : (x: unknown) => JSON.parse(JSON.stringify(x)));
    const next = clone(u.cfg) as GenConfig;
    next.canvas = get().cfg.canvas; // presets restyle the component, never the stage
    get().replaceConfig(next);
    get().setKitName(u.name);
  },
  removeUserPreset: (id) => {
    const userPresets = get().userPresets.filter((x) => x.id !== id);
    saveJson("ui-generator-userpresets", userPresets);
    set({ userPresets });
  },
  kitName: loadJson<string | null>("ui-generator-kitname", null),
  setKitName: (v) => { markTouched(); saveJson("ui-generator-kitname", v); set({ kitName: v }); },
  userShapes: (() => { const l = loadJson<UserShape[]>("ui-generator-usershapes", []); setUserShapes(l); return l; })(),
  addUserShape: (u) => {
    markTouched();
    const userShapes = [...get().userShapes.filter((x) => x.id !== u.id), u];
    setUserShapes(userShapes); saveJson("ui-generator-usershapes", userShapes);
    set({ userShapes });
  },
  removeUserShape: (id) => {
    markTouched();
    const userShapes = get().userShapes.filter((x) => x.id !== id);
    setUserShapes(userShapes); saveJson("ui-generator-usershapes", userShapes);
    // anything still wearing the removed silhouette falls back to Rounded
    const st = get();
    const kitShapes = Object.fromEntries(Object.entries(st.kitShapes).filter(([, v]) => v !== id));
    set({ userShapes, kitShapes: kitShapes as typeof st.kitShapes });
    if (st.cfg.shape === id) st.update((c) => { c.shape = "round"; });
  },
  kitRow: { ...defaultRow(), ...loadJson<Partial<RowCfg>>("ui-generator-kitrow", {}) },
  setKitRow: (patch) => {
    markTouched();
    const kitRow = { ...get().kitRow, ...patch };
    saveJson("ui-generator-kitrow", kitRow);
    set({ kitRow });
  },
  kitTextOy: loadJson<Partial<Record<string, number>>>("ui-generator-kittextoy", {}),
  setKitTextOy: (key, v) => {
    markTouched();
    const kitTextOy = { ...get().kitTextOy };
    // null clears the override (back to the theme); 0 is a valid explicit value
    if (v === null) delete kitTextOy[key]; else kitTextOy[key] = v;
    saveJson("ui-generator-kittextoy", kitTextOy);
    set({ kitTextOy });
  },
  bgImage: null,
  setBgImage: (url) => set({ bgImage: url }),
  helpOn: false,
  setHelpOn: (v) => set({ helpOn: v }),
  bgShow: true, bgOpacity: 100, bgBlur: 0,
  setBg: (p) => set(p),
  refreshLibraryItem: (id) => {
    const clone = typeof structuredClone === "function" ? structuredClone : ((x: unknown) => JSON.parse(JSON.stringify(x)));
    const library = get().library.map((l) => l.id === id ? { ...l, cfg: clone(get().cfg) as GenConfig } : l);
    saveJson(LIB_KEY, library);
    set({ library });
  },
  inheritDefaults: () => {
    const cfg = (typeof structuredClone === "function" ? structuredClone(get().cfg) : JSON.parse(JSON.stringify(get().cfg))) as GenConfig;
    cfg.stateDesigns = {};
    cfg.states.hover = { ...cfg.states.default };
    cfg.states.pressed = { ...cfg.states.default };
    cfg.states.disabled = { ...cfg.states.default };
    get().replaceConfig(cfg);
  },
  replaceConfig: (next) => {
    markTouched();
    past.push(get().cfg);
    if (past.length > 60) past.shift();
    future.length = 0;
    lastPush = 0;
    set({ cfg: next, saveStatus: "saving" });
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(get().cfg)); } catch { /* ignore */ }
      set({ saveStatus: "saved" });
    }, 300);
  },

  update: (fn) => {
    markTouched();
    const prev = get().cfg;
    // structuredClone is ~3-4x faster than JSON round-tripping — keeps rapid
    // slider drags responsive
    const cfg = (typeof structuredClone === "function" ? structuredClone(prev) : JSON.parse(JSON.stringify(prev))) as GenConfig;
    const sel = get().selectedState;
    if (sel !== "default") {
      // editing a non-default state: fork its design on first touch, then
      // route all design-field edits into the fork — Default stays untouched
      if (!cfg.stateDesigns) cfg.stateDesigns = {};
      if (!cfg.stateDesigns[sel]) cfg.stateDesigns[sel] = pickDesign(cfg);
      const d = cfg.stateDesigns[sel]!;
      const t = Object.assign({}, cfg, {
        effects: d.effects, face: d.face, bevel: d.bevel, candy: d.candy,
        lighting: d.lighting, shadow: d.shadow, transparency: d.transparency, type: d.type,
      }) as GenConfig;
      Object.defineProperty(t, "shape", { get: () => d.shape, set: (v) => { d.shape = v; }, enumerable: true, configurable: true });
      fn(t);
      d.effects = t.effects; d.face = t.face; d.bevel = t.bevel; d.candy = t.candy;
      d.lighting = t.lighting; d.shadow = t.shadow; d.transparency = t.transparency; d.type = t.type;
      // the typeface is one decision for the whole component — weight, colors
      // and effects stay state-specific
      if (d.type.font !== cfg.type.font) {
        cfg.type.font = d.type.font;
        for (const other of Object.values(cfg.stateDesigns)) { if (other?.type) other.type.font = d.type.font; }
      }
      cfg.content = t.content; cfg.icon = t.icon; cfg.states = t.states; cfg.visible = t.visible;
      cfg.canvas = t.canvas; cfg.presetId = t.presetId;
    } else {
      fn(cfg);
    }
    const now = Date.now();
    if (now - lastPush > 350) {
      past.push(prev);
      if (past.length > 60) past.shift();
      lastPush = now;
    }
    future.length = 0;
    set({ cfg, saveStatus: "saving" });
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(get().cfg)); } catch { /* ignore */ }
      set({ saveStatus: "saved" });
    }, 600);
  },
  undo: () => {
    const p = past.pop();
    if (!p) return;
    future.push(get().cfg);
    lastPush = 0;
    set({ cfg: p });
    try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
  },
  redo: () => {
    const f = future.pop();
    if (!f) return;
    past.push(get().cfg);
    lastPush = 0;
    set({ cfg: f });
    try { localStorage.setItem(LS_KEY, JSON.stringify(f)); } catch { /* ignore */ }
  },
  setPanelW: (w) => {
    const v = Math.max(300, Math.min(560, Math.round(w)));
    try { localStorage.setItem("ui-generator-panelw", String(v)); } catch { /* ignore */ }
    set({ panelW: v });
  },
  setPreset: (id) => {
    // Bubble Pop ships as a fully authored look (Chevon's bubblepopdefault) —
    // picking it loads that complete design rather than re-mixing tokens
    if (PRESET_DEFAULTS[id]) {
      const next = hydrate(structuredClone(PRESET_DEFAULTS[id]));
      next.canvas = get().cfg.canvas; // presets restyle the component, never the stage
      get().replaceConfig(next);
      return;
    }
    const p = presetById(id);
    get().update((c) => {
      c.presetId = id; c.shape = p.shape; c.bevel = { ...p.bevel }; c.effects = { ...p.effects };
      const candy = defaultCandy();
      applyPresetCandy(candy, p);
      c.candy = candy;
      retintText(c);
    });
  },
  randomize: () => {
    const next = randomizeConfig(get().cfg);
    const roll = (n: number) => Math.floor(Math.random() * n);
    get().update((c) => {
      c.effects = next.effects; // lighting stays put — rolled light angles tilted the speculars askew
      // typography joins the roll
      c.type.font = GAME_FONTS[roll(GAME_FONTS.length)].name;
      // pattern rolls tone-on-tone so it stays harmonious
      const pats: GenConfig["candy"]["pattern"]["type"][] = ["none", "stripes", "dots", "checker", "halftone", "stars"];
      c.candy.pattern.type = pats[roll(pats.length)];
      c.candy.pattern.color = null;
      c.candy.pattern.opacity = 18 + roll(40);
      c.candy.pattern.scale = 20 + roll(70);
      // gloss gradient re-tints from the new palette
      const bevel = c.effects.Bevel ?? "#0E9CC9";
      c.candy.gloss.tint = darken(bevel, 0.15);
      c.candy.gloss.tint2 = hexMix(c.effects.Glow ?? "#8FF0FF", "#FFFFFF", 0.5);
      // the stage is the user's workspace — a roll restyles the component only
      retintText(c);
    });
  },
  setSelectedState: (s) => set({ selectedState: s }),
  setPhase: (p) => set({ phase: p }),
  setKitSize: (id, s) => set((st) => ({ kitSizes: { ...st.kitSizes, [id]: s } })),
  setZoom: (z) => set({ zoom: Math.max(0.4, Math.min(4, Math.round(z * 10) / 10)) }),
  setPanMode: (v) => set({ panMode: v }),
  setGridStyle: (v) => set({ gridStyle: v }),
  setSectionFilter: (v) => set({ sectionFilter: v }),
  randomizeColors: () => {
    const next = randomizeConfig(get().cfg);
    get().update((c) => { c.effects = next.effects; retintText(c); });
  },
  toggle: (s) => set((st) => ({ open: { ...st.open, [s]: !st.open[s] } })),
}));

// kick off the site-default fetch once the store exists
fetchSiteDefault();
