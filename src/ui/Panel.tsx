import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Dices, Layers, Type, LayoutGrid, Search, Settings, HelpCircle, Plus, Minus, RotateCcw, Hammer, PenTool, Trash2, Copy, ArrowUpDown, LibraryBig, CheckCircle2, Shapes, Palette, Sun, Box } from "lucide-react";
import { useGen } from "@/generator/store";
import { PRESETS, EFFECT_ROLES, ROLE_HINT, STATE_NAMES, GAME_FONTS, TEXT_PRESETS, SPECULAR_MODES, PATTERN_TYPES, SHAPES, ICONS_ENABLED, KIT_COMPONENTS, KIT_SHAPE, BLEND_MODES, defaultStates, applyTextPreset, darken, registerCustomFont } from "@/generator/model";
import type { GenStateName, BlendMode } from "@/generator/model";
import { ICON_LIBS, loadLib, libLoaded, searchLib, getDef, previewSvg } from "@/generator/icons";
import { ensureFont } from "@/generator/fonts";
import { renderBevel, shapePath } from "@/generator/bevel";
import { hydrate, retintText } from "@/generator/store";
import { defaultConfig, defaultCandy, applyPresetCandy } from "@/generator/model";
import type { GenConfig } from "@/generator/model";
import { PRESET_DEFAULTS } from "@/generator/store";
import { SILHOUETTES, SILHOUETTE_CATEGORIES } from "@/generator/silhouettes";

/* Rendered mini-previews for the style presets — built once, by the same
   renderer as everything else. */
let presetArtCache: { id: string; name: string; svg: string }[] | null = null;
function presetArt() {
  if (!presetArtCache) presetArtCache = PRESETS.map((p) => {
    let pc: GenConfig;
    if (PRESET_DEFAULTS[p.id]) {
      pc = hydrate(structuredClone(PRESET_DEFAULTS[p.id])); // clone — hydrate keeps references
    } else {
      pc = defaultConfig();
      pc.presetId = p.id; pc.shape = p.shape; pc.bevel = { ...p.bevel }; pc.effects = { ...p.effects };
      const candy = defaultCandy(); applyPresetCandy(candy, p); pc.candy = candy;
      retintText(pc);
    }
    pc.content.label = "PLAY";
    pc.icon.show = false;
    return { id: p.id, name: p.name, svg: renderBevel(pc, "default") };
  });
  return presetArtCache;
}

/* Rail buttons jump to their section group — the panel always shows the full
   stack, so nothing critical ever disappears from view. Order mirrors how the
   object is understood: style → color → structure → surface → light →
   reflections → depth → advanced. */
const GROUPS: Record<string, string[]> = {
  states: ["state", "states"],
  style: ["shape"],
  silhouette: ["silhouette"],
  color: ["mapping"],
  material: ["structure", "surface"],
  lighting: ["lighting", "gloss", "glow", "depth"],
  type: ["typography"],
  library: ["library"],
  icons: ["icon"],
};

export function Rail() {
  const { sectionFilter, setSectionFilter, phase, setPhase, helpOn, setHelpOn } = useGen();
  const items = [
    { id: "states", Icon: LayoutGrid, label: "Global & states" },
    { id: "style", Icon: Layers, label: "Style preset" },
    { id: "silhouette", Icon: Shapes, label: "Silhouette" },
    { id: "color", Icon: Palette, label: "Color" },
    { id: "material", Icon: Box, label: "Structure & surface" },
    { id: "lighting", Icon: Sun, label: "Lighting, gloss & depth" },
    { id: "type", Icon: Type, label: "Typography" },
    { id: "library", Icon: LibraryBig, label: "Component library" },
    ...(ICONS_ENABLED ? [{ id: "icons", Icon: Search, label: "Icon library" }] : []),
  ];
  const jump = (id: string) => {
    setSectionFilter(id);
    // open the group's sections for real, then bring the first into view
    useGen.setState((st) => ({ open: { ...st.open, ...Object.fromEntries((GROUPS[id] ?? []).map((k) => [k, true])) } }));
    window.setTimeout(() => {
      const first = GROUPS[id]?.[0];
      document.querySelector(`[data-sec="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  };
  return (
    <nav className="rail" aria-label="Sections">
      {items.map(({ id, Icon, label }) => (
        <button key={id} className={sectionFilter === id ? "on" : ""} title={label} aria-label={label}
          aria-pressed={sectionFilter === id}
          onClick={() => jump(id)}>
          <Icon size={22} strokeWidth={1.7} />
        </button>
      ))}
      <span className="gap" />
      <button title="The Kit — pick a component to work on" aria-label="The Kit"
        className={phase === "kit" ? "on" : ""} onClick={() => setPhase(phase === "kit" ? "master" : "kit")}>
        <Hammer size={21} strokeWidth={1.7} />
      </button>
      <button title="The Board — stage components over a background" aria-label="The Board"
        className={phase === "board" ? "on" : ""} onClick={() => setPhase(phase === "board" ? "master" : "board")}>
        <LayoutGrid size={21} strokeWidth={1.7} />
      </button>
      <button title="Settings" aria-label="Settings"><Settings size={22} strokeWidth={1.7} /></button>
      <button title="Help — live hints in the top bar while you roll over controls" aria-label="Help"
        className={helpOn ? "on" : ""} onClick={() => setHelpOn(!helpOn)}><HelpCircle size={22} strokeWidth={1.7} /></button>
    </nav>
  );
}

function Section({ id, title, summary, right, children }: {
  id: string; title: React.ReactNode; summary?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode;
}) {
  const { open, toggle } = useGen();
  const isOpen = !!open[id];
  return (
    <section className="sec" data-sec={id}>
      <div className="sec-head" onClick={() => toggle(id)} role="button" aria-expanded={isOpen} tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(id); }}>
        <h3>{title}</h3>
        <span className="sum">
          {right}
          {!isOpen && summary}
          <span className={`chev${isOpen ? " open" : ""}`}><ChevronDown size={17} strokeWidth={2} /></span>
        </span>
      </div>
      {isOpen && <div className="sec-body">{children}</div>}
    </section>
  );
}

function Slider({ label, value, min, max, unit, step, onChange }: {
  label: string; value: number; min: number; max: number; unit: string; step?: number; onChange: (v: number) => void;
}) {
  const clampV = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="ctl">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="valbox">
        <input className="numin" type="number" min={min} max={max} step={step ?? 1} value={value}
          aria-label={`${label} value`}
          onChange={(e) => { const v = +e.target.value; if (!Number.isNaN(v)) onChange(clampV(v)); }} />
        <i>{unit}</i>
      </span>
    </div>
  );
}

function Well({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="ctl">
      <label>{label}</label>
      <span className="chipwell sm" style={{ background: value }}>
        <input type="color" value={value} aria-label={`${label} color`} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="mr-hint">{value.toUpperCase()}</span>
    </div>
  );
}

function FxToggle({ label, on, onToggle, children }: {
  label: string; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  // Effects that are on show their controls; off effects can still be peeked
  // open with the caret so nothing feels hidden.
  const [peek, setPeek] = useState(false);
  const expanded = on || peek;
  return (
    <div className="fxblock">
      <span className="fxhead">
        <button className={`fxchip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onToggle(!on)}>{label}</button>
        {!on && children && (
          <button className="fxpeek" aria-label={`${peek ? "Hide" : "Show"} ${label} controls`} onClick={() => setPeek(!peek)}>
            <ChevronDown size={14} strokeWidth={2} style={{ transform: peek ? "rotate(180deg)" : undefined }} />
          </button>
        )}
      </span>
      {expanded && children && <div className={`fxsub${on ? "" : " dim"}`}>{children}</div>}
    </div>
  );
}

function AngleDial({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const fromEvent = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    let a = Math.round((Math.atan2(-dy, dx) * 180) / Math.PI);
    if (a < 0) a += 360;
    onChange(a);
  };
  return (
    <div ref={ref} className="dial" role="slider" aria-label="Lighting angle" aria-valuenow={value} tabIndex={0}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); fromEvent(e); }}
      onPointerMove={(e) => { if (e.buttons) fromEvent(e); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange((value + 5) % 360);
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange((value + 355) % 360);
      }}>
      <span className="hand" style={{ transform: `rotate(${-value}deg)` }} />
    </div>
  );
}

