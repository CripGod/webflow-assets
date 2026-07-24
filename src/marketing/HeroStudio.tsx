import { useEffect, useRef } from "react";
import { Plus, Zap, Eye, Save, Download, AlignLeft, AlignCenter, AlignRight, CaseSensitive } from "lucide-react";
import { PALETTES, ICONS, FONTS, WEIGHTS, REEL, vars, type Design } from "./studioModel";

/* The LIVE STUDIO — a neon, fully-interactive candy-button designer. It
   attract-loops through presets and hands the visitor the wheel the moment
   they touch a control. Everything is CSS custom properties on the studio
   root; @property registrations make the colors morph. */
export function HeroStudio({
  design, onChange, driving, onDrive, onPush, gridOn, onGrid,
}: {
  design: Design; onChange: (d: Design) => void;
  driving: boolean; onDrive: () => void;
  onPush: () => void; gridOn: boolean; onGrid: () => void;
}) {
  const reelI = useRef(0);
  const Icon = ICONS[design.icon];

  useEffect(() => {
    if (driving) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      reelI.current = (reelI.current + 1) % REEL.length;
      onChange(REEL[reelI.current]);
    }, 2800);
    return () => clearInterval(t);
  }, [driving, onChange]);

  const take = () => { if (!driving) onDrive(); };
  const set = (p: Partial<Design>) => { take(); onChange({ ...design, ...p }); };
  const fill = (v: number) => ({ ["--fill" as string]: `${v}%` });

  return (
    <div className="studio" style={vars(design)}>
      <div className="studio__in">
        <div className="studio__hd">
          <span className="studio__live"><i /> LIVE STUDIO</span>
          <span className={`st-flag${driving ? " on" : ""}`} style={{ position: "static" }}>
            {driving ? "✦ your design" : "✦ auto-designing"}
          </span>
        </div>

        <div className="studio__cols">
          {/* left: preview + shape controls */}
          <div className="studio__main" onPointerDownCapture={take}>
            <div className="stage" style={gridOn ? undefined : { backgroundImage: "radial-gradient(120% 120% at 50% 0%,rgba(168,85,247,.16),transparent 60%)" }}>
              <button
                className={`cbtn st-${design.state.toLowerCase()}`}
                type="button" tabIndex={-1} aria-hidden="true"
                style={{ fontFamily: "var(--ffam)", justifyContent: design.align === "center" ? "center" : `flex-${design.align === "left" ? "start" : "end"}`, textTransform: design.upper ? "uppercase" : "none" }}
              >
                <Icon strokeWidth={2.6} fill={["Play", "Heart", "Star"].includes(design.icon) ? "currentColor" : "none"} />
                <span>{design.label || " "}</span>
              </button>
            </div>

            <p className="lbl" style={{ marginTop: 16 }}>Color</p>
            <div className="swatches">
              {PALETTES.map((p) => (
                <button key={p.key} className={`sw${design.palette === p.key ? " on" : ""}`}
                  style={{ background: `linear-gradient(160deg,${p.hi},${p.lo})` }}
                  aria-label={p.name} onClick={() => set({ palette: p.key })} />
              ))}
              <button className="sw sw--add" aria-label="More colors in the editor" onClick={onPush}><Plus /></button>
            </div>

            <div className="srow"><span>Roundness</span>
              <input className="slider" style={fill(design.round)} type="range" min={0} max={100} value={design.round}
                onChange={(e) => set({ round: +e.target.value })} aria-label="Roundness" />
              <span>{design.round}%</span></div>
            <div className="srow"><span>Glow</span>
              <input className="slider" style={fill(design.glow)} type="range" min={0} max={100} value={design.glow}
                onChange={(e) => set({ glow: +e.target.value })} aria-label="Glow" />
              <span>{design.glow}%</span></div>
            <div className="srow"><span>Shadow</span>
              <input className="slider" style={fill(design.shadow)} type="range" min={0} max={100} value={design.shadow}
                onChange={(e) => set({ shadow: +e.target.value })} aria-label="Shadow" />
              <span>{design.shadow}%</span></div>

            <div className="tabrow">
              <span>State</span>
              <div className="tabs">
                {(["Default", "Hover", "Pressed", "Disabled"] as const).map((s) => (
                  <button key={s} className={design.state === s ? "on" : ""} onClick={() => set({ state: s })}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* right: type controls */}
          <div className="spanel" onPointerDownCapture={take}>
            <div className="field"><span>Label</span>
              <input className="inp" value={design.label} maxLength={12} placeholder="Your text"
                onChange={(e) => set({ label: e.target.value })} onFocus={take} /></div>
            <div className="field"><span>Font</span>
              <select className="sel" value={design.font} onChange={(e) => set({ font: e.target.value })}>
                {Object.keys(FONTS).map((f) => <option key={f} value={f}>{f}</option>)}
              </select></div>
            <div className="field"><span>Weight</span>
              <select className="sel" value={design.weight} onChange={(e) => set({ weight: e.target.value })}>
                {Object.keys(WEIGHTS).map((w) => <option key={w} value={w}>{w}</option>)}
              </select></div>
            <div className="field"><span>Size</span>
              <div className="numrow">
                <input className="slider" style={fill(((design.size - 20) / 40) * 100)} type="range" min={20} max={60} value={design.size}
                  onChange={(e) => set({ size: +e.target.value })} aria-label="Size" />
                <span className="numbox">{design.size} px</span>
              </div></div>
            <div className="field"><span>Letter spacing</span>
              <div className="numrow">
                <input className="slider" style={fill(((design.track + 2) / 10) * 100)} type="range" min={-2} max={8} value={design.track}
                  onChange={(e) => set({ track: +e.target.value })} aria-label="Letter spacing" />
                <span className="numbox">{design.track} px</span>
              </div></div>
            <div className="field"><span>Align</span>
              <div className="align">
                <button className={design.align === "left" ? "on" : ""} onClick={() => set({ align: "left" })} aria-label="Align left"><AlignLeft /></button>
                <button className={design.align === "center" ? "on" : ""} onClick={() => set({ align: "center" })} aria-label="Align center"><AlignCenter /></button>
                <button className={design.align === "right" ? "on" : ""} onClick={() => set({ align: "right" })} aria-label="Align right"><AlignRight /></button>
                <button className={design.upper ? "on" : ""} onClick={() => set({ upper: !design.upper })} aria-label="Uppercase"><CaseSensitive /></button>
              </div></div>
          </div>

          <div className="studio__foot-btn">
            <button className="push" onClick={onPush}><Zap size={17} strokeWidth={2.4} fill="currentColor" /> Push to a kit</button>
          </div>

          <div className="toolbar">
            <button onClick={onGrid}><span className={`tg${gridOn ? " on" : ""}`}><i /></span> Grid</button>
            <button onClick={onPush}><Eye /> Preview</button>
            <button onClick={onPush}><Save /> Save</button>
            <button onClick={onPush}><Download /> Export</button>
          </div>
        </div>
      </div>
    </div>
  );
}
