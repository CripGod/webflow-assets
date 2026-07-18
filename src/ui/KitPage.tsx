import { useMemo } from "react";
import { Download, PenTool } from "lucide-react";
import { useGen } from "@/generator/store";
import { EFFECT_ROLES, KIT_COMPONENTS, PRESETS, ROLE_HINT, SHAPES, SPECULAR_MODES, STOCK_ICONS, PATTERN_TYPES } from "@/generator/model";
import type { GenStateName, IconDef, KitComponentId, KitSize } from "@/generator/model";
import { renderKit, renderTypeSpecimen } from "@/generator/bevel";
import { downloadSvg } from "@/generator/exportUtils";
import { LiveArt } from "./LiveArt";

/* The Kit — a vertically scrolling guideline sheet: tokens, type, every
   component in true relative scale, and five little screens built from them.
   Everything is drawn by the one renderer; Play makes the whole page live. */

const PIECE_SCALE = 0.5;
const PATTERN_SCALE = 0.34;

/** Static art (type specimens) displayed at a uniform physical scale. */
function Art({ svg, scale }: { svg: string; scale: number }) {
  const w = useMemo(() => {
    const m = svg.match(/width="([\d.]+)"/);
    return m ? +m[1] * scale : undefined;
  }, [svg, scale]);
  return <div className="kp-art" style={{ width: w }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

interface PieceOpts {
  id: KitComponentId; size?: KitSize; label?: string; segments?: string[];
  icon?: IconDef | null; value?: number; baseState?: GenStateName; scale?: number;
}

/** Shared plumbing for every live piece on this page. */
function usePiece(p: PieceOpts) {
  const { cfg, kitShapes, kitSizes, canvasMode, setFocus, setKitSize } = useGen();
  // an explicit size (the Primary ramp) is fixed; everything else follows the
  // per-component size the user picks with the caption's S/M/L chips
  const size = p.size ?? kitSizes[p.id] ?? "m";
  return {
    cfg, playing: canvasMode === "play", size, setKitSize,
    sizable: p.size === undefined,
    name: KIT_COMPONENTS.find((c) => c.id === p.id)?.name ?? p.id,
    kit: { id: p.id, size, shape: kitShapes[p.id], label: p.label, segments: p.segments, icon: p.icon, value: p.value, baseState: p.baseState },
    onEdit: () => setFocus(p.id),
  };
}

/** One specced piece: live art + a caption rail with sizes and an SVG export. */
function Piece(p: PieceOpts & { caption: string }) {
  const { cfg, playing, size, setKitSize, sizable, name, kit, onEdit } = usePiece(p);
  return (
    <figure className="kp-piece">
      <LiveArt cfg={cfg} playing={playing} scale={p.scale ?? PIECE_SCALE} className="kp-live"
        kit={kit} title={playing ? p.caption : `Edit ${name}`} onDesignClick={onEdit} />
      <figcaption className="kp-cap">
        <span>{p.caption}</span>
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
            const { cfg: c, kitShapes: ks } = useGen.getState();
            const variant = p.caption.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            downloadSvg(
              renderKit(c, p.id, size, p.baseState ?? "default", p.value, ks[p.id], { label: p.label, segments: p.segments, icon: p.icon, expand: true }),
              `kit-${variant}-${size}.svg`
            );
          }}>
          <Download size={12} strokeWidth={2.2} />
        </button>
      </figcaption>
    </figure>
  );
}

/** A piece inside a pattern mock — no caption rail, tighter scale. */
function PPiece(p: PieceOpts) {
  const { cfg, playing, name, kit, onEdit } = usePiece({ ...p, size: p.size ?? "m" });
  return (
    <LiveArt cfg={cfg} playing={playing} scale={p.scale ?? PATTERN_SCALE} className="gp-piece"
      kit={kit} title={playing ? name : `Edit ${name}`} onDesignClick={onEdit} />
  );
}

