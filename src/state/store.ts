import { create } from "zustand";
import type { ForgeDoc, MasterComponent, StateName, PreviewMode, WorkflowPhase } from "@/model/types";
import { DEFAULT_DOC, cloneDoc } from "@/model/defaults";

interface ForgeState {
  doc: ForgeDoc;
  savedDoc: ForgeDoc;
  activeState: StateName;
  previewMode: PreviewMode;
  phase: WorkflowPhase;
  activeRailTab: string;
  helpExpanded: boolean;
  gridVisible: boolean;
  gridOpacity: number;

  get master(): MasterComponent;
  isDirty: () => boolean;

  setActiveState: (s: StateName) => void;
  setPreviewMode: (m: PreviewMode) => void;
  setRailTab: (t: string) => void;
  setHelpExpanded: (v: boolean) => void;
  setGridVisible: (v: boolean) => void;
  setGridOpacity: (v: number) => void;

  updateMaster: (fn: (m: MasterComponent) => void) => void;
  save: () => void;
}

export const useForge = create<ForgeState>((set, get) => ({
  doc: cloneDoc(DEFAULT_DOC),
  savedDoc: cloneDoc(DEFAULT_DOC),
  activeState: "default",
  previewMode: "design",
  phase: "master",
  activeRailTab: "material",
  helpExpanded: true,
  gridVisible: true,
  gridOpacity: 0.3,

  get master() {
    return get().doc.master;
  },
  isDirty: () => JSON.stringify(get().doc) !== JSON.stringify(get().savedDoc),

  setActiveState: (s) => set({ activeState: s }),
  setPreviewMode: (m) => set({ previewMode: m }),
  setRailTab: (t) => set({ activeRailTab: t }),
  setHelpExpanded: (v) => set({ helpExpanded: v }),
  setGridVisible: (v) => set({ gridVisible: v }),
  setGridOpacity: (v) => set({ gridOpacity: v }),

  updateMaster: (fn) =>
    set((st) => {
      const doc = cloneDoc(st.doc);
      fn(doc.master);
      // keep material.radius <-> geometry.radius in sync
      doc.master.geometry.radius = doc.master.material.radius;
      return { doc };
    }),

  save: () => set((st) => ({ savedDoc: cloneDoc(st.doc) })),
}));
