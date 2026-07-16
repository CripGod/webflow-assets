import type { ForgeDoc, MasterComponent, MaterialPalette } from "./types";

// ── FORGE CARBON MATTE ──────────────────────────────────────────────────────
// Exact material tokens from the design lock (§11–12). These are the canonical
// hex values; the resolver derives every render layer from them + the model.

const CARBON_MATTE_PALETTE: MaterialPalette = {
  edgeDark: "#080A0D",
  rimDark: "#101419",
  rimMid: "#1A1F25",
  faceTop: "#363D46",
  faceUpper: "#2D333B",
  faceCenter: "#242A31",
  faceLower: "#191E24",
  faceBottom: "#111419",
  highlight: "rgba(220, 229, 239, 0.30)",
  highlightSoft: "rgba(187, 199, 214, 0.12)",
  innerDark: "rgba(0, 0, 0, 0.42)",
  shadowDark: "rgba(7, 9, 12, 0.36)",
  // Base surface gradient — darker, richer, denser at the lower edge (§11 + rework).
  // The resolver layers a convex top catch-light and an edge vignette over this.
  gradient: [
    [0, "#2E353E"],
    [9, "#262C35"],
    [40, "#1D232A"],
    [72, "#141920"],
    [100, "#0D1116"],
  ],
  labelColor: "#A9AFB8",
  iconColor: "#A9AFB8",
};

export const CARBON_MATTE: MasterComponent = {
  id: "forge-carbon-matte",
  name: "Forge Carbon Matte",
  type: "button",
  geometry: {
    width: 860,
    height: 214,
    radius: 107,
    iconRegion: 214,
    labelGap: 52,
  },
  material: {
    finish: "matte",
    highlight: 62,
    noise: 18,
    radius: 107,
    depth: 12,
  },
  lighting: {
    directionDeg: 315,
    elevationDeg: 42,
    intensity: 62,
    ambient: 24,
    rimLight: 36,
    highlightSoftness: 48,
    shadowSoftness: 48,
    shadowDistance: 24,
    shadowSpread: 2,
  },
  content: {
    label: "Launch Forge",
    emphasis: "emboss",
    language: "en",
    font: "Inter",
    iconSet: "Lucide",
    icon: "Rocket",
    iconWeight: 2.15,
  },
  palette: CARBON_MATTE_PALETTE,
  // State deltas per §13 — authored over the resolved Default.
  states: {
    default: {},
    hover: {
      translateY: -2,
      shadowDistanceDelta: 3,
      highlightDelta: 7,
      rimDelta: 4,
      cursor: "pointer",
      interactive: true,
    },
    pressed: {
      translateY: 3,
      outerShadowOpacityScale: 0.4,
      contactShadowScale: 0.4,
      insetLowerBoost: 1.5,
      faceDarken: 0.04,
      reliefScale: 0.75,
      cursor: "pointer",
    },
    disabled: {
      opacity: 0.58,
      saturation: 0.7,
      outerShadowOpacityScale: 0.45,
      contactShadowScale: 0.45,
      reliefScale: 0.65,
      cursor: "not-allowed",
      interactive: false,
    },
  },
};

export const DEFAULT_DOC: ForgeDoc = {
  schemaVersion: 1,
  master: CARBON_MATTE,
};

export function cloneDoc(doc: ForgeDoc): ForgeDoc {
  return JSON.parse(JSON.stringify(doc));
}
