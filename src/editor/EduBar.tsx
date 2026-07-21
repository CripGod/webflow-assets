import { useEffect, useRef } from "react";
import { X, ChevronDown, ChevronUp, Lightbulb, Check, Code2, Shapes, Image } from "lucide-react";
import { useForge } from "@/state/store";

export function EduBar() {
  const expanded = useForge((s) => s.helpExpanded);
  const setExpanded = useForge((s) => s.setHelpExpanded);
  const paused = useRef(false);
  const timer = useRef<number | null>(null);

  // auto-collapse after 12s of no interaction; paused while hovered/focused (§10)
  useEffect(() => {
    if (!expanded) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const tick = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        if (!paused.current) setExpanded(false);
        else tick();
      }, 12000);
    };
    tick();
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [expanded, setExpanded]);

  const style = { transition: "height 220ms cubic-bezier(0.16,0.84,0.44,1)" } as const;

  if (!expanded) {
    return (
      <div className="forge-help is-collapsed" style={style}>
        <div className="help-collapsed-inner">
          <Lightbulb size={16} strokeWidth={1.5} color="#f2a83b" />
          <span className="t-bb-heading">Help &amp; tips</span>
          <button className="icon-btn" style={{ border: 0, width: 32, height: 32 }} onClick={() => setExpanded(true)} aria-label="Expand help">
            <ChevronUp size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="forge-help is-expanded"
      style={style}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocusCapture={() => (paused.current = true)}
      onBlurCapture={() => (paused.current = false)}
    >
      <div className="help-cols">
        <div className="help-col" style={{ flexBasis: "27%" }}>
          <span className="t-bb-heading">Built with open source</span>
          <ul>
            <li className="t-bb-body"><Shapes size={13} strokeWidth={1.5} className="help-check" />FORGE is powered by open-source libraries you already know.</li>
            <li className="t-bb-body"><Check size={13} strokeWidth={1.5} className="help-check" />Open source is powerful</li>
            <li className="t-bb-body"><Check size={13} strokeWidth={1.5} className="help-check" />Transparent &amp; extensible</li>
            <li className="t-bb-body"><Check size={13} strokeWidth={1.5} className="help-check" />Built for designers &amp; developers</li>
          </ul>
        </div>
        <div className="help-col" style={{ flexBasis: "22%" }}>
          <span className="t-bb-heading">How it works</span>
          <ul>
            <li className="t-bb-body"><span className="help-num">1</span>Design your master component</li>
            <li className="t-bb-body"><span className="help-num">2</span>Configure states and variants</li>
            <li className="t-bb-body"><span className="help-num">3</span>Generate a complete, consistent kit</li>
          </ul>
        </div>
        <div className="help-col" style={{ flexBasis: "24%" }}>
          <span className="t-bb-heading">Output includes</span>
          <ul>
            <li className="t-bb-body"><Code2 size={13} strokeWidth={1.5} className="help-check" style={{ color: "#8993a3" }} />HTML Preview (live, accessible markup)</li>
            <li className="t-bb-body"><Shapes size={13} strokeWidth={1.5} className="help-check" style={{ color: "#8993a3" }} />SVG (vector, resolution independent)</li>
            <li className="t-bb-body"><Image size={13} strokeWidth={1.5} className="help-check" style={{ color: "#8993a3" }} />PNG (advanced effects / fallbacks)</li>
          </ul>
        </div>
        <div className="help-col" style={{ flexBasis: "27%" }}>
          <span className="t-bb-heading" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Lightbulb size={13} strokeWidth={1.5} color="#f2a83b" /> Tip
          </span>
          <ul>
            <li className="t-bb-body">Advanced effects like filters, gradients, and blend modes may require PNG to render correctly in every environment.</li>
          </ul>
        </div>
      </div>
      <button className="help-collapse" onClick={() => setExpanded(false)} aria-label="Collapse help">
        <ChevronDown size={16} strokeWidth={1.5} />
      </button>
      <button className="help-close" onClick={() => setExpanded(false)} aria-label="Close help">
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
