import { useState, useCallback } from "react";
import {
  ArrowRight, Play, BadgeCheck, Infinity as InfinityIcon, Gamepad2, ChevronDown,
  Shapes, Box, Layers, Upload, Building2, Rocket, GraduationCap, PenTool, Blocks,
  Lock, Check, Coins, Star, Github,
} from "lucide-react";
import { navigate } from "@/shell/router";
import { openAuth } from "@/shell/authOverlay";
import { HeroStudio } from "./HeroStudio";
import { KitShowcase } from "./KitShowcase";
import { DEFAULT_DESIGN, type Design } from "./studioModel";
import logoUrl from "../../pb-logo.png";

const REPO_URL = "https://github.com/patternbreakai/ui-kit-maker";

const TRUST = [
  { icon: BadgeCheck, t: "100% Deterministic", s: "Same input, same output" },
  { icon: InfinityIcon, t: "Yours forever", s: "Export and ship" },
  { icon: Gamepad2, t: "Game ready", s: "Engine-ready assets" },
];
const SPEED = [
  { icon: Shapes, cls: "pink", title: "Shape it", body: "Dial in shape, nudge, radius, depth and more — once.", chips: ["dots"] },
  { icon: Box, cls: "blue", title: "Skin it", body: "Pick a material, tune glow, shadow, and surface detail.", chips: ["swatch"] },
  { icon: Layers, cls: "green", title: "State-aware", body: "Default, hover, pressed, disabled — all connected.", chips: ["states"] },
  { icon: Upload, cls: "gold", title: "Export anywhere", body: "PNG, SVG, JSON, Figma, or engine-ready UI assets.", chips: ["PNG", "SVG", "JSON"] },
];
const CREATORS = [
  { icon: Gamepad2, g: "linear-gradient(160deg,#7c3aed,#2563eb)", t: "Game devs", b: "Ship faster with cohesive, scalable UI that evolves." },
  { icon: Building2, g: "linear-gradient(160deg,#db2777,#7c3aed)", t: "Indies & small studios", b: "Make your game look premium — without a huge team." },
  { icon: Rocket, g: "linear-gradient(160deg,#f59e0b,#db2777)", t: "Hobbyists & makers", b: "Build beautiful UI for your passion projects." },
  { icon: GraduationCap, g: "linear-gradient(160deg,#06b6d4,#3b82f6)", t: "Students", b: "Learn by doing. Create, iterate, level up." },
  { icon: PenTool, g: "linear-gradient(160deg,#a855f7,#ec4899)", t: "UI designers", b: "Go from concept to interactive kits in minutes." },
  { icon: Blocks, g: "linear-gradient(160deg,#f97316,#facc15)", t: "Prototypers & no-code", b: "Power up prototypes and tools with real game UI." },
];
const OWN_LIST = [
  "100% original, every time", "No training. No scraping.",
  "Commercial use, always", "Clear terms. No surprises.",
];

