import { useEffect, useRef, useState } from "react";
import { Play, Heart, Zap, Trophy, Rocket, Star, Shuffle, ArrowRight } from "lucide-react";
import { navigate } from "@/shell/router";

/* The hero "studio" — a live, customizable candy button rendered entirely in
   CSS (no engine import, so the marketing page stays a lean, instant chunk).
   It attract-loops through a few pre-built designs on its own, and the instant
   the visitor touches any control it hands them the wheel. "Push to kit" shows
   the same design cascaded across states + components, tiny — the appetite-
   whetter for what the real generator does.

   All look comes from CSS custom properties on the .studio root; @property
   registrations (in frontdoor.css) let the colors morph smoothly. */

type Palette = { key: string; name: string; hi: string; mid: string; lo: string; shadow: string; ink: string };

const PALETTES: Palette[] = [
  { key: "indigo", name: "Indigo", hi: "#8a90ff", mid: "#6366f1", lo: "#4f46e5", shadow: "rgba(79,70,229,.55)", ink: "#fff" },
  { key: "violet", name: "Violet", hi: "#c08bff", mid: "#8b5cf6", lo: "#6d28d9", shadow: "rgba(109,40,217,.55)", ink: "#fff" },
  { key: "pink", name: "Pink", hi: "#ff9ecd", mid: "#f472b6", lo: "#db2777", shadow: "rgba(219,39,119,.5)", ink: "#fff" },
  { key: "red", name: "Red", hi: "#ff9a9a", mid: "#fb5e5e", lo: "#dc2626", shadow: "rgba(220,38,38,.5)", ink: "#fff" },
  { key: "amber", name: "Amber", hi: "#ffd985", mid: "#fbbf24", lo: "#f59e0b", shadow: "rgba(245,158,11,.5)", ink: "#7a4406" },
  { key: "lime", name: "Lime", hi: "#a6f08a", mid: "#4ade80", lo: "#16a34a", shadow: "rgba(22,163,74,.45)", ink: "#0a3d1c" },
  { key: "teal", name: "Teal", hi: "#5cead4", mid: "#2dd4bf", lo: "#0d9488", shadow: "rgba(13,148,136,.45)", ink: "#06403a" },
  { key: "sky", name: "Sky", hi: "#8fd6ff", mid: "#38bdf8", lo: "#0284c7", shadow: "rgba(2,132,199,.45)", ink: "#06324f" },
];

const ICONS = { Play, Heart, Zap, Trophy, Rocket, Star } as const;
type IconName = keyof typeof ICONS;

type Design = { palette: string; round: number; shine: number; label: string; icon: IconName };

// The attract loop — hand-tuned, diverse, all gorgeous.
const REEL: Design[] = [
  { palette: "indigo", round: 18, shine: 0.62, label: "Play", icon: "Play" },
  { palette: "pink", round: 30, shine: 0.5, label: "Claim", icon: "Heart" },
  { palette: "teal", round: 10, shine: 0.72, label: "Boost", icon: "Zap" },
  { palette: "amber", round: 32, shine: 0.46, label: "Win!", icon: "Trophy" },
  { palette: "violet", round: 20, shine: 0.66, label: "Start", icon: "Rocket" },
  { palette: "lime", round: 14, shine: 0.6, label: "Go", icon: "Star" },
];

const SURPRISE_LABELS = ["Play", "Start", "Claim", "Boost", "Level Up", "Go!", "Begin", "Win", "Collect", "Next"];
const paletteOf = (key: string) => PALETTES.find((p) => p.key === key) ?? PALETTES[0];

function vars(d: Design): React.CSSProperties {
  const p = paletteOf(d.palette);
  return {
    ["--c-hi" as string]: p.hi,
    ["--c-mid" as string]: p.mid,
    ["--c-lo" as string]: p.lo,
    ["--c-shadow" as string]: p.shadow,
    ["--c-ink" as string]: p.ink,
    ["--round" as string]: d.round,
    ["--shine" as string]: d.shine,
  };
}

