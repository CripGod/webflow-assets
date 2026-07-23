import {
  ArrowRight, Shapes, Gem, Layers, Download, Gamepad2, Building2, Rocket,
  GraduationCap, PenTool, Blocks, ShieldCheck, Sun, Moon, Github, MousePointerClick,
} from "lucide-react";
import { navigate } from "@/shell/router";
import { openAuth } from "@/shell/authOverlay";
import { useTheme, toggleTheme } from "@/shell/theme";
import { HeroStudio } from "./HeroStudio";
// The real PatternBreak mark, bundled from the repo root (same file the editor
// uses). gen.css inverts `img.logo` in dark mode.
import logoUrl from "../../pb-logo.png";

const REPO_URL = "https://github.com/patternbreakai/ui-kit-maker";

const TUNE = [
  { icon: Shapes, title: "Shape it", body: "24 procedural silhouettes — pills, chamfers, shields, hand-drawn. Swap the outline; the material stays put." },
  { icon: Gem, title: "Skin it", body: "Bevel, gloss, extrusion, glow, printed patterns. Real hard-candy depth — never a flat fill." },
  { icon: Layers, title: "State-aware", body: "Default, Hover, Pressed, Disabled are designed together and stay in sync — one footprint, no drift." },
  { icon: Download, title: "Export anywhere", body: "Live canvas, semantic HTML, layered SVG, PNG — plus a read-only share link teammates can open." },
];

const AUDIENCE = [
  { icon: Gamepad2, title: "Game devs", body: "A cohesive HUD, menu, and shop kit in an afternoon — not a sprint." },
  { icon: Building2, title: "Indie & small studios", body: "Punch above your weight. No full-time UI artist required." },
  { icon: Rocket, title: "Hobbyists & makers", body: "Make the side project look shipped, not sketched." },
  { icon: GraduationCap, title: "Students", body: "Learn design systems by playing with a real one. Free, forever." },
  { icon: PenTool, title: "UI designers", body: "Prototype a whole component family faster than you'd mock one screen." },
  { icon: Blocks, title: "Prototypers & no-code", body: "Drop polished, exportable UI into any tool or engine." },
];

const STEPS = [
  { title: "Design the master", body: "Tune one component — silhouette, material, type, and its four states." },
  { title: "Generate the kit", body: "One model fans out to every component and size, live on the canvas." },
  { title: "Export or share", body: "Download an engine kit, HTML, SVG, or PNG — or publish a live link." },
];

