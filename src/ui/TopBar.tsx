import { useState, useRef, useEffect } from "react";
import { Code2, Check, CheckCircle2, MoreHorizontal, Download, Image, Copy, RotateCcw, FileDown } from "lucide-react";
import { useGen } from "@/generator/store";
import { defaultConfig } from "@/generator/model";
import { renderBevel } from "@/generator/bevel";
import { downloadSvg, downloadPng, downloadHtml, copyText } from "@/generator/exportUtils";

// The actual PatternBreak logo file, bundled from the repo's top-level
// pb-logo.png — never redrawn or interpreted.
import logoUrl from "../../pb-logo.png";

function Logo() {
  return <img className="logo" src={logoUrl} alt="PatternBreak" />;
}

// v9: the bar stays out of the way — presets, states, and the kit live in the
// left panel. Up here: copy the code, download a working HTML page, save
// status, and the overflow exports.
export function TopBar() {
  const { cfg, saveStatus, update, selectedState } = useGen();
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const svg = () => renderBevel(cfg, selectedState);
  const copyCode = () => {
    void copyText(svg()).then((ok) => {
      if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1400); }
    });
  };
  const dlHtml = () => downloadHtml(cfg, `ui-${cfg.presetId}.html`);

  return (
    <header className="top">
      <div className="brand">
        <Logo />
        <span className="name">The UI Generator</span>
      </div>
      <div className="top-spacer" />

      <button className="copycode" onClick={copyCode} title="Copy component code (SVG)">
        {copied ? <Check size={17} strokeWidth={2.2} color="#16a34a" /> : <Code2 size={17} strokeWidth={1.9} />}
        {copied ? "Copied" : "Copy code"}
      </button>

      <button className="copycode" onClick={dlHtml} title="Download a self-contained HTML page with every state">
        <FileDown size={17} strokeWidth={1.9} />
        Download HTML
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
            <button onClick={() => { dlHtml(); setMenuOpen(false); }}>
              <FileDown size={15} strokeWidth={1.8} /> Download HTML
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
