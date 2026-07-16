import { useMemo } from "react";
import { Grid3x3, Scan, Upload } from "lucide-react";
import { useForge } from "@/state/store";
import { HeroButton } from "@/render/HeroButton";
import { toHtml } from "@/export/toHtml";
import { Slider } from "./controls/Controls";

function Rulers() {
  const cols = useMemo(() => Array.from({ length: 14 }, (_, i) => i * 100), []);
  const rows = useMemo(() => Array.from({ length: 9 }, (_, i) => i * 100), []);
  return (
    <>
      <div className="ruler-corner" />
      <div className="ruler-top">
        {cols.map((v) => (
          <span key={v} className="ruler-tick" style={{ left: v, top: 12 }}>{v}</span>
        ))}
      </div>
      <div className="ruler-left">
        {rows.map((v) => (
          <span key={v} className="ruler-tick" style={{ top: v + 4, left: 6 }}>{v}</span>
        ))}
      </div>
    </>
  );
}

export function Canvas() {
  const { previewMode, gridVisible, gridOpacity, setGridVisible, setGridOpacity } = useForge();
  const master = useForge((s) => s.doc.master);
  const activeState = useForge((s) => s.activeState);
  const helpExpanded = useForge((s) => s.helpExpanded);

  const minor = "rgba(122,134,151,0.10)";
  const major = "rgba(122,134,151,0.16)";
  const gridBg = gridVisible
    ? {
        backgroundImage: `
          linear-gradient(${major} 1px, transparent 1px),
          linear-gradient(90deg, ${major} 1px, transparent 1px),
          linear-gradient(${minor} 1px, transparent 1px),
          linear-gradient(90deg, ${minor} 1px, transparent 1px)`,
        backgroundSize: "120px 120px, 120px 120px, 24px 24px, 24px 24px",
        opacity: gridOpacity,
      }
    : {};

  const toolbarBottom = 34; // 34px above the help bar (help bar is its own grid row)

  return (
    <div className="forge-canvas">
      <Rulers />
      <div className="grid-plane" style={gridBg} />

      {previewMode === "design" ? (
        <div className="stage">
          <div className="stage-inner">
            <div className="hero-wrap">
              <HeroButton master={master} state={activeState} />
            </div>
          </div>
        </div>
      ) : (
        <div className="stage" style={{ alignItems: "stretch", padding: "24px 32px" }}>
          <HtmlPreview />
        </div>
      )}

      <div className="canvas-toolbar" style={{ bottom: toolbarBottom, width: 500 }} data-help={helpExpanded}>
        <div className="ct-group">
          <button className={`ct-icon${gridVisible ? " is-active" : ""}`} title="Grid" onClick={() => setGridVisible(!gridVisible)}>
            <Grid3x3 size={18} strokeWidth={1.5} />
          </button>
          <button className="ct-icon" title="Fit"><Scan size={18} strokeWidth={1.5} /></button>
        </div>
        <div className="ct-div" />
        <div className="ct-group" style={{ flex: 1 }}>
          <span className="ct-label">Grid opacity</span>
          <Slider value={Math.round(gridOpacity * 100)} min={0} max={100} onChange={(v) => setGridOpacity(v / 100)} />
          <span className="ct-label" style={{ width: 34, textAlign: "right" }}>{Math.round(gridOpacity * 100)}%</span>
        </div>
        <div className="ct-div" />
        <div className="ct-group">
          <button className="ct-icon" title="Upload background" style={{ width: "auto", padding: "0 10px", gap: 6, display: "flex" }}>
            <Upload size={16} strokeWidth={1.5} /> <span className="ct-label">Upload background</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function HtmlPreview() {
  const master = useForge((s) => s.doc.master);
  const activeState = useForge((s) => s.activeState);
  const html = useMemo(() => toHtml(master, activeState), [master, activeState]);
  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto", background: "#fff", border: "1px solid var(--forge-border-default)", borderRadius: 8 }}>
      <pre style={{ margin: 0, padding: 20, fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: 11, lineHeight: 1.6, color: "#364152", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        <code>{html}</code>
      </pre>
    </div>
  );
}