export function Landing() {
  const theme = useTheme();
  const openApp = () => navigate("#/app");

  return (
    <div className="landing">
      <header className="fd-nav">
        <a className="fd-brand" href="#/" aria-label="The UI Generator — home">
          <img className="logo" src={logoUrl} alt="" width={34} height={34} />
          <span className="fd-brand__name">The UI Generator</span>
        </a>
        <nav className="fd-nav__actions" aria-label="Primary">
          <button className="fd-icon-btn" onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <Sun size={17} strokeWidth={1.9} /> : <Moon size={17} strokeWidth={1.9} />}
          </button>
          <button className="fd-btn fd-btn--ghost" onClick={() => openAuth("signin")}>Sign in</button>
          <button className="fd-btn fd-btn--primary" onClick={openApp}>Open the generator</button>
        </nav>
      </header>

      <main>
        {/* ── hero ─────────────────────────────────────────────── */}
        <section className="fd-hero">
          <div className="fd-hero__copy">
            <span className="fd-eyebrow">Free · runs in your browser · your work stays yours</span>
            <h1 className="fd-hero__title">
              Design a UI kit that's <em>unmistakably yours.</em>
            </h1>
            <p className="fd-hero__sub">
              Tweak a real button right here — color, shape, shine — then push it into a
              whole kit. Every pixel comes from a deterministic engine, not AI, so what
              you make is <b>100% yours</b> to ship, sell, and own.
            </p>
            <div className="fd-hero__cta">
              <button className="fd-btn fd-btn--primary fd-btn--lg" onClick={openApp}>
                Open the generator <ArrowRight size={18} strokeWidth={2.2} />
              </button>
              <button className="fd-btn fd-btn--ghost fd-btn--lg" onClick={() => openAuth("signin")}>Sign in</button>
            </div>
            <p className="fd-hero__note">
              <MousePointerClick size={15} strokeWidth={2} /> This button is live — go on, mess it up.
            </p>
          </div>
          <div className="fd-hero__art">
            <HeroStudio />
          </div>
        </section>

        {/* ── the math ─────────────────────────────────────────── */}
        <section className="fd-math" aria-labelledby="fd-math-title">
          <h2 className="fd-section-title" id="fd-math-title">The math is on your side</h2>
          <div className="fd-eq" role="img"
            aria-label="24 silhouettes times 16 material presets times 23 type treatments equals 8,832 starting kits, before color">
            <span className="fd-eq__f"><b>24</b> silhouettes</span>
            <span className="fd-eq__op">×</span>
            <span className="fd-eq__f"><b>16</b> material presets</span>
            <span className="fd-eq__op">×</span>
            <span className="fd-eq__f"><b>23</b> type treatments</span>
            <span className="fd-eq__op">=</span>
            <span className="fd-eq__r"><b>8,832</b> starting kits</span>
          </div>
          <p className="fd-math__foot">
            …and that's <em>before you pick a color.</em> Open up the palette and “millions”
            starts to feel modest — every kit still 100% deterministic, 100% yours.
          </p>
        </section>

        {/* ── what you can tune ────────────────────────────────── */}
        <section className="fd-tune" aria-labelledby="fd-tune-title">
          <h2 className="fd-section-title" id="fd-tune-title">Everything's a dial, nothing's a lock</h2>
          <div className="fd-tune__grid">
            {TUNE.map(({ icon: Icon, title, body }) => (
              <article className="fd-tunecard" key={title}>
                <span className="fd-tunecard__icon"><Icon size={22} strokeWidth={1.8} /></span>
                <h3 className="fd-tunecard__title">{title}</h3>
                <p className="fd-tunecard__body">{body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── rapid iteration band ─────────────────────────────── */}
        <section className="fd-band">
          <div className="fd-band__inner">
            <span className="fd-eyebrow">Rapid iteration</span>
            <h2 className="fd-band__title">Change one thing. Watch everything update.</h2>
            <p className="fd-band__sub">
              Every state, size, and component re-renders live as you drag — no re-exporting,
              no regenerating, no waiting. Undo is one keystroke. Explore a thousand looks
              before lunch and keep the one that clicks.
            </p>
          </div>
        </section>

        {/* ── who it's for ─────────────────────────────────────── */}
        <section className="fd-who" aria-labelledby="fd-who-title">
          <h2 className="fd-section-title" id="fd-who-title">Built for anyone who ships</h2>
          <div className="fd-who__grid">
            {AUDIENCE.map(({ icon: Icon, title, body }) => (
              <article className="fd-whocard" key={title}>
                <span className="fd-whocard__icon"><Icon size={20} strokeWidth={1.8} /></span>
                <div>
                  <h3 className="fd-whocard__title">{title}</h3>
                  <p className="fd-whocard__body">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── ownership / not-AI ───────────────────────────────── */}
        <section className="fd-own" aria-labelledby="fd-own-title">
          <span className="fd-own__badge"><ShieldCheck size={16} strokeWidth={2} /> Yours, for real</span>
          <h2 className="fd-own__title" id="fd-own-title">No AI. No templates. No gray areas.</h2>
          <p className="fd-own__body">
            Every kit is drawn by a deterministic design engine — not a model trained on
            other people's work. Nothing is scraped, nothing is “in the style of” someone
            else. What you make is unique to your settings, and it's yours to ship, sell,
            and call your own.
          </p>
        </section>

        {/* ── how it works ─────────────────────────────────────── */}
        <section className="fd-how" aria-labelledby="fd-how-title">
          <h2 className="fd-section-title" id="fd-how-title">How it works</h2>
          <ol className="fd-steps">
            {STEPS.map(({ title, body }, i) => (
              <li className="fd-step" key={title}>
                <span className="fd-step__num" aria-hidden="true">{i + 1}</span>
                <h3 className="fd-step__title">{title}</h3>
                <p className="fd-step__body">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── final CTA ────────────────────────────────────────── */}
        <section className="fd-cta-band">
          <h2 className="fd-cta-band__title">Start building — nothing to install.</h2>
          <p className="fd-cta-band__sub">
            The editor is free and runs entirely in your browser. Sign in whenever you want
            your kits saved and synced.
          </p>
          <div className="fd-hero__cta">
            <button className="fd-btn fd-btn--primary fd-btn--lg" onClick={openApp}>
              Open the generator <ArrowRight size={18} strokeWidth={2.2} />
            </button>
          </div>
        </section>
      </main>

      <footer className="fd-footer">
        <div className="fd-footer__brand">
          <img className="logo" src={logoUrl} alt="" width={26} height={26} />
          <span>The UI Generator</span>
          <span className="fd-footer__by">by PatternBreak</span>
        </div>
        <nav className="fd-footer__links" aria-label="Footer">
          <a href="legal/terms.html" target="_blank" rel="noreferrer">Terms</a>
          <a href="legal/privacy.html" target="_blank" rel="noreferrer">Privacy</a>
          <a href={REPO_URL} target="_blank" rel="noreferrer"><Github size={15} strokeWidth={1.8} /> GitHub</a>
        </nav>
      </footer>
    </div>
  );
}
