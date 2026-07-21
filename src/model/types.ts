// FORGE canonical configuration model.
// This is the single source of truth. The canvas renderer, HTML preview,
// state preview, and every export path derive from `MasterComponent` via the
// resolver in src/resolver. Nothing renders the component from anything else.

export type StateName = "default" | "hover" | "pressed" | "disabled";
export type PreviewMode = "design" | "html";
export type WorkflowPhase = "master" | "kit";

export type Finish = "matte" | "shiny" | "hybrid";
export type Emphasis = "emboss" | "deboss";

export interface Geometry {
  /** Reference width in logical px (860 for CARBON MATTE). Actual render width clamps responsively. */
  width: number;
  height: number;
  radius: number;
  /** Width of the icon region measured from the button's left edge. */
  iconRegion: number;
  /** Gap from the content divider to the start of the label. */
  labelGap: number;
}

export interface MaterialConfig {
  finish: Finish;
  /** 0..100 — strength of upper highlight. */
  highlight: number;
  /** 0..100 — surface noise texture opacity mapping. */
  noise: number;
  /** Corner radius in px (mirrors geometry.radius, exposed as a control). */
  radius: number;
  /** 0..100 — extrusion depth; scales rim + inner shading. */
  depth: number;
}

export interface LightingConfig {
  /** Virtual light direction in degrees (315 = upper-left). */
  directionDeg: number;
  /** Light elevation in degrees. */
  elevationDeg: number;
  /** 0..100 */
  intensity: number;
  /** 0..100 */
  ambient: number;
  /** 0..100 */
  rimLight: number;
  /** 0..100 */
  highlightSoftness: number;
  /** 0..100 */
  shadowSoftness: number;
  /** px */
  shadowDistance: number;
  /** px */
  shadowSpread: number;
}

export interface ContentConfig {
  label: string;
  emphasis: Emphasis;
  language: string;
  font: string;
  iconSet: string;
  icon: string;
  /** Icon stroke weight in px. */
  iconWeight: number;
}

/** A state is authored as a delta over the resolved Default. */
export interface StateDelta {
  translateY?: number;
  shadowDistanceDelta?: number;
  highlightDelta?: number;
  rimDelta?: number;
  outerShadowOpacityScale?: number;
  contactShadowScale?: number;
  faceDarken?: number; // 0..1 fractional darken of face gradient
  reliefScale?: number; // 0..1 scale on text/icon emboss strength
  opacity?: number; // 0..1
  saturation?: number; // 0..1
  insetLowerBoost?: number; // multiplier on inset lower shadow
  cursor?: string;
  interactive?: boolean;
}

/** Fixed material token palette for a preset (exact hex from the design lock). */
export interface MaterialPalette {
  edgeDark: string;
  rimDark: string;
  rimMid: string;
  faceTop: string;
  faceUpper: string;
  faceCenter: string;
  faceLower: string;
  faceBottom: string;
  highlight: string;
  highlightSoft: string;
  innerDark: string;
  shadowDark: string;
  /** ordered [offset%, color] stops for the base surface gradient */
  gradient: Array<[number, string]>;
  labelColor: string;
  iconColor: string;
}

export interface MasterComponent {
  id: string;
  name: string;
  type: "button";
  geometry: Geometry;
  material: MaterialConfig;
  lighting: LightingConfig;
  content: ContentConfig;
  palette: MaterialPalette;
  states: Record<StateName, StateDelta>;
}

export interface ForgeDoc {
  schemaVersion: 1;
  master: MasterComponent;
}
