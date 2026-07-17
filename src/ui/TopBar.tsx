import { useState, useRef, useEffect } from "react";
import { ChevronDown, Code2, Check, CheckCircle2, MoreHorizontal, Download, Image, Copy, RotateCcw, Hammer, PenTool } from "lucide-react";
import { useGen } from "@/generator/store";
import { PRESETS, defaultConfig } from "@/generator/model";
import { renderBevel } from "@/generator/bevel";
import { downloadSvg, downloadPng, copyText } from "@/generator/exportUtils";

/** PatternBreak logo — loads the real asset from /pb-logo.png (drop the PNG in
 *  the repo's public/ folder). Falls back to a drawn mark until the file exists. */
function Logo() {
  const [missing, setMissing] = useState(false);
  if (!missing) {
    return (
      <img className="logo" src={`${import.meta.env.BASE_URL}pb-logo.png`} alt="PatternBreak"
        onError={() => setMissing(true)} />
    );
  }
  return (
    <svg className="logo" viewBox="0 0 100 100" aria-label="PatternBreak">
      <circle cx="50" cy="50" r="37" fill="none" stroke="#111318" strokeWidth="3.4" />
      <line x1="4" y1="96" x2="96" y2="4" stroke="#111318" strokeWidth="3.4" strokeLinecap="round" />
      <text x="49" y="52" fontFamily="Georgia, serif" fontSize="40" fontWeight="600" fill="#111318"
        textAnchor="middle" dominantBaseline="central" letterSpacing="-3">PB</text>
    </svg>
  );
}

export function TopBar() {
  const { cfg, setPreset, saveStatus, update, phase, setPhase, selectedState } = useGen();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const svg = () => renderBevel(cfg, selectedState);
  const stateValue =
    cfg.visible.hover && cfg.visible.pressed && cfg.visible.disabled ? "4" :
    cfg.visible.hover && cfg.visible.pressed ? "3" :
    cfg.visible.hover ? "2" : "1";

  const copyCode = () => {
    void copyText(svg()).then((ok) => {
      if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1400); }
    });
  };

  return (
    <header className="top">
      <div className="brand">
        <Logo />
        <span className="name">The UI Generator</span>
      </div>
      <div className="top-spacer" />

      <label className="fieldbox">
        <span className="fl">Style preset</span>
        <select value={cfg.presetId} onChange={(e) => setPreset(e.target.value)} aria-label="Style preset">
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
      </label>

      <label className="fieldbox" style={{ minWidth: 148 }}>
        <span className="fl">States</span>
        <select value={stateValue} aria-label="States shown"
          onChange={(e) => {
            const n = +e.target.value;
            update((c) => { c.visible.hover = n >= 2; c.visible.pressed = n >= 3; c.visible.disabled = n >= 4; });
          }}>
          <option value="4">4 states</option>
          <option value="3">3 states</option>
          <option value="2">2 states</option>
          <option value="1">1 state</option>
        </select>
        <span className="chev"><ChevronDown size={17} strokeWidth={2} /></span>
      </label>

      <button className="copycode" onClick={copyCode} title="Copy component code (SVG)">
        {copied ? <Check size={17} strokeWidth={2.2} color="#16a34a" /> : <Code2 size={17} strokeWidth={1.9} />}
        {copied ? "Copied" : "Copy code"}
      </button>

      <button className={`buildkit${phase === "kit" ? " on" : ""}`}
        onClick={() => setPhase(phase === "kit" ? "master" : "kit")}
        title={phase === "kit" ? "Back to the master component" : "Save style and apply it to the kit"}>
        {phase === "kit" ? <PenTool size={16} strokeWidth={1.9} /> : <Hammer size={16} strokeWidth={1.9} />}
        {phase === "kit" ? "Edit master" : "Build kit"}
      </button>

      <div className="top-spacer" />

      <div className="saved">
        <span className="ok"><CheckCircle2 size={19} strokeWidth={1.9} color={saveStatus === "saved" ? "#16a34a" : "#9aa1ac"} /></span>
        {saveStatus === "saved" ? "All changes saved" : "Saving…"}
      </div>

      <div ref={menuRef} style={{ position: "relative" }}>
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="More actions">
          <MoreHorizontal size={20} strokeWidth={1.8} />
        </button>
        {menuOpen && (
          <div className="menu-pop">
            <button onClick={() => { downloadSvg(svg(), `ui-${cfg.presetId}-${selectedState}.svg`); setMenuOpen(false); }}>
              <Download size={15} strokeWidth={1.8} /> Export SVG
            </button>
            <button onClick={() => { void downloadPng(svg(), `ui-${cfg.presetId}-${selectedState}@2x.png`, 2); setMenuOpen(false); }}>
              <Image size={15} strokeWidth={1.8} /> Export PNG 2×
            </button>
            <button onClick={() => { copyCode(); setMenuOpen(false); }}>
              <Copy size={15} strokeWidth={1.8} /> Copy SVG code
            </button>
            <button onClick={() => { const d = defaultConfig(); update((c) => Object.assign(c, d)); setMenuOpen(false); }}>
              <RotateCcw size={15} strokeWidth={1.8} /> Reset to defaults
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
