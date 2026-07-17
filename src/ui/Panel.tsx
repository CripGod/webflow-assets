import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Shuffle, Layers, Type, LayoutGrid, Search, Settings, HelpCircle, Plus, Minus, ExternalLink, Info, X } from "lucide-react";
import { useGen } from "@/generator/store";
import { PRESETS, EFFECT_ROLES } from "@/generator/model";
import type { EffectRole } from "@/generator/model";
import { searchIcons, iconInner } from "@/generator/icons";

export function Rail() {
  const { open, toggle } = useGen();
  const items = [
    { id: "style", Icon: Layers, label: "Style" },
    { id: "content", Icon: Type, label: "Content" },
    { id: "states", Icon: LayoutGrid, label: "Layout / states" },
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

const ROLE_HINT: Record<EffectRole, string> = {
  Bevel: "edge frame", Glow: "outer aura", Highlight: "face sheen", Shadow: "grounding", "Inner Fill": "body",
};

export function Panel() {
  const { cfg, update, setPreset, randomize } = useGen();
  const [iconQuery, setIconQuery] = useState("");
  const results = useMemo(() => searchIcons(iconQuery, 18), [iconQuery]);
  const presentRoles = EFFECT_ROLES.filter((r) => cfg.effects[r] !== undefined);
  const missingRoles = EFFECT_ROLES.filter((r) => cfg.effects[r] === undefined);
  const mapStops = presentRoles.map((r) => cfg.effects[r]!) as string[];
  const mapBar = mapStops.length > 1 ? `linear-gradient(90deg, ${mapStops.join(", ")})` : mapStops[0] ?? "#ddd";

  return (
    <aside className="panel">
      {/* ── 1 · Style ─────────────────────────────────────── */}
      <Section id="style" title={<>Style <em className="titnote">preset (collection)</em></>}
        right={<Info size={14} strokeWidth={2} style={{ color: "var(--ink3)" }} />}>
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

      {/* ── 2 · Surface ───────────────────────────────────── */}
      <Section id="surface" title="Surface"
        right={
          <span className="inlinectl" onClick={(e) => e.stopPropagation()}>
            <span className="mini-swatch" style={{ background: cfg.face.mode === "light" ? "#fff" : "#221833" }} />
            <select className="tinysel" value={cfg.face.mode} aria-label="Face mode"
              onChange={(e) => update((c) => { c.face.mode = e.target.value as "light" | "dark"; })}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </span>
        }>
        <Slider label="Finish" value={cfg.face.finish} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.face.finish = v; })} />
        <Slider label="Noise" value={cfg.face.noise} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.face.noise = v; })} />
        <div className="helper">Finish is the face sheen; Noise is surface grain; mode flips the body light/dark.</div>
      </Section>

      {/* ── 3 · Bevel ─────────────────────────────────────── */}
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
        <Slider label="Bevel depth" value={cfg.bevel.depth} min={0} max={48} unit="px" onChange={(v) => update((c) => { c.bevel.depth = v; })} />
        <Slider label="Edge softness" value={cfg.bevel.softness} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.bevel.softness = v; })} />
      </Section>

      {/* ── 4 · Lighting ──────────────────────────────────── */}
      <Section id="lighting" title="Lighting">
        <div className="lightcard">
          <div className="lightcard-head"><span>Key light</span></div>
          <div className="ctl">
            <label>Angle</label>
            <AngleDial value={cfg.lighting.angle} onChange={(v) => update((c) => { c.lighting.angle = v; })} />
            <span className="valbox">
              <input className="numin" type="number" min={0} max={360} value={cfg.lighting.angle} aria-label="Key light angle"
                onChange={(e) => update((c) => { c.lighting.angle = ((+e.target.value % 360) + 360) % 360; })} />
              <i>°</i>
            </span>
          </div>
          <Slider label="Highlight" value={cfg.lighting.highlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.highlight = v; })} />
          <Slider label="Lowlight" value={cfg.lighting.lowlight} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.lowlight = v; })} />
          <Slider label="Shadow depth" value={cfg.lighting.shadow} min={0} max={100} unit="%" onChange={(v) => update((c) => { c.lighting.shadow = v; })} />
        </div>
        {cfg.lighting.extras.map((l) => (
          <div className="lightcard" key={l.id}>
            <div className="lightcard-head">
              <span>{l.kind === "rim" ? "Rim light" : "Fill light"}</span>
              <button aria-label="Remove light" onClick={() => update((c) => { c.lighting.extras = c.lighting.extras.filter((x) => x.id !== l.id); })}>
                <X size={13} strokeWidth={2} />
              </button>
            </div>
            <div className="ctl">
              <label>Angle</label>
              <AngleDial value={l.angle} onChange={(v) => update((c) => {
                const t = c.lighting.extras.find((x) => x.id === l.id); if (t) t.angle = v;
              })} />
              <span className="valbox">
                <input className="numin" type="number" min={0} max={360} value={l.angle} aria-label={`${l.kind} light angle`}
                  onChange={(e) => update((c) => {
                    const t = c.lighting.extras.find((x) => x.id === l.id); if (t) t.angle = ((+e.target.value % 360) + 360) % 360;
                  })} />
                <i>°</i>
              </span>
            </div>
            <Slider label="Intensity" value={l.intensity} min={0} max={100} unit="%" onChange={(v) => update((c) => {
              const t = c.lighting.extras.find((x) => x.id === l.id); if (t) t.intensity = v;
            })} />
          </div>
        ))}
        {cfg.lighting.extras.length < 3 && (
          <button className="addlight" onClick={() => update((c) => {
            const kind = c.lighting.extras.some((x) => x.kind === "rim") ? "fill" : "rim";
            const angle = (c.lighting.angle + 180) % 360;
            c.lighting.extras = [...c.lighting.extras, { id: "L" + Date.now(), kind, angle, intensity: 55 }];
          })}>
            <Plus size={14} strokeWidth={2} /> Add light
          </button>
        )}
      </Section>

      {/* ── 5 · Color Mapping ─────────────────────────────── */}
      <Section id="mapping" title="Color Mapping" right={<span className="mapbar" style={{ background: mapBar }} />}>
        <span className="mapbar wide" style={{ background: mapBar }} />
        <div className="maplist">
          {presentRoles.map((r) => (
            <div className="maprow" key={r}>
              <span className="mini-swatch" style={{ background: cfg.effects[r] }} />
              <span className="mr-role">{r}</span>
              <ChevronRight size={12} strokeWidth={2} style={{ color: "var(--ink3)" }} />
              <span className="mr-hint">{ROLE_HINT[r]}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 6 · Content ───────────────────────────────────── */}
      <Section id="content" title="Content"
        summary={<span>{cfg.content.placement === "none" ? "Text" : "Text + Icon"}</span>}>
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
        <div className="ctl">
          <label>Icon</label>
          <span className="curicon" dangerouslySetInnerHTML={{ __html: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${iconInner(cfg.content.icon)}</svg>` }} />
          <span className="helper" style={{ flex: 1 }}>{cfg.content.icon} — pick another below</span>
        </div>
      </Section>

      {/* ── 7 · States ────────────────────────────────────── */}
      <Section id="states" title="States" summary={<span>{1 + Object.values(cfg.visible).filter(Boolean).length} states</span>}>
        <label className="check"><input type="checkbox" checked disabled /> Default (hero preview)</label>
        {(["hover", "pressed", "disabled"] as const).map((s) => (
          <label className="check" key={s}>
            <input type="checkbox" checked={cfg.visible[s]} onChange={(e) => update((c) => { c.visible[s] = e.target.checked; })} />
            {s[0].toUpperCase() + s.slice(1)}
          </label>
        ))}
      </Section>

      {/* ── 8 · Randomize ─────────────────────────────────── */}
      <button className="randbtn" onClick={randomize}>
        <Shuffle size={18} strokeWidth={1.9} /> Randomize
      </button>

      {/* ── 9 · Icon search ───────────────────────────────── */}
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
