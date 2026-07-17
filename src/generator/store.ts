import { create } from "zustand";
import type { GenConfig, GenStateName, KitComponentId, KitSize, GridStyle, CandyTokens } from "./model";
import { defaultConfig, defaultCandy, applyPresetCandy, randomizeConfig, presetById, darken, hexMix, registerCustomFont, pickDesign } from "./model";
import { getDef } from "./icons";

/* Keep the text treatment's accent colors in step with the shell palette so a
   preset or color roll never leaves a stale outline color behind. */
function retintText(c: GenConfig) {
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
  if ((cfg.shape as string) === "shard") cfg.shape = "chamfer";
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
  return defaultConfig();
}

interface GenStore {
  cfg: GenConfig;
  selectedState: GenStateName;
  phase: "master" | "kit";
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

  update: (fn: (c: GenConfig) => void) => void;
  undo: () => void;
  redo: () => void;
  setPanelW: (w: number) => void;
  setPreset: (id: string) => void;
  randomize: () => void;
  setSelectedState: (s: GenStateName) => void;
  setPhase: (p: "master" | "kit") => void;
  setKitSize: (id: KitComponentId, s: KitSize) => void;
  setZoom: (z: number) => void;
  setPanMode: (v: boolean) => void;
  setGridStyle: (v: GridStyle) => void;
  setSectionFilter: (v: string | null) => void;
  randomizeColors: () => void;
  toggle: (section: string) => void;
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
  },
  canvasMode: "design" as const,
  setCanvasMode: (m) => set({ canvasMode: m }),
  inheritDefaults: () => {
    const cfg = (typeof structuredClone === "function" ? structuredClone(get().cfg) : JSON.parse(JSON.stringify(get().cfg))) as GenConfig;
    cfg.stateDesigns = {};
    cfg.states.hover = { ...cfg.states.default };
    cfg.states.pressed = { ...cfg.states.default };
    cfg.states.disabled = { ...cfg.states.default };
    get().replaceConfig(cfg);
  },
  replaceConfig: (next) => {
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
    get().update((c) => { c.effects = next.effects; c.lighting = next.lighting; retintText(c); });
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
