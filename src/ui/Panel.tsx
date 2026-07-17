import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Dices, Layers, Type, LayoutGrid, Search, Settings, HelpCircle, Plus, Minus, RotateCcw, Hammer, PenTool, Trash2, Copy } from "lucide-react";
import { useGen } from "@/generator/store";
import { PRESETS, EFFECT_ROLES, ROLE_HINT, STATE_NAMES, GAME_FONTS, TEXT_PRESETS, SPECULAR_MODES, PATTERN_TYPES, SHAPES, ICONS_ENABLED, defaultStates, applyTextPreset, darken, registerCustomFont } from "@/generator/model";
import type { GenStateName } from "@/generator/model";
import { ICON_LIBS, loadLib, libLoaded, searchLib, getDef, previewSvg } from "@/generator/icons";
import { ensureFont } from "@/generator/fonts";

/* Rail buttons isolate their section group in the panel. Click again to show all.
   Order mirrors how the object is understood: style → color → structure →
   surface → light → reflections → depth → advanced. */
const GROUPS: Record<string, string[]> = {
  style: ["shape", "mapping", "structure", "surface", "lighting", "gloss", "glow", "depth"],
  type: ["typography"],
  states: ["state", "states"],
  icons: ["icon"],
};

export function Rail() {
  const { sectionFilter, setSectionFilter } = useGen();
  const items = [
    { id: "style", Icon: Layers, label: "Style & material" },
    { id: "type", Icon: Type, label: "Typography" },
    { id: "states", Icon: LayoutGrid, label: "States" },
    ...(ICONS_ENABLED ? [{ id: "icons", Icon: Search, label: "Icon library" }] : []),
  ];
  return (
    <nav className="rail" aria-label="Sections">
      {items.map(({ id, Icon, label }) => (
        <button key={id} className={sectionFilter === id ? "on" : ""} title={label} aria-label={label}
          aria-pressed={sectionFilter === id}
          onClick={() => setSectionFilter(sectionFilter === id ? null : id)}>
          <Icon size={22} strokeWidth={1.7} />
        </button>
      ))}
      <span className="gap" />
      <button title="Settings" aria-label="Settings"><Settings size={22} strokeWidth={1.7} /></button>
      <button title="Help" aria-label="Help"><HelpCircle size={22} strokeWidth={1.7} /></button>
    </nav>
  );
}

