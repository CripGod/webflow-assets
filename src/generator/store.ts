import { create } from "zustand";
import type { GenConfig, GenStateName, KitComponentId, KitSize, GridStyle } from "./model";
import { defaultConfig, randomizeConfig, presetById } from "./model";

const LS_KEY = "ui-generator-v8"; // v8: typography, section filter, grid styles

function load(): GenConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GenConfig>;
      if (parsed.presetId && parsed.states && parsed.shadow && parsed.transparency && parsed.type) {
        return { ...defaultConfig(), ...parsed } as GenConfig;
      }
    }
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

  update: (fn: (c: GenConfig) => void) => void;
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
  open: { state: true, style: true, bevel: true, lighting: true },

  update: (fn) => {
    const cfg = JSON.parse(JSON.stringify(get().cfg)) as GenConfig;
    fn(cfg);
    set({ cfg, saveStatus: "saving" });
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(get().cfg)); } catch { /* ignore */ }
      set({ saveStatus: "saved" });
    }, 600);
  },
  setPreset: (id) => {
    const p = presetById(id);
    get().update((c) => { c.presetId = id; c.shape = p.shape; c.bevel = { ...p.bevel }; c.effects = { ...p.effects }; });
  },
  randomize: () => {
    const next = randomizeConfig(get().cfg);
    get().update((c) => { c.effects = next.effects; c.lighting = next.lighting; });
  },
  setSelectedState: (s) => set({ selectedState: s }),
  setPhase: (p) => set({ phase: p }),
  setKitSize: (id, s) => set((st) => ({ kitSizes: { ...st.kitSizes, [id]: s } })),
  setZoom: (z) => set({ zoom: Math.max(0.4, Math.min(2.4, Math.round(z * 10) / 10)) }),
  setPanMode: (v) => set({ panMode: v }),
  setGridStyle: (v) => set({ gridStyle: v }),
  setSectionFilter: (v) => set({ sectionFilter: v }),
  randomizeColors: () => {
    const next = randomizeConfig(get().cfg);
    get().update((c) => { c.effects = next.effects; });
  },
  toggle: (s) => set((st) => ({ open: { ...st.open, [s]: !st.open[s] } })),
}));