export function HeroStudio() {
  const [design, setDesign] = useState<Design>(REEL[0]);
  const [driving, setDriving] = useState(false); // user has taken over
  const [view, setView] = useState<"edit" | "kit">("edit");
  const reelI = useRef(0);
  const Icon = ICONS[design.icon];

  // Attract loop — cycles until the visitor takes the wheel. Paused for
  // reduced-motion and whenever the kit preview is showing.
  useEffect(() => {
    if (driving || view === "kit") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      reelI.current = (reelI.current + 1) % REEL.length;
      setDesign(REEL[reelI.current]);
    }, 2600);
    return () => clearInterval(t);
  }, [driving, view]);

  const takeOver = () => { if (!driving) setDriving(true); };
  const patch = (p: Partial<Design>) => { takeOver(); setDesign((d) => ({ ...d, ...p })); };

  const surprise = () => {
    takeOver();
    const pal = PALETTES[Math.floor(rnd() * PALETTES.length)].key;
    setDesign({
      palette: pal,
      round: Math.round(rnd() * 32),
      shine: 0.35 + rnd() * 0.5,
      label: SURPRISE_LABELS[Math.floor(rnd() * SURPRISE_LABELS.length)],
      icon: (Object.keys(ICONS) as IconName[])[Math.floor(rnd() * Object.keys(ICONS).length)],
    });
  };

  return (
    <div className="studio" style={vars(design)}>
      <div className="studio__stage">
        <div className="studio__grid" aria-hidden="true" />
        <span className={`studio__flag${driving ? " is-driving" : ""}`}>
          {driving ? "✦ your design" : "✦ auto-designing — grab a control"}
        </span>

        {view === "edit" ? (
          <div className="studio__previewwrap">
            <button className="studio-btn" type="button" aria-label={`Preview button: ${design.label}`} tabIndex={-1}>
              <Icon size={22} strokeWidth={2.6} fill={design.icon === "Play" || design.icon === "Heart" || design.icon === "Star" ? "currentColor" : "none"} />
              <span>{design.label || " "}</span>
            </button>
          </div>
        ) : (
          <MiniKit design={design} />
        )}
      </div>

      <div className="studio__controls" onPointerDownCapture={takeOver}>
        <div className="ctl">
          <span className="ctl__label">Color</span>
          <div className="swatches" role="group" aria-label="Button color">
            {PALETTES.map((p) => (
              <button
                key={p.key}
                className={`swatch${design.palette === p.key ? " is-on" : ""}`}
                style={{ background: `linear-gradient(160deg, ${p.hi}, ${p.lo})` }}
                aria-label={p.name}
                aria-pressed={design.palette === p.key}
                onClick={() => patch({ palette: p.key })}
              />
            ))}
          </div>
        </div>

        <div className="ctl">
          <label className="ctl__label" htmlFor="s-round">Roundness</label>
          <input id="s-round" className="slider2" type="range" min={0} max={32} value={design.round}
            onChange={(e) => patch({ round: +e.target.value })} />
        </div>

        <div className="ctl">
          <label className="ctl__label" htmlFor="s-shine">Shine</label>
          <input id="s-shine" className="slider2" type="range" min={0} max={100} value={Math.round(design.shine * 100)}
            onChange={(e) => patch({ shine: +e.target.value / 100 })} />
        </div>

        <div className="ctl">
          <label className="ctl__label" htmlFor="s-label">Label</label>
          <input id="s-label" className="studio-text" type="text" maxLength={14} value={design.label}
            placeholder="Your text" onChange={(e) => patch({ label: e.target.value })} onFocus={takeOver} />
          <button className="chip-btn" onClick={surprise} title="Surprise me">
            <Shuffle size={14} strokeWidth={2} /> Surprise me
          </button>
        </div>
      </div>

      <div className="studio__foot">
        {view === "edit" ? (
          <button className="studio__push" onClick={() => setView("kit")}>
            <Zap size={16} strokeWidth={2.2} fill="currentColor" /> Push to a kit
          </button>
        ) : (
          <>
            <button className="studio__back" onClick={() => setView("edit")}>← Keep editing</button>
            <button className="studio__open" onClick={() => navigate("#/app")}>
              Do it for real <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* One design's DNA cascaded across states + components — tiny. */
function MiniKit({ design }: { design: Design }) {
  const Icon = ICONS[design.icon];
  const label = design.label || "Play";
  return (
    <div className="minikit">
      <div className="minikit__row">
        {(["Default", "Hover", "Pressed", "Disabled"] as const).map((s) => (
          <figure className="mk-cell" key={s}>
            <button className={`studio-btn mk-btn mk-${s.toLowerCase()}`} tabIndex={-1} aria-hidden="true">
              <Icon size={12} strokeWidth={2.6} /> <span>{label}</span>
            </button>
            <figcaption>{s}</figcaption>
          </figure>
        ))}
      </div>
      <div className="minikit__row minikit__row--parts">
        <span className="mk-pill" aria-hidden="true"><Icon size={11} strokeWidth={2.6} /> {label}</span>
        <span className="mk-badge" aria-hidden="true">NEW</span>
        <span className="mk-round" aria-hidden="true"><Icon size={13} strokeWidth={2.6} /></span>
        <span className="mk-toggle" aria-hidden="true"><i /></span>
        <span className="mk-bar" aria-hidden="true"><i style={{ width: "62%" }} /></span>
      </div>
      <p className="minikit__cap">One button’s DNA → <b>46 components × 4 states</b>, instantly.</p>
    </div>
  );
}

/* Deterministic-ish jitter without Math.random (kept out of module scope so the
   value differs per click via a rolling seed). */
let seed = 0x2f6e2b1;
function rnd() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return ((seed >>> 0) % 100000) / 100000;
}
