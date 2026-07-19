import { useMemo, useState } from "react";
import { Download, Lock, PenTool, SquarePen } from "lucide-react";
import { useGen } from "@/generator/store";
import { EFFECT_ROLES, KIT_COMPONENTS, PRESETS, ROLE_HINT, SHAPES, SPECULAR_MODES, STOCK_ICONS, PATTERN_TYPES, applyKitDesign, fontByName } from "@/generator/model";
import type { GenConfig, GenStateName, IconDef, KitComponentId, KitSize } from "@/generator/model";
import { renderBevel, renderKit, renderTypeSpecimen } from "@/generator/bevel";
import { silhouetteMeta } from "@/generator/silhouettes";
import { previewSvg } from "@/generator/icons";
import { downloadSvg } from "@/generator/exportUtils";
import { LiveArt } from "./LiveArt";

/* The Kit — a living guideline sheet in five levels: Foundations, Components,
   Assemblies, Build Parts, Screen Patterns. One renderer draws everything,
   every example is live, and every piece opens in the editor. */

const PIECE_SCALE = 0.5;
const PATTERN_SCALE = 0.34;

const clone = (c: GenConfig) => JSON.parse(JSON.stringify(c)) as GenConfig;

/** Static art (type specimens, layer cards) at a uniform physical scale. */
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
}

/** Shared plumbing for every live piece on this page. The page is always
 *  alive — clicking a piece plays it; editing goes through the ✎ button. */
