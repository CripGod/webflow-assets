import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Shuffle, Layers, Type, LayoutGrid, Search, Settings, HelpCircle, Plus, Minus, ExternalLink, RotateCcw } from "lucide-react";
import { useGen } from "@/generator/store";
import { PRESETS, EFFECT_ROLES, ROLE_HINT, STATE_NAMES, defaultStates } from "@/generator/model";
import type { GenStateName } from "@/generator/model";
import { searchIcons, iconInner } from "@/generator/icons";

export function Rail() {
  const { open, toggle } = useGen();
  const items = [
    { id: "style", Icon: Layers, label: "Style" },
    { id: "content", Icon: Type, label: "Content" },
    { id: "states", Icon: LayoutGrid, label: "States" },
    { id: "icons", Icon: Search, label: "Icon library" },
  ];
  return (
    <nav className="rail" aria-label="Sections">
      {items.map(({ id, Icon, label }) => (
        <button key={id} className={open[id] ? "on" : ""} title={label} aria-label={label} onClick={() => toggle(id)}>
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
  const { open, toggle } = useGen();
  const isOpen = !!open[id];
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

function Slider({ label, value, min, max, unit, onChange }: {
  label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div className="ctl">
      <label>{label}</label>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="valbox">{value}<i>{unit}</i></span>
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
  const { cfg, update, setPreset, randomize, selectedState, setSelectedState } = useGen();
  const [iconQuery, setIconQuery] = useState("");
  const results = useMemo(() => searchIcons(iconQuery, 18), [iconQuery]);
  const presentRoles = EFFECT_ROLES.filter((r) => cfg.effects[r] !== undefined);
  const missingRoles = EFFECT_ROLES.filter((r) => cfg.effects[r] === undefined);
  const mapStops = presentRoles.map((r) => cfg.effects[r]!) as string[];
  const mapBar = mapStops.length > 1 ? `linear-gradient(90deg, ${mapStops.join(", ")})` : mapStops[0] ?? "#ddd";
  const adj = cfg.states[selectedState];

  return (
    <aside className="panel">
      {/* ── State (edits apply to the selected state only) ──── */}
      <Section id="state" title="State"
        right={<span className="statebadge">{STATE_LABEL[selectedState]}</span>}>
        <div className="segmini" role="radiogroup" aria-label="State being edited">
          {STATE_NAMES.map((s) => (
            <button key={s} className={selectedState === s ? "on" : ""} role="radio" aria-checked={selectedState === s}
              onClick={() => setSelectedState(s)}>{STATE_LABEL[s]}</button>
          ))}
        </div>
        <div className="helper">Hover or press the button on the canvas to feel the states live. These sliders shape only <b>{STATE_LABEL[selectedState]}</b>.</div>
        <Slider label="Brightness" value={adj.brightness} min={-30} max={30} unit="" onChange={(v) => update((c) => { c.states[selectedState].brightness = v; })} />
        <Slider label="Glow" value={adj.glow} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.states[selectedState].glow = v; })} />
        <Slider label="Lift" value={adj.lift} min={-10} max={10} unit="px" onChange={(v) => update((c) => { c.states[selectedState].lift = v; })} />
        <Slider label="Opacity" value={adj.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.states[selectedState].opacity = v; })} />
        <button className="resetstate" onClick={() => update((c) => { c.states[selectedState] = defaultStates()[selectedState]; })}>
          <RotateCcw size={13} strokeWidth={2} /> Reset {STATE_LABEL[selectedState]}
        </button>
      </Section>

      {/* ── Style ─────────────────────────────────────────── */}
      <Section id="style" title={<>Style <em className="titnote">preset (collection)</em></>}>
        <label className="fieldbox" style={{ minWidth: 0 }}>
          <span className="fl">Style preset</span>
          <select value={cfg.presetId} onChange={(e) => setPreset(e.target.value)} aria-label="Style preset">
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
        </label>
        <div>
          <div className="sublabel">Effect colors <em>(component only)</em></div>
          <div className="chips">
            {presentRoles.map((role) => (
              <span className="chip" key={role}>
                <span className="chipwell" style={{ background: cfg.effects[role] }}>
                  <input type="color" value={cfg.effects[role]} aria-label={`${role} color`}
                    onChange={(e) => update((c) => { c.effects[role] = e.target.value; })} />
                </span>
                <span className="chiplabel">{role}</span>
              </span>
            ))}
            <button className="chipbtn" disabled={missingRoles.length === 0} title={missingRoles.length ? `Add ${missingRoles[0]}` : "All effects present"}
              onClick={() => update((c) => { c.effects[missingRoles[0]] = PRESETS.find((p) => p.id === c.presetId)?.effects[missingRoles[0]] ?? "#888888"; })}>
              <Plus size={14} strokeWidth={2} />
            </button>
            <button className="chipbtn" disabled={presentRoles.length <= 1} title="Remove last effect color"
              onClick={() => update((c) => { delete c.effects[presentRoles[presentRoles.length - 1]]; })}>
              <Minus size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      </Section>

      {/* ── Surface ───────────────────────────────────────── */}
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
        <Slider label="Finish" value={cfg.face.finish} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.face.finish = v; })} />
        <Slider label="Noise" value={cfg.face.noise} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.face.noise = v; })} />
      </Section>

      {/* ── Bevel ─────────────────────────────────────────── */}
      <Section id="bevel" title="Bevel">
        <div className="ctl">
          <label>Shape</label>
          <div className="segmini" role="radiogroup">
            {(["chamfer", "pill", "sharp", "round"] as const).map((s) => (
              <button key={s} className={cfg.shape === s ? "on" : ""} role="radio" aria-checked={cfg.shape === s}
                onClick={() => update((c) => { c.shape = s; })}>{s[0].toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
        </div>
        <Slider label="Bevel width" value={cfg.bevel.width} min={4} max={26} unit="px" onChange={(v) => update((c) => { c.bevel.width = v; })} />
        <Slider label="Edge softness" value={cfg.bevel.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.bevel.softness = v; })} />
      </Section>

      {/* ── Lighting (one key light) ──────────────────────── */}
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
        <Slider label="Hard highlight" value={cfg.lighting.hardHighlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.hardHighlight = v; })} />
        <Slider label="Lowlight" value={cfg.lighting.lowlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.lowlight = v; })} />
      </Section>

      {/* ── Shadow ────────────────────────────────────────── */}
      <Section id="shadow" title="Shadow">
        <Slider label="Distance" value={cfg.shadow.distance} min={0} max={48} unit="px" onChange={(v) => update((c) => { c.shadow.distance = v; })} />
        <Slider label="Blur" value={cfg.shadow.blur} min={0} max={60} unit="px" onChange={(v) => update((c) => { c.shadow.blur = v; })} />
        <Slider label="Opacity" value={cfg.shadow.opacity} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.shadow.opacity = v; })} />
        <div className="helper">Shadow color comes from the Shadow chip; direction follows the light.</div>
      </Section>

      {/* ── Transparency ──────────────────────────────────── */}
      <Section id="transparency" title="Transparency">
        <Slider label="Frame" value={cfg.transparency.frame} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.frame = v; })} />
        <Slider label="Interior" value={cfg.transparency.interior} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.interior = v; })} />
        <Slider label="Text & icon" value={cfg.transparency.content} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.transparency.content = v; })} />
      </Section>

      {/* ── Color Mapping (editable) ──────────────────────── */}
      <Section id="mapping" title="Color Mapping" right={<span className="mapbar" style={{ background: mapBar }} />}>
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
        <div className="helper">Click any well to edit — same colors as the chips above.</div>
      </Section>

      {/* ── Content ───────────────────────────────────────── */}
      <Section id="content" title="Content" summary={<span>{cfg.content.label || "—"}</span>}>
        <input className="tinput" value={cfg.content.label} maxLength={18} aria-label="Label text"
          onChange={(e) => update((c) => { c.content.label = e.target.value; })} />
        <div className="ctl">
          <label>Icon placement</label>
          <div className="segmini" role="radiogroup">
            {(["left", "right", "none"] as const).map((p) => (
              <button key={p} className={cfg.content.placement === p ? "on" : ""} role="radio" aria-checked={cfg.content.placement === p}
                onClick={() => update((c) => { c.content.placement = p; })}>{p[0].toUpperCase() + p.slice(1)}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="sublabel">Text effects</div>
          <div className="fxrow">
            {(["emboss", "glow", "outline", "shadow"] as const).map((f) => (
              <button key={f} className={`fxchip${cfg.content.fx[f] ? " on" : ""}`} aria-pressed={cfg.content.fx[f]}
                onClick={() => update((c) => { c.content.fx[f] = !c.content.fx[f]; })}>
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ── States shown on canvas ────────────────────────── */}
      <Section id="states" title="States shown" summary={<span>{1 + Object.values(cfg.visible).filter(Boolean).length} states</span>}>
        <label className="check"><input type="checkbox" checked disabled /> Default (hero)</label>
        {(["hover", "pressed", "disabled"] as const).map((s) => (
          <label className="check" key={s}>
            <input type="checkbox" checked={cfg.visible[s]} onChange={(e) => update((c) => { c.visible[s] = e.target.checked; })} />
            {STATE_LABEL[s]}
          </label>
        ))}
      </Section>

      <button className="randbtn" onClick={randomize}>
        <Shuffle size={18} strokeWidth={1.9} /> Randomize
      </button>

      {/* ── Icon search ───────────────────────────────────── */}
      <div className="iconsearch">
        <div className="searchbox">
          <Search size={15} strokeWidth={2} />
          <input value={iconQuery} placeholder="Search icons..." aria-label="Search icons"
            onChange={(e) => setIconQuery(e.target.value)} />
        </div>
        <div className="icongrid">
          {results.map((name) => (
            <button key={name} className={cfg.content.icon === name ? "on" : ""} title={name}
              onClick={() => update((c) => { c.content.icon = name; if (c.content.placement === "none") c.content.placement = "right"; })}
              dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconInner(name)}</svg>` }} />
          ))}
        </div>
        <a className="iconlink" href="https://lucide.dev/icons" target="_blank" rel="noreferrer">
          Explore the full icon set <ExternalLink size={13} strokeWidth={2} />
        </a>
      </div>
    </aside>
  );
}
