import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Lock, PenTool, ShieldCheck, SquarePen } from "lucide-react";
import { useGen } from "@/generator/store";
import { EFFECT_ROLES, KIT_COMPONENTS, PRESETS, ROLE_HINT, SHAPES, SPECULAR_MODES, STOCK_ICONS, PATTERN_TYPES, applyKitDesign, fontByName, hexMix, isDarkBg, effKitSize } from "@/generator/model";
import type { GenConfig, GenStateName, IconDef, KitComponentId, KitSize, Shape } from "@/generator/model";
import { renderBevel, renderKit, renderTypeSpecimen } from "@/generator/bevel";
import { silhouetteMeta, SILHOUETTES } from "@/generator/silhouettes";
import { previewSvg } from "@/generator/icons";
import { downloadSettings, downloadSvg, downloadZip } from "@/generator/exportUtils";
import { LiveArt } from "./LiveArt";
import { HeroGL } from "./HeroGL";

/* The Kit — a living guideline sheet in five levels: Foundations, Components,
   Assemblies, Build Parts, Screen Patterns. One renderer draws everything,
   every example is live, and every piece opens in the editor. */

const CHAPTERS: [string, string, string][] = [
  ["foundations", "01", "Foundations"],
  ["components", "02", "Components"],
  ["parts", "03", "Build Parts"],
  ["patterns", "04", "Screen Patterns"],
  ["resources", "05", "Resources"],
];

const PIECE_SCALE = 0.62;
const PATTERN_SCALE = 0.31;

const clone = (c: GenConfig) => JSON.parse(JSON.stringify(c)) as GenConfig;

/** Static art (type specimens, layer cards) at a uniform physical scale. */
/** Rewrite a specimen's viewBox to hug the text vertically — specimen
 *  canvases reserve glow travel that editorial rows don't need. */
function tightenV(svg: string, px: number, oy = 0): string {
  const vb = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) return svg;
  // the specimen text sits at y≈86 plus the bottom-anchor rise reserve
  // (48·K, K = 130/168) plus the theme nudge at the same K — mirror the
  // renderer exactly, then hug it
  const K2 = 130 / 168;
  const cy = 86 + 48 * K2 + oy * K2;
  const y0 = cy - px * 0.92, h = px * 1.9;
  // trim the left glow reserve too so every row shares one left edge
  const x0 = 14, w = +vb[1] + +vb[3] - 14;
  return svg
    .replace(vb[0], `viewBox="${x0} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}"`)
    .replace(/width="([\d.]+)"/, `width="${w.toFixed(1)}"`)
    .replace(/height="([\d.]+)"/, `height="${h.toFixed(1)}"`);
}

function Art({ svg, scale, className }: { svg: string; scale: number; className?: string }) {
  const w = useMemo(() => {
    const m = svg.match(/width="([\d.]+)"/);
    return m ? +m[1] * scale : undefined;
  }, [svg, scale]);
  return <div className={`kp-art${className ? " " + className : ""}`} style={{ width: w }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

interface PieceOpts {
  id: KitComponentId; size?: KitSize; label?: string; segments?: string[];
  icon?: IconDef | null; value?: number; baseState?: GenStateName; scale?: number;
  sub?: string; max?: string; addBtn?: boolean; overlay?: string; trim?: boolean;
  kind?: "circle" | "oval" | "strip"; tone?: "alt"; shape?: Shape;
}

/** Shared plumbing for every live piece on this page. The page is always
 *  alive — clicking a piece plays it; editing goes through the ✎ button. */
function usePiece(p: PieceOpts) {
  const { cfg, kitShapes, kitSizes, kitDesigns, kitTextOy, kitRow, setFocus, setKitSize } = useGen();
  // an explicit size (the Primary ramp) is fixed; everything else follows the
  // per-component size the user picks with the caption's S/M/L chips
  // the documentation shows medium and large only — a stored Small reads as Medium
  const size = p.size ?? effKitSize(kitSizes[p.id]);
  return {
    // a locked component renders its own snapshot, not the master's style
    cfg: applyKitDesign(cfg, kitDesigns[p.id]),
    locked: !!kitDesigns[p.id],
    size, setKitSize,
    sizable: p.size === undefined,
    name: KIT_COMPONENTS.find((c) => c.id === p.id)?.name ?? p.id,
    kit: {
      id: p.id, size, shape: p.shape ?? kitShapes[p.id], label: p.label, segments: p.segments,
      icon: p.icon, value: p.value, baseState: p.baseState,
      sub: p.sub, max: p.max, addBtn: p.addBtn, overlay: p.overlay,
      // explicit per-component vertical text adjustment (0 is a valid value)
      textOy: kitTextOy[`${p.id}:${size}`],
      // data rows follow the row model everywhere; a variant's explicit
      // label/sub still wins for its own line
      row: p.id === "datarow" ? kitRow : undefined,
      kind: p.kind, tone: p.tone,
    },
    onEdit: () => setFocus(p.id),
  };
}

/** One specced piece: live art + a caption rail with edit, sizes and export. */
function Piece(p: PieceOpts & { caption: string; ambient?: boolean }) {
  const { cfg, locked, size, setKitSize, sizable, name, kit, onEdit } = usePiece(p);
  return (
    <figure className="kp-piece">
      <LiveArt cfg={cfg} playing scale={p.scale ?? PIECE_SCALE} className="kp-live"
        kit={kit} title={p.caption} ambient={p.ambient} />
      <figcaption className="kp-cap">
        {locked && <Lock className="kp-lockic" size={11} strokeWidth={2.4} aria-label="Locked to its own look" />}
        <span>{p.caption}</span>
        <button className="kp-edit" title={`Edit ${name} in the editor`} aria-label={`Edit ${name}`}
          onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <SquarePen size={12} strokeWidth={2.2} />
        </button>
        {sizable && (
          <span className="kp-sizes">
            {(["m", "l"] as const).map((s) => (
              <button key={s} className={size === s ? "on" : ""} title={`Size ${s.toUpperCase()}`}
                onClick={(e) => { e.stopPropagation(); setKitSize(p.id, s); }}>{s.toUpperCase()}</button>
            ))}
          </span>
        )}
        <button className="kp-dl" title={`Export ${p.caption} SVG`} aria-label={`Export ${p.caption} SVG`}
          onClick={(e) => {
            e.stopPropagation();
            const { cfg: c, kitShapes: ks, kitDesigns: kd, kitTextOy: ko } = useGen.getState();
            const variant = p.caption.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            downloadSvg(
              renderKit(applyKitDesign(c, kd[p.id]), p.id, size, p.baseState ?? "default", p.value, ks[p.id],
                { label: p.label, segments: p.segments, icon: p.icon, expand: true, textOy: ko[`${p.id}:${size}`] }),
              `kit-${variant}-${size}.svg`
            );
          }}>
          <Download size={12} strokeWidth={2.2} />
        </button>
      </figcaption>
    </figure>
  );
}

/** A piece inside a pattern or assembly mock — no caption rail, tighter scale. */
function PPiece(p: PieceOpts & { ambient?: boolean }) {
  const { cfg, name, kit } = usePiece({ ...p, size: p.size ?? "m" });
  return (
    <LiveArt cfg={cfg} playing scale={p.scale ?? PATTERN_SCALE} className="gp-piece"
      kit={kit} title={name} ambient={p.ambient} trim={p.trim} />
  );
}

/** A piece on a screen-pattern stage — same live plumbing, but the invisible
 *  render canvas is trimmed away so pieces stack at interface rhythm. */
function SPiece(p: PieceOpts & { ambient?: boolean }) {
  return <PPiece {...p} trim={p.trim ?? true} />;
}

/** One screen-pattern specimen: identification above the viewport, the dark
 *  stage as the actual screen, quiet system metadata below. The viewport's
 *  aspect ratio is fixed and every nested piece reserves its largest state,
 *  so no interaction inside can move the card, the grid or the page. */
function Pat({ n, name, cat, comps, asms, lead, children }: {
  n: string; name: string; cat: string; comps: number; asms: number;
  lead: KitComponentId; children: React.ReactNode;
}) {
  const { setFocus } = useGen();
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!big) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [big]);
  return (
    <article className="pat">
      <header className="pat-head">
        <span className="pat-num">{n}</span>
        <h4 className="pat-name">{name}</h4>
        <span className="pat-cat">{cat}</span>
        <button className="pat-open" onClick={() => setBig(true)}
          title={`Inspect ${name} at presentation size`}>
          Open pattern →
        </button>
      </header>
      <div className="pat-view"><div className="sc">{children}</div></div>
      <footer className="pat-foot">
        <span>{comps} registered components</span>
        <span>{asms} {asms === 1 ? "assembly" : "assemblies"}</span>
        <span>Fully editable</span>
      </footer>
      {big && createPortal(
        <div className="kp-patmodal" role="dialog" aria-modal="true" aria-label={`${name} — enlarged`} onClick={() => setBig(false)}>
          <div className="kp-patmodal-card" onClick={(e) => e.stopPropagation()}>
            <header className="pat-head">
              <span className="pat-num">{n}</span>
              <h4 className="pat-name">{name}</h4>
              <span className="pat-cat">{cat} · phone-true sizes, shown big for desktop review</span>
              <button className="pat-open" onClick={() => { setBig(false); setFocus(lead); }}>Edit in editor →</button>
              <button className="pat-open" onClick={() => setBig(false)}>Close ✕</button>
            </header>
            <div className="pat-view kp-patbig"><div className="sc">{children}</div></div>
          </div>
        </div>,
        document.body
      )}
    </article>
  );
}

/** Shared template for terminal states — icon, title, one-line explanation,
 *  primary recovery, secondary escape. Empty and Error are the same system. */
/** One full-screen layout starter — a device-true stage the user can delete.
 *  These are idea starters, not rules; every piece stays live and editable. */
function LayoutCard({ id, name, device, onHide, children }: {
  id: string; name: string; device: "Desktop 16:9" | "Mobile landscape" | "Mobile portrait";
  onHide: (id: string) => void; children: React.ReactNode;
}) {
  const cls = device === "Desktop 16:9" ? "desktop" : device === "Mobile landscape" ? "mobile-l" : "mobile-p";
  return (
    <article className={`lay ${cls}`}>
      <header className="pat-head">
        <h4 className="pat-name">{name}</h4>
        <span className="pat-cat">{device}</span>
        <button className="pat-open" onClick={() => onHide(id)} title="Remove this starter from your kit">Remove ×</button>
      </header>
      <div className="lay-view"><div className="lay-stage">{children}</div></div>
    </article>
  );
}

function StateScreen({ icon, title, line, action }: { icon: IconDef; title: string; line: string; action: string }) {
  return (
    <>
      <SPiece id="badge" baseState="pressed" icon={icon} scale={0.34} />
      <SPiece id="tab" label={title} tone="alt" scale={0.36} />
      <span className="sc-caption dim">{line}</span>
      <div className="sc-row sc-push">
        <SPiece id="small" label={action} scale={0.34} />
        <PPiece id="ghost" label="Back" size="s" scale={0.32} />
      </div>
    </>
  );
}

function Sec({ n, title, anchor, note, wide, children }: { n: string; title: string; anchor?: string; note?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`kp-sec${wide ? " kp-wide" : ""}`} data-anchor={anchor}>
      <header className="kp-sechead">
        <span className="kp-num">{n}</span>
        <h2>{title}</h2>
        <span className="kp-rule" />
      </header>
      {note && <p className="kp-note">{note}</p>}
      {children}
    </section>
  );
}

/** Chapter divider — a level of the system, visually senior to any section. */
function Chapter({ n, id, label, blurb }: { n: string; id: string; label: string; blurb: string }) {
  return (
    <div className="kp-chapter" id={`chap-${id}`} data-chap={id}>
      <span className="kp-chapnum" aria-hidden="true">{n}</span>
      <div className="kp-chaptext">
        <span className="kp-chapname">{label}</span>
        <span className="kp-chapblurb">{blurb}</span>
      </div>
      <span className="kp-chapline" />
    </div>
  );
}

/** Small annotation line under a Build Part — plain editorial text, not pills. */
function Meta({ items }: { items: string[] }) {
  return <div className="kp-meta">{items.map((m) => <span key={m}>{m}</span>)}</div>;
}

/** Structured spec rows — the documentation voice for property readouts.
 *  Key/value lines with one shared left edge; pills stay reserved for real
 *  selections and states. */