export function Landing() {
  const [design, setDesign] = useState<Design>(DEFAULT_DESIGN);
  const [driving, setDriving] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const onChange = useCallback((d: Design) => setDesign(d), []);
  const say = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout((say as unknown as { _t?: number })._t);
    (say as unknown as { _t?: number })._t = window.setTimeout(() => setToast(null), 2600);
  }, []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const openApp = () => navigate("#/app");

  return (
    <div className="landing">
      {/* ── nav ── */}
      <header className="nv">
        <a className="nv__brand" href="#/" aria-label="UI Kit Maker — home">
          <img src={logoUrl} alt="" />
          <span><span className="nv__name">UI Kit Maker</span><br /><span className="nv__by">by PatternBreak</span></span>
        </a>
        <nav className="nv__menu" aria-label="Primary">
          <a onClick={() => scrollTo("speed")}>Features</a>
          <a onClick={() => scrollTo("kit")}>How it works</a>
          <a onClick={() => scrollTo("kit")}>Kits</a>
          <a onClick={() => say("Pricing — coming soon.")}>Pricing</a>
          <a onClick={() => say("Resources — coming soon.")}>Resources <ChevronDown /></a>
        </nav>
        <div className="nv__actions">
          <button className="btn btn--ghost" onClick={() => openAuth("signin")}>Sign in</button>
          <button className="btn btn--neon" onClick={openApp}>Open the generator <ArrowRight /></button>
        </div>
      </header>

      <main className="wrap">
        {/* ── hero ── */}
        <section className="hero">
          <div>
            <p className="eyebrow">Design System</p>
            <h1 className="h1">Design a<br />UI kit in<br /><span className="grad">seconds.</span></h1>
            <p className="lead">One master component becomes a full, coherent game UI kit — instantly.</p>
            <div className="hero__cta">
              <button className="btn btn--neon btn--lg" onClick={openApp}>Open the generator <ArrowRight /></button>
              <button className="demo-link" onClick={() => scrollTo("kit")}><span className="play"><Play fill="currentColor" /></span> Watch demo</button>
            </div>
            <div className="trust">
              {TRUST.map(({ icon: I, t, s }) => (
                <div className="trust__item" key={t}><I /><span><b>{t}</b><span>{s}</span></span></div>
              ))}
            </div>
          </div>
          <HeroStudio design={design} onChange={onChange} driving={driving}
            onDrive={() => setDriving(true)} onPush={() => scrollTo("kit")}
            gridOn={gridOn} onGrid={() => setGridOn((v) => !v)} />
        </section>

        {/* ── push to a kit ── */}
        <section className="sec kit" id="kit">
          <div className="kit__intro">
            <p className="kicker">Push to a kit</p>
            <h2 className="h2">One click.<br />Everything.</h2>
            <p>Your master styles propagate across every component, state and screen — and it's all live. Poke it.</p>
          </div>
          <KitShowcase design={design} toast={say} />
        </section>

        {/* ── math ── */}
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="math">
            <div className="math__spark" />
            <div className="math__row">
              <div className="math__cell c-pink"><b>24</b><span>Silhouettes</span></div>
              <span className="math__op">×</span>
              <div className="math__cell c-blue"><b>16</b><span>Material presets</span></div>
              <span className="math__op">×</span>
              <div className="math__cell c-cyan"><b>23</b><span>Type treatments</span></div>
              <span className="math__op">=</span>
              <div className="math__cell c-gold"><b>8,832</b><span>Starting kits</span></div>
            </div>
          </div>
        </section>

        {/* ── built for speed ── */}
        <section className="sec" id="speed" style={{ paddingTop: 0 }}>
          <p className="kicker">Built for speed. Designed for games.</p>
          <div className="grid4">
            {SPEED.map(({ icon: I, cls, title, body, chips }) => (
              <article className="scard" key={title}>
                <span className={`hexi hexi--${cls}`}><I /></span>
                <h3>{title}</h3><p>{body}</p>
                <div className="mini">
                  {title === "Export anywhere"
                    ? chips.map((c) => <span key={c} className="chip" style={{ background: "linear-gradient(160deg,#f59e0b,#b45309)" }}>{c}</span>)
                    : title === "State-aware"
                    ? [0, 1, 2, 3].map((i) => <span key={i} className="dot" style={{ background: i === 0 ? "linear-gradient(160deg,#e879f9,#a21caf)" : "rgba(255,255,255,.08)" }} />)
                    : [0, 1, 2, 3, 4].map((i) => <span key={i} className="dot" style={{ background: ["#e879f9", "#3b82f6", "#22d3ee", "#22c55e", "#f59e0b"][i], opacity: title === "Shape it" ? 0.5 : 1 }} />)}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── made for creators ── */}
        <section className="sec" id="creators" style={{ paddingTop: 0 }}>
          <p className="kicker">Made for creators who build games</p>
          <div className="grid6">
            {CREATORS.map(({ icon: I, g, t, b }) => (
              <article className="ccard" key={t}>
                <div className="art" style={{ background: g }}><I /></div>
                <div className="bd"><h4>{t}</h4><p>{b}</p></div>
              </article>
            ))}
          </div>
        </section>

        {/* ── ownership ── */}
        <section className="sec" id="own" style={{ paddingTop: 0 }}>
          <div className="own">
            <div className="lockart"><span className="halo" /><Lock strokeWidth={1.6} /></div>
            <div className="own__h">
              <h2 className="h2">No AI.<br />No templates.<br /><em>No gray areas.</em></h2>
            </div>
            <div>
              <div className="own__mid">
                <p>You create. You own. Your kits are yours to keep, use, and ship — forever.</p>
                <ul>{OWN_LIST.map((l) => <li key={l}><Check /> {l}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── final CTA ── */}
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="fcta">
            <div className="fcta__deco">
              <span className="coin"><Star size={18} fill="currentColor" /></span>
            </div>
            <div className="fcta__t">
              <h3>Start building —<br /><em>nothing to install.</em></h3>
              <p>Free to try. No credit card. Just vibes.</p>
            </div>
            <button className="btn btn--neon btn--lg" onClick={openApp}>Open the generator <ArrowRight /></button>
            <div className="fcta__deco">
              <span className="gem" /><span className="coin"><Coins size={18} /></span>
            </div>
          </div>
        </section>
      </main>

      <footer className="ft">
        <div className="ft__brand"><img src={logoUrl} alt="" /><span>UI Kit Maker</span><span className="nv__by">by PatternBreak</span></div>
        <nav className="ft__links" aria-label="Footer">
          <a href="legal/terms.html" target="_blank" rel="noreferrer">Terms</a>
          <a href="legal/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
          <a onClick={() => say("Licenses — coming soon.")}>Licenses</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer"><Github size={14} /> GitHub</a>
        </nav>
        <span className="ft__meta">© 2026 PatternBreak, Inc. · All rights reserved.</span>
      </footer>

      <div id="toast" className={toast ? "show" : ""}>{toast}</div>
    </div>
  );
}