function Sec({ n, title, note, children }: { n: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="kp-sec">
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

export function KitPage() {
  const { cfg, canvasMode, setPhase } = useGen();
  const playing = canvasMode === "play";
  const dark = cfg.canvas === "#1C1D22" || cfg.canvas === "#000000";
  const preset = PRESETS.find((p) => p.id === cfg.presetId);
  const sil = SHAPES.find((s) => s.id === cfg.shape)?.name.split(" — ")[0] ?? "Custom";
  const roles = EFFECT_ROLES.filter((r) => cfg.effects[r] !== undefined);
  const specularName = SPECULAR_MODES.find((m) => m.id === cfg.candy.specular.mode)?.name ?? "—";
  const patternName = PATTERN_TYPES.find((p) => p.id === cfg.candy.pattern.type)?.name.split(" — ")[0] ?? "None";
  const label = cfg.content.label || "PLAY";
  const T = cfg.type;
  const typeFx = [
    T.outline.on && "Outline", T.shadow.on && "Shadow",
    T.emboss.on && (T.emboss.strength < 0 ? "Deboss" : "Emboss"), T.glow.on && "Glow",
  ].filter(Boolean) as string[];
  const caseName = { none: "As typed", upper: "Uppercase", lower: "Lowercase", title: "Title Case" }[T.case];

  const specimen = useMemo(() => renderTypeSpecimen(cfg, label), [cfg, label]);
  const alphabet = useMemo(() => renderTypeSpecimen(cfg, "ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789"), [cfg]);

  return (
    <div className={`kitpage${dark ? " dark" : ""}${playing ? " playing" : ""}`}>
      <button className="makekit kitback" onClick={() => setPhase("master")} title="Back to the component editor">
        <PenTool size={14} strokeWidth={2} /> Edit master
      </button>

      {/* ── intro ── */}
      <header className="kp-hero">
        <div className="kp-eyebrow">PatternBreak · UI Guidelines</div>
        <h1 className="kp-title">The {preset?.name ?? "Custom"} Kit</h1>
        <p className="kp-sub">
          {sil} silhouette · {T.font} · {KIT_COMPONENTS.length} components dressed in one material recipe.
          {playing ? " Play is on — press, drag, flip and open everything below."
            : " Click any piece to open it in the editor, or hit Play (▶ in the canvas toolbar) and this whole page comes alive."}
        </p>
        <div className="kp-dots" aria-hidden="true">
          {roles.map((r) => <span key={r} style={{ background: cfg.effects[r] }} />)}
        </div>
      </header>

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
      <Sec n="02" title="Typography" note="One face, one treatment — every label on this page inherits it.">
        <div className="kp-typo">
          <Art svg={specimen} scale={0.62} />
          <Art svg={alphabet} scale={0.4} />
        </div>
        <div className="kp-specrow">
          <span>Font <b>{T.font}</b></span>
          <span>Weight <b>{T.weight}{T.italic ? " Italic" : ""}</b></span>
          <span>Size <b>{T.size}px</b></span>
          <span>Case <b>{caseName}</b></span>
          <span>Tracking <b>{T.spacing}</b></span>
          <span>Fill <b>{T.fillMode === "auto" ? "Auto" : T.fillMode === "solid" ? "Solid" : "Gradient"}</b></span>
          <span>Treatment <b>{typeFx.length ? typeFx.join(" + ") : "Plain"}</b></span>
        </div>
      </Sec>

      {/* ── 03 · buttons ── */}
      <Sec n="03" title="Buttons" note="The working set in true relative scale — Primary carries the master label.">
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
      </Sec>

      {/* ── 04 · choice controls ── */}
      <Sec n="04" title="Choice" note="Checks, radios and switches share the shell. In Play, they really flip.">
        <div className="kp-tray">
          <Piece id="checkbox" caption="Checkbox" />
          <Piece id="radio" caption="Radio" />
          <Piece id="toggle" caption="Toggle · On" value={1} />
          <Piece id="toggle" caption="Toggle · Off" value={0} />
        </div>
      </Sec>

      {/* ── 05 · fields ── */}
      <Sec n="05" title="Fields" note="Wells sunk into the same candy. The dropdown opens on click in Play.">
        <div className="kp-tray">
          <Piece id="input" caption="Input" />
          <Piece id="dropdown" caption="Dropdown" />
          {/* the open menu overflows its svg — give the caption room below */}
          <div className="kp-tall"><Piece id="dropdown" caption="Dropdown · Open" baseState="pressed" /></div>
        </div>
      </Sec>

      {/* ── 06 · sliders & progress ── */}
      <Sec n="06" title="Sliders & Progress" note="In Play: drag the slider, click the bar and watch it fill.">
        <div className="kp-tray">
          <Piece id="slider" caption="Slider" value={0.62} />
          <Piece id="progress" caption="Progress" value={0.62} />
        </div>
      </Sec>

      {/* ── 07 · feedback ── */}
      <Sec n="07" title="Feedback" note="Counts, awards and callouts. Click a badge in Play to award it.">
        <div className="kp-tray">
          <Piece id="badge" caption="Badge · Count" label="12" />
          <Piece id="badge" caption="Badge · Awarded" baseState="pressed" />
          <Piece id="chip" caption="Chip" />
        </div>
      </Sec>

      {/* ── 08 · navigation ── */}
      <Sec n="08" title="Navigation" note="Tabs, a three-way switch and the marquee header.">
        <div className="kp-tray">
          <Piece id="tab" caption="Tab" label="HOME" />
          <Piece id="tab" caption="Tab" label="STORE" />
          <Piece id="segment" caption="Segmented control" value={1} />
        </div>
        <div className="kp-tray">
          {/* the header carries the master label — edit it in Typography */}
          <Piece id="header" caption="Header banner" />
        </div>
      </Sec>

      {/* ── 09 · patterns ── */}
      <Sec n="09" title="Patterns" note="The kit at work — five little screens built from nothing but the pieces above. All of it stays live in Play.">
        <div className="kp-patterns">
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
            <div className="gp-row"><span className="gp-label">Music</span><PPiece id="toggle" value={1} /></div>
            <div className="gp-row"><span className="gp-label">Sound FX</span><PPiece id="toggle" value={1} /></div>
            <div className="gp-row"><span className="gp-label">Haptics</span><PPiece id="toggle" value={0} /></div>
            <div className="gp-col"><span className="gp-label">Master volume</span><PPiece id="slider" value={0.7} /></div>
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
            <div className="gp-col"><span className="gp-label">XP · 620 / 1000</span><PPiece id="progress" value={0.62} /></div>
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
        </div>
      </Sec>

      <footer className="kp-foot">Made with The UI Generator · every piece above is the same recipe, one renderer, zero mockups.</footer>
    </div>
  );
}