function usePiece(p: PieceOpts) {
  const { cfg, kitShapes, kitSizes, kitDesigns, kitTextOy, setFocus, setKitSize } = useGen();
  // an explicit size (the Primary ramp) is fixed; everything else follows the
  // per-component size the user picks with the caption's S/M/L chips
  const size = p.size ?? kitSizes[p.id] ?? "m";
  return {
    // a locked component renders its own snapshot, not the master's style
    cfg: applyKitDesign(cfg, kitDesigns[p.id]),
    locked: !!kitDesigns[p.id],
    size, setKitSize,
    sizable: p.size === undefined,
    name: KIT_COMPONENTS.find((c) => c.id === p.id)?.name ?? p.id,
    kit: {
      id: p.id, size, shape: kitShapes[p.id], label: p.label, segments: p.segments,
      icon: p.icon, value: p.value, baseState: p.baseState,
      // explicit per-component vertical text adjustment (0 is a valid value)
      textOy: kitTextOy[`${p.id}:${size}`],
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
            {(["s", "m", "l"] as const).map((s) => (
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
      kit={kit} title={name} ambient={p.ambient} />
  );
}

function Sec({ n, title, anchor, note, children }: { n: string; title: string; anchor?: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="kp-sec" data-anchor={anchor}>
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

/** Chapter divider — one of the kit's five levels. */
function Chapter({ id, label, blurb }: { id: string; label: string; blurb: string }) {
  return (
    <div className="kp-chapter" id={`chap-${id}`}>
      <span className="kp-chapline" />
      <span className="kp-chapname">{label}</span>
      <span className="kp-chapblurb">{blurb}</span>
    </div>
  );
}

/** Small metadata chips under a Build Part. */
function Meta({ items }: { items: string[] }) {
  return <div className="kp-meta">{items.map((m) => <span key={m}>{m}</span>)}</div>;
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

/* jump into the editor with a section opened — Build Parts are editable by
   opening the layer that produces them */
function openEditor(sec: string) {
  useGen.setState((st) => ({ open: { ...st.open, [sec]: true }, phase: "master" }));
  window.setTimeout(() => document.querySelector(`[data-sec="${sec}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
}

/** Banner rendered with its three-slice guides: fixed caps, stretch middle,
 *  text-safe area — computed from the real silhouette metadata. */
function SliceDemo({ cfg, label, size = "m" }: { cfg: GenConfig; label: string; size?: KitSize }) {
  const { kitShapes } = useGen();
  const shape = kitShapes.header ?? "banner";
  const met = silhouetteMeta(shape);
  const svg = useMemo(() => renderKit(cfg, "header", size, "default", undefined, kitShapes.header, { label }), [cfg, label, size, kitShapes.header]);
  const geo = useMemo(() => {
    const m = svg.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/);
    if (!m || !met) return null;
    const pad = -+m[1], total = +m[3];
    const h = 158 * ({ s: 0.72, m: 1, l: 1.22 } as const)[size];
    const shellW = total - pad * 2 - 104; // x margin 52 each side
    const cap = met.capScale * h, safe = met.content.left * h;
    const x0 = pad + 52;
    return {
      capL: ((x0 + cap) / total) * 100, capR: ((x0 + shellW - cap) / total) * 100,
      safeL: ((x0 + safe) / total) * 100, safeR: ((x0 + shellW - safe) / total) * 100,
    };
  }, [svg, met, size]);
  return (
    <div className="kp-slice">
      <Art svg={svg} scale={0.44} />
      {geo && (
        <>
          <span className="kp-guide cap" style={{ left: `${geo.capL}%` }} />
          <span className="kp-guide cap" style={{ left: `${geo.capR}%` }} />
          <span className="kp-guide safe" style={{ left: `${geo.safeL}%` }} />
          <span className="kp-guide safe" style={{ left: `${geo.safeR}%` }} />
        </>
      )}
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
  const { cfg, kitDesigns, setPhase } = useGen();
  const dark = cfg.canvas === "#1C1D22" || cfg.canvas === "#000000";
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
    T.stripes?.on && "Stripes", T.inflate?.on && "Inflate",
  ].filter(Boolean) as string[];
  const caseName = { none: "As typed", upper: "Uppercase", lower: "Lowercase", title: "Title Case" }[T.case];

  // splash text — a real editable instance of the display-text component
  const [splash, setSplash] = useState("SWEET VICTORY");
  const [splashHi, setSplashHi] = useState("VICTORY");
  const splashArt = useMemo(() => renderTypeSpecimen(cfg, splash, { highlight: splashHi }), [cfg, splash, splashHi]);

  const specimen = useMemo(() => renderTypeSpecimen(cfg, label), [cfg, label]);
  const loadingArt = useMemo(() => renderTypeSpecimen(cfg, "LOADING"), [cfg]);
  const alphaUp = useMemo(() => renderTypeSpecimen(cfg, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", { keepCase: true }), [cfg]);
  const alphaLo = useMemo(() => renderTypeSpecimen(cfg, "abcdefghijklmnopqrstuvwxyz", { keepCase: true }), [cfg]);
  const digits = useMemo(() => renderTypeSpecimen(cfg, "0123456789 ! ? & % + × / : . , ’ “ ” ( ) [ ]", { keepCase: true }), [cfg]);

  // typography recipe — the current treatment as a live layered stack
  const recipe = useMemo(() => {
    const offAll = (c: GenConfig) => {
      c.type.outline.on = false; c.type.shadow.on = false; c.type.emboss.on = false;
      c.type.glow.on = false; c.type.stripes = { on: false, angle: 45, opacity: 30 };
      c.type.inflate = { on: false, strength: 55 }; c.type.highlight = "";
    };
    const layers: { name: string; on: (c: GenConfig) => void }[] = [{ name: "Live base text · face fill", on: () => {} }];
    if (T.outline.on) layers.push({ name: "+ Outline", on: (c) => { c.type.outline.on = true; } });
    if (T.shadow.on) layers.push({ name: "+ Shadow", on: (c) => { c.type.shadow.on = true; } });
    if (T.emboss.on) layers.push({ name: T.emboss.strength < 0 ? "+ Deboss relief" : "+ Emboss relief", on: (c) => { c.type.emboss.on = true; } });
    if (T.glow.on) layers.push({ name: "+ Glow", on: (c) => { c.type.glow.on = true; } });
    if (T.stripes?.on) layers.push({ name: "+ Stripe mask", on: (c) => { c.type.stripes!.on = true; } });
    if (T.inflate?.on) layers.push({ name: "+ Inflate highlight", on: (c) => { c.type.inflate!.on = true; } });
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
      <button className="makekit kitback" onClick={() => setPhase("master")} title="Back to the component editor">
        <PenTool size={14} strokeWidth={2} /> Edit master
      </button>

      {/* ── intro ── */}
      <header className="kp-hero">
        <div className="kp-eyebrow">PatternBreak · UI Guidelines</div>
        <h1 className="kp-title">The {preset?.name ?? "Custom"} Kit</h1>
        <p className="kp-sub">
          {sil} silhouette · {T.font} · one material recipe at five scales: foundations, finished components,
          assemblies, Build Parts for constructing new assets, and complete screen patterns.
          Everything is live — press, drag, flip, open — and everything stays editable via the ✎ next to its name.
        </p>
        <div className="kp-dots" aria-hidden="true">
          {roles.map((r) => <span key={r} style={{ background: cfg.effects[r] }} />)}
        </div>
        <nav className="kp-chapnav" aria-label="Kit chapters">
          {[["foundations", "Foundations"], ["components", "Components"], ["assemblies", "Assemblies"], ["parts", "Build Parts"], ["patterns", "Screen Patterns"]].map(([id, name]) => (
            <button key={id} onClick={() => document.getElementById(`chap-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{name}</button>
          ))}
        </nav>
      </header>

      <Chapter id="foundations" label="Foundations" blurb="the tokens and type everything else inherits" />

      {/* ── 01 · style tokens ── */}
      <Sec n="01" title="Style" note="Five wells drive every layer of the shell — repaint them in Color and the whole page follows.">
        <div className="kp-swatches">
          {roles.map((r) => (
            <div className="kp-swatch" key={r}>
              <span className="kp-chip" style={{ background: cfg.effects[r] }} />
              <span className="kp-swname">{r}</span>
              <span className="kp-swhex">{cfg.effects[r]?.toUpperCase()}</span>
              <span className="kp-swhint">{ROLE_HINT[r]}</span>
            </div>
          ))}
        </div>
        <div className="kp-specrow">
          <span>Face <b>{cfg.face.mode === "dark" ? "Dark" : "Light"}</b></span>
          <span>Wall <b>{cfg.bevel.width}px</b></span>
          <span>Extrusion <b>{cfg.candy.extrusion.depth}px</b></span>
          <span>Key light <b>{cfg.lighting.angle}°</b></span>
          <span>Gloss <b>{cfg.candy.gloss.on ? `${cfg.candy.gloss.opacity}%` : "Off"}</b></span>
          <span>Specular <b>{cfg.candy.specular.on ? specularName : "Off"}</b></span>
          <span>Pattern <b>{patternName}</b></span>
        </div>
      </Sec>

      {/* ── 02 · typography ── */}
      <Sec n="02" title="Typography" note="One face, one treatment — every label on this page inherits it. All of it is live text; nothing is outlined or rasterized.">
        <div className="kp-typo">
          <Art svg={specimen} scale={0.62} />
          <Art svg={alphaUp} scale={0.4} />
          <Art svg={alphaLo} scale={0.4} />
          <Art svg={digits} scale={0.4} />
        </div>
        <div className="kp-specrow">
          <span>Font <b>{T.font}</b></span>
          <span>Weight <b>{caps?.wght ? `${T.weight} (var ${caps.wght[0]}–${caps.wght[1]})` : (caps?.weights ?? [T.weight]).join(" · ")}{T.italic ? " Italic" : ""}</b></span>
          {caps?.wdth && <span>Width <b>{T.width ?? caps.wdth[2]}% (var {caps.wdth[0]}–{caps.wdth[1]})</b></span>}
          <span>Size <b>{T.size}px</b></span>
          <span>Case <b>{caseName}</b></span>
          <span>Tracking <b>{T.spacing}</b></span>
          <span>Fill <b>{T.fillMode === "auto" ? "Auto" : T.fillMode === "solid" ? "Solid" : "Gradient"}</b></span>
          <span>Treatment <b>{typeFx.length ? typeFx.join(" + ") : "Plain"}</b></span>
        </div>
        <div className="kp-specrow">
          <a className="kp-link" target="_blank" rel="noreferrer"
            href={`https://github.com/google/fonts/tree/main/ofl/${T.font.toLowerCase().replace(/[^a-z0-9]/g, "")}`}>
            {T.font} on GitHub ↗
          </a>
          <a className="kp-link" target="_blank" rel="noreferrer"
            href={`https://fonts.google.com/specimen/${encodeURIComponent(T.font).replace(/%20/g, "+")}`}>
            Google Fonts ↗
          </a>
        </div>

        {/* splash text — real, editable instances of the display-text component */}
        <div className="kp-subhead">Splash text</div>
        <p className="kp-note">Big theme moments, straight from the same type system. Edit the text and the highlight phrase below — the highlight renders as a brighter, illuminated part of the same material.</p>
        <div className="kp-splashedit">
          <label>Text <input value={splash} maxLength={32} onChange={(e) => setSplash(e.target.value)} aria-label="Splash text" /></label>
          <label>Highlight phrase <input value={splashHi} maxLength={32} onChange={(e) => setSplashHi(e.target.value)} aria-label="Highlight phrase" /></label>
        </div>
        <Art svg={splashArt} scale={0.58} className="kp-splashmain" />
        <div className="kp-splashrow">
          {SPLASHES.map((s) => (
            <button key={s} className={`kp-splashchip${s === splash ? " on" : ""}`} title={`Load “${s}” into the splash editor`}
              onClick={() => { setSplash(s); setSplashHi(s === "SWEET VICTORY" ? "VICTORY" : ""); }}>
              <Art svg={renderTypeSpecimen(cfg, s)} scale={0.22} />
            </button>
          ))}
        </div>
      </Sec>

      <Chapter id="components" label="Components" blurb="finished controls, in true relative scale" />

      {/* ── 03 · buttons ── */}
      <Sec n="03" title="Buttons" note="The working set — Primary carries the master label. Hover, press and keyboard-focus any of them; the strip below shows every state.">
        <div className="kp-tray">
          <Piece id="primary" size="l" caption="Primary · L" />
          <Piece id="primary" size="m" caption="Primary · M" />
          <Piece id="primary" size="s" caption="Primary · S" />
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
      <Sec n="04" title="Choice" note="Checks, radios and switches share the shell — click a toggle and it really flips.">
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
      <Sec n="05" title="Fields" note="Wells sunk into the same candy. Click the dropdown and it opens.">
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
      <Sec n="06" title="Sliders & Progress" note="Drag the slider — the thumb stays inside the shell at both ends. Click the progress bar (or press Enter on it) and it replays 0 → its configured value.">
        <div className="kp-tray">
          <Piece id="slider" caption="Slider" value={0.62} />
          <Piece id="progress" caption="Progress" value={0.62} ambient />
        </div>
        <StateStrip variants={[
          { cap: "Min", piece: { id: "slider", value: 0 } },
          { cap: "25%", piece: { id: "slider", value: 0.25 } },
          { cap: "Mid", piece: { id: "slider", value: 0.5 } },
          { cap: "75%", piece: { id: "slider", value: 0.75 } },
          { cap: "Max", piece: { id: "slider", value: 1 } },
        ]} />
      </Sec>

      {/* ── 07 · feedback ── */}
      <Sec n="07" title="Feedback" note="Counts, awards and callouts. Click a badge to award it.">
        <div className="kp-tray">
          <Piece id="badge" caption="Badge · Count" label="12" />
          <Piece id="badge" caption="Badge · Awarded" baseState="pressed" />
          <Piece id="chip" caption="Chip" />
        </div>
      </Sec>

      {/* ── 08 · navigation ── */}
      <Sec n="08" title="Navigation" note="Tabs, a three-way switch and Banner / Stretch — a three-slice banner whose caps never distort and whose text never enters the tails.">
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
            <SliceDemo cfg={applyKitDesign(cfg, kitDesigns.header)} label={label} />
            <div className="kp-cap"><span>Standard</span></div>
          </div>
          <div>
            <SliceDemo cfg={applyKitDesign(cfg, kitDesigns.header)} label="CONTINUE YOUR ADVENTURE" size="l" />
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
      <Sec n="09" title="Icons" anchor="icons" note="The functional glyph set — Lucide, embedded with the same rules everywhere. Shown bare, as icon buttons, and as themed medallions.">
        <div className="kp-icons">
          {ICON_SET.map((ic) => (
            <figure className="kp-icon" key={ic.key} title={ic.name}>
              <span dangerouslySetInnerHTML={{ __html: previewSvg(STOCK_ICONS[ic.key], 22) }} />
              <figcaption>{ic.name}</figcaption>
            </figure>
          ))}
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

      <Chapter id="assemblies" label="Assemblies" blurb="components combined into ready pieces — no new materials, no one-off styling" />

      {/* ── 10 · containers & assemblies ── */}
      <Sec n="10" title="Containers & Assemblies" note="Panels and compound pieces built entirely from the components above.">
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
        </div>
      </Sec>

      <Chapter id="parts" label="Build Parts" blurb="the construction vocabulary — build what the kit doesn’t have yet without breaking the language" />

      {/* ── 11 · build parts ── */}
      <Sec n="11" title="Build Parts" note="Everything above is built from these. Click any part to open the layer that produces it in the editor.">
        <div className="kp-subhead">Stretch systems</div>
        <p className="kp-note">Every silhouette is procedural three-slice geometry: caps are sized by height and never distort; only the middle stretches. Magenta dashes mark the fixed caps, green marks the text-safe area.</p>
        <div className="kp-slices">
          <SliceDemo cfg={cfg} label="GO" />
          <SliceDemo cfg={cfg} label={label} />
          <SliceDemo cfg={cfg} label="CONTINUE YOUR ADVENTURE" />
        </div>
        <div className="kp-meta">
          <span>Left cap · Fixed</span><span>Center · Stretch X</span><span>Right cap · Fixed</span>
          <span>Panel corners · Fixed</span><span>Panel edges · Stretch</span><span>Panel center · Stretch X/Y</span>
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
        <div className="kp-subhead">Proof of system — Objective Card, assembled only from parts above</div>
        <div className="kp-patterns kp-assemblies">
          <div className="gp-card kp-objective">
            <div className="gp-row">
              <PPiece id="tab" label="DAILY OBJECTIVE" scale={0.3} />
              <PPiece id="iconbtn" icon={STOCK_ICONS.close} scale={0.2} />
            </div>
            <div className="gp-row center">
              <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.trophy} scale={0.26} />
              <span className="gp-label">Win 3 matches in ranked mode</span>
            </div>
            <PPiece id="progress" value={0.66} scale={0.34} />
            <div className="gp-row center">
              <PPiece id="chip" label="+250" icon={STOCK_ICONS.gem} scale={0.28} />
              <PPiece id="small" label="CLAIM" scale={0.3} />
            </div>
          </div>
        </div>
      </Sec>

      <Chapter id="patterns" label="Screen Patterns" blurb="complete live screens — start here and restyle everything at once" />

      {/* ── 12 · patterns ── */}
      <Sec n="12" title="Screen Patterns" note="Eleven little screens built from nothing but registered components — all of them live, every nested piece editable.">
        <div className="kp-patterns">
          <div className="gp-card">
            <div className="gp-title">Main menu</div>
            <Art svg={specimen} scale={0.3} />
            <PPiece id="primary" label="PLAY" size="s" />
            <PPiece id="ghost" label="Options" size="s" scale={0.3} />
            <div className="gp-row center">
              <PPiece id="chip" label="980" icon={STOCK_ICONS.gem} scale={0.26} />
              <PPiece id="iconbtn" icon={STOCK_ICONS.gear} scale={0.24} />
              <PPiece id="badge" label="3" scale={0.22} />
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Sign in</div>
            <PPiece id="header" label="WELCOME BACK" scale={0.3} />
            <PPiece id="input" label="Email address" />
            <PPiece id="input" label="Password" />
            <PPiece id="primary" label="LOG IN" size="s" />
            <PPiece id="ghost" label="Forgot password?" size="s" scale={0.3} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Settings</div>
            <PPiece id="header" label="SETTINGS" scale={0.3} />
            <div className="gp-col"><span className="gp-label">Music</span><PPiece id="slider" value={0.8} /></div>
            <div className="gp-col"><span className="gp-label">Sound FX</span><PPiece id="slider" value={0.55} /></div>
            <div className="gp-row"><span className="gp-label">Haptics</span><PPiece id="toggle" value={0} /></div>
            <PPiece id="small" label="DONE" />
          </div>
          <div className="gp-card">
            <div className="gp-title">Profile</div>
            <PPiece id="header" label="PROFILE" scale={0.3} />
            <div className="gp-row center">
              <PPiece id="iconbtn" icon={STOCK_ICONS.user} />
              <div className="gp-col">
                <span className="gp-name">PLAYER ONE</span>
                <PPiece id="chip" label="LV 12" icon={STOCK_ICONS.star} scale={0.3} />
              </div>
            </div>
            <div className="gp-col"><span className="gp-label">XP · 620 / 1000</span><PPiece id="progress" value={0.62} ambient /></div>
            <PPiece id="small" label="EDIT" scale={0.3} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Reward</div>
            <PPiece id="header" label="LEVEL UP!" scale={0.3} />
            <PPiece id="badge" baseState="pressed" scale={0.44} />
            <PPiece id="chip" label="+500" icon={STOCK_ICONS.gem} />
            <div className="gp-col"><span className="gp-label">Next reward</span><PPiece id="progress" value={1} /></div>
            <PPiece id="primary" label="CLAIM" size="s" />
          </div>
          <div className="gp-card">
            <div className="gp-title">Purchase</div>
            <PPiece id="header" label="STORE" scale={0.3} />
            <PPiece id="segment" segments={["1×", "10×", "100×"]} value={0} />
            <div className="gp-row center">
              <PPiece id="chip" label="980" icon={STOCK_ICONS.gem} />
              <PPiece id="chip" label="4.99" icon={STOCK_ICONS.cart} />
            </div>
            <PPiece id="primary" label="BUY NOW" size="s" />
            <PPiece id="ghost" label="Cancel" size="s" scale={0.3} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Confirmation</div>
            <PPiece id="header" label="ARE YOU SURE?" scale={0.28} />
            <span className="gp-label">Quitting now will forfeit the match.</span>
            <div className="gp-row center">
              <PPiece id="small" label="CONFIRM" scale={0.32} />
              <PPiece id="ghost" label="Cancel" size="s" scale={0.3} />
            </div>
            <PPiece id="iconbtn" icon={STOCK_ICONS.close} scale={0.2} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Loading</div>
            <Art svg={loadingArt} scale={0.26} />
            <PPiece id="progress" value={0.85} ambient />
            <span className="gp-label">Tip: locked doors remember you.</span>
            <span className="gp-label dim">Fetching world state…</span>
          </div>
          <div className="gp-card">
            <div className="gp-title">Results · Victory</div>
            <Art svg={splashArt} scale={0.26} />
            <div className="gp-row center">
              <PPiece id="chip" label="SCORE 12 480" icon={null} scale={0.28} />
              <PPiece id="chip" label="BEST" icon={STOCK_ICONS.star} scale={0.26} />
            </div>
            <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.trophy} scale={0.3} />
            <div className="gp-row center">
              <PPiece id="primary" label="CONTINUE" size="s" scale={0.32} />
              <PPiece id="ghost" label="Replay" size="s" scale={0.28} />
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-title">Empty state</div>
            <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.search} scale={0.3} />
            <PPiece id="tab" label="NO ITEMS YET" scale={0.3} />
            <span className="gp-label">Complete quests to fill your bag.</span>
            <PPiece id="small" label="EXPLORE" scale={0.32} />
            <PPiece id="ghost" label="Back" size="s" scale={0.28} />
          </div>
          <div className="gp-card">
            <div className="gp-title">Connection error</div>
            <PPiece id="badge" baseState="pressed" icon={STOCK_ICONS.warning} scale={0.3} />
            <PPiece id="tab" label="CONNECTION LOST" scale={0.3} />
            <span className="gp-label">We couldn’t reach the server.</span>
            <div className="gp-row center">
              <PPiece id="small" label="RETRY" scale={0.3} />
              <PPiece id="ghost" label="Back" size="s" scale={0.28} />
            </div>
          </div>
        </div>
      </Sec>

      <footer className="kp-foot">Made with The UI Generator · five levels, one material recipe, one renderer, zero mockups.</footer>
    </div>
  );
}
