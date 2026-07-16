import { ChevronDown, Upload, ArrowRight } from "lucide-react";
import { useForge } from "@/state/store";
import { Slider, Segmented, Field, SelectField, Dial } from "./controls/Controls";
import type { Finish, Emphasis } from "@/model/types";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <span className="section-marker">{n}</span>
        <span className="t-section">{title}</span>
        <span className="section-chevron"><ChevronDown size={14} strokeWidth={1.5} /></span>
      </div>
      {children}
    </section>
  );
}
function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="ctl-row">
      <span className="ctl-label t-ctl-label">{label}</span>
      <span className="ctl-body">{children}</span>
      {value !== undefined && <span className="ctl-value t-ctl-value">{value}</span>}
    </div>
  );
}

export function SettingsPanel() {
  const master = useForge((s) => s.doc.master);
  const update = useForge((s) => s.updateMaster);
  const m = master.material;
  const L = master.lighting;
  const c = master.content;

  return (
    <div className="forge-panel">
      <Section n={1} title="Surface / Material">
        <div style={{ marginBottom: 12 }}>
          <Segmented<Finish>
            value={m.finish}
            onChange={(v) => update((mm) => { mm.material.finish = v; })}
            options={[{ value: "matte", label: "Matte" }, { value: "shiny", label: "Shiny" }, { value: "hybrid", label: "Hybrid" }]}
          />
        </div>
        <Row label="Highlight" value={`${m.highlight}%`}>
          <Slider value={m.highlight} min={0} max={100} onChange={(v) => update((mm) => { mm.material.highlight = v; })} />
        </Row>
        <Row label="Noise" value={`${m.noise}%`}>
          <Slider value={m.noise} min={0} max={100} onChange={(v) => update((mm) => { mm.material.noise = v; })} />
        </Row>
        <Row label="Radius" value={`${m.radius} px`}>
          <Slider value={m.radius} min={0} max={120} onChange={(v) => update((mm) => { mm.material.radius = v; })} />
        </Row>
        <Row label="Depth" value={`${m.depth} px`}>
          <Slider value={m.depth} min={0} max={40} onChange={(v) => update((mm) => { mm.material.depth = v; })} />
        </Row>
      </Section>

      <Section n={2} title="Lighting">
        <Row label="Light direction" value={`${Math.round(L.directionDeg)}°`}>
          <Dial deg={L.directionDeg} onChange={(v) => update((mm) => { mm.lighting.directionDeg = v; })} />
        </Row>
        <Row label="Shadow softness" value={`${L.shadowSoftness}%`}>
          <Slider value={L.shadowSoftness} min={0} max={100} onChange={(v) => update((mm) => { mm.lighting.shadowSoftness = v; })} />
        </Row>
        <Row label="Rim light" value={`${L.rimLight}%`}>
          <Slider value={L.rimLight} min={0} max={100} onChange={(v) => update((mm) => { mm.lighting.rimLight = v; })} />
        </Row>
        <Row label="Ambient" value={`${L.ambient}%`}>
          <Slider value={L.ambient} min={0} max={100} onChange={(v) => update((mm) => { mm.lighting.ambient = v; })} />
        </Row>
      </Section>

      <Section n={3} title="Content">
        <Row label="Text label" value={`${c.label.length}/32`}>
          <Field value={c.label} onChange={(v) => update((mm) => { mm.content.label = v.slice(0, 32); })} />
        </Row>
        <div style={{ margin: "0 0 8px" }}>
          <Segmented<Emphasis>
            value={c.emphasis}
            onChange={(v) => update((mm) => { mm.content.emphasis = v; })}
            options={[{ value: "emboss", label: "Emboss" }, { value: "deboss", label: "Deboss" }]}
          />
        </div>
        <Row label="Language">
          <SelectField value={c.language} onChange={(v) => update((mm) => { mm.content.language = v; })}
            options={[{ value: "en", label: "English (EN)" }, { value: "es", label: "Español (ES)" }, { value: "ja", label: "日本語 (JA)" }]} />
        </Row>
        <Row label="Font">
          <SelectField value={c.font} onChange={(v) => update((mm) => { mm.content.font = v; })}
            options={[{ value: "Inter", label: "Inter SemiBold" }]} />
        </Row>
        <Row label="Icon set">
          <SelectField value={c.iconSet} onChange={(v) => update((mm) => { mm.content.iconSet = v; })}
            options={[{ value: "Lucide", label: "Lucide" }]} />
        </Row>
        <Row label="Icon">
          <SelectField value={c.icon} onChange={(v) => update((mm) => { mm.content.icon = v; })}
            options={[{ value: "Rocket", label: "Rocket" }, { value: "Zap", label: "Zap" }, { value: "Play", label: "Play" }, { value: "Flame", label: "Flame" }]} />
        </Row>
        <Row label="Icon weight" value={`${c.iconWeight.toFixed(1)} px`}>
          <Slider value={c.iconWeight} min={1} max={3} step={0.05} onChange={(v) => update((mm) => { mm.content.iconWeight = v; })} />
        </Row>
      </Section>

      <Section n={4} title="Background">
        <Row label="Grid style">
          <SelectField value="dot" onChange={() => {}}
            options={[{ value: "dot", label: "Dot Grid" }, { value: "line", label: "Line Grid" }]} />
        </Row>
        <Row label="Background mode">
          <Segmented value="grid" onChange={() => {}}
            options={[{ value: "grid", label: "Grid" }, { value: "solid", label: "Solid" }, { value: "custom", label: "Custom" }]} />
        </Row>
        <button className="field" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", marginTop: 4 }}>
          <Upload size={12} strokeWidth={1.5} /> <span className="t-input">Upload image</span>
        </button>
      </Section>

      <Section n={5} title="Output">
        <div className="t-helper" style={{ marginBottom: 6 }}>Every export path consumes the same model.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="t-input" style={{ display: "flex", gap: 8 }}><input type="checkbox" defaultChecked /> HTML Preview (live, accessible markup)</label>
          <label className="t-input" style={{ display: "flex", gap: 8 }}><input type="checkbox" defaultChecked /> SVG (vector, resolution independent)</label>
          <label className="t-input" style={{ display: "flex", gap: 8 }}><input type="checkbox" defaultChecked /> PNG (advanced effects / fallbacks)</label>
        </div>
      </Section>

      <Section n={6} title="Kit Flow">
        <div style={{ border: "1px solid var(--forge-border-subtle)", borderRadius: 8, padding: 12, background: "var(--forge-panel-secondary)" }}>
          <div className="t-ctl-label" style={{ color: "#273140", marginBottom: 4 }}>You are editing the Master Component</div>
          <div className="t-helper" style={{ lineHeight: 1.5, marginBottom: 10 }}>
            All states and variants generate from this. Approve the master, then generate your kit.
          </div>
          <button style={{ width: "100%", height: 34, borderRadius: 8, border: 0, background: "var(--forge-accent)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            Generate Kit from Master <ArrowRight size={14} strokeWidth={2} />
          </button>
        </div>
      </Section>
    </div>
  );
}