const STATE_LABEL: Record<GenStateName, string> = { default: "Default", hover: "Hover", pressed: "Pressed", disabled: "Disabled" };

/** Font dropdown with each family previewed in its own face. */
function FontPicker({ value, customFonts, onPick }: { value: string; customFonts: string[]; onPick: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const names = [...GAME_FONTS.map((f) => f.name), ...customFonts];
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => { if (open) names.forEach(ensureFont); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="fontpick">
      <button className="fieldbox fontpick-btn" aria-label="Font" aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <span className="fl">Font</span>
        <span className="fontpick-cur" style={{ fontFamily: `'${value}', Inter, sans-serif` }}>{value}</span>
        <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
      </button>
      {open && (
        <div className="fontpick-pop" role="listbox" aria-label="Fonts">
          {names.map((n) => (
            <button key={n} role="option" aria-selected={n === value} className={n === value ? "on" : ""}
              onClick={() => { onPick(n); setOpen(false); }}>
              <span className="fp-name">{n}</span>
              <span className="fp-preview" style={{ fontFamily: `'${n}', Inter, sans-serif` }}>PLAY</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Panel() {
  const { cfg, update, setPreset, randomize, randomizeColors, selectedState, setSelectedState, sectionFilter, phase, setPhase, inheritDefaults, library, addToLibrary, removeFromLibrary, loadFromLibrary, addToBoard, focus, setFocus, kitShapes, setKitShape, styleLib, saveStyle, applyStyle, removeStyle, canvasMode, bgShow, bgOpacity, bgBlur, setBg, refreshLibraryItem } = useGen();
  const [iconQuery, setIconQuery] = useState("");
  const [libTick, setLibTick] = useState(0);
  const [justAdded, setJustAdded] = useState(false);
  const [outlines, setOutlines] = useState(false);
  const [silCat, setSilCat] = useState<string>("All");
  const savedLib = cfg.icon.def?.lib && ICON_LIBS.some((l) => l.id === cfg.icon.def!.lib) ? cfg.icon.def!.lib : "lucide";
  const [browseLib, setBrowseLib] = useState(savedLib);
  const libIsReady = libLoaded(browseLib);

  useEffect(() => {
    if (!ICONS_ENABLED) return;
    let live = true;
    if (!libLoaded(browseLib)) {
      void loadLib(browseLib).then(() => { if (live) setLibTick((t) => t + 1); });
    }
    return () => { live = false; };
  }, [browseLib]);

  const bigGrid = sectionFilter === "icons";
  const results = useMemo(
    () => (ICONS_ENABLED ? searchLib(browseLib, iconQuery, bigGrid ? 60 : 24) : []),
    // libTick re-runs the search once an async library lands
    [browseLib, iconQuery, bigGrid, libTick] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Controls read from — and update() writes to — the selected state's own
  // design. Untouched states mirror Default live until first edited.
  const D = selectedState !== "default" ? (cfg.stateDesigns?.[selectedState] ?? cfg) : cfg;
  const presentRoles = EFFECT_ROLES.filter((r) => D.effects[r] !== undefined);
  const missingRoles = EFFECT_ROLES.filter((r) => D.effects[r] === undefined);
  const mapStops = presentRoles.map((r) => D.effects[r]!) as string[];
  const mapBar = mapStops.length > 1 ? `linear-gradient(90deg, ${mapStops.join(", ")})` : mapStops[0] ?? "#ddd";
  const adj = cfg.states[selectedState];
  const T2 = D.type;
  const C = D.candy;
  const palette = { dark: darken(D.effects.Bevel ?? "#0E9CC9", 0.5), glow: D.effects.Glow ?? "#8FF0FF" };
  useEffect(() => { ensureFont(D.type.font); }, [D.type.font]);

  // focusing a kit component jumps the panel to the top so the banner is seen
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => { if (focus) panelRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }, [focus]);

  const [fontDraft, setFontDraft] = useState("");
  const addFont = () => {
    const name = fontDraft.trim();
    if (!name) return;
    registerCustomFont(name);
    ensureFont(name);
    update((c) => {
      if (!c.type.customFonts) c.type.customFonts = [];
      if (!c.type.customFonts.includes(name)) c.type.customFonts.push(name);
      c.type.font = name;
    });
    setFontDraft("");
  };

  if (phase === "kit") {
    // The Kit is a place you go to pick what to work on — not a control surface.
    return (
      <aside className="panel">
        <div className="sec">
          <div className="sec-head"><h3>The Kit</h3></div>
          <div className="sec-body">
            <div className="helper">Your whole UI kit, dressed in the current style. Click any component to open it in the editor — its silhouette is its own; the style stays global. Hit Play (canvas toolbar) to feel everything live.</div>
          </div>
        </div>
        <div className="btnrow">
          <button className="randbtn kit on" onClick={() => setPhase("master")}>
            <PenTool size={16} strokeWidth={1.9} /> Back to editor
          </button>
        </div>
      </aside>
    );
  }

  if (phase === "board") {
    // Assemble mode: the design controls step aside; only the Library matters.
    return (
      <aside className="panel">
        <div className="sec">
          <div className="sec-head"><h3>Stage</h3></div>
          <div className="sec-body">
            <div className="helper">Assemble mode — add components with +, drag to arrange, use the +/− on a piece to scale it, × to remove. Hit Play (canvas toolbar) to make everything live.</div>
          </div>
        </div>
        <section className="sec">
          <div className="sec-head"><h3>Backdrop</h3></div>
          <div className="sec-body">
            <label className="check"><input type="checkbox" checked={bgShow} onChange={(e) => setBg({ bgShow: e.target.checked })} /> Show background image</label>
            <Slider label="Opacity" value={bgOpacity} min={0} max={100} unit="%" onChange={(v) => setBg({ bgOpacity: v })} />
            <Slider label="Blur" value={bgBlur} min={0} max={20} unit="px" onChange={(v) => setBg({ bgBlur: v })} />
            <div className="helper">Artist-only — the backdrop never ships in exports. Upload or clear the image from the canvas toolbar; canvas color dots switch to a flat color.</div>
          </div>
        </section>
        <section className="sec">
          <div className="sec-head"><h3>Library</h3><span className="sum">{library.length} saved</span></div>
          <div className="sec-body">
            <div className="libgrid">
              {library.map((item) => (
                <div className="libcard" key={item.id}>
                  <button className="libthumb" title={`Load ${item.name} into the editor`} onClick={() => loadFromLibrary(item.id)}
                    dangerouslySetInnerHTML={{ __html: renderBevel(item.cfg, "default") }} />
                  <div className="librow">
                    <span className="libname">{item.name}</span>
                    <button className="chipbtn" title="Add to stage" onClick={() => addToBoard(item.id)}><Plus size={14} strokeWidth={2.2} /></button>
                    <button className="chipbtn" title="Update this saved component to the current style" onClick={() => refreshLibraryItem(item.id)}><RotateCcw size={13} strokeWidth={2} /></button>
                    <button className="chipbtn" title="Delete" onClick={() => removeFromLibrary(item.id)}><Trash2 size={13} strokeWidth={2} /></button>
                  </div>
                </div>
              ))}
              {library.length === 0 && <div className="helper">Nothing saved yet — go back to the editor and hit “OK — add to library”.</div>}
            </div>
          </div>
        </section>
        <div className="btnrow">
          <button className="randbtn kit on" onClick={() => setPhase("master")}>
            <PenTool size={16} strokeWidth={1.9} /> Back to editor
          </button>
        </div>
      </aside>
    );
  }

  const playLocked = canvasMode === "play";
  return (
    <aside className={`panel${playLocked ? " playlock" : ""}`} ref={panelRef}>
      {playLocked && <div className="playnote">Play mode — controls are paused so you can feel the states. Switch back to Design (✎ in the canvas toolbar) to edit.</div>}
      {focus && (
        <div className="focusnote">
          Editing <b>{KIT_COMPONENTS.find((c) => c.id === focus)?.name}</b> — every control below shapes it live.
          <button onClick={() => setFocus(null)}>Back to button</button>
        </div>
      )}
      {/* ── Global — whole-component adjustments per state ── */}
      <Section id="state" title="Global" right={<span className="statebadge">{STATE_LABEL[selectedState]}</span>}>
        <div className="segmini" role="radiogroup" aria-label="State being edited">
          {STATE_NAMES.map((s) => (
            <button key={s} className={selectedState === s ? "on" : ""} role="radio" aria-checked={selectedState === s}
              onClick={() => setSelectedState(s)}>{STATE_LABEL[s]}</button>
          ))}
        </div>
        <div className="helper">Hover or press the button on the canvas to feel the states live. These sliders shape only <b>{STATE_LABEL[selectedState]}</b>.</div>
        <Slider label="Brightness" value={adj.brightness} min={-30} max={30} unit="" onChange={(v) => update((c) => { c.states[selectedState].brightness = v; })} />
        <Slider label="Saturation" value={adj.saturation ?? 0} min={-100} max={100} unit="" onChange={(v) => update((c) => { c.states[selectedState].saturation = v; })} />
        <Slider label="Glow" value={adj.glow} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.states[selectedState].glow = v; })} />
        <label className="check"><input type="checkbox" checked={C.aura.color === null}
          onChange={(e) => update((c) => { c.candy.aura.color = e.target.checked ? null : (c.effects.Glow ?? "#8FF0FF"); })} /> Glow color from Color map</label>
        {C.aura.color !== null && (
          <Well label="Glow color" value={C.aura.color} onChange={(v) => update((c) => { c.candy.aura.color = v; })} />
        )}
        <Slider label="Lift" value={adj.lift} min={-10} max={10} unit="px" onChange={(v) => update((c) => { c.states[selectedState].lift = v; })} />
        <Slider label="Opacity" value={adj.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.states[selectedState].opacity = v; })} />
        <button className="resetstate" onClick={() => update((c) => { c.states[selectedState] = defaultStates()[selectedState]; })}>
          <RotateCcw size={13} strokeWidth={2} /> Reset {STATE_LABEL[selectedState]}
        </button>
        <button className="resetstate" title="Make Hover, Pressed and Disabled mirror the Default design again — a clean base after exploring"
          onClick={inheritDefaults}>
          <Copy size={13} strokeWidth={2} /> Apply Default to all states
        </button>
        {selectedState !== "default" && cfg.stateDesigns?.[selectedState] && (
          <div className="helper">This state has its own design — edits here never touch Default.</div>
        )}
      </Section>

      {/* ── A · Style (the candy construction) ────────────── */}
      <Section id="shape" title="Presets" summary={<span className="mapbar" style={{ background: mapBar }} />}>
        <div className="presetgrid">
          {presetArt().map((p) => (
            <button key={p.id} className={`presetcard${cfg.presetId === p.id ? " on" : ""}`} title={p.name}
              onClick={() => setPreset(p.id)}>
              <span className="presetart" dangerouslySetInnerHTML={{ __html: p.svg }} />
              <span className="presetname">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="helper">Each style is a different candy construction — shell, gloss and depth, not just a palette.</div>
        <button className="resetstate" onClick={randomize}>
          <Dices size={14} strokeWidth={2} /> Randomize everything
        </button>
        <div className="sublabel">My styles</div>
        {styleLib.length > 0 && (
          <div className="stylerow">
            {styleLib.map((st) => (
              <span key={st.id} className="stylechip">
                <button onClick={() => applyStyle(st.id)} title={`Apply ${st.name} to the whole kit`}>{st.name}</button>
                <button className="x" title="Delete style" onClick={() => removeStyle(st.id)}><Trash2 size={11} strokeWidth={2} /></button>
              </span>
            ))}
          </div>
        )}
        <button className="resetstate" onClick={() => saveStyle(window.prompt("Name this style:", cfg.content.label || "My style") || "My style")}>
          <Copy size={13} strokeWidth={2} /> Save current look as a style
        </button>
        <div className="helper">A style is the whole material recipe — colors, surface, lighting, type, state designs. Applying one restyles every component; silhouettes stay put.</div>
      </Section>

      {/* ── A2 · Silhouette — pure geometry, material stays ── */}
      <Section id="silhouette" title="Silhouette" summary={<span>{SHAPES.find((sh) => sh.id === D.shape)?.name.split(" — ")[0]}</span>}>
        <div className="silcats" role="radiogroup" aria-label="Silhouette category">
          {["All", ...SILHOUETTE_CATEGORIES].map((cat) => (
            <button key={cat} className={silCat === cat ? "on" : ""} role="radio" aria-checked={silCat === cat}
              onClick={() => setSilCat(cat)}>{cat}</button>
          ))}
        </div>
        <div className="shapegrid">
          {SILHOUETTES.filter((m) => silCat === "All" || m.category === silCat).map((m) => (
            <button key={m.id} className={`shapecard${(focus ? (kitShapes[focus] ?? KIT_SHAPE[focus] ?? D.shape) : D.shape) === m.id ? " on" : ""}`} title={`${m.name} — ${m.character}`}
              onClick={() => { if (focus) setKitShape(focus, m.id); else update((c) => { c.shape = m.id; }); }}>
              <svg viewBox="0 0 120 56" aria-hidden="true"><path d={shapePath(m.id, 8, 8, 104, 40, D.bevel.softness)} /></svg>
              <span>{m.name}</span>
            </button>
          ))}
        </div>
        {D.shape !== "pill" && (
          <Slider label="Corner softness" value={D.bevel.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.bevel.softness = v; })} />
        )}
        {focus && <div className="helper">Picking a silhouette here reshapes only <b>{KIT_COMPONENTS.find((c) => c.id === focus)?.name}</b> — the style stays global.</div>}
        <button className="resetstate" onClick={() => setOutlines(true)} title="Judge silhouettes as plain geometry — before materials flatter them">
          <Shapes size={13} strokeWidth={2} /> Outline view — compare raw geometry
        </button>
        <div className="helper">Silhouette is pure geometry — switching it keeps your material, lighting, colors and type exactly as they are.</div>
      </Section>

      {outlines && (
        <div className="devoutlines" role="dialog" aria-label="Silhouette outline comparison" onClick={() => setOutlines(false)}>
          <div className="devo-head">
            Raw silhouette geometry — <span style={{ color: "#fff" }}>white outline</span>,
            <span style={{ color: "#c084fc" }}> purple dashes = fixed end caps (never stretch)</span>,
            <span style={{ color: "#4ade80" }}> green = content-safe area</span>. Click anywhere to close.
          </div>
          {SILHOUETTE_CATEGORIES.map((cat) => (
          <div key={cat}>
          <div className="devo-cat">{cat}</div>
          <div className="devo-grid">
            {SILHOUETTES.filter((m) => m.category === cat).map((m) => {
              const W = 250, H = 92, ox = 12, oy = 14, gw = W - 24, gh = H - 28;
              const cap = Math.min(m.capScale * gh, gw * 0.45);
              return (
                <div key={m.id} className={`devo-card${D.shape === m.id ? " on" : ""}`}>
                  <svg viewBox={`0 0 ${W} ${H}`}>
                    <path d={shapePath(m.id, ox, oy, gw, gh, 60)} fill="none" stroke="#fff" strokeWidth="1.6" />
                    <line x1={ox + cap} y1={3} x2={ox + cap} y2={H - 3} stroke="#c084fc" strokeWidth="1" strokeDasharray="4 3" />
                    <line x1={ox + gw - cap} y1={3} x2={ox + gw - cap} y2={H - 3} stroke="#c084fc" strokeWidth="1" strokeDasharray="4 3" />
                    <rect x={ox + m.content.left * gh} y={oy + m.content.top * gh}
                      width={gw - (m.content.left + m.content.right) * gh} height={gh - (m.content.top + m.content.bottom) * gh}
                      fill="none" stroke="#4ade80" strokeWidth="1" strokeDasharray="3 3" />
                  </svg>
                  <div className="devo-name">{m.name}</div>
                  <div className="devo-src">{m.source} · {m.license}</div>
                </div>
              );
            })}
          </div>
          </div>
          ))}
        </div>
      )}

      {/* ── B · Color — THE color editor ──────────────────── */}
      <Section id="mapping" title="Color"
        right={
          <span className="inlinectl" onClick={(e) => e.stopPropagation()}>
            <button className="chipbtn" title="Randomize colors" aria-label="Randomize colors" onClick={randomizeColors}>
              <Dices size={14} strokeWidth={2} />
            </button>
          </span>
        }
        summary={<span className="mapbar" style={{ background: mapBar }} />}>
        <span className="mapbar wide" style={{ background: mapBar }} />
        <div className="maplist">
          {presentRoles.map((r) => (
            <div className="maprow" key={r}>
              <span className="chipwell sm" style={{ background: D.effects[r] }}>
                <input type="color" value={D.effects[r]} aria-label={`${r} color`}
                  onChange={(e) => update((c) => { c.effects[r] = e.target.value; })} />
              </span>
              <span className="mr-role">{r}</span>
              <ChevronRight size={12} strokeWidth={2} style={{ color: "var(--ink3)" }} />
              <span className="mr-hint">{ROLE_HINT[r]}</span>
            </div>
          ))}
        </div>
        <div className="chips" style={{ gap: 8 }}>
          <button className="chipbtn" disabled={missingRoles.length === 0} title={missingRoles.length ? `Add ${missingRoles[0]}` : "All effects present"}
            onClick={() => update((c) => { c.effects[missingRoles[0]] = PRESETS.find((p) => p.id === c.presetId)?.effects[missingRoles[0]] ?? "#888888"; })}>
            <Plus size={14} strokeWidth={2} />
          </button>
          <button className="chipbtn" disabled={presentRoles.length <= 1} title="Remove last effect color"
            onClick={() => update((c) => { delete c.effects[presentRoles[presentRoles.length - 1]]; })}>
            <Minus size={14} strokeWidth={2} />
          </button>
          <span className="helper" style={{ alignSelf: "center" }}>component-only · never the shell</span>
        </div>
      </Section>

      {/* ── C · Structure — the object's build ────────────── */}
      <Section id="structure" title="Structure">
        <Slider label="Wall width" value={D.bevel.width} min={4} max={26} unit="px" onChange={(v) => update((c) => { c.bevel.width = v; })} />
        <Slider label="Rim width" value={C.rim.width} min={0} max={10} unit="px" onChange={(v) => update((c) => { c.candy.rim.width = v; })} />
        <Slider label="Rim brightness" value={C.rim.brightness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.rim.brightness = v; })} />
        <Slider label="Inner edge" value={C.innerEdge.strength} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.innerEdge.strength = v; })} />
        <Slider label="Edge width" value={C.innerEdge.width} min={0} max={6} unit="px" onChange={(v) => update((c) => { c.candy.innerEdge.width = v; })} />
        <Slider label="Extrusion depth" value={C.extrusion.depth} min={0} max={48} unit="px" onChange={(v) => update((c) => { c.candy.extrusion.depth = v; })} />
      </Section>

      {/* ── D · Surface ───────────────────────────────────── */}
      <Section id="surface" title="Surface"
        right={
          <span className="inlinectl" onClick={(e) => e.stopPropagation()}>
            <select className="tinysel" value={D.face.mode} aria-label="Face mode"
              onChange={(e) => update((c) => { c.face.mode = e.target.value as "light" | "dark"; })}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </span>
        }>
        <Slider label="Face contrast" value={D.face.contrast} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.face.contrast = v; })} />
        <Slider label="Gradient mid" value={D.face.midpoint} min={10} max={90} unit="%" onChange={(v) => update((c) => { c.face.midpoint = v; })} />

        <div className="sublabel">Pattern</div>
        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Pattern</span>
          <select value={C.pattern.type} aria-label="Pattern type"
            onChange={(e) => update((c) => { c.candy.pattern.type = e.target.value as typeof C.pattern.type; })}>
            {PATTERN_TYPES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
        {C.pattern.type !== "none" && (<>
          <Slider label="Scale" value={C.pattern.scale} min={10} max={100} unit="%" onChange={(v) => update((c) => { c.candy.pattern.scale = v; })} />
          {C.pattern.type === "stripes" && (
            <Slider label="Angle" value={C.pattern.angle} min={0} max={180} unit="°" onChange={(v) => update((c) => { c.candy.pattern.angle = v; })} />
          )}
          <Slider label="Opacity" value={C.pattern.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.pattern.opacity = v; })} />
          <label className="check"><input type="checkbox" checked={C.pattern.color === null}
            onChange={(e) => update((c) => { c.candy.pattern.color = e.target.checked ? null : (c.effects.Bevel ?? "#0E9CC9"); })} /> Tone-on-tone (auto)</label>
          {C.pattern.color !== null && (
            <Well label="Pattern color" value={C.pattern.color} onChange={(v) => update((c) => { c.candy.pattern.color = v; })} />
          )}
        </>)}

        <div className="sublabel">Micro grain</div>
        <Slider label="Amount" value={C.texture.amount} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.texture.amount = v; })} />
        {C.texture.amount > 0 && (
          <Slider label="Grain size" value={C.texture.scale} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.texture.scale = v; })} />
        )}

        <div className="sublabel">Transparency</div>
        <Slider label="Frame" value={D.transparency.frame} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.frame = v; })} />
        <Slider label="Interior" value={D.transparency.interior} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.interior = v; })} />
        <Slider label="Text" value={D.transparency.content} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.content = v; })} />
      </Section>

      {/* ── E · Lighting ──────────────────────────────────── */}
      <Section id="lighting" title="Lighting" summary={<span>{D.lighting.angle}°</span>}>
        <label className="check"><input type="checkbox" checked={D.lighting.tint != null}
          onChange={(e) => update((c) => { c.lighting.tint = e.target.checked ? (c.effects.Highlight ?? "#FFFFFF") : null; })} /> Tint the key light</label>
        {D.lighting.tint != null && (
          <Well label="Light color" value={D.lighting.tint} onChange={(v) => update((c) => { c.lighting.tint = v; })} />
        )}
        <Slider label="Light angle" value={D.lighting.angle} min={0} max={360} unit="°" onChange={(v) => update((c) => { c.lighting.angle = ((v % 360) + 360) % 360; })} />
        <div className="ctl">
          <label>Direction</label>
          <AngleDial value={D.lighting.angle} onChange={(v) => update((c) => { c.lighting.angle = v; })} />
          <span className="mr-hint">drag the dial or slide above</span>
        </div>
        <Slider label="Highlight" value={D.lighting.highlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.highlight = v; })} />
        <Slider label="Lowlight" value={D.lighting.lowlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.lowlight = v; })} />
        <div className="helper">One key light drives every layer — gradients, gloss side, specular position, extrusion flanks and the shadow direction.</div>
      </Section>

      {/* ── F · Gloss & Reflections ───────────────────────── */}
      <Section id="gloss" title="Gloss & Reflections"
        right={
          <span className="inlinectl" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={C.gloss.on} aria-label="Gloss on"
              onChange={(e) => update((c) => { c.candy.gloss.on = e.target.checked; })} />
          </span>
        }>
        {C.gloss.on && (<>
        <Slider label="Gloss height" value={C.gloss.height} min={10} max={90} unit="%" onChange={(v) => update((c) => { c.candy.gloss.height = v; })} />
        <Slider label="Curvature" value={C.gloss.curve} min={-40} max={60} unit="px" onChange={(v) => update((c) => { c.candy.gloss.curve = v; })} />
        <Slider label="Gloss opacity" value={C.gloss.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.gloss.opacity = v; })} />
        <Slider label="Softness" value={C.gloss.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.gloss.softness = v; })} />
        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Gloss blend mode</span>
          <select value={C.gloss.blend ?? "normal"} aria-label="Gloss blend mode" onChange={(e) => update((c) => { c.candy.gloss.blend = e.target.value as BlendMode; })}>
            {BLEND_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
        <div className="ctl">
          <label>Gloss fill</label>
          <div className="segmini" role="radiogroup" aria-label="Gloss fill">
            {([["highlight", "Auto"], ["custom", "Color"], ["gradient", "Gradient"]] as const).map(([v, t]) => (
              <button key={v} className={C.gloss.fill === v ? "on" : ""} role="radio" aria-checked={C.gloss.fill === v}
                onClick={() => update((c) => { c.candy.gloss.fill = v; })}>{t}</button>
            ))}
          </div>
        </div>
        {C.gloss.fill !== "highlight" && (<>
          <Well label={C.gloss.fill === "gradient" ? "Gloss top" : "Gloss color"} value={C.gloss.tint}
            onChange={(v) => update((c) => { c.candy.gloss.tint = v; })} />
          {C.gloss.fill === "gradient" && (
            <button className="resetstate" onClick={() => update((c) => { const t = c.candy.gloss.tint; c.candy.gloss.tint = c.candy.gloss.tint2; c.candy.gloss.tint2 = t; })}>
              <ArrowUpDown size={13} strokeWidth={2} /> Swap gloss colors
            </button>
          )}
        </>)}
        {C.gloss.fill === "gradient" && (
          <Well label="Gloss bottom" value={C.gloss.tint2}
            onChange={(v) => update((c) => { c.candy.gloss.tint2 = v; })} />
        )}
        <div className="ctl">
          <label>Layering</label>
          <div className="segmini" role="radiogroup" aria-label="Gloss layering">
            {([["below", "Below text"], ["above", "Above text"]] as const).map(([v, t]) => (
              <button key={v} className={C.gloss.layer === v ? "on" : ""} role="radio" aria-checked={C.gloss.layer === v}
                onClick={() => update((c) => { c.candy.gloss.layer = v; })}>{t}</button>
            ))}
          </div>
        </div>
        <div className="helper">Above text seals the label under the candy shell; below keeps it crisp and UI-like.</div>
        </>)}
        <div className="sublabel">Specular</div>
        <label className="check"><input type="checkbox" checked={C.specular.on} onChange={(e) => update((c) => { c.candy.specular.on = e.target.checked; })} /> Specular reflections</label>
        {C.specular.on && (<>
          <label className="fieldbox" style={{ minWidth: 0 }}>
            <span className="fl">Specular type</span>
            <select value={C.specular.mode} aria-label="Specular type"
              onChange={(e) => update((c) => { c.candy.specular.mode = e.target.value as typeof C.specular.mode; })}>
              {SPECULAR_MODES.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
          </label>
          <Slider label="Size" value={C.specular.size} min={4} max={100} unit="px" onChange={(v) => update((c) => { c.candy.specular.size = v; })} />
          <Slider label="Shape" value={C.specular.stretch} min={10} max={100} unit="%" onChange={(v) => update((c) => { c.candy.specular.stretch = v; })} />
          <Slider label="Intensity" value={C.specular.intensity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.specular.intensity = v; })} />
          {C.specular.mode !== "anime" && (
            <Slider label="Softness" value={C.specular.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.specular.softness = v; })} />
          )}
          <label className="fieldbox" style={{ minWidth: 0 }}>
            <span className="fl">Specular blend mode</span>
            <select value={C.specular.blend ?? "normal"} aria-label="Specular blend mode" onChange={(e) => update((c) => { c.candy.specular.blend = e.target.value as BlendMode; })}>
              {BLEND_MODES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
          </label>
          {(C.specular.mode === "dual" || C.specular.mode === "anime") && (
            <Slider label="Spacing" value={C.specular.gap} min={50} max={300} unit="%" onChange={(v) => update((c) => { c.candy.specular.gap = v; })} />
          )}
          {C.specular.mode !== "sweep" && (<>
            <Slider label="Angle" value={C.specular.angle} min={-80} max={80} unit="°" onChange={(v) => update((c) => { c.candy.specular.angle = v; })} />
            <Slider label="Nudge X" value={C.specular.ox} min={-50} max={50} unit="" onChange={(v) => update((c) => { c.candy.specular.ox = v; })} />
            <Slider label="Nudge Y" value={C.specular.oy} min={-50} max={50} unit="" onChange={(v) => update((c) => { c.candy.specular.oy = v; })} />
          </>)}
        </>)}
        <div className="sublabel">Lower bloom</div>
        <Slider label="Bloom" value={C.bloom.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.bloom.opacity = v; })} />
        <Slider label="Bloom size" value={C.bloom.size} min={10} max={100} unit="%" onChange={(v) => update((c) => { c.candy.bloom.size = v; })} />
      </Section>

      {/* ── F2 · Glow — light living inside the candy ─────── */}
      <Section id="glow" title="Glow" summary={<span>{C.innerGlow.opacity}%</span>}>
        <div className="sublabel">Inner glow</div>
        <Slider label="Opacity" value={C.innerGlow.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.innerGlow.opacity = v; })} />
        <Slider label="Spread" value={C.innerGlow.size} min={10} max={100} unit="%" onChange={(v) => update((c) => { c.candy.innerGlow.size = v; })} />
        <label className="check"><input type="checkbox" checked={C.innerGlow.color === null}
          onChange={(e) => update((c) => { c.candy.innerGlow.color = e.target.checked ? null : (c.effects.Glow ?? "#8FF0FF"); })} /> Color from Color map</label>
        {C.innerGlow.color !== null && (
          <Well label="Glow color" value={C.innerGlow.color} onChange={(v) => update((c) => { c.candy.innerGlow.color = v; })} />
        )}
        <div className="helper">Colored light inside the candy, rising from the unlit side.</div>
        <div className="sublabel">Base glow</div>
        <Slider label="Base glow" value={C.extrusion.glow} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.extrusion.glow = v; })} />
        <div className="helper">Light caught in the middle of the body, below the lower bloom. Uses the inner-glow color.</div>
      </Section>

      {/* ── G · Depth & Shadow ────────────────────────────── */}
      <Section id="depth" title="Depth & Shadow">
        <div className="sublabel">Cast shadow</div>
        <Slider label="Distance" value={D.shadow.distance} min={0} max={48} unit="px" onChange={(v) => update((c) => { c.shadow.distance = v; })} />
        <Slider label="Blur" value={D.shadow.blur} min={0} max={60} unit="px" onChange={(v) => update((c) => { c.shadow.blur = v; })} />
        <Slider label="Opacity" value={D.shadow.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.shadow.opacity = v; })} />
        <Slider label="Contact" value={C.contact.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.contact.opacity = v; })} />
        <div className="sublabel">Body shading</div>
        <Slider label="Darkness" value={C.extrusion.darkness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.extrusion.darkness = v; })} />
        <div className="helper">The body is lit by the key light — its flanks brighten and darken as you spin the angle. Pressing compresses it.</div>
      </Section>

      {/* ── H · Typography (content lives here too) ───────── */}
      <Section id="typography" title="Typography" summary={<span>{cfg.content.label || T2.font}</span>}>
        <input className="tinput" value={cfg.content.label} maxLength={18} aria-label="Label text"
          onChange={(e) => update((c) => { c.content.label = e.target.value; })} />
        <FontPicker value={T2.font} customFonts={T2.customFonts ?? []}
          onPick={(f) => { ensureFont(f); update((c) => { c.type.font = f; }); }} />
        <div className="addfont">
          <input className="tinput" value={fontDraft} placeholder="Add Google Font — exact family name" aria-label="Add Google Font"
            onChange={(e) => setFontDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addFont(); }} />
          <button className="chipbtn" title="Add font" aria-label="Add font" onClick={addFont} disabled={!fontDraft.trim()}>
            <Plus size={14} strokeWidth={2} />
          </button>
        </div>
        <div className="helper">Paste the family name exactly as it appears on fonts.google.com (e.g. “Titan One”).</div>
        <Slider label="Size" value={T2.size} min={28} max={76} unit="px" onChange={(v) => update((c) => { c.type.size = v; })} />
        <Slider label="Vertical nudge" value={T2.oy ?? 0} min={-20} max={20} unit="px" onChange={(v) => update((c) => { c.type.oy = v; })} />
        <Slider label="Weight" value={T2.weight} min={400} max={900} step={100} unit="" onChange={(v) => update((c) => { c.type.weight = v; })} />
        <Slider label="Spacing" value={T2.spacing} min={-5} max={20} unit="" onChange={(v) => update((c) => { c.type.spacing = v; })} />
        <div className="ctl">
          <label>Case</label>
          <div className="segmini" role="radiogroup">
            {([["none", "Aa"], ["upper", "AA"], ["lower", "aa"], ["title", "Ab"]] as const).map(([v, t]) => (
              <button key={v} className={T2.case === v ? "on" : ""} role="radio" aria-checked={T2.case === v}
                onClick={() => update((c) => { c.type.case = v; })}>{t}</button>
            ))}
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={T2.italic} onChange={(e) => update((c) => { c.type.italic = e.target.checked; })} /> Italic</label>
        <div className="ctl">
          <label>Fill</label>
          <div className="segmini" role="radiogroup">
            {(["auto", "solid", "gradient"] as const).map((m) => (
              <button key={m} className={T2.fillMode === m ? "on" : ""} role="radio" aria-checked={T2.fillMode === m}
                onClick={() => update((c) => { c.type.fillMode = m; })}>{m[0].toUpperCase() + m.slice(1)}</button>
            ))}
          </div>
        </div>
        {T2.fillMode !== "auto" && <Well label={T2.fillMode === "gradient" ? "Fill top" : "Fill"} value={T2.fill} onChange={(v) => update((c) => { c.type.fill = v; })} />}
        {T2.fillMode === "gradient" && (<>
          <Well label="Fill bottom" value={T2.fill2} onChange={(v) => update((c) => { c.type.fill2 = v; })} />
          <button className="resetstate" title="Swap top and bottom fill colors"
            onClick={() => update((c) => { const t = c.type.fill; c.type.fill = c.type.fill2; c.type.fill2 = t; })}>
            <ArrowUpDown size={13} strokeWidth={2} /> Swap fills
          </button>
        </>)}
        <Slider label="Fill opacity" value={T2.fillOpacity ?? 100} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.fillOpacity = v; })} />

        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Text style preset</span>
          <select value={T2.preset} aria-label="Text style preset"
            onChange={(e) => update((c) => { applyTextPreset(c.type, e.target.value, palette); })}>
            {TEXT_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
        <div className="helper">Presets fill the controls below — keep tweaking, nothing locks.</div>

        <FxToggle label="Outline" on={T2.outline.on} onToggle={(v) => update((c) => { c.type.outline.on = v; })}>
          <Well label={T2.outline.color2 ? "Stroke top" : "Color"} value={T2.outline.color} onChange={(v) => update((c) => { c.type.outline.color = v; })} />
          <label className="check"><input type="checkbox" checked={T2.outline.color2 !== null}
            onChange={(e) => update((c) => { c.type.outline.color2 = e.target.checked ? darken(c.type.outline.color, 0.35) : null; })} /> Gradient stroke</label>
          {T2.outline.color2 !== null && (
            <button className="resetstate" onClick={() => update((c) => { const t = c.type.outline.color; c.type.outline.color = c.type.outline.color2!; c.type.outline.color2 = t; })}>
              <ArrowUpDown size={13} strokeWidth={2} /> Swap stroke colors
            </button>
          )}
          {T2.outline.color2 !== null && (
            <Well label="Stroke bottom" value={T2.outline.color2} onChange={(v) => update((c) => { c.type.outline.color2 = v; })} />
          )}
          <Slider label="Width" value={T2.outline.width} min={0.5} max={8} step={0.5} unit="px" onChange={(v) => update((c) => { c.type.outline.width = v; })} />
        </FxToggle>
        <FxToggle label="Shadow" on={T2.shadow.on} onToggle={(v) => update((c) => { c.type.shadow.on = v; })}>
          <Well label="Color" value={T2.shadow.color} onChange={(v) => update((c) => { c.type.shadow.color = v; })} />
          <Slider label="Offset X" value={T2.shadow.x} min={-10} max={10} unit="px" onChange={(v) => update((c) => { c.type.shadow.x = v; })} />
          <Slider label="Offset Y" value={T2.shadow.y} min={-10} max={12} unit="px" onChange={(v) => update((c) => { c.type.shadow.y = v; })} />
          <Slider label="Blur" value={T2.shadow.blur} min={0} max={12} step={0.5} unit="px" onChange={(v) => update((c) => { c.type.shadow.blur = v; })} />
          <Slider label="Opacity" value={T2.shadow.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.shadow.opacity = v; })} />
        </FxToggle>
        <FxToggle label="Emboss / Deboss" on={T2.emboss.on} onToggle={(v) => update((c) => { c.type.emboss.on = v; })}>
          <Slider label="Depth" value={T2.emboss.strength} min={-100} max={100} unit="%" onChange={(v) => update((c) => { c.type.emboss.strength = v; })} />
          <Slider label="Distance" value={T2.emboss.distance ?? 2} min={0} max={8} step={0.5} unit="px" onChange={(v) => update((c) => { c.type.emboss.distance = v; })} />
          <Slider label="Hi softness" value={T2.emboss.softness ?? 30} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.emboss.softness = v; })} />
          <Slider label="Sh softness" value={T2.emboss.shSoftness ?? T2.emboss.softness ?? 30} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.emboss.shSoftness = v; })} />
          <div className="sublabel">Highlight side</div>
          <Well label="Color" value={T2.emboss.hiColor ?? "#FFFFFF"} onChange={(v) => update((c) => { c.type.emboss.hiColor = v; })} />
          <Slider label="Opacity" value={T2.emboss.hiOpacity ?? 70} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.emboss.hiOpacity = v; })} />
          <div className="sublabel">Shadow side</div>
          <Well label="Color" value={T2.emboss.shColor ?? "#04080E"} onChange={(v) => update((c) => { c.type.emboss.shColor = v; })} />
          <Slider label="Opacity" value={T2.emboss.shOpacity ?? 60} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.emboss.shOpacity = v; })} />
          <div className="helper">The relief follows the master light — spin the Lighting angle and the highlight and shade travel with it. Positive embosses, negative debosses.</div>
        </FxToggle>
        <FxToggle label="Glow" on={T2.glow.on} onToggle={(v) => update((c) => { c.type.glow.on = v; })}>
          <Well label="Color" value={T2.glow.color} onChange={(v) => update((c) => { c.type.glow.color = v; })} />
          <Slider label="Size" value={T2.glow.size} min={2} max={24} unit="px" onChange={(v) => update((c) => { c.type.glow.size = v; })} />
          <Slider label="Opacity" value={T2.glow.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.glow.opacity = v; })} />
        </FxToggle>
      </Section>


      {/* ── Icon (parked behind ICONS_ENABLED for this phase) ── */}
      {ICONS_ENABLED && (
      <Section id="icon" title="Icon"
        right={
          <span className="inlinectl" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={cfg.icon.show} aria-label="Show icon"
              onChange={(e) => update((c) => { c.icon.show = e.target.checked; })} />
          </span>
        }
        summary={<span>{cfg.icon.show && cfg.icon.def ? cfg.icon.def.name : "off"}</span>}>
        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Icon library</span>
          <select value={browseLib} aria-label="Icon library" onChange={(e) => setBrowseLib(e.target.value)}>
            {ICON_LIBS.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.note}</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
        <div className="searchbox">
          <Search size={15} strokeWidth={2} />
          <input value={iconQuery} placeholder={`Search ${ICON_LIBS.find((l) => l.id === browseLib)?.name}...`} aria-label="Search icons"
            onChange={(e) => setIconQuery(e.target.value)} />
        </div>
        {!libIsReady && <div className="helper">Loading library…</div>}
        <div className="icongrid">
          {results.map((name) => {
            const def = getDef(browseLib, name);
            if (!def) return null;
            const on = cfg.icon.def?.lib === browseLib && cfg.icon.def?.name === name;
            return (
              <button key={name} className={on ? "on" : ""} title={name}
                onClick={() => update((c) => { c.icon.def = def; c.icon.show = true; })}
                dangerouslySetInnerHTML={{ __html: previewSvg(def) }} />
            );
          })}
        </div>
        {cfg.icon.show && cfg.icon.def && (<>
          <div className="ctl">
            <label>Placement</label>
            <div className="segmini" role="radiogroup">
              {(["left", "right"] as const).map((p) => (
                <button key={p} className={cfg.icon.placement === p ? "on" : ""} role="radio" aria-checked={cfg.icon.placement === p}
                  onClick={() => update((c) => { c.icon.placement = p; })}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={cfg.icon.only} onChange={(e) => update((c) => { c.icon.only = e.target.checked; })} /> Icon only (hide label)</label>
          <Slider label="Size" value={cfg.icon.size} min={40} max={170} unit="%" onChange={(v) => update((c) => { c.icon.size = v; })} />
          {cfg.icon.def.mode === "stroke" &&
            <Slider label="Stroke" value={cfg.icon.strokeWidth} min={5} max={40} unit="/10" onChange={(v) => update((c) => { c.icon.strokeWidth = v; })} />}
          <label className="check"><input type="checkbox" checked={cfg.icon.color === null} onChange={(e) => update((c) => { c.icon.color = e.target.checked ? null : "#FFFFFF"; })} /> Match text color</label>
          {cfg.icon.color !== null && <Well label="Color" value={cfg.icon.color} onChange={(v) => update((c) => { c.icon.color = v; })} />}
          <Slider label="Opacity" value={cfg.icon.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.icon.opacity = v; })} />
          <Slider label="Rotation" value={cfg.icon.rotation} min={0} max={360} unit="°" onChange={(v) => update((c) => { c.icon.rotation = v; })} />
          <Slider label="Gap" value={cfg.icon.gap} min={0} max={40} unit="px" onChange={(v) => update((c) => { c.icon.gap = v; })} />
          <Slider label="Nudge X" value={cfg.icon.ox} min={-30} max={30} unit="px" onChange={(v) => update((c) => { c.icon.ox = v; })} />
          <Slider label="Nudge Y" value={cfg.icon.oy} min={-30} max={30} unit="px" onChange={(v) => update((c) => { c.icon.oy = v; })} />
          <div className="sublabel">Icon effects</div>
          <div className="fxrow">
            {(["shadow", "glow", "emboss"] as const).map((f) => (
              <button key={f} className={`fxchip${cfg.icon.fx[f] ? " on" : ""}`} aria-pressed={cfg.icon.fx[f]}
                onClick={() => update((c) => { c.icon.fx[f] = !c.icon.fx[f]; })}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="resetstate" onClick={() => update((c) => { c.icon.def = null; c.icon.show = false; c.icon.only = false; })}>
            <Trash2 size={13} strokeWidth={2} /> Remove icon
          </button>
        </>)}
        {(!cfg.icon.show || !cfg.icon.def) && <div className="helper">No icon — the label recenters itself. Pick one above to add it back.</div>}
      </Section>
      )}

      {/* ── Library — approved components ─────────────────── */}
      <Section id="library" title="Library" summary={<span>{library.length} saved</span>}>
        {library.length === 0 && <div className="helper">The flow: design a component → “OK — add to library” saves it here → the + button places it on the stage (Board) → drag to arrange, Play to feel the states.</div>}
        <div className="libgrid">
          {library.map((item) => (
            <div className="libcard" key={item.id}>
              <button className="libthumb" title={`Load ${item.name}`} onClick={() => loadFromLibrary(item.id)}
                dangerouslySetInnerHTML={{ __html: renderBevel(item.cfg, "default") }} />
              <div className="librow">
                <span className="libname">{item.name}</span>
                <button className="chipbtn" title="Add to stage" aria-label={`Add ${item.name} to the stage`} onClick={() => addToBoard(item.id)}>
                  <Plus size={14} strokeWidth={2.2} />
                </button>
                <button className="chipbtn" title="Delete" aria-label={`Delete ${item.name}`} onClick={() => removeFromLibrary(item.id)}>
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="helper">Click a thumbnail to load it into the editor. Send to board to sketch layouts.</div>
      </Section>

      {/* ── States shown ──────────────────────────────────── */}
      <Section id="states" title="States shown" summary={<span>{1 + Object.values(cfg.visible).filter(Boolean).length} states</span>}>
        <label className="check"><input type="checkbox" checked disabled /> Default (hero)</label>
        {(["hover", "pressed", "disabled"] as const).map((s) => (
          <label className="check" key={s}>
            <input type="checkbox" checked={cfg.visible[s]} onChange={(e) => update((c) => { c.visible[s] = e.target.checked; })} />
            {STATE_LABEL[s]}
          </label>
        ))}
      </Section>

      <div className="btnrow">
        <button className={`randbtn${justAdded ? " okflash" : ""}`} title="Approve this component and save it to the library"
          onClick={() => {
            addToLibrary(cfg.content.label || "Component");
            setJustAdded(true);
            useGen.setState((st) => ({ open: { ...st.open, library: true } }));
            window.setTimeout(() => setJustAdded(false), 1800);
          }}>
          <CheckCircle2 size={16} strokeWidth={1.9} /> {justAdded ? `✓ Saved — ${library.length} in Library` : "OK — add to library"}
        </button>
      </div>
      {(
        <div className="btnrow">
          <button className="randbtn kit" onClick={() => setPhase("kit")}
            title="Open the Kit — pick which component to work on">
            <Hammer size={16} strokeWidth={1.9} /> The Kit
          </button>
          <button className="randbtn kit" onClick={() => setPhase("board")}
            title="Free sketch area — drag saved components around">
            <LayoutGrid size={16} strokeWidth={1.9} /> Board
          </button>
        </div>
      )}
    </aside>
  );
}
