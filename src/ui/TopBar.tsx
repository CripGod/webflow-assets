import { useState, useRef, useEffect } from "react";
import { CheckCircle2, CloudOff, CloudUpload, MoreHorizontal, Download, Image, Copy, RotateCcw, FileDown, FileUp, FileJson, User, Moon, Sun, Gamepad2, Sparkles } from "lucide-react";
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

/* When Help is on (❓ at the bottom of the tray), this area narrates whatever
   the pointer is over. v68: a real narrator — curated explanations for whole
   control families first, then label-aware fallbacks, so every roll-over
   says something useful instead of going quiet between titled elements. */
const txtOf = (el: HTMLElement | null) => (el?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
const LABEL_NOTES: Record<string, string> = {
  "Smoothness": "rounds the silhouette's corners. Procedural shapes reshape live; imported outlines keep their authored geometry.",
  "Bevel width": "how much wall sits between the outer edge and the face — the inner shapes follow a true Offset Path, never a rescale.",
  "Extrusion depth": "the body under the face — the candy's physical thickness. The base line stays put; the face rises.",
  "Gloss height": "how far the glass sheet reaches down the face.",
  "Gloss opacity": "how hard the glass reads. Softness feathers its lower edge.",
  "Light angle": "the single source of truth — every gradient, the shadow side, the gloss and the speculars all follow it.",
  "Glow": "the state aura color pulls from the Glow well unless overridden.",
  "Size": "type size at master scale — every component's text follows proportionally.",
  "Weight": "clamped to what the loaded face really supports.",
  "Letter spacing": "tracking in em/100 — display faces usually want a touch more.",
  "Pattern scale": "the printed-wrap cell size; tone-on-tone from the shell color unless you pick one.",
  "Opacity": "0 hides the layer entirely — same as toggling it off, but slideable.",
  "Segments": "how many cells the bar splits into (2–12).",
  "Corner softness": "rounds procedural silhouettes; imported paths keep their drawn corners.",
};
type HintRule = [string, (el: HTMLElement) => string | null];
const HELP_RULES: HintRule[] = [
  ["[data-help]", (el) => el.getAttribute("data-help")],
  [".presetgrid button, .stylegrid button", (el) => `“${txtOf(el)}” — a full candy construction: shell, gloss, depth and palette. Click to apply it (to the focused piece only while you're editing one).`],
  [".shapegrid .shapecard", (el) => `${el.title || txtOf(el)} — click to swap the silhouette. Material stays put; with a component focused, only that piece changes shape.`],
  ["input[type=\"range\"]", (el) => {
    const lbl = txtOf(el.closest(".ctl")?.querySelector("label") as HTMLElement | null);
    const note = LABEL_NOTES[lbl] ?? "drag to adjust — the number box beside it takes exact values.";
    return lbl ? `${lbl} — ${note}` : `Drag to adjust — ${note}`;
  }],
  [".numin", () => "Exact-value box — same control as the slider, for typing precise numbers."],
  [".sec-head", (el) => `${txtOf(el)} — click to open or close this section. The search box up top finds any control inside.`],
  ["input[type=\"color\"], .well", (el) => {
    const lbl = txtOf(el.closest(".ctl, .roleline")?.querySelector("label, .rolename") as HTMLElement | null);
    return `${lbl || "Color well"} — click to pick a color. Roles cascade: most layers derive their shades from these wells.`;
  }],
  ["select", (el) => {
    const lbl = txtOf(el.closest("label")?.querySelector("span, b") as HTMLElement | null) || el.getAttribute("aria-label") || "";
    return `${lbl || "Picker"} — choose from the list; changes apply instantly and keep being editable.`;
  }],
  [".fontpick", () => "The typeface — open to browse the game-font library; real weight and width ranges load per face."],
  ["button.kp-edit", () => "Edit this component — opens it in the editor. Every design change stays on this piece only; save it as a style to reuse the look."],
  [".kp-exportmain", () => "Runs the export format you used last. The arrow beside it lists all three."],
  [".kp-exportarrow", () => "All export formats — engine kit (ZIP of atomic PNGs + manifests), layered SVG pack (fonts embedded), sprite-sheet PNG."],
  [".kp-share", () => "Copies a view-only link to this whole kit — colors, shapes, labels, everything. Downloads stay with the owner."],
  ["[data-shinebtn]", () => "Shine sweep — a moving specular pass over every live piece. Preview flair only; exports are untouched."],
  [".rail-dest", (el) => (el.getAttribute("aria-label") === "The Kit"
    ? "The Kit — the living guidelines sheet: every component, every state, all the exports."
    : "The Board — stage pieces over screenshots and backgrounds, then export each artboard as a PNG.")],
  [".rail button", (el) => `${el.getAttribute("aria-label") || "Section shuttle"} — scrolls the tray to that group of controls.`],
  [".scard", () => "A state preview — Default, Hover, Pressed and Disabled share one footprint, so a live layout never shifts."],
  [".hero-slot", () => "The hero — the focused piece at full size. In Play mode it's real: hover it, press it, drag its value."],
  [".focusnote button, .lockrow button", (el) => el.title || `${txtOf(el)}.`],
  [".kp-line", () => "Waypoint connector — a dimensional tube carrying the theme's own pattern; dashed means not yet reached."],
  [".kp-rail3", () => "Reward-track rail — the lit run wears the theme pattern; nodes mark claimed, claimable and current tiers."],
  [".kp-piece, .gp-piece, .kp-live", (el) => {
    const cap = txtOf(el.closest("figure")?.querySelector("figcaption") as HTMLElement | null);
    return `${cap || "Live piece"} — rendered by the engine right now. Click to play its behavior; ✎ opens it for per-piece styling.`;
  }],
  ["input[type=\"checkbox\"]", (el) => {
    const lbl = txtOf(el.closest("label") as HTMLElement | null);
    return lbl ? `${lbl} — toggle it; anything it unlocks unfolds right below.` : null;
  }],
  ["input[type=\"text\"], input[type=\"search\"]", (el) => {
    const ph = (el as HTMLInputElement).placeholder;
    return ph ? `Type here — ${ph.toLowerCase()}` : "Type here — changes land as you type.";
  }],
];
function describeHover(target: HTMLElement): string {
  for (const [sel, fn] of HELP_RULES) {
    const el = target.closest(sel) as HTMLElement | null;
    if (el) { const h = fn(el); if (h) return h; }
  }
  const titled = target.closest("[title],[aria-label]") as HTMLElement | null;
  if (titled) return titled.title || titled.getAttribute("aria-label") || "";
  const btn = target.closest("button") as HTMLElement | null;
  if (btn && txtOf(btn)) return `${txtOf(btn)} — click to run it.`;
  return "";
}
function HelpHint() {
  const { helpOn } = useGen();
  const [hint, setHint] = useState("");
  useEffect(() => {
    if (!helpOn) { setHint(""); return; }
    const over = (e: MouseEvent) => {
      const h = describeHover(e.target as HTMLElement);
      // sticky: keep the last explanation while crossing quiet gaps, so the
      // narrator never flickers to empty mid-tray
      if (h) setHint(h);
    };
    document.addEventListener("mouseover", over);
    return () => document.removeEventListener("mouseover", over);
  }, [helpOn]);
  if (!helpOn) return <span className="helphint off">Turn on Help (❓ bottom of the tray) for live hints here.</span>;
  return <span className="helphint">{hint || "Roll over anything — I'll explain it here."}</span>;
}

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
        <span className="name">The UI Generator</span>
      </div>
      <div className="top-spacer" />

      <HelpHint />

      <div className="top-spacer" />

      <div className="saved">
        {cloud.state === "error" ? (
          <>
            <span className="ok"><CloudOff size={19} strokeWidth={1.9} color="#d97706" /></span>
            Cloud paused — saved locally
          </>
        ) : cloud.state === "synced" || cloud.state === "syncing" ? (
          <>
            <span className="ok"><CloudUpload size={19} strokeWidth={1.9} color={cloud.state === "synced" && saveStatus === "saved" ? "#16a34a" : "#9aa1ac"} /></span>
            {cloud.state === "synced" && saveStatus === "saved" ? "Saved to your account" : "Syncing…"}
          </>
        ) : (
          <>
            <span className="ok"><CheckCircle2 size={19} strokeWidth={1.9} color={saveStatus === "saved" ? "#16a34a" : "#9aa1ac"} /></span>
            {saveStatus === "saved" ? "All changes saved" : "Saving…"}
          </>
        )}
      </div>

      <button className={`acct${shine ? " on" : ""}`} onClick={() => setShine(!shine)}
        aria-label={shine ? "Turn the shine sweep off" : "Turn the shine sweep on"} aria-pressed={shine}
        title={shine ? "Shine sweep — on everywhere" : "Shine sweep — off"} data-shinebtn="1">
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
    </header>
  );
}