function SpecList({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="kp-spec">
      {rows.map(([k, v]) => (
        <div className="kp-specline" key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

/* color readouts — designers hand these to print and engine pipelines */
function rgbOf(hex: string): [number, number, number] {
  const p = parseInt(hex.slice(1), 16);
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
}
function cmykOf(hex: string): string {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return "0 0 0 100";
  const f = (v: number) => Math.round(((1 - v - k) / (1 - k)) * 100);
  return `${f(r)} ${f(g)} ${f(b)} ${Math.round(k * 100)}`;
}

/* relative luminance + WCAG-ish contrast for the accessibility read */
function lum(hex: string): number {
  const p = parseInt(hex.slice(1), 16);
  const f = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((p >> 16) & 255) + 0.7152 * f((p >> 8) & 255) + 0.0722 * f(p & 255);
}
function contrast(a: string, b: string): number {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function assess(cfg: GenConfig): { level: "Strong" | "Fair" | "Risky"; notes: string[] } {
  const T = cfg.type;
  const face = cfg.face.mode === "dark" ? hexMix(cfg.effects.Bevel ?? "#0E9CC9", "#0B0714", 0.72) : (cfg.effects["Inner Fill"] ?? "#2CC5F0");
  const label = T.fillMode === "auto"
    ? (cfg.face.mode === "dark" ? "#EAF6FF" : "#FFFFFF")
    : T.fillMode === "gradient" ? hexMix(T.fill, T.fill2, 0.5) : T.fill;
  const ratio = contrast(label, face);
  const notes: string[] = [];
  let hard = false;
  if (ratio < 3) { hard = true; notes.push(`Label vs. face contrast is about ${ratio.toFixed(1)}:1 — hard to read for a lot of players. A darker face or brighter fill would help.`); }
  else if (ratio < 4.5) notes.push(`Label contrast is around ${ratio.toFixed(1)}:1 — fine for big display text, but small labels may get murky.`);
  if (T.outline.on && ratio < 4.5) notes.push("The outline is doing real legibility work here — keep it on.");
  if (T.glow.on && T.glow.size > 16 && T.glow.opacity > 85) notes.push("That much glow can halo the letterforms at small sizes — consider easing size or opacity.");
  if (T.spacing < -2) notes.push("Tight negative tracking crowds the glyphs — small text will smudge.");
  if ((T.outline.on && T.outline.width < 1)) notes.push("A sub-1px outline tends to disappear on low-DPI screens.");
  if (cfg.candy.pattern.type !== "none" && cfg.candy.pattern.opacity > 60) notes.push("The face pattern is strong enough to compete with the label — lower its opacity for text-heavy pieces.");
  const level = hard ? "Risky" : notes.length > 1 ? "Fair" : "Strong";
  if (!notes.length) notes.push("Contrast, tracking and effects are all comfortable. No warnings.");
  return { level, notes };
}

/** A live piece row shown at several states, tiny captions underneath. */
function StateStrip({ variants }: {
  variants: { cap: string; piece: PieceOpts }[];
}) {
  return (
    <div className="kp-states">
      {variants.map((v) => (
        <figure className="kp-state" key={v.cap}>
          <PPiece {...v.piece} scale={v.piece.scale ?? 0.3} />
          <figcaption>{v.cap}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** One motion behavior demo — click replays the behavior on a real piece. */
function MotionDemo({ name, cls, piece, purpose, dur, ease }: {
  name: string; cls: string; piece: PieceOpts; purpose: string; dur: string; ease: string;
}) {
  const [tick, setTick] = useState(0);
  return (
    <button className="kp-part kp-mo" title={`Replay ${name}`} onClick={() => setTick((t) => t + 1)}>
      <span key={tick} className={`kp-mostage ${cls}`}>
        <PPiece {...piece} scale={piece.scale ?? 0.26} />
      </span>
      <span className="kp-partname">{name}</span>
      <span className="kp-mopurpose">{purpose}</span>
      <span className="kp-mospec">{dur} · {ease}</span>
    </button>
  );
}

/* jump into the editor with a section opened — Build Parts are editable by
   opening the layer that produces them */
function openEditor(sec: string) {
  useGen.setState((st) => ({ open: { ...st.open, [sec]: true }, phase: "master" }));
  window.setTimeout(() => document.querySelector(`[data-sec="${sec}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
}

/** Banner rendered with its three-slice guides: fixed caps, stretch middle,
 *  text-safe area — computed from the real silhouette metadata. The demo
 *  scales itself into `fit` px so a very wide banner never dominates the
 *  page; the ruler label reports its true shell width. */
function SliceDemo({ cfg, label, size = "m", fit = 520, ruler }: { cfg: GenConfig; label: string; size?: KitSize; fit?: number; ruler?: boolean }) {
  const { kitShapes, kitTextOy } = useGen();
  const shape = kitShapes.header ?? "banner";
  const met = silhouetteMeta(shape);
  const oy = kitTextOy[`header:${size}`];
  const svg = useMemo(() => renderKit(cfg, "header", size, "default", undefined, kitShapes.header, { label, textOy: oy }), [cfg, label, size, kitShapes.header, oy]);
  const geo = useMemo(() => {
    const m = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
    if (!m || !met) return null;
    const pad = -+m[1], total = +m[3];
    const h = 158 * ({ s: 0.72, m: 1, l: 1.22 } as const)[size];
    const shellW = total - pad * 2 - 104; // x margin 52 each side
    const cap = met.capScale * h, safe = met.content.left * h;
    const x0 = pad + 52;
    return {
      total, shellW: Math.round(shellW),
      capL: ((x0 + cap) / total) * 100, capR: ((x0 + shellW - cap) / total) * 100,
      safeL: ((x0 + safe) / total) * 100, safeR: ((x0 + shellW - safe) / total) * 100,
    };
  }, [svg, met, size]);
  const scale = geo ? Math.min(0.44, fit / geo.total) : 0.44;
  return (
    <div>
      <div className="kp-slice">
        <Art svg={svg} scale={scale} />
        {geo && (
          <>
            <span className="kp-guide cap" style={{ left: `${geo.capL}%` }} />
            <span className="kp-guide cap" style={{ left: `${geo.capR}%` }} />
            <span className="kp-guide safe" style={{ left: `${geo.safeL}%` }} />
            <span className="kp-guide safe" style={{ left: `${geo.safeR}%` }} />
          </>
        )}
      </div>
      {ruler && geo && <div className="kp-ruler">├─ true shell width ≈ {geo.shellW}px · shown at {Math.round(scale * 100)}% ─┤</div>}
    </div>
  );
}

const SPLASHES = ["SWEET VICTORY", "BONUS BURST", "SUGAR RUSH", "LEVEL UP!", "NEW HIGH SCORE", "MISSION COMPLETE", "READY?", "GAME OVER"];

const ICON_SET: { key: string; name: string }[] = [
  { key: "play", name: "Play" }, { key: "pause", name: "Pause" }, { key: "close", name: "Close" },
  { key: "back", name: "Back" }, { key: "forward", name: "Forward" }, { key: "check", name: "Check" },
  { key: "lock", name: "Lock" }, { key: "unlock", name: "Unlock" }, { key: "gear", name: "Settings" },
  { key: "user", name: "User" }, { key: "bag", name: "Store" }, { key: "volume", name: "Volume" },
  { key: "volumeOff", name: "Muted" }, { key: "info", name: "Info" }, { key: "warning", name: "Warning" },
  { key: "refresh", name: "Refresh" }, { key: "home", name: "Home" }, { key: "search", name: "Search" },
];

export function KitPage() {
  const { cfg, kitDesigns, setPhase, kitName, setKitName, saveUserPreset, update } = useGen();
  const dark = isDarkBg(cfg.canvas);
  const preset = PRESETS.find((p) => p.id === cfg.presetId);
  const sil = SHAPES.find((s) => s.id === cfg.shape)?.name.split(" — ")[0] ?? "Custom";
  const roles = EFFECT_ROLES.filter((r) => cfg.effects[r] !== undefined);
  const specularName = SPECULAR_MODES.find((m) => m.id === cfg.candy.specular.mode)?.name ?? "—";
  const patternName = PATTERN_TYPES.find((p) => p.id === cfg.candy.pattern.type)?.name.split(" — ")[0] ?? "None";
  const label = cfg.content.label || "PLAY";
  const T = cfg.type;
  const caps = fontByName(T.font).caps;
  const typeFx = [
    T.outline.on && "Outline", T.shadow.on && "Shadow",
    T.emboss.on && (T.emboss.strength < 0 ? "Deboss" : "Emboss"), T.glow.on && "Glow",
    T.stripes?.on && "Stripes", T.glints?.on && "Glints",
  ].filter(Boolean) as string[];
  const caseName = { none: "As typed", upper: "Uppercase", lower: "Lowercase", title: "Title Case" }[T.case];

  // the live display test — a real editable instance of the display-text component
  const [splash, setSplash] = useState("SWEET VICTORY");
  const [splashHi, setSplashHi] = useState("VICTORY");
  const [treatOn, setTreatOn] = useState(true);
  const typeOff = (c: GenConfig) => {
    c.type.outline.on = false; c.type.shadow.on = false; c.type.emboss.on = false;
    c.type.glow.on = false; c.type.stripes = { on: false, angle: 45, opacity: 30 };
    c.type.glints = { on: false, opacity: 55 }; c.type.highlight = "";
  };
  const splashArt = useMemo(() => tightenV(renderTypeSpecimen(cfg, splash, {
    highlight: treatOn ? splashHi : undefined,
    mutate: (c) => { c.type.size = 84; if (!treatOn) typeOff(c); },
  }), 84, cfg.type.oy ?? 0), [cfg, splash, splashHi, treatOn]); // eslint-disable-line react-hooks/exhaustive-deps

  // accessibility read — friendly, hidden behind a disclosure
  const [a11yOpen, setA11yOpen] = useState(false);
  const audit = useMemo(() => assess(cfg), [cfg]);
  // objective rewards render as real display-text specimens, not chips
  const xpArts = useMemo(() => new Map((["+250 XP", "+400 XP", "+350 XP", "+300 XP"] as const).map((x) => [x as string, renderTypeSpecimen(cfg, x)])), [cfg]);

  // screen-pattern group filter — restrained text nav, not capsules
  const [patTab, setPatTab] = useState<"all" | "core" | "outcome" | "state">("all");

  // hero disclosure + sticky-nav orientation
  const [aboutOpen, setAboutOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [hiddenLays, setHiddenLays] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("ui-generator-hiddenlayouts") ?? "[]"); } catch { return []; }
  });
  const hideLay = (id: string) => setHiddenLays((h) => {
    const next = id === "*reset*" ? [] : [...h, id];
    try { localStorage.setItem("ui-generator-hiddenlayouts", JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
  const [activeChap, setActiveChap] = useState("foundations");
  useEffect(() => {
    const scroller = document.querySelector(".canvas");
    if (!scroller) return;
    let raf = 0;
    const read = () => {
      raf = 0;
      const marks = [...document.querySelectorAll<HTMLElement>("[data-chap]")];
      let current = "foundations";
      for (const m of marks) if (m.getBoundingClientRect().top < 280) current = m.dataset.chap ?? current;
      setActiveChap((prev) => (prev === current ? prev : current));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(read); };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    read();
    return () => { scroller.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // main-menu title — the game's name (preset), not the master button label
  const menuArt = useMemo(() => renderTypeSpecimen(cfg, (preset?.name ?? "CANDY").toUpperCase()), [cfg, preset]);
  const loadingArt = useMemo(() => renderTypeSpecimen(cfg, "LOADING"), [cfg]);
  const charRow = (txt: string) => tightenV(renderTypeSpecimen(cfg, txt, { keepCase: true, mutate: (c) => { c.type.size = 52; } }), 52, T.oy ?? 0);
  const alphaUp = useMemo(() => charRow("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const alphaLo = useMemo(() => charRow("abcdefghijklmnopqrstuvwxyz"), [cfg]); // eslint-disable-line react-hooks/exhaustive-deps
  const digits = useMemo(() => charRow("0123456789 ! ? & % + × / : . , ’ “ ” ( ) [ ]"), [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // hero specimen — the current live phrase at Display XL
  const heroTypeArt = useMemo(() => tightenV(renderTypeSpecimen(cfg, splash, {
    highlight: splashHi || undefined, mutate: (c) => { c.type.size = 128; },
  }), 128, T.oy ?? 0), [cfg, splash, splashHi]); // eslint-disable-line react-hooks/exhaustive-deps

  // display construction — the treatment built up in four inspectable stages
  const conWord = (splash.trim().split(/\s+/)[0] || "LEVEL").slice(0, 8).toUpperCase();
  const conStages = useMemo(() => {
    const base = (c: GenConfig) => { typeOff(c); c.type.size = 62; };
    const defs: [string, (c: GenConfig) => void][] = [
      ["Base fill", (c) => base(c)],
      ["Outline", (c) => { base(c); c.type.outline.on = true; }],
      ["Depth", (c) => {
        base(c); c.type.outline.on = true; c.type.shadow.on = true;
        c.type.emboss.on = true; if (!c.type.emboss.strength) c.type.emboss.strength = 55;
      }],
      ["Highlight + glow", (c) => {
        base(c); c.type.outline.on = true; c.type.shadow.on = true;
        c.type.emboss.on = true; if (!c.type.emboss.strength) c.type.emboss.strength = 55;
        c.type.glow.on = true; c.type.glints = { on: true, opacity: c.type.glints?.opacity ?? 55 };
      }],
    ];
    return defs.map(([name, mutate]) => ({ name, svg: tightenV(renderTypeSpecimen(cfg, conWord, { mutate }), 62, T.oy ?? 0) }));
  }, [cfg, conWord]); // eslint-disable-line react-hooks/exhaustive-deps

  // scale reference — the same phrase down the whole ramp
  const scaleArts = useMemo(() => ([["Display XL", 128], ["Display L", 96], ["Display M", 64], ["Display S", 40], ["Label", 18]] as const)
    .map(([nm, px]) => ({ nm, px, svg: tightenV(renderTypeSpecimen(cfg, "LEVEL UP", { mutate: (c) => { c.type.size = px; } }), Math.max(px, 16), T.oy ?? 0) })), [cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  // caps-only faces map lowercase onto the uppercase forms — detect for real
  const [fontsTick, setFontsTick] = useState(0);
  useEffect(() => { document.fonts?.ready?.then(() => setFontsTick((t) => t + 1)).catch(() => {}); }, [T.font]); // eslint-disable-line react-hooks/exhaustive-deps
  const capsOnly = useMemo(() => {
    void fontsTick;
    try {
      const cv = document.createElement("canvas"); cv.width = 160; cv.height = 64;
      const ctx = cv.getContext("2d");
      if (!ctx) return false;
      ctx.font = `40px "${T.font}", Inter, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText("agr", 4, 8);
      const lo = cv.toDataURL();
      ctx.clearRect(0, 0, 160, 64);
      ctx.fillText("AGR", 4, 8);
      return lo === cv.toDataURL();
    } catch { return false; }
  }, [T.font, fontsTick]);

  // typography recipe — the current treatment as a live layered stack
  const recipe = useMemo(() => {
    const offAll = (c: GenConfig) => {
      c.type.outline.on = false; c.type.shadow.on = false; c.type.emboss.on = false;
      c.type.glow.on = false; c.type.stripes = { on: false, angle: 45, opacity: 30 };
      c.type.glints = { on: false, opacity: 55 }; c.type.highlight = "";
    };
    const layers: { name: string; on: (c: GenConfig) => void }[] = [{ name: "Live base text · face fill", on: () => {} }];
    if (T.outline.on) layers.push({ name: "+ Outline", on: (c) => { c.type.outline.on = true; } });
    if (T.shadow.on) layers.push({ name: "+ Shadow", on: (c) => { c.type.shadow.on = true; } });
    if (T.emboss.on) layers.push({ name: T.emboss.strength < 0 ? "+ Deboss relief" : "+ Emboss relief", on: (c) => { c.type.emboss.on = true; } });
    if (T.glow.on) layers.push({ name: "+ Glow", on: (c) => { c.type.glow.on = true; } });
    if (T.stripes?.on) layers.push({ name: "+ Stripe mask", on: (c) => { c.type.stripes!.on = true; } });
    if (T.glints?.on) layers.push({ name: "+ Highlight glints", on: (c) => { c.type.glints!.on = true; } });
    layers.push({ name: "+ Highlight phrase", on: (c) => { c.type.highlight = c.content.label.split(" ").pop() ?? ""; } });
    const ons: ((c: GenConfig) => void)[] = [];
    return layers.map((l) => {
      ons.push(l.on);
      const fns = [...ons];
      return { name: l.name, svg: renderTypeSpecimen(cfg, label, { mutate: (c) => { offAll(c); fns.forEach((f) => f(c)); } }) };
    });
  }, [cfg, label]); // eslint-disable-line react-hooks/exhaustive-deps

  // build-part layer isolation — each card is one layer of the real stack
  const layerCards = useMemo(() => {
    const zero = (c: GenConfig) => {
      c.shadow.opacity = 0; c.candy.contact.opacity = 0; c.candy.extrusion.depth = 0;
      c.transparency = { frame: 0, interior: 0, content: 0 };
      for (const s of Object.values(c.states)) { s.glow = 0; s.lift = 0; }
      c.candy.gloss.on = false; c.candy.specular.on = false; c.candy.pattern.type = "none";
      c.candy.innerGlow.opacity = 0; c.candy.bloom.opacity = 0; c.candy.texture.amount = 0;
      c.candy.extrusion.glow = 0; c.stateDesigns = {};
    };
    const iso = (mut: (c: GenConfig) => void) => {
      const c = clone(cfg); zero(c); mut(c); return renderBevel(c, "default");
    };
    const base = cfg;
    return [
      { name: "Cast shadow", sec: "depth", meta: ["Stretch X/Y", "bottom of stack", "recolor via Shadow well"], svg: iso((c) => { c.shadow.opacity = Math.max(30, base.shadow.opacity); }) },
      { name: "Extrusion body", sec: "structure", meta: ["Stretch X", "under the shell", "depth in px"], svg: iso((c) => { c.candy.extrusion.depth = Math.max(10, base.candy.extrusion.depth); }) },
      { name: "Shell wall + rim", sec: "structure", meta: ["Fixed caps", "stretch middle", "recolor via Bevel well"], svg: iso((c) => { c.transparency.frame = 100; }) },
      { name: "Face gradient", sec: "surface", meta: ["Stretch X/Y", "recolor via Inner Fill", "safe inset = wall"], svg: iso((c) => { c.transparency.interior = 100; }) },
      { name: "Pattern overlay", sec: "surface", meta: ["Repeat", "over the face", "tone-on-tone"], svg: iso((c) => { c.transparency.interior = 100; c.candy.pattern.type = base.candy.pattern.type === "none" ? "stripes" : base.candy.pattern.type; }) },
      { name: "Inner glow", sec: "glow", meta: ["Stretch X/Y", "unlit side", "recolor via Glow well"], svg: iso((c) => { c.transparency.interior = 100; c.candy.innerGlow.opacity = 75; }) },
      { name: "Gloss strip", sec: "gloss", meta: ["Stretch X", "top of face", "curve + softness"], svg: iso((c) => { c.transparency.interior = 100; c.candy.gloss.on = true; }) },
      { name: "Specular streak", sec: "gloss", meta: ["Fixed size", "lit corner", "six modes"], svg: iso((c) => { c.transparency.interior = 100; c.candy.specular.on = true; }) },
      { name: "Outer glow (aura)", sec: "state", meta: ["Stretch X/Y", "behind everything", "per-state"], svg: iso((c) => { c.transparency.frame = 100; c.states.default.glow = 55; }) },
      { name: "Contact shadow", sec: "depth", meta: ["Stretch X", "grounding", "fades on lift"], svg: iso((c) => { c.transparency.frame = 100; c.candy.contact.opacity = 60; }) },
      { name: "Live text treatment", sec: "typography", meta: ["Editable text", "never rasterized", "full recipe below"], svg: iso((c) => { c.transparency.content = 100; }) },
    ];
  }, [cfg]);

  return (
    <div className={`kitpage${dark ? " dark" : ""}`}>
      {/* ── sticky chapter navigation — persistent orientation ── */}
      <nav className="kp-tabsbar" aria-label="Kit chapters">
        {CHAPTERS.map(([id, num, name]) => (
          <button key={id} className={activeChap === id ? "on" : ""}
            onClick={() => {
              setActiveChap(id);
              const el = document.getElementById(`chap-${id}`);
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
              // one glow pulse on arrival — "you are here"
              el?.classList.remove("kp-glowonce"); void el?.offsetWidth; el?.classList.add("kp-glowonce");
              window.setTimeout(() => el?.classList.remove("kp-glowonce"), 1800);
            }}>
            <span className="kp-tabnum">{num}</span> {name}
          </button>
        ))}
        <button className="kp-tabedit" onClick={() => setPhase("master")} title="Back to the component editor">
          <PenTool size={13} strokeWidth={2} /> Editor
        </button>
      </nav>

      {/* ── hero — the system, stated once ── */}
      <header className="kp-hero kp-hero2">
        <div className="kp-heroleft">
          <div className="kp-eyebrow"><span className="kp-verpill">Design System</span> PatternBreak</div>
          {renaming ? (
            <input className="kp-titleedit" autoFocus maxLength={40} aria-label="Kit name"
              defaultValue={kitName ?? `The ${preset?.name ?? "Custom"} Kit`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const changed = v && v !== `The ${preset?.name ?? "Custom"} Kit`;
                setKitName(changed ? v : null);
                if (changed) saveUserPreset(v); // the named look becomes a preset — the original stays
                setRenaming(false);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(false); }} />
          ) : (
            <h1 className="kp-title kp-renamable" onClick={() => setRenaming(true)} title="Click to rename this kit">
              {kitName ?? `The ${preset?.name ?? "Custom"} Kit`} <SquarePen className="kp-renpen" size={17} strokeWidth={2.1} aria-hidden="true" />
            </h1>
          )}
          <p className="kp-sub">A dimensional candy interface system for fast, playful game UI — one material, five levels, everything live.</p>
          <div className="kp-facts">
            {([["5", "Levels"], [String(KIT_COMPONENTS.length) + "+", "Components"], ["20+", "Assemblies"], [sil, "Silhouette"]] as const).map(([v, l]) => (
              <div className="kp-fact" key={l}><b>{v}</b><span>{l}</span></div>
            ))}
            <button className={`kp-fact kp-a11ybtn${a11yOpen ? ` a11y-${audit.level.toLowerCase()}` : ""}`} aria-expanded={a11yOpen} onClick={() => setA11yOpen((v) => !v)}>
              <b><ShieldCheck size={14} strokeWidth={2.4} /> {a11yOpen ? audit.level : "See score"}</b><span>Accessibility</span>
            </button>
          </div>
          <div className="kp-roleline" aria-hidden="true">
            {roles.map((r) => <span className="kp-roledot" key={r}><i style={{ background: cfg.effects[r] }} />{r}</span>)}
          </div>
          <button className="kp-about" aria-expanded={aboutOpen} onClick={() => setAboutOpen((v) => !v)}>About this kit {aboutOpen ? "–" : "+"}</button>
          {aboutOpen && (
            <p className="kp-note kp-aboutbody">
              {sil} silhouette · {T.font}. One material recipe at five levels: foundations, finished
              components, Build Parts with containers and assemblies, screen patterns and resources.
              Every specimen is a live render from the same engine that draws the editor canvas;
              each opens in the editor via the ✎ next to its name. Nothing on this page is a mockup.
            </p>
          )}
          {a11yOpen && (
            <div className={`kp-a11y ${audit.level.toLowerCase()}`} role="status">
              <b>{audit.level === "Strong" ? "Strong — reads clearly." : audit.level === "Fair" ? "Fair — solid, with a couple of watch-outs." : "Risky — worth a tweak before shipping."}</b>
              <ul>{audit.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              <div className="kp-a11yhow">Computed locally from WCAG contrast ratios and type metrics — no AI involved, nothing leaves the page.</div>
            </div>
          )}
        </div>
        <HeroGL />
      </header>

      <Chapter n="01" id="foundations" label="Foundations" blurb="The color roles, material and typography every component inherits." />

      {/* ── 01 · style tokens ── */}
      <Sec n="01" title="Color & Material" note="Five color roles drive the material: face, bevel, glow, shadow and inner fill. Repaint a role and every layer that uses it follows. These are functional roles, not a brand palette.">
        <div className="kp-mat">
          <div className="kp-explode" aria-label="Material layers, top to bottom">
            {([["01", "Glow", "Outer bloom for energy and focus", "Outer glow (aura)"],
               ["02", "Face", "Lit surface that carries the content", "Face gradient"],
               ["03", "Shell", "Wall and rim for shape definition", "Shell wall + rim"],
               ["04", "Body", "Extrusion for physical depth", "Extrusion body"],
               ["05", "Shadow", "Grounding and separation", "Cast shadow"]] as const).map(([n, t, d, layer]) => (
              <div className="kp-exrow" key={n}>
                <div className="kp-exlab"><b>{n} · {t}</b><span>{d}</span></div>
                <Art svg={layerCards.find((l) => l.name === layer)?.svg ?? ""} scale={0.3} />
              </div>
            ))}
          </div>
          <div className="kp-roles2">
            <div className="kp-rolehead">Color roles</div>
            {roles.map((r) => (
              <div className="kp-role2" key={r}>
                <i style={{ background: cfg.effects[r] }} />
                <div className="kp-rolemeta"><b>{r}</b><span>{ROLE_HINT[r]}</span></div>
                <code>{cfg.effects[r]?.toUpperCase()}{"\n"}RGB {rgbOf(cfg.effects[r] ?? "#000000").join(" ")}{"\n"}CMYK {cmykOf(cfg.effects[r] ?? "#000000")}</code>
              </div>
            ))}
          </div>
        </div>
        <div className="kp-meta">
          <span>Change freely: any role's hue</span>
          <span>Keep related: glow near the bevel family</span>
          <span>Breaks the look: flat fills, removed rim, black shadows at full opacity</span>
        </div>
        <SpecList rows={[
          ["Face", cfg.face.mode === "dark" ? "Dark" : "Light"],
          ["Wall", `${cfg.bevel.width}px`],
          ["Extrusion", `${cfg.candy.extrusion.depth}px`],
          ["Key light", `${cfg.lighting.angle}°`],
          ["Gloss", cfg.candy.gloss.on ? `${cfg.candy.gloss.opacity}%` : "Off"],
          ["Specular", cfg.candy.specular.on ? specularName : "Off"],
          ["Pattern", patternName],
        ]} />
      </Sec>

      {/* ── 02 · typography ── */}
      <Sec n="02" title="Typography" note="One typeface, one construction system. Display text inherits the same material, outline, depth, and lighting rules as every component in the kit.">
        <div className="kp-typo2">
          <aside className="kp-tyinfo">
            <div className="kp-tyid">
              <b>{T.font}</b>
              <span>Display Typeface</span>
            </div>
            <dl className="kp-tydl">
              {([
                ["Style", T.italic ? "Italic display" : "Display"],
                ["Weight", caps?.wght ? `${T.weight} · variable ${caps.wght[0]}–${caps.wght[1]}` : String(T.weight)],
                ["Case", caseName],
                ["Tracking", `${T.spacing >= 0 ? "" : "−"}${Math.abs(T.spacing)}%`],
                ["Treatment", ["Fill", ...typeFx].join(", ").toLowerCase().replace(/^f/, "F")],
                ["Recommended use", "Titles, rewards, actions, short phrases"],
              ] as const).map(([k2, v2]) => (
                <div className="kp-tyrow" key={k2}><dt>{k2}</dt><dd>{v2}</dd></div>
              ))}
            </dl>
            <div className="kp-tyuse">
              <b className="use">Use it for</b>
              <span>Screen titles · Reward moments · Primary actions · Short status messages</span>
              <b className="avoid">Avoid it for</b>
              <span>Body copy · Long instructions · Dense data · Small labels</span>
            </div>
            <div className="kp-tysrc">
              <a target="_blank" rel="noreferrer" href={`https://fonts.google.com/specimen/${encodeURIComponent(T.font).replace(/%20/g, "+")}`}>Google Fonts</a>
              <i>·</i>
              <a target="_blank" rel="noreferrer" href={`https://github.com/google/fonts/tree/main/ofl/${T.font.toLowerCase().replace(/[^a-z0-9]/g, "")}`}>Open source</a>
              <i>·</i>
              <span>Live text</span>
            </div>
          </aside>

          <div className="kp-tyspec">
            <div className="kp-tylabel">Primary display example</div>
            <Art svg={heroTypeArt} scale={0.92} className="kp-tyhero" />
            <div className="kp-tyanno">Display XL · 128px · {T.spacing >= 0 ? T.spacing : `−${Math.abs(T.spacing)}`}% tracking · {caseName}</div>

            <div className="kp-tylabel kp-tygap">Character set</div>
            <div className="kp-tychars">
              <span className="kp-tyrowlab">Uppercase</span>
              <Art svg={alphaUp} scale={0.9} />
              <span className="kp-tyrowlab">Lowercase</span>
              <Art svg={alphaLo} scale={0.9} />
              {capsOnly && <p className="kp-tymap">Lowercase maps to uppercase forms.</p>}
              <span className="kp-tyrowlab">Numerals &amp; punctuation</span>
              <Art svg={digits} scale={0.9} />
            </div>

            <div className="kp-tylabel kp-tygap">Display construction</div>
            <div className="kp-tystages">
              {conStages.map((st, i) => (
                <figure key={st.name}>
                  <Art svg={st.svg} scale={0.78} />
                  <figcaption><b>{String(i + 1).padStart(2, "0")}</b> {st.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>

        <div className="kp-tylive">
          <div className="kp-tylabel">Live display test</div>
          <div className="kp-tylivegrid">
            <div className="kp-tyout">
              <Art svg={splashArt} scale={1} className="kp-splashmain" />
              <p className="kp-tymap">The highlight phrase is rendered with the same treatment as the rest of the display.</p>
            </div>
            <div className="kp-tyctl">
              <label>Primary phrase
                <span className="kp-tyfield"><input value={splash} maxLength={20} onChange={(e) => setSplash(e.target.value)} aria-label="Splash text" /><i>{splash.length}/20</i></span>
              </label>
              <label>Highlight phrase
                <span className="kp-tyfield"><input value={splashHi} maxLength={20} onChange={(e) => setSplashHi(e.target.value)} aria-label="Highlight phrase" /><i>{splashHi.length}/20</i></span>
              </label>
              <label className="kp-tyslide">Highlight intensity
                <span className="kp-tyfield"><input type="range" min={0} max={100} value={T.highlightBoost ?? 70} aria-label="Highlight intensity"
                  onChange={(e) => update((c) => { c.type.highlightBoost = +e.target.value; })} /><i>{T.highlightBoost ?? 70}%</i></span>
              </label>
              <label className="kp-tytog">Treatment
                <button className={`kp-tyswitch${treatOn ? " on" : ""}`} role="switch" aria-checked={treatOn} aria-label="Treatment on or off"
                  onClick={() => setTreatOn(!treatOn)}><i>{treatOn ? "ON" : "OFF"}</i></button>
              </label>
              <p className="kp-tymap">The highlight rides the matched phrase — position follows the text itself.</p>
            </div>
          </div>
        </div>

        <div className="kp-tyfoot">
          <div className="kp-typresets">
            <div className="kp-tylabel">Phrase presets</div>
            <div className="kp-splashtxts" style={{ fontFamily: `'${T.font}', Inter, sans-serif` }}>
              {SPLASHES.map((sp) => (
                <button key={sp} className={`kp-splashtxt${sp === splash ? " on" : ""}`} title={`Load “${sp}” into the live test`}
                  onClick={() => { setSplash(sp); setSplashHi(sp === "SWEET VICTORY" ? "VICTORY" : ""); }}>{sp}</button>
              ))}
            </div>
            <p className="kp-tymap">Click a preset to load it into the live test.</p>
          </div>
          <div className="kp-tyscale">
            <div className="kp-tylabel">Type scale reference</div>
            {scaleArts.map((r) => (
              <div className="kp-tyrung" key={r.nm}>
                <span>{r.nm}<i>{r.px}px</i></span>
                <Art svg={r.svg} scale={0.68} />
              </div>
            ))}
          </div>
        </div>
      </Sec>

      <Chapter n="02" id="components" label="Components" blurb="Finished controls, shown in true relative scale." />

      {/* ── 03 · buttons ── */}
      <Sec n="01" title="Buttons" note="Primary carries the master label. The strip below shows every state; hover, press and keyboard-focus are all real.">
        <div className="kp-tray">
          <Piece id="primary" size="l" caption="Primary · L" />
          <Piece id="primary" size="m" caption="Primary · M" />
        </div>
        <div className="kp-tray">
          <Piece id="secondary" caption="Secondary" />
          <Piece id="ghost" caption="Ghost" />
          <Piece id="small" caption="Small" />
          <Piece id="iconbtn" caption="Icon button" />
        </div>
        <StateStrip variants={[
          { cap: "Default", piece: { id: "small", label: "PLAY" } },
          { cap: "Hover / Focus", piece: { id: "small", label: "PLAY", baseState: "hover" } },
          { cap: "Pressed", piece: { id: "small", label: "PLAY", baseState: "pressed" } },
          { cap: "Disabled", piece: { id: "small", label: "PLAY", baseState: "disabled" } },
          { cap: "Locked", piece: { id: "small", label: "", icon: STOCK_ICONS.lock, baseState: "disabled" } },
        ]} />
      </Sec>

      {/* ── 04 · choice controls ── */}
      <Sec n="02" title="Choice Controls" note="Checks, radios and switches share the shell. Toggles flip on click and on Enter or Space.">
        <div className="kp-tray">
          <Piece id="checkbox" caption="Checkbox" />
          <Piece id="radio" caption="Radio" />
          <Piece id="toggle" caption="Toggle · On" value={1} />
          <Piece id="toggle" caption="Toggle · Off" value={0} />
        </div>
        <StateStrip variants={[
          { cap: "Off", piece: { id: "toggle", value: 0 } },
          { cap: "On", piece: { id: "toggle", value: 1 } },
          { cap: "Hover / Focus", piece: { id: "toggle", value: 1, baseState: "hover" } },
          { cap: "Disabled", piece: { id: "toggle", value: 1, baseState: "disabled" } },
        ]} />
      </Sec>

      {/* ── 05 · fields ── */}
      <Sec n="03" title="Fields" note="Input wells sunk into the same material. The dropdown opens in place.">
        <div className="kp-tray">
          <Piece id="input" caption="Input" />
          <Piece id="dropdown" caption="Dropdown" />
          {/* the open menu overflows its svg — give the caption room below */}
          <div className="kp-tall"><Piece id="dropdown" caption="Dropdown · Open" baseState="pressed" /></div>
        </div>
        <StateStrip variants={[
          { cap: "Empty", piece: { id: "input" } },
          { cap: "Filled", piece: { id: "input", label: "player_one" } },
          { cap: "Hover / Focus", piece: { id: "input", baseState: "hover" } },
          { cap: "Disabled", piece: { id: "input", baseState: "disabled" } },
        ]} />
      </Sec>

      {/* ── 06 · sliders & progress ── */}
      <Sec n="04" title="Sliders & Progress" note="Shared range rules: the thumb stays inside the shell at both endpoints and the fill ends at the thumb's center. Progress replays to its configured value on click or Enter.">
        <div className="kp-tray">
          <Piece id="slider" caption="Slider" value={0.62} />
          <Piece id="progress" caption="Progress" value={0.62} ambient />
        </div>
        <StateStrip variants={[
          { cap: "Min", piece: { id: "slider", value: 0, scale: 0.26 } },
          { cap: "25%", piece: { id: "slider", value: 0.25, scale: 0.26 } },
          { cap: "Mid", piece: { id: "slider", value: 0.5, scale: 0.26 } },
          { cap: "75%", piece: { id: "slider", value: 0.75, scale: 0.26 } },
          { cap: "Max", piece: { id: "slider", value: 1, scale: 0.26 } },
        ]} />
      </Sec>

      {/* ── 07 · feedback ── */}
      <Sec n="05" title="Feedback" note="Counts, awards and callouts. A badge awards on click.">
        <div className="kp-tray">
          <Piece id="badge" caption="Badge · Count" label="12" />
          <Piece id="badge" caption="Badge · Awarded" baseState="pressed" />
          <Piece id="chip" caption="Chip" />
        </div>
      </Sec>

      {/* ── 08 · navigation ── */}
      <Sec n="06" title="Navigation" note="Tabs, a segmented switch and the three-slice banner. Caps never distort; text never enters the tails.">
        <div className="kp-tray">
          <Piece id="tab" caption="Tab" label="HOME" />
          <Piece id="tab" caption="Tab" label="STORE" />
          <Piece id="segment" caption="Segmented control" value={1} />
        </div>
        <StateStrip variants={[
          { cap: "Default", piece: { id: "tab", label: "TAB" } },
          { cap: "Hover", piece: { id: "tab", label: "TAB", baseState: "hover" } },
          { cap: "Selected", piece: { id: "tab", label: "TAB", baseState: "pressed" } },
          { cap: "Disabled", piece: { id: "tab", label: "TAB", baseState: "disabled" } },
        ]} />
        <div className="kp-subhead">Banner / Stretch</div>
        <div className="kp-tray kp-banners">
          <div>
            <SliceDemo cfg={applyKitDesign(cfg, kitDesigns.header)} label={label} fit={380} ruler />
            <div className="kp-cap"><span>Standard</span></div>
          </div>
          <div>
            <SliceDemo cfg={applyKitDesign(cfg, kitDesigns.header)} label="CONTINUE YOUR ADVENTURE" size="l" fit={520} ruler />
            <div className="kp-cap"><span>Wide</span></div>
          </div>
        </div>
        <div className="kp-tray">
          <Piece id="header" caption="Banner · editable" />
        </div>
        <div className="kp-meta">
          <span>Fixed caps (dashed magenta)</span><span>Stretch region between caps</span><span>Text-safe area (dashed green)</span>
          <span>Min width ≈ 2× cap</span><span>Recommended label ≤ 18 chars</span><span>Tested to 29 chars (Wide)</span>
        </div>
      </Sec>

      {/* ── 09 · icons ── */}
      <Sec n="07" title="Icons" anchor="icons" note="The functional glyph set, embedded with the same rules everywhere: bare, as icon buttons, and as themed medallions.">
        <div className="kp-icons">
          {ICON_SET.map((ic) => (
            <figure className="kp-icon" key={ic.key} title={ic.name}>
              <span dangerouslySetInnerHTML={{ __html: previewSvg(STOCK_ICONS[ic.key], 27) }} />
              <figcaption>{ic.name}</figcaption>
            </figure>
          ))}
        </div>
        <div className="kp-links">
          <a target="_blank" rel="noreferrer" href="https://lucide.dev/icons/">Lucide icon library ↗</a>
        </div>
        <div className="kp-tray">
          <Piece id="iconbtn" caption="Icon button · Play" icon={STOCK_ICONS.play} />
          <Piece id="iconbtn" caption="Icon button · Settings" icon={STOCK_ICONS.gear} />
          <Piece id="iconbtn" caption="Icon button · Close" icon={STOCK_ICONS.close} />
          <Piece id="badge" caption="Medallion · Trophy" baseState="pressed" icon={STOCK_ICONS.trophy} />
          <Piece id="badge" caption="Medallion · Lock" baseState="pressed" icon={STOCK_ICONS.lock} />
          <Piece id="badge" caption="Medallion · Warning" baseState="pressed" icon={STOCK_ICONS.warning} />
        </div>
      </Sec>

      {/* ── 10 · game HUD & data ── */}
      <Sec n="08" title="Game HUD & Data" note="Counters, rows, slots and rings. Every icon, portrait and value is a replaceable slot.">
        <div className="kp-subhead">HUD counters</div>
        <div className="kp-tray">
          <Piece id="resource" caption="Compact" label="1 250" scale={0.4} />
          <Piece id="resource" caption="Current / max" label="3" max="5" icon={STOCK_ICONS.heart} scale={0.4} />
          <Piece id="resource" caption="With add" label="980" addBtn scale={0.4} />
          <Piece id="resource" caption="Low resource" label="0" max="5" icon={STOCK_ICONS.heart} baseState="hover" scale={0.4} />
          <Piece id="resource" caption="Disabled" label="—" baseState="disabled" scale={0.4} />
        </div>
        <div className="kp-subhead">Data rows</div>
        <div className="kp-tray">
          <Piece id="datarow" caption="Standard" scale={0.42} value={0.4} />
          <Piece id="datarow" caption="Selected" baseState="hover" value={0.4} scale={0.42} />
        </div>
        <div className="kp-tray">
          <Piece id="datarow" caption="Locked" overlay="locked" baseState="disabled" label="???" sub="Reach level 20" value={0} scale={0.42} />
          <Piece id="datarow" caption="Completed" overlay="check" label="Daily Login" sub="Reward ready" value={1} scale={0.42} />
        </div>
        <div className="kp-subhead">Item slots — one family, stackable status overlays</div>
        <div className="kp-slotgrid">
          <Piece id="slot" caption="Empty" icon={null} scale={0.38} />
          <Piece id="slot" caption="Filled" icon={STOCK_ICONS.gem} scale={0.38} />
          <Piece id="slot" caption="Count" icon={STOCK_ICONS.gem} overlay="count:14" scale={0.38} />
          <Piece id="slot" caption="Level" icon={STOCK_ICONS.user} overlay="level:12" scale={0.38} />
          <Piece id="slot" caption="Equipped" icon={STOCK_ICONS.gem} overlay="equipped" scale={0.38} />
          <Piece id="slot" caption="New" icon={STOCK_ICONS.bag} overlay="new" scale={0.38} />
          <Piece id="slot" caption="Claimable" icon={STOCK_ICONS.gem} overlay="claimable" baseState="hover" scale={0.38} />
          <Piece id="slot" caption="Cooldown" icon={STOCK_ICONS.gem} overlay="cooldown:12s" scale={0.38} />
          <Piece id="slot" caption="Locked" icon={STOCK_ICONS.gem} overlay="locked" scale={0.38} />
        </div>
        <Meta items={["Same footprint per size", "icon centered at 60%", "badges pin to corners", "veil states dim the well only", "captions always below"]} />
        <div className="kp-subhead">Touch controls</div>
        <div className="kp-tray">
          <Piece id="joystick" caption="Joystick · drag me" scale={0.44} />
          <Piece id="joystick" caption="Disabled" baseState="disabled" scale={0.44} />
        </div>
        <div className="kp-meta"><span>Knob springs back on release</span><span>Deflection clamps to the travel ring</span><span>data-stick carries the geometry for engine bindings</span></div>
        <div className="kp-subhead">Combat & spatial HUD</div>
        <div className="kp-tray">
          <Piece id="reticle" caption="Reticle · ring" scale={0.55} />
          <Piece id="reticle" caption="Reticle · brackets" overlay="brackets" scale={0.55} />
          <Piece id="minimap" caption="Mini-map · compass" scale={0.46} />
          <Piece id="minimap" caption="Mini-map · radar" overlay="square" scale={0.46} />
          <Piece id="ammo" caption="Ammo counter" label="24" max="90" scale={0.5} />
          <Piece id="lives" caption="Lives" label="3" max="5" scale={0.72} />
          <Piece id="joystick" caption="Joystick · ghost overlay" overlay="ghost" scale={0.44} />
        </div>
        <div className="kp-meta"><span>Reticles and lives are shell-free spatial UI</span><span>Badges double as spatial markers — pair one with the pulse ring from Onboarding & Map</span><span>The overlay stick is stroke-and-glass — designed to sit on live gameplay</span></div>
        <div className="kp-subhead">Celebration numbers</div>
        <div className="kp-tray">
          <Piece id="bignum" caption="Big number · full type treatment, no container" label="+12,450" scale={0.6} />
        </div>
        <div className="kp-subhead">Progress rings & timers — click one to replay it</div>
        <div className="kp-ringrow">
          <Piece id="ring" size="l" caption="Standard" value={0.62} scale={0.56} />
          <Piece id="ring" size="l" caption="Countdown" value={0.72} label="0:42" scale={0.56} ambient />
          <Piece id="ring" size="l" caption="Nearly done" value={0.94} scale={0.56} />
          <Piece id="ring" size="l" caption="Complete" value={1} label="✓" scale={0.56} />
          <Piece id="ring" size="l" caption="Expired" value={0} label="0:00" baseState="disabled" scale={0.56} />
        </div>
      </Sec>

      <Chapter n="03" id="parts" label="Build Parts" blurb="The construction vocabulary: parts, containers, assemblies and motion — with downloads." />

      {/* ── 14 · build parts ── */}
      <Sec n="01" title="Build Parts" note="Everything in the kit is built from these. Each part opens the layer that produces it in the editor. Downloads are layered SVGs with named groups and nine-slice metadata.">
        <div className="kp-dlrow">
          {([["all", "Download full pack"], ["components", "Components"], ["layers", "Material layers"], ["controls", "Control pieces"], ["type", "Typography recipe"], ["assemblies", "Assemblies"]] as const).map(([which, capn]) => (
            <button key={which} onClick={() => {
              const st = useGen.getState();
              const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              const files: { path: string; data: string }[] = [];
              if (which === "all" || which === "layers") layerCards.forEach((lc) => files.push({ path: `build-parts/material-layers/${slug(lc.name)}.svg`, data: lc.svg }));
              if (which === "all" || which === "type") recipe.forEach((r) => files.push({ path: `build-parts/typography-recipe/${slug(r.name)}.svg`, data: r.svg }));
              if (which === "all" || which === "controls") (["slider", "toggle", "progress", "badge", "ring", "slot", "resource", "datarow"] as KitComponentId[]).forEach((cid) =>
                files.push({ path: `build-parts/control-pieces/${cid}.svg`, data: renderKit(applyKitDesign(st.cfg, st.kitDesigns[cid]), cid, "m", "default", undefined, st.kitShapes[cid], { expand: true, row: cid === "datarow" ? st.kitRow : undefined }) }));
              if (which === "all" || which === "assemblies") {
                // containers + the pieces every assembly is composed from,
                // plus a recipe sheet describing the compositions
                (["s", "m", "l"] as const).forEach((sz) =>
                  files.push({ path: `assemblies/containers/panel-${sz}.svg`, data: renderKit(applyKitDesign(st.cfg, st.kitDesigns.panel), "panel", sz, "default", undefined, st.kitShapes.panel, { expand: true }) }));
                (["circle", "oval", "strip"] as const).forEach((kind) =>
                  files.push({ path: `assemblies/containers/panel-${kind}.svg`, data: renderKit(applyKitDesign(st.cfg, st.kitDesigns.panel), "panel", "m", "default", undefined, st.kitShapes.panel, { expand: true, kind }) }));
                ([["header", "banner"], ["tab", "section-tab"], ["datarow", "list-row"], ["resource", "hud-counter"], ["slot", "item-slot"], ["ring", "progress-ring"], ["chip", "stat-chip"], ["badge", "medallion"]] as [KitComponentId, string][]).forEach(([cid, nm]) =>
                  files.push({ path: `assemblies/pieces/${nm}.svg`, data: renderKit(applyKitDesign(st.cfg, st.kitDesigns[cid]), cid, effKitSize(st.kitSizes[cid]), "default", undefined, st.kitShapes[cid], { expand: true, row: cid === "datarow" ? st.kitRow : undefined }) }));
                files.push({
                  path: "assemblies/RECIPES.md",
                  data: [
                    "# Assembly recipes", "",
                    "Assemblies are compositions of registered components — no unique art.",
                    "Rebuild them in any tool by stacking the pieces in this folder:", "",
                    "- Titled panel: panel + tab (top-left, inset 16) + iconbtn (top-right)",
                    "- Confirmation modal: panel-s + header + two buttons, stacked on center axis",
                    "- Toast: chip + small button, right-aligned",
                    "- List row: list-row; selected state = hover render",
                    "- Objective card: tab + medallion + text + progress + chip + small button",
                    "- Reward track: item-slot per milestone, connectors 3px, done = solid",
                    "- Bottom sheet: panel with 18px top radius + handle bar 44×5",
                    "- Waypoint: medallion; the current waypoint adds a 2px pulse ring at +8px",
                  ].join("\n"),
                });
              }
              if (which === "all" || which === "components") KIT_COMPONENTS.forEach(({ id: cid }) =>
                files.push({ path: `components/${cid}.svg`, data: renderKit(applyKitDesign(st.cfg, st.kitDesigns[cid]), cid, effKitSize(st.kitSizes[cid]), "default", undefined, st.kitShapes[cid], { expand: true, textOy: st.kitTextOy[`${cid}:${effKitSize(st.kitSizes[cid])}`], row: cid === "datarow" ? st.kitRow : undefined }) }));
              if (which === "all") {
                files.push({
                  path: "9slice.json",
                  data: JSON.stringify({
                    note: "Fixed-cap insets for stretchable pieces. Values are fractions of the piece's shell height H: the caps are capScale×H px wide and must not stretch; only the center region stretches. content gives the text-safe insets.",
                    silhouettes: SILHOUETTES.map((s) => ({ id: s.id, name: s.name, capScale: s.capScale, content: s.content })),
                  }, null, 2),
                });
                files.push({
                  path: "README.md",
                  data: [
                    "# UI Kit asset pack", "",
                    "Layered SVGs from The UI Generator. Every component keeps named groups —",
                    "cast-shadow, extrusion, shell, face, content, gloss, specular — so Figma", "imports them as a readable layer tree.", "",
                    "## Figma", "Drag any SVG onto the canvas. Ungroup once to reach the named layers.", "",
                    "## Illustrator", "Open directly. You may see 'Clipping will be lost on roundtrip to Tiny' —",
                    "that warning concerns re-SAVING to the SVG Tiny profile; the artwork imports",
                    "completely. The candy face requires one clip group (gloss, pattern and",
                    "speculars must stay inside the face), which is what triggers the notice.", "",
                    "## Nine-slice scaling", "See 9slice.json: caps are fixed (capScale × shell height), centers stretch.",
                    "The `content` insets are the text-safe area used by the generator itself.",
                  ].join("\n"),
                });
              }
              downloadZip(`ui-kit-${which}.zip`, files);
            }}><Download size={12} strokeWidth={2.2} /> {capn}</button>
          ))}
        </div>
        <div className="kp-subhead">Material &amp; structural layers</div>
        <div className="kp-parts">
          {layerCards.map((lc) => (
            <button className="kp-part" key={lc.name} title={`Open ${lc.name} in the editor`} onClick={() => openEditor(lc.sec)}>
              <Art svg={lc.svg} scale={0.26} />
              <span className="kp-partname">{lc.name}</span>
              <Meta items={lc.meta} />
            </button>
          ))}
        </div>
        <div className="kp-subhead">Control pieces</div>
        <div className="kp-tray">
          <Piece id="slider" caption="Track · Fill · Thumb" value={0.62} />
          <Piece id="toggle" caption="Track · Knob" value={1} />
          <Piece id="progress" caption="Fill · Cap" value={0.62} />
          <Piece id="badge" caption="Badge face · rim" label="7" />
        </div>
        <div className="kp-meta">
          <span>Thumb / knob · Fixed, never scales with track</span><span>Track · Stretch X</span>
          <span>Fill · Stretch X, ends at thumb center</span><span>All recolor via the five wells</span>
        </div>
        <div className="kp-subhead">Typography treatment — live layered recipe</div>
        <div className="kp-recipe">
          {recipe.map((r) => (
            <button className="kp-part wide" key={r.name} title="Open Typography in the editor" onClick={() => openEditor("typography")}>
              <Art svg={r.svg} scale={0.3} />
              <span className="kp-partname">{r.name}</span>
            </button>
          ))}
        </div>
      </Sec>

      {/* ── nine-slice & anatomy — the stretch contract, as its own chapter beat ── */}
      <Sec n="02" title="Nine-Slice & Anatomy" note="Corners fixed, edges stretch on one axis, the center stretches on both. Every silhouette ships this contract as data (9slice.json).">
        <p className="kp-note">Every silhouette is procedural three-slice geometry: caps are sized by height and never distort; only the middle stretches. Magenta dashes mark the fixed caps, green marks the text-safe area.</p>
        <div className="kp-slices">
          <SliceDemo cfg={cfg} label="GO" fit={300} />
          <SliceDemo cfg={cfg} label={label} fit={380} />
          <SliceDemo cfg={cfg} label="CONTINUE YOUR ADVENTURE" fit={520} ruler />
        </div>
        <div className="kp-meta">
          <span>Left cap · Fixed</span><span>Center · Stretch X</span><span>Right cap · Fixed</span>
          <span>Panel corners · Fixed</span><span>Panel edges · Stretch</span><span>Panel center · Stretch X/Y</span>
        </div>
        <div className="kp-meta"><span>Corners · fixed</span><span>Edges · stretch one axis</span><span>Center · stretches both</span><span>Text stays inside the green safe area</span></div>
      </Sec>

      {/* ── 15 · motion ── */}
      {/* ── 11 · containers & assemblies ── */}
      <Sec n="03" title="Containers & Assemblies" note="Compound pieces built entirely from registered components — no new materials, no one-off styling. Included in the Build Parts downloads.">
        <div className="kp-subhead">Container shapes</div>
        <div className="kp-tray">
          <Piece id="panel" caption="Container · Panel" size="s" scale={0.4} />
          <Piece id="panel" caption="Container · Round" kind="circle" size="s" scale={0.4} />
          <Piece id="panel" caption="Container · Oval" kind="oval" size="s" scale={0.4} />
          <Piece id="panel" caption="Container · Dialogue strip" kind="strip" size="s" scale={0.4} />
        </div>
        <div className="kp-tray">
          <Piece id="panel" size="s" caption="Panel · S" />
          <Piece id="panel" size="m" caption="Panel · M" />
        </div>
        <div className="kp-patterns kp-assemblies">
          <div className="gp-card">
            <div className="gp-title">Titled panel</div>
            <PPiece id="tab" label="INVENTORY" scale={0.3} />
            <PPiece id="panel" size="s" scale={0.42} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Confirmation modal</div>
            <PPiece id="header" label="ARE YOU SURE?" scale={0.26} />
            <span className="gp-label">This can’t be undone.</span>
            <div className="gp-row center">
              <PPiece id="small" label="YES" scale={0.3} />
              <PPiece id="ghost" label="Cancel" size="s" scale={0.3} />
            </div>
            <PPiece id="iconbtn" icon={STOCK_ICONS.close} scale={0.22} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Toast · Tooltip</div>
            <div className="gp-row center">
              <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.info} scale={0.26} />
              <span className="gp-label">Saved to the cloud</span>
            </div>
            <PPiece id="chip" label="Tooltip text" icon={null} scale={0.3} />
          </div>
          <div className="gp-card">
            <div className="gp-title">List row · Item slot</div>
            <div className="gp-row">
              <PPiece id="iconbtn" icon={STOCK_ICONS.bag} scale={0.24} />
              <span className="gp-label">Mystic Blade</span>
              <PPiece id="iconbtn" icon={STOCK_ICONS.forward} scale={0.2} />
            </div>
            <div className="gp-row center">
              <PPiece id="iconbtn" icon={STOCK_ICONS.gem} scale={0.28} />
              <PPiece id="badge" label="3" scale={0.24} />
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Avatar · Medallion · Stat chips</div>
            <div className="gp-row center">
              <PPiece id="iconbtn" icon={STOCK_ICONS.user} scale={0.28} />
              <PPiece id="badge" baseState="pressed" scale={0.28} />
            </div>
            <div className="gp-row center">
              <PPiece id="chip" label="STR 42" icon={null} scale={0.28} />
              <PPiece id="chip" label="980" icon={STOCK_ICONS.gem} scale={0.28} />
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">HUD strip · Loading</div>
            <div className="gp-row center">
              <PPiece id="chip" label="×3" icon={STOCK_ICONS.heart} scale={0.26} />
              <PPiece id="progress" value={0.62} scale={0.3} ambient />
              <PPiece id="chip" label="980" icon={STOCK_ICONS.gem} scale={0.26} />
            </div>
            <div className="gp-row center">
              <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.refresh} scale={0.24} />
              <span className="gp-label">Loading level…</span>
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Empty state</div>
            <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.search} scale={0.3} />
            <PPiece id="tab" label="NOTHING HERE" scale={0.3} />
            <span className="gp-label">Your collection is waiting to begin.</span>
            <PPiece id="small" label="EXPLORE" scale={0.32} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Error state</div>
            <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.warning} scale={0.3} />
            <PPiece id="tab" label="SOMETHING BROKE" scale={0.3} />
            <span className="gp-label">That didn’t work — try again.</span>
            <div className="gp-row center">
              <PPiece id="small" label="RETRY" scale={0.3} />
              <PPiece id="ghost" label="Back" size="s" scale={0.3} />
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Bottom sheet · collapsed</div>
            <div className="kp-sheet collapsed">
              <span className="kp-handle" />
              <div className="gp-row">
                <span className="gp-label">Squad details</span>
                <PPiece id="iconbtn" icon={STOCK_ICONS.forward} scale={0.18} />
              </div>
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Bottom sheet · expanded</div>
            <div className="kp-sheet">
              <span className="kp-handle" />
              <div className="gp-row"><span className="gp-label">Squad details</span><PPiece id="iconbtn" icon={STOCK_ICONS.close} scale={0.16} /></div>
              <PPiece id="datarow" value={0.4} scale={0.3} />
              <PPiece id="datarow" label="Iron Golem" sub="Level 8 · Tank" value={0.7} scale={0.3} />
              <div className="kp-sheetfoot"><PPiece id="small" label="DEPLOY" scale={0.28} /></div>
            </div>
          </div>
        </div>
      </Sec>

      {/* ── 12 · reward & objectives ── */}
      <Sec n="04" title="Reward Track & Objectives" note="Progression assemblies built from registered components. The track visualizes milestone rewards; objectives drive player progression and grant resources.">
        <div className="kp-subhead">Reward track</div>
        <div className="kp-track3">
          <span className="kp-rail3" aria-hidden="true"><i /><em /></span>
          {([
            ["Claimed", "5,000 XP", "done", <SPiece key="a" id="slot" icon={STOCK_ICONS.check} overlay="check" scale={0.84} />, false],
            ["Claimable", "10,000 XP", "done", <SPiece key="b" id="slot" icon={STOCK_ICONS.bag} overlay="claimable" baseState="hover" scale={0.95} />, true],
            ["Current", "20,000 XP", "current", <SPiece key="c" id="slot" shape="pill" icon={STOCK_ICONS.gem} overlay="new" baseState="hover" scale={1.25} />, false],
            ["Upcoming", "30,000 XP", "next", <SPiece key="d" id="slot" icon={STOCK_ICONS.lock} overlay="locked" scale={0.84} />, false],
            ["Final reward", "50,000 XP", "next", <SPiece key="e" id="slot" icon={STOCK_ICONS.trophy} overlay="locked" scale={1.05} />, false],
          ] as [string, string, string, React.ReactNode, boolean][]).map(([capn, xp, st, node, claim]) => (
            <div className={`kp-tstop3 ${st}`} key={capn}>
              <div className={`kp-tnodezone${st === "current" ? " current" : ""}`}>{node}</div>
              <span className="kp-tstate"><i className={`kp-tdot ${st}`} />{capn}</span>
              <span className="kp-txp">{xp}</span>
              {claim && <SPiece id="primary" label="CLAIM REWARD" scale={0.34} />}
            </div>
          ))}
        </div>
        <div className="kp-progrid">
          <div>
            <div className="kp-subhead">Current objectives</div>
            <p className="kp-note">Complete objectives to earn rewards and XP.</p>
            <div className="kp-objlist">
              {([
                [STOCK_ICONS.play, "Play 3 matches", "Jump into any game mode.", "3 / 3", 1, "done", "+250 XP"],
                [STOCK_ICONS.warning, "Deal 5,000 damage", "Damage enemy players.", "2,850 / 5,000", 0.57, "active", "+400 XP"],
                [STOCK_ICONS.trophy, "Win 1 match", "Achieve victory in any mode.", "0 / 1", 0, "idle", "+350 XP"],
                [STOCK_ICONS.star, "Collect 10 power-ups", "Find or earn power-ups.", "6 / 10", 0.6, "active", "+300 XP"],
              ] as [IconDef, string, string, string, number, string, string][]).map(([ic, t, sub, count, v, st, xp]) => (
                <div className="kp-obj" key={t}>
                  <span className="kp-objic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: previewSvg(ic, 22) }} />
                  <div className="kp-objtext"><b>{t}</b><span>{sub}</span></div>
                  <div className="kp-objprog">
                    <span className={`kp-objcount${st === "done" ? " done" : ""}`}>{count}</span>
                    <SPiece id="progress" value={v} scale={0.34} />
                  </div>
                  <span className={`kp-objstate ${st}`}>{st === "done" ? "✓ Completed" : st === "active" ? "In progress" : "Not started"}</span>
                  <Art svg={xpArts.get(xp) ?? renderTypeSpecimen(cfg, xp)} scale={0.34} className="kp-objxp" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="kp-subhead">Weekly bonus</div>
            <p className="kp-note">Complete objectives all week to earn a bonus reward.</p>
            <div className="kp-weekly">
              <span className="sc-caption dim">WEEKLY STREAK</span>
              <div className="kp-wkbig"><b>4</b><span>/ 7 days</span></div>
              <div className="kp-wkdays">
                {(["M", "T", "W", "T", "F", "S", "S"] as const).map((d, i) => (
                  <div className="kp-wkday" key={d + i}>
                    <SPiece id="checkbox" value={i < 4 ? 1 : 0} scale={0.54} />
                    <span>{d}</span>
                  </div>
                ))}
              </div>
              <div className="kp-wkline" />
              <span className="sc-caption dim">BONUS REWARD</span>
              <div className="kp-wkreward">
                <SPiece id="badge" size="l" baseState="pressed" icon={STOCK_ICONS.gem} scale={0.56} />
                <SPiece id="chip" label="+1,000 XP" icon={null} scale={0.46} />
              </div>
            </div>
          </div>
        </div>
        <div className="kp-meta">
          <span>Composed from: Track rail</span><span>Milestone node (item slot)</span><span>Objective item</span><span>Reward chip</span><span>Status badge</span><span>Weekly panel</span>
        </div>
      </Sec>

      {/* ── 13 · onboarding & map ── */}
      <Sec n="05" title="Onboarding & Map" note="Tutorial and map primitives. The spotlight and ring point at components without changing them.">
        <div className="kp-patterns kp-assemblies">
          <div className="gp-card">
            <div className="gp-title">Speech bubble · coachmark</div>
            <div className="kp-bubblerow">
              <PPiece id="iconbtn" icon={STOCK_ICONS.user} scale={0.26} />
              <div className="kp-bubble">Tap the glowing button to start your first quest!</div>
            </div>
            <div className="kp-coach">
              <span className="kp-step">1 / 3</span>
              <span className="gp-label">This is your energy meter.</span>
              <div className="gp-row center">
                <PPiece id="small" label="NEXT" scale={0.26} />
                <PPiece id="ghost" label="Skip" size="s" scale={0.24} />
              </div>
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Spotlight · target ring</div>
            <div className="kp-dim">
              {/* the ring IS the treatment — it points at any registered
                  component without wrapping or altering it */}
              <span className="kp-spot pure">
                <span className="kp-ringpulse" />
                <span className="kp-spothole" />
              </span>
              <span className="kp-pointer">▲</span>
              <span className="gp-label">The ring targets any component — nothing is nested inside it</span>
            </div>
            <div className="kp-dim">
              <span className="kp-locpin"><span className="kp-ringpulse" /><span className="kp-locdot" /></span>
              <span className="gp-label">Current-location marker</span>
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Waypoints · connectors</div>
            <div className="kp-map">
              <span className="kp-line done" />
              <span className="kp-line" />
              <div className="kp-nodes">
                <div className="kp-node"><PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.check} scale={0.24} /><span>Done</span></div>
                <div className="kp-node sel"><span className="kp-ringpulse" /><PPiece id="badge" label="4" scale={0.26} baseState="hover" /><span>Current</span></div>
                <div className="kp-node"><PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.lock} scale={0.24} /><span>Locked</span></div>
              </div>
              <div className="gp-row center">
                <PPiece id="iconbtn" icon={STOCK_ICONS.search} scale={0.18} />
                <PPiece id="iconbtn" icon={STOCK_ICONS.home} scale={0.18} />
              </div>
            </div>
          </div>
        </div>
      </Sec>

      <Sec n="06" title="Motion" note="Parameterized behaviors that apply to any piece. Click a card to replay it. Reduced-motion preference disables all of them.">
        <div className="kp-motion">
          {([
            ["Attention pulse", "mo-pulse", { id: "small" as KitComponentId, label: "CLAIM" }, "Draw the eye to an idle action", "1.26s", "ease-in-out, loops"],
            ["Bounce", "mo-bounce", { id: "badge" as KitComponentId, baseState: "pressed" as GenStateName }, "Celebrate a small win", "0.90s", "spring 0.3 / 1.6"],
            ["Glow cycle", "mo-glow", { id: "chip" as KitComponentId, label: "+500", icon: STOCK_ICONS.gem }, "Ambient shimmer on claimables", "1.98s", "ease-in-out, loops"],
            ["Error shake", "mo-shake", { id: "input" as KitComponentId, label: "Wrong code" }, "Reject an input without a dialog", "0.54s", "ease-in-out"],
            ["Reward pop", "mo-pop", { id: "slot" as KitComponentId, icon: STOCK_ICONS.gem, overlay: "claimable" }, "Reveal a claimable reward", "0.63s", "overshoot 0.2 / 1.8"],
            ["Press compression", "mo-press", { id: "small" as KitComponentId, label: "GO" }, "Tactile press acknowledgement", "0.45s", "ease-out"],
            ["Notification entrance", "mo-slidein", { id: "resource" as KitComponentId, label: "+50" }, "Bring a counter update in from the edge", "0.63s", "decelerate"],
            ["Panel slide", "mo-rise", { id: "tab" as KitComponentId, label: "NEW QUEST" }, "Raise a sheet or panel into view", "0.63s", "decelerate"],
          ] as [string, string, PieceOpts, string, string, string][]).map(([name, cls, piece, purpose, dur, ease]) => (
            <MotionDemo key={cls} name={name} cls={cls} piece={piece} purpose={purpose} dur={dur} ease={ease} />
          ))}
        </div>
        <div className="kp-meta"><span>Durations scale with --mo-dur</span><span>Magnitude scales with --mo-mag</span><span>prefers-reduced-motion disables every behavior</span></div>
      </Sec>

      {/* ── proof of system — the chapter's conclusion ── */}
      <Sec n="07" title="Proof of System" note="The Objective Card as a full game screen, assembled only from registered parts. If the rules hold here, they hold for anything you build.">
        <div className="kp-proof" style={{
          backgroundImage: [
            `radial-gradient(ellipse 70% 90% at 82% 20%, ${hexMix(cfg.effects.Bevel ?? "#0E9CC9", dark ? "#05060C" : "#EDF0F8", 0.55)}, transparent 70%)`,
            `radial-gradient(ellipse 60% 80% at 10% 85%, ${hexMix(cfg.effects.Glow ?? "#8FF0FF", dark ? "#05060C" : "#EDF0F8", 0.6)}, transparent 72%)`,
            `linear-gradient(170deg, var(--st-bg1), var(--st-bg2) 75%)`,
          ].join(", "),
        }}>
          <div className="kp-proofcard">
            <div className="kp-prhead">
              <SPiece id="header" label="DAILY OBJECTIVE" scale={0.4} />
              <span className="lay-spring" />
              <span className="kp-prcap">Time remaining</span>
              <SPiece id="chip" label="14H 37M" icon={null} tone="alt" scale={0.36} />
              <SPiece id="iconbtn" icon={STOCK_ICONS.close} scale={0.3} />
            </div>
            <div className="kp-prmain">
              <div className="kp-prleft">
                <div className="kp-prtitle">
                  <SPiece id="badge" baseState="pressed" icon={STOCK_ICONS.trophy} scale={0.5} />
                  <div>
                    <h3>Win 3 matches in ranked mode</h3>
                    <p>Compete in ranked matches and secure 3 victories to earn your reward.</p>
                  </div>
                </div>
                <span className="kp-prcap">Progress</span>
                <div className="kp-prprog">
                  <SPiece id="progress" value={0.66} ambient scale={0.5} />
                  <b>2 / 3</b>
                </div>
              </div>
              <div className="kp-prrewards">
                <span className="kp-prcap">Rewards</span>
                <div className="kp-prrgrid">
                  <div className="kp-prreward"><SPiece id="slot" icon={STOCK_ICONS.gem} overlay="claimable" scale={0.5} /><b>+250</b><span>gems</span></div>
                  <div className="kp-prreward"><SPiece id="slot" icon={STOCK_ICONS.bag} overlay="count:1" scale={0.5} /><b>Premium crate</b><span>×1</span></div>
                </div>
              </div>
            </div>
            <div className="kp-prtrack">
              <span className="kp-prcap">Milestone tracker</span>
              <div className="kp-prstops">
                {([
                  ["1 win", "50 gems", "done", <SPiece key="1" id="checkbox" scale={0.3} />],
                  ["2 wins", "100 gems", "done", <SPiece key="2" id="checkbox" scale={0.3} />],
                  ["3 wins", "250 + crate", "current", <SPiece key="3" id="badge" baseState="pressed" icon={STOCK_ICONS.trophy} scale={0.4} />],
                  ["5 wins", "500 gems", "next", <SPiece key="5" id="slot" size="s" icon={STOCK_ICONS.lock} overlay="locked" scale={0.32} />],
                  ["7 wins", "Legendary crate", "next", <SPiece key="7" id="slot" size="s" icon={STOCK_ICONS.lock} overlay="locked" scale={0.32} />],
                ] as [string, string, string, React.ReactNode][]).map(([w, prize, st, node], i) => (
                  <div className={`kp-prstop ${st}`} key={w}>
                    {i > 0 && <span className={`kp-prconn ${st === "next" ? "pending" : "done"}`} />}
                    <div className="kp-prnode">{node}</div>
                    <b>{w}</b><span>{prize}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="kp-prfoot">
              <SPiece id="ghost" label="OBJECTIVES" size="s" scale={0.4} />
              <SPiece id="primary" label="CLAIM REWARD" scale={0.56} />
              <SPiece id="ghost" label="SHARE" size="s" scale={0.4} />
            </div>
          </div>
        </div>
        <div className="kp-meta">
          <span>Built entirely from: Foundations (color, type, material)</span><span>Components (buttons, slots, progress)</span><span>Assemblies (banner, tracker, rewards)</span><span>System rules (spacing, radius, glow)</span><span>Backdrop: blurred tints derived from the kit's own color roles</span>
        </div>
      </Sec>

      <Chapter n="04" id="patterns" label="Screen Patterns" blurb="Complete screens composed from the system." />

      {/* ── 16 · patterns — editorial case study, three meaningful groups ── */}
      <Sec n="01" title="Screen Patterns" wide note="Complete interface compositions built entirely from registered kit components. Every pattern remains live, editable, and connected to the same underlying design system.">
        <nav className="pat-tabs" aria-label="Pattern groups">
          {([["all", "All"], ["core", "Core Screens"], ["outcome", "Feedback & Outcomes"], ["state", "Empty & Error"]] as const).map(([id, name]) => (
            <button key={id} className={patTab === id ? "on" : ""} aria-pressed={patTab === id}
              onClick={() => setPatTab(id)}>{name}</button>
          ))}
        </nav>

        {(patTab === "all" || patTab === "core") && (
          <div className="pat-group">
            <div className="pat-ghead">
              <h3>Core Screens</h3>
              <p>Primary navigation, account and system management screens.</p>
            </div>
            <div className="pat-grid">
              <Pat n="01" name="Main Menu" cat="Core Screen" comps={7} asms={3} lead="primary">
                <Art svg={menuArt} scale={0.46} />
                <SPiece id="primary" label="PLAY" scale={0.46} />
                <div className="sc-stack">
                  <SPiece id="small" label="OPTIONS" scale={0.36} />
                  <SPiece id="small" label="STORE" scale={0.36} />
                </div>
                <div className="sc-row sc-util sc-push">
                  <SPiece id="chip" label="980" icon={STOCK_ICONS.gem} scale={0.32} />
                  <SPiece id="iconbtn" icon={STOCK_ICONS.gear} scale={0.28} />
                  <SPiece id="badge" label="3" scale={0.26} />
                </div>
              </Pat>
              <Pat n="02" name="Sign In" cat="Core Screen" comps={5} asms={2} lead="input">
                <SPiece id="header" label="WELCOME BACK" scale={0.34} />
                <span className="sc-caption dim">Sign in to keep your progress.</span>
                <div className="sc-stack sc-push">
                  <SPiece id="input" label="Username" scale={0.38} />
                  <SPiece id="input" label="Password" scale={0.38} />
                </div>
                <SPiece id="primary" label="SIGN IN" size="s" scale={0.4} />
                <div className="sc-push"><SPiece id="ghost" label="Forgot password?" size="s" scale={0.32} /></div>
              </Pat>
              <Pat n="03" name="Settings" cat="Core Screen" comps={6} asms={2} lead="slider">
                <SPiece id="header" label="SETTINGS" scale={0.32} />
                <div className="sc-form sc-push">
                  <div className="sc-set"><span className="sc-lab">Music</span><SPiece id="slider" value={0.8} scale={0.32} /></div>
                  <div className="sc-set"><span className="sc-lab">Sound FX</span><SPiece id="slider" value={0.55} scale={0.32} /></div>
                  <div className="sc-set"><span className="sc-lab">Haptics</span><SPiece id="toggle" value={1} scale={0.26} /></div>
                  <div className="sc-set"><span className="sc-lab">Notifications</span><SPiece id="toggle" value={0} scale={0.26} /></div>
                </div>
                <div className="sc-push"><SPiece id="small" label="DONE" scale={0.34} /></div>
              </Pat>
              <Pat n="04" name="Profile" cat="Core Screen" comps={4} asms={3} lead="progress">
                <div className="sc-row sc-id">
                  <SPiece id="iconbtn" icon={STOCK_ICONS.user} scale={0.44} />
                  <div className="sc-idcol">
                    <span className="sc-name">PLAYER ONE</span>
                    <SPiece id="chip" label="LV 24" icon={STOCK_ICONS.star} scale={0.3} />
                  </div>
                </div>
                <div className="sc-form sc-push">
                  <div className="sc-between"><span className="sc-lab">XP</span><span className="sc-caption dim">3,450 / 5,000</span></div>
                  <SPiece id="progress" value={0.69} ambient scale={0.42} />
                </div>
                <div className="sc-push"><SPiece id="small" label="EDIT PROFILE" scale={0.38} /></div>
              </Pat>
              <Pat n="05" name="Reward" cat="Core Screen" comps={4} asms={2} lead="badge">
                <SPiece id="header" label="LEVEL UP!" scale={0.38} />
                <div className="sc-push"><SPiece id="badge" size="l" baseState="pressed" icon={STOCK_ICONS.star} scale={0.72} /></div>
                <SPiece id="chip" label="+250" icon={STOCK_ICONS.gem} scale={0.42} />
                <div className="sc-push"><SPiece id="primary" label="CLAIM REWARD" size="s" scale={0.44} /></div>
              </Pat>
              <Pat n="06" name="Purchase" cat="Core Screen" comps={5} asms={3} lead="segment">
                <SPiece id="header" label="STORE" scale={0.3} />
                <div className="sc-push"><SPiece id="segment" segments={["500", "1,200", "2,500"]} value={1} scale={0.42} /></div>
                <div className="sc-row">
                  <SPiece id="chip" label="1,200" icon={STOCK_ICONS.gem} scale={0.34} />
                  <span className="sc-caption dim">for</span>
                  <SPiece id="chip" label="$4.99" icon={null} scale={0.34} />
                </div>
                <SPiece id="primary" label="BUY NOW" size="s" scale={0.38} />
                <SPiece id="ghost" label="Cancel" size="s" scale={0.3} />
              </Pat>
            </div>
          </div>
        )}

        {(patTab === "all" || patTab === "outcome") && (
          <div className="pat-group">
            <div className="pat-ghead">
              <h3>Feedback &amp; Outcomes</h3>
              <p>System feedback, progress and end-state compositions.</p>
            </div>
            <div className="pat-grid three">
              <Pat n="07" name="Confirmation" cat="Outcome Screen" comps={3} asms={1} lead="small">
                <div className="sc-modal">
                  <SPiece id="header" label="ARE YOU SURE?" scale={0.26} />
                  <span className="sc-caption">Quitting now will forfeit the match.</span>
                  <div className="sc-row sc-push">
                    <SPiece id="small" label="CONFIRM" scale={0.36} />
                    <SPiece id="ghost" label="Cancel" size="s" scale={0.34} />
                  </div>
                </div>
              </Pat>
              <Pat n="08" name="Loading" cat="Outcome Screen" comps={2} asms={1} lead="progress">
                <Art svg={loadingArt} scale={0.32} />
                <SPiece id="progress" value={0.72} ambient scale={0.48} />
                <span className="sc-caption dim sc-push">Tip: locked doors remember you.</span>
              </Pat>
              <Pat n="09" name="Results — Victory" cat="Outcome Screen" comps={4} asms={2} lead="primary">
                <Art svg={splashArt} scale={0.28} />
                <div className="sc-cluster sc-push">
                  <span className="sc-caption dim">Score</span>
                  <SPiece id="resource" label="12,450" icon={STOCK_ICONS.trophy} scale={0.46} />
                </div>
                <div className="sc-row sc-push">
                  <SPiece id="primary" label="CONTINUE" size="s" scale={0.38} />
                  <SPiece id="ghost" label="Replay" size="s" scale={0.34} />
                </div>
              </Pat>
            </div>
          </div>
        )}

        {(patTab === "all" || patTab === "state") && (
          <div className="pat-group">
            <div className="pat-ghead">
              <h3>Empty &amp; Error States</h3>
              <p>Empty, offline and error handling — one template, two intents.</p>
            </div>
            <div className="pat-grid">
              <Pat n="10" name="Empty State" cat="State Screen" comps={4} asms={1} lead="small">
                <StateScreen icon={STOCK_ICONS.search} title="NO ITEMS YET" line="Complete levels to fill your bag." action="BROWSE STORE" />
              </Pat>
              <Pat n="11" name="Connection Error" cat="State Screen" comps={4} asms={1} lead="small">
                <StateScreen icon={STOCK_ICONS.warning} title="CONNECTION LOST" line="We can’t reach the server." action="RETRY" />
              </Pat>
            </div>
          </div>
        )}
      </Sec>

      {/* ── layout starters — everything working together, at device scale ── */}
      <Sec n="02" title="Layout Starters" wide note="Full screens at true device proportions — idea starters showing the system working together. Remove any you don't want; they're starters, not rules.">
        {hiddenLays.length > 0 && (
          <button className="pat-open kp-layrestore" onClick={() => hideLay("*reset*")}>Restore {hiddenLays.length} removed starter{hiddenLays.length > 1 ? "s" : ""}</button>
        )}
        <div className="lay-grid">
          {!hiddenLays.includes("inventory") && (
            <LayoutCard id="inventory" name="Inventory" device="Desktop 16:9" onHide={hideLay}>
              <div className="lay-row lay-bar">
                <SPiece id="resource" label="12,480" icon={STOCK_ICONS.gem} scale={0.4} />
                <SPiece id="resource" label="4" max="5" icon={STOCK_ICONS.heart} scale={0.4} />
                <span className="lay-spring" />
                <SPiece id="iconbtn" icon={STOCK_ICONS.gear} scale={0.46} />
              </div>
              <div className="lay-row lay-fill">
                <div className="lay-col">
                  <SPiece id="tab" label="WEAPONS" scale={0.4} />
                  <div className="lay-row">
                    <SPiece id="slot" icon={STOCK_ICONS.gem} overlay="level:3" scale={0.4} />
                    <SPiece id="slot" icon={STOCK_ICONS.bag} overlay="count:14" scale={0.4} />
                    <SPiece id="slot" icon={STOCK_ICONS.heart} overlay="equipped" scale={0.4} />
                  </div>
                  <div className="lay-row">
                    <SPiece id="slot" icon={STOCK_ICONS.trophy} overlay="new" scale={0.4} />
                    <SPiece id="slot" overlay="empty" scale={0.4} />
                    <SPiece id="slot" icon={STOCK_ICONS.gem} overlay="locked" scale={0.4} />
                  </div>
                </div>
                <div className="lay-col">
                  <SPiece id="datarow" scale={0.42} value={0.4} />
                  <SPiece id="datarow" label="Iron Golem" sub="Level 8 · Tank" value={0.7} scale={0.42} />
                  <div className="sc-push"><SPiece id="primary" label="EQUIP" size="s" scale={0.44} /></div>
                </div>
              </div>
            </LayoutCard>
          )}
          {!hiddenLays.includes("fight") && (
            <LayoutCard id="fight" name="Fight Screen" device="Desktop 16:9" onHide={hideLay}>
              <div className="lay-row lay-bar">
                <SPiece id="progress" value={0.82} scale={0.42} />
                <SPiece id="resource" label="48" icon={null} scale={0.38} />
                <SPiece id="progress" value={0.55} scale={0.42} />
              </div>
              <div className="lay-row lay-mid">
                <SPiece id="tab" label="ROUND 2" tone="alt" scale={0.4} />
              </div>
              <div className="lay-row lay-foot">
                <SPiece id="joystick" size="s" scale={0.44} />
                <span className="lay-spring" />
                <SPiece id="iconbtn" icon={STOCK_ICONS.close} scale={0.4} />
                <SPiece id="iconbtn" icon={STOCK_ICONS.play} scale={0.46} />
              </div>
            </LayoutCard>
          )}
          {!hiddenLays.includes("runner") && (
            <LayoutCard id="runner" name="Endless Runner" device="Mobile landscape" onHide={hideLay}>
              <div className="lay-row lay-bar">
                <SPiece id="resource" label="1,204" icon={STOCK_ICONS.gem} scale={0.38} />
                <span className="lay-spring" />
                <SPiece id="chip" label="×3" icon={STOCK_ICONS.star} scale={0.46} />
                <SPiece id="iconbtn" icon={STOCK_ICONS.pause} scale={0.34} />
              </div>
              <div className="lay-row lay-mid"><span className="sc-caption dim">tap to jump · hold to glide</span></div>
              <div className="lay-row lay-foot"><SPiece id="progress" value={0.36} ambient scale={0.42} /></div>
            </LayoutCard>
          )}
          {!hiddenLays.includes("word") && (
            <LayoutCard id="word" name="Word Game" device="Mobile portrait" onHide={hideLay}>
              <SPiece id="header" label="WORD RUSH" scale={0.32} />
              <div className="lay-row">
                <SPiece id="slot" icon={null} overlay="count:A" scale={0.34} />
                <SPiece id="slot" icon={null} overlay="count:R" scale={0.34} />
                <SPiece id="slot" icon={null} overlay="count:T" scale={0.34} />
              </div>
              <SPiece id="input" label="Type a word…" scale={0.46} />
              <div className="sc-push"><SPiece id="primary" label="SUBMIT" size="s" scale={0.38} /></div>
              <SPiece id="progress" value={0.62} ambient scale={0.46} />
            </LayoutCard>
          )}
          {!hiddenLays.includes("match3") && (
            <LayoutCard id="match3" name="Match-3" device="Mobile portrait" onHide={hideLay}>
              <div className="lay-row lay-bar">
                <SPiece id="resource" label="27" icon={STOCK_ICONS.heart} scale={0.34} />
                <SPiece id="resource" label="900" icon={STOCK_ICONS.gem} scale={0.34} />
              </div>
              <div className="lay-row">
                <SPiece id="slot" size="s" icon={STOCK_ICONS.gem} scale={0.34} />
                <SPiece id="slot" size="s" icon={STOCK_ICONS.heart} scale={0.34} />
                <SPiece id="slot" size="s" icon={STOCK_ICONS.star} scale={0.34} />
              </div>
              <div className="lay-row">
                <SPiece id="slot" size="s" icon={STOCK_ICONS.star} scale={0.34} />
                <SPiece id="slot" size="s" icon={STOCK_ICONS.gem} overlay="new" scale={0.34} />
                <SPiece id="slot" size="s" icon={STOCK_ICONS.heart} scale={0.34} />
              </div>
              <div className="sc-push"><SPiece id="progress" value={0.44} ambient scale={0.46} /></div>
              <SPiece id="chip" label="LEVEL 12" icon={null} scale={0.34} />
            </LayoutCard>
          )}
        </div>
      </Sec>

      <Chapter n="05" id="resources" label="Resources" blurb="Files, formats and integration notes." />

      <Sec n="01" title="Export & Integration" note="Layered SVG first — Figma reads the named groups directly. Category downloads sit with Build Parts above; engine sprite kits export from the toolbar.">
        <SpecList rows={[
          ["Figma", "Drop any exported SVG on the canvas; ungroup once for the layer tree (shadow, extrusion, shell, face, content, gloss)"],
          ["Illustrator", "Opens directly. The SVG-Tiny clipping notice concerns re-saving only; imports are complete"],
          ["Engines", "Sprite-sheet kit with per-state rects and 9-slice borders — Unity Sprite Editor and Unreal UMG shapes"],
          ["Nine-slice", "Caps are capScale × shell height and never stretch; content gives the text-safe insets (9slice.json)"],
          ["Settings", "The whole design as portable JSON — re-import it or share it as a team default"],
        ]} />
        <div className="kp-links">
          <a target="_blank" rel="noreferrer"
            href={`https://github.com/google/fonts/tree/main/ofl/${T.font.toLowerCase().replace(/[^a-z0-9]/g, "")}`}>{T.font} on GitHub ↗</a>
          <a target="_blank" rel="noreferrer"
            href={`https://fonts.google.com/specimen/${encodeURIComponent(T.font).replace(/%20/g, "+")}`}>Google Fonts ↗</a>
          <a href="#settings" onClick={(e) => { e.preventDefault(); downloadSettings(cfg); }}>Download settings JSON ↓</a>
        </div>
      </Sec>

      <footer className="kp-foot">The UI Generator Design System · five levels, one material recipe, one renderer, zero mockups.</footer>
    </div>
  );
}
