import { ArrowRight, Save } from "lucide-react";
import { useForge } from "@/state/store";
import type { StateName, PreviewMode } from "@/model/types";

const STATES: { value: StateName; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "hover", label: "Hover" },
  { value: "pressed", label: "Pressed" },
  { value: "disabled", label: "Disabled" },
];

export function TopBar() {
  const { activeState, setActiveState, previewMode, setPreviewMode, save } = useForge();
  const dirty = useForge((s) => s.isDirty());

  return (
    <header className="forge-topbar">
      <div className="tb-dots" aria-hidden>
        <i style={{ background: "#ff5f57" }} />
        <i style={{ background: "#febc2e" }} />
        <i style={{ background: "#28c840" }} />
      </div>
      <div className="tb-brand">
        <span className="t-wordmark">FORGE</span>
        <span className="t-descriptor">Component Kit Builder</span>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <span className="pill pill--active">
          <span className="pill-step">1</span>
          <span className="pill-label">Master Component</span>
        </span>
        <span className="tb-arrow"><ArrowRight size={16} strokeWidth={1.5} /></span>
        <span className="pill pill--idle">
          <span className="pill-step">2</span>
          <span className="pill-label">Build Kit</span>
        </span>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group">
        <span className="tb-statelabel">State</span>
        <div className="seg" role="radiogroup" aria-label="Component state">
          {STATES.map((s) => (
            <button key={s.value} type="button" role="radio" aria-checked={activeState === s.value}
              className={activeState === s.value ? "is-selected" : ""}
              onClick={() => setActiveState(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tb-group" style={{ marginLeft: 20 }}>
        <div className="seg" role="radiogroup" aria-label="Preview mode">
          {([["design", "Design", 72], ["html", "HTML Preview", 98]] as [PreviewMode, string, number][]).map(
            ([v, label, w]) => (
              <button key={v} type="button" role="radio" aria-checked={previewMode === v}
                className={previewMode === v ? "is-selected" : ""} style={{ minWidth: w }}
                onClick={() => setPreviewMode(v)}>
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <div className="tb-spacer" />

      <div className="tb-group" style={{ gap: 12 }}>
        {dirty && (
          <div className="tb-unsaved">
            <div className="row"><span className="dot" /><span className="l1">Unsaved changes</span></div>
            <span className="l2">Save before switching states</span>
          </div>
        )}
        <button className="icon-btn" title="Save" onClick={save} aria-label="Save">
          <Save size={16} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
