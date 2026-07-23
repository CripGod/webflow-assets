import { useState, useRef, useEffect } from "react";
import { CheckCircle2, CloudOff, CloudUpload, Download, Image, Copy, RotateCcw, FileDown, FileUp, FileJson, User, Moon, Sun, Gamepad2, Sparkles, ChevronDown } from "lucide-react";
import { useGen, hydrate, getDefault } from "@/generator/store";
import { AccountMenu, useCloudStatus } from "./AccountMenu";
import { renderBevel } from "@/generator/bevel";
import { downloadSvg, downloadPng, downloadHtml, downloadSettings, downloadGameKit, copyText } from "@/generator/exportUtils";

// The actual PatternBreak logo file, bundled from the repo's top-level
// pb-logo.png — never redrawn or interpreted.
import logoUrl from "../../pb-logo.png";

function Logo() {
  return <img className="logo" src={logoUrl} alt="PatternBreak" />;
}

/* A quiet toolbar: brand at the left, an empty center (help now lives in
   tooltips), and one tight cluster of global actions on the right —
   save-status, shine, theme, account, and Export. */
export function TopBar() {
  const { cfg, saveStatus, selectedState, theme, setTheme, replaceConfig, shine, setShine } = useGen();
  const cloud = useCloudStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);
  const [, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const acctRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctOpen(false);
    };
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

  const importSettings = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== "object" || !parsed.presetId || !parsed.candy) return;
        replaceConfig(hydrate(parsed));
      } catch { /* not a settings file — ignore */ }
    };
    reader.readAsText(file);
  };

  return (
    <header className="top">
      <div className="brand">
        <Logo />
        <span className="name">UI Kit Maker</span>
      </div>

      {/* empty center — help now lives in tooltips, not a narrator bar */}
      <div className="top-spacer" />

      <div className="topcluster">
        <div className="saved">
          {cloud.state === "error" ? (
            <><span className="ok"><CloudOff size={18} strokeWidth={1.9} color="#d97706" /></span>Cloud paused</>
          ) : cloud.state === "synced" || cloud.state === "syncing" ? (
            <><span className="ok"><CloudUpload size={18} strokeWidth={1.9} color={cloud.state === "synced" && saveStatus === "saved" ? "#16a34a" : "#9aa1ac"} /></span>{cloud.state === "synced" && saveStatus === "saved" ? "Saved" : "Syncing…"}</>
          ) : (
            <><span className="ok"><CheckCircle2 size={18} strokeWidth={1.9} color={saveStatus === "saved" ? "#16a34a" : "#9aa1ac"} /></span>{saveStatus === "saved" ? "Saved" : "Saving…"}</>
          )}
        </div>

        <button className={`acct${shine ? " on" : ""}`} onClick={() => setShine(!shine)}
          aria-label={shine ? "Turn the shine sweep off" : "Turn the shine sweep on"} aria-pressed={shine}
          title={shine ? "Shine sweep — on" : "Shine sweep — off"} data-shinebtn="1">
          <Sparkles size={17} strokeWidth={1.9} />
        </button>

        <button className="acct" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}>
          {theme === "dark" ? <Sun size={17} strokeWidth={1.9} /> : <Moon size={17} strokeWidth={1.9} />}
        </button>

        <div ref={acctRef} style={{ position: "relative" }}>
          <button className={`acct${cloud.state === "synced" ? " on" : ""}`} onClick={() => setAcctOpen(!acctOpen)}
            aria-label="Account" title={cloud.email ? `Account — ${cloud.email}` : "Account"}>
            <User size={17} strokeWidth={1.9} />
          </button>
          {acctOpen && <AccountMenu onClose={() => setAcctOpen(false)} />}
        </div>

        <div ref={menuRef} style={{ position: "relative" }}>
          <button className="exportbtn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Export and settings" aria-haspopup="menu" aria-expanded={menuOpen}>
            <Download size={15} strokeWidth={1.9} /> Export <ChevronDown size={14} strokeWidth={2} />
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
              <button onClick={() => { void downloadGameKit(cfg); setMenuOpen(false); }}>
                <Gamepad2 size={15} strokeWidth={1.8} /> Export game kit
              </button>
              <button onClick={() => { downloadSettings(cfg); setMenuOpen(false); }}>
                <FileJson size={15} strokeWidth={1.8} /> Export settings
              </button>
              <button onClick={() => { fileRef.current?.click(); }}>
                <FileUp size={15} strokeWidth={1.8} /> Import settings…
              </button>
              <button onClick={() => {
                // component-only reset: the stage (canvas color, grid, zoom) is
                // the user's workspace and stays put
                const d = getDefault();
                d.canvas = cfg.canvas;
                replaceConfig(d);
                setMenuOpen(false);
              }}>
                <RotateCcw size={15} strokeWidth={1.8} /> Reset component
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importSettings(f); e.target.value = ""; setMenuOpen(false); }} />
        </div>
      </div>
    </header>
  );
}