function Section({ id, title, summary, right, children }: {
  id: string; title: React.ReactNode; summary?: React.ReactNode; right?: React.ReactNode; children?: React.ReactNode;
}) {
  const { open, toggle, sectionFilter } = useGen();
  if (sectionFilter && !GROUPS[sectionFilter]?.includes(id)) return null;
  const isOpen = !!open[id] || !!sectionFilter; // isolating a group opens its sections
  return (
    <section className="sec">
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
  return (
    <div className="ctl">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step ?? 1} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="valbox">{value}<i>{unit}</i></span>
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

export function Panel() {
  const { cfg, update, setPreset, randomize, randomizeColors, selectedState, setSelectedState, sectionFilter, phase, setPhase } = useGen();
  const [iconQuery, setIconQuery] = useState("");
  const [libTick, setLibTick] = useState(0);
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

  const presentRoles = EFFECT_ROLES.filter((r) => cfg.effects[r] !== undefined);
  const missingRoles = EFFECT_ROLES.filter((r) => cfg.effects[r] === undefined);
  const mapStops = presentRoles.map((r) => cfg.effects[r]!) as string[];
  const mapBar = mapStops.length > 1 ? `linear-gradient(90deg, ${mapStops.join(", ")})` : mapStops[0] ?? "#ddd";
  const adj = cfg.states[selectedState];
  const T2 = cfg.type;
  const C = cfg.candy;
  const palette = { dark: darken(cfg.effects.Bevel ?? "#0E9CC9", 0.5), glow: cfg.effects.Glow ?? "#8FF0FF" };
  useEffect(() => { ensureFont(cfg.type.font); }, [cfg.type.font]);

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

  return (
    <aside className="panel">
      {/* ── State (which state the sliders shape) ─────────── */}
      <Section id="state" title="State" right={<span className="statebadge">{STATE_LABEL[selectedState]}</span>}>
        <div className="segmini" role="radiogroup" aria-label="State being edited">
          {STATE_NAMES.map((s) => (
            <button key={s} className={selectedState === s ? "on" : ""} role="radio" aria-checked={selectedState === s}
              onClick={() => setSelectedState(s)}>{STATE_LABEL[s]}</button>
          ))}
        </div>
        <div className="helper">Hover or press the button on the canvas to feel the states live. These sliders shape only <b>{STATE_LABEL[selectedState]}</b>.</div>
        <Slider label="Brightness" value={adj.brightness} min={-30} max={30} unit="" onChange={(v) => update((c) => { c.states[selectedState].brightness = v; })} />
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
        <button className="resetstate" title="Copy the Default state's treatment onto Hover, Pressed and Disabled — a clean base after exploring"
          onClick={() => update((c) => {
            c.states.hover = { ...c.states.default };
            c.states.pressed = { ...c.states.default };
            c.states.disabled = { ...c.states.default };
          })}>
          <Copy size={13} strokeWidth={2} /> Apply Default to all states
        </button>
      </Section>

      {/* ── A · Shape (the candy construction) ────────────── */}
      <Section id="shape" title="Shape" summary={<span className="mapbar" style={{ background: mapBar }} />}>
        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Shape preset</span>
          <select value={cfg.presetId} onChange={(e) => setPreset(e.target.value)} aria-label="Shape preset">
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
        <div className="helper">Each preset is a different candy construction — shell, gloss and depth, not just a palette.</div>
        <button className="resetstate" onClick={randomize}>
          <Dices size={14} strokeWidth={2} /> Randomize
        </button>
      </Section>

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
              <span className="chipwell sm" style={{ background: cfg.effects[r] }}>
                <input type="color" value={cfg.effects[r]} aria-label={`${r} color`}
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
        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Silhouette</span>
          <select value={cfg.shape} aria-label="Silhouette"
            onChange={(e) => update((c) => { c.shape = e.target.value as typeof cfg.shape; })}>
            {SHAPES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
        <Slider label="Corner softness" value={cfg.bevel.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.bevel.softness = v; })} />
        <Slider label="Wall width" value={cfg.bevel.width} min={4} max={26} unit="px" onChange={(v) => update((c) => { c.bevel.width = v; })} />
        <Slider label="Rim width" value={C.rim.width} min={0} max={10} unit="px" onChange={(v) => update((c) => { c.candy.rim.width = v; })} />
        <Slider label="Rim brightness" value={C.rim.brightness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.rim.brightness = v; })} />
        <Slider label="Inner edge" value={C.innerEdge.strength} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.innerEdge.strength = v; })} />
        <Slider label="Edge width" value={C.innerEdge.width} min={0} max={6} unit="px" onChange={(v) => update((c) => { c.candy.innerEdge.width = v; })} />
        <Slider label="Extrusion depth" value={C.extrusion.depth} min={0} max={24} unit="px" onChange={(v) => update((c) => { c.candy.extrusion.depth = v; })} />
      </Section>

      {/* ── D · Surface ───────────────────────────────────── */}
      <Section id="surface" title="Surface"
        right={
          <span className="inlinectl" onClick={(e) => e.stopPropagation()}>
            <select className="tinysel" value={cfg.face.mode} aria-label="Face mode"
              onChange={(e) => update((c) => { c.face.mode = e.target.value as "light" | "dark"; })}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </span>
        }>
        <Slider label="Face contrast" value={cfg.face.contrast} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.face.contrast = v; })} />
        <Slider label="Gradient mid" value={cfg.face.midpoint} min={10} max={90} unit="%" onChange={(v) => update((c) => { c.face.midpoint = v; })} />

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

        <div className="sublabel">Inner shade</div>
        <label className="check"><input type="checkbox" checked={C.blob.on}
          onChange={(e) => update((c) => { c.candy.blob.on = e.target.checked; })} /> Organic dark blob</label>
        {C.blob.on && (<>
          <Slider label="Opacity" value={C.blob.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.blob.opacity = v; })} />
          <Slider label="Size" value={C.blob.size} min={20} max={120} unit="%" onChange={(v) => update((c) => { c.candy.blob.size = v; })} />
          <Slider label="Position X" value={C.blob.x} min={-50} max={50} unit="" onChange={(v) => update((c) => { c.candy.blob.x = v; })} />
          <Slider label="Position Y" value={C.blob.y} min={-50} max={50} unit="" onChange={(v) => update((c) => { c.candy.blob.y = v; })} />
        </>)}

        <div className="sublabel">Micro grain</div>
        <Slider label="Amount" value={C.texture.amount} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.texture.amount = v; })} />
        <Slider label="Grain size" value={C.texture.scale} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.texture.scale = v; })} />

        <div className="sublabel">Transparency</div>
        <Slider label="Frame" value={cfg.transparency.frame} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.frame = v; })} />
        <Slider label="Interior" value={cfg.transparency.interior} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.interior = v; })} />
        <Slider label="Text" value={cfg.transparency.content} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.content = v; })} />
      </Section>

      {/* ── E · Lighting ──────────────────────────────────── */}
      <Section id="lighting" title="Lighting">
        <div className="ctl">
          <label>Angle</label>
          <AngleDial value={cfg.lighting.angle} onChange={(v) => update((c) => { c.lighting.angle = v; })} />
          <span className="valbox">
            <input className="numin" type="number" min={0} max={360} value={cfg.lighting.angle} aria-label="Lighting angle degrees"
              onChange={(e) => update((c) => { c.lighting.angle = ((+e.target.value % 360) + 360) % 360; })} />
            <i>°</i>
          </span>
        </div>
        <Slider label="Highlight" value={cfg.lighting.highlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.highlight = v; })} />
        <Slider label="Lowlight" value={cfg.lighting.lowlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.lowlight = v; })} />
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
        <Slider label="Gloss height" value={C.gloss.height} min={10} max={90} unit="%" onChange={(v) => update((c) => { c.candy.gloss.height = v; })} />
        <Slider label="Curvature" value={C.gloss.curve} min={-40} max={60} unit="px" onChange={(v) => update((c) => { c.candy.gloss.curve = v; })} />
        <Slider label="Gloss opacity" value={C.gloss.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.gloss.opacity = v; })} />
        <Slider label="Softness" value={C.gloss.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.gloss.softness = v; })} />
        <div className="ctl">
          <label>Gloss fill</label>
          <div className="segmini" role="radiogroup" aria-label="Gloss fill">
            {([["highlight", "Auto"], ["custom", "Color"], ["gradient", "Gradient"]] as const).map(([v, t]) => (
              <button key={v} className={C.gloss.fill === v ? "on" : ""} role="radio" aria-checked={C.gloss.fill === v}
                onClick={() => update((c) => { c.candy.gloss.fill = v; })}>{t}</button>
            ))}
          </div>
        </div>
        {C.gloss.fill !== "highlight" && (
          <Well label={C.gloss.fill === "gradient" ? "Gloss top" : "Gloss color"} value={C.gloss.tint}
            onChange={(v) => update((c) => { c.candy.gloss.tint = v; })} />
        )}
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
          <Slider label="Size" value={C.specular.size} min={4} max={60} unit="px" onChange={(v) => update((c) => { c.candy.specular.size = v; })} />
          <Slider label="Shape" value={C.specular.stretch} min={10} max={100} unit="%" onChange={(v) => update((c) => { c.candy.specular.stretch = v; })} />
          <Slider label="Intensity" value={C.specular.intensity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.specular.intensity = v; })} />
          <Slider label="Softness" value={C.specular.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.specular.softness = v; })} />
          {(C.specular.mode === "dual" || C.specular.mode === "anime") && (
            <Slider label="Spacing" value={C.specular.gap} min={50} max={300} unit="%" onChange={(v) => update((c) => { c.candy.specular.gap = v; })} />
          )}
          <Slider label="Angle" value={C.specular.angle} min={-80} max={80} unit="°" onChange={(v) => update((c) => { c.candy.specular.angle = v; })} />
          <Slider label="Nudge X" value={C.specular.ox} min={-50} max={50} unit="" onChange={(v) => update((c) => { c.candy.specular.ox = v; })} />
          <Slider label="Nudge Y" value={C.specular.oy} min={-50} max={50} unit="" onChange={(v) => update((c) => { c.candy.specular.oy = v; })} />
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
        <Slider label="Distance" value={cfg.shadow.distance} min={0} max={48} unit="px" onChange={(v) => update((c) => { c.shadow.distance = v; })} />
        <Slider label="Blur" value={cfg.shadow.blur} min={0} max={60} unit="px" onChange={(v) => update((c) => { c.shadow.blur = v; })} />
        <Slider label="Opacity" value={cfg.shadow.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.shadow.opacity = v; })} />
        <Slider label="Contact" value={C.contact.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.contact.opacity = v; })} />
        <div className="sublabel">Body shading</div>
        <Slider label="Darkness" value={C.extrusion.darkness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.candy.extrusion.darkness = v; })} />
        <div className="helper">The body is lit by the key light — its flanks brighten and darken as you spin the angle. Pressing compresses it.</div>
      </Section>

      {/* ── H · Typography (content lives here too) ───────── */}
      <Section id="typography" title="Typography" summary={<span>{cfg.content.label || T2.font}</span>}>
        <input className="tinput" value={cfg.content.label} maxLength={18} aria-label="Label text"
          onChange={(e) => update((c) => { c.content.label = e.target.value; })} />
        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Font</span>
          <select value={T2.font} aria-label="Font"
            onChange={(e) => { const f = e.target.value; ensureFont(f); update((c) => { c.type.font = f; }); }}>
            {GAME_FONTS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
            {(T2.customFonts ?? []).map((f) => <option key={f} value={f}>{f} ★</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
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
        {T2.fillMode === "gradient" && <Well label="Fill bottom" value={T2.fill2} onChange={(v) => update((c) => { c.type.fill2 = v; })} />}
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
          <Well label="Color" value={T2.outline.color} onChange={(v) => update((c) => { c.type.outline.color = v; })} />
          <Slider label="Width" value={T2.outline.width} min={0.5} max={8} step={0.5} unit="px" onChange={(v) => update((c) => { c.type.outline.width = v; })} />
        </FxToggle>
        <FxToggle label="Shadow" on={T2.shadow.on} onToggle={(v) => update((c) => { c.type.shadow.on = v; })}>
          <Well label="Color" value={T2.shadow.color} onChange={(v) => update((c) => { c.type.shadow.color = v; })} />
          <Slider label="Offset X" value={T2.shadow.x} min={-10} max={10} unit="px" onChange={(v) => update((c) => { c.type.shadow.x = v; })} />
          <Slider label="Offset Y" value={T2.shadow.y} min={-10} max={12} unit="px" onChange={(v) => update((c) => { c.type.shadow.y = v; })} />
          <Slider label="Blur" value={T2.shadow.blur} min={0} max={12} step={0.5} unit="px" onChange={(v) => update((c) => { c.type.shadow.blur = v; })} />
          <Slider label="Opacity" value={T2.shadow.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.shadow.opacity = v; })} />
        </FxToggle>
        <FxToggle label="Boss / Deboss" on={T2.emboss.on} onToggle={(v) => update((c) => { c.type.emboss.on = v; })}>
          <Slider label="Depth" value={T2.emboss.strength} min={-100} max={100} unit="%" onChange={(v) => update((c) => { c.type.emboss.strength = v; })} />
          <Slider label="Softness" value={T2.emboss.softness ?? 30} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.type.emboss.softness = v; })} />
          <div className="helper">Positive bosses, negative debosses. High softness + low fill opacity reads as frosted glass — try the Glass preset.</div>
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

      {!sectionFilter && (
        <div className="btnrow">
          <button className={`randbtn kit${phase === "kit" ? " on" : ""}`}
            onClick={() => setPhase(phase === "kit" ? "master" : "kit")}
            title={phase === "kit" ? "Back to the master component" : "Save style and apply it to the kit"}>
            {phase === "kit" ? <PenTool size={16} strokeWidth={1.9} /> : <Hammer size={16} strokeWidth={1.9} />}
            {phase === "kit" ? "Edit master" : "Build kit"}
          </button>
        </div>
      )}
    </aside>
  );
}
