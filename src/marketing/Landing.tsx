import {
  ArrowRight, Layers, Boxes, Cloud, Share2, SlidersHorizontal, Wand2, Send,
  Sun, Moon, Github,
} from "lucide-react";
import { navigate } from "@/shell/router";
import { openAuth } from "@/shell/authOverlay";
import { useTheme, toggleTheme } from "@/shell/theme";
import { HeroArt } from "./HeroArt";
// The real PatternBreak mark, bundled from the repo root (same file the editor
// uses). gen.css inverts `img.logo` in dark mode.
import logoUrl from "../../pb-logo.png";

const REPO_URL = "https://github.com/patternbreakai/ui-kit-maker";

const FEATURES = [
  {
    icon: Layers,
    title: "Master-component editor",
    body: "Design one canonical component — shape, material, type. Every state and size follows from it.",
  },
  {
    icon: Boxes,
    title: "One model, every export",
    body: "The same source renders to the live canvas, HTML, layered SVG, and PNG — they can never drift apart.",
  },
  {
    icon: Cloud,
    title: "Cloud saves & named projects",
    body: "Sign in to keep a library of named kits that follow you to any device. Optional — the editor works without it.",
  },
  {
    icon: Share2,
    title: "Shareable links",
    body: "Publish a kit behind a short link anyone can open, read-only. Your downloads stay yours.",
  },
];

const STEPS = [
  {
    icon: SlidersHorizontal,
    title: "Design the master",
    body: "Tune one component — silhouette, bevel, gloss, palette, type, and its Default / Hover / Pressed / Disabled states.",
  },
  {
    icon: Wand2,
    title: "Generate the kit",
    body: "One model fans out to every component and size on the canvas, the guideline sheet, and the assembly board.",
  },
  {
    icon: Send,
    title: "Export or share",
    body: "Download an engine kit, HTML, SVG, or PNG — or publish a live link teammates can open in the browser.",
  },
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
          <button
            className="fd-icon-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun size={17} strokeWidth={1.9} /> : <Moon size={17} strokeWidth={1.9} />}
          </button>
          <button className="fd-btn fd-btn--ghost" onClick={() => openAuth("signin")}>
            Sign in
          </button>
          <button className="fd-btn fd-btn--primary" onClick={openApp}>
            Open the generator
          </button>
        </nav>
      </header>

      <main>
        <section className="fd-hero">
          <div className="fd-hero__copy">
            <span className="fd-eyebrow">Free · local-first · no account needed</span>
            <h1 className="fd-hero__title">
              A game-ready UI kit from <em>one</em> master component.
            </h1>
            <p className="fd-hero__sub">
              The UI Generator turns a single master component into a full kit — every
              state, every size — then exports it to canvas, HTML, SVG, and PNG. Open
              it and start building; an account only adds cloud saves and shareable
              projects.
            </p>
            <div className="fd-hero__cta">
              <button className="fd-btn fd-btn--primary fd-btn--lg" onClick={openApp}>
                Open the generator <ArrowRight size={18} strokeWidth={2.2} />
              </button>
              <button className="fd-btn fd-btn--ghost fd-btn--lg" onClick={() => openAuth("signin")}>
                Sign in
              </button>
            </div>
            <p className="fd-hero__note">
              No sign-up wall — your work saves right here in your browser.
            </p>
          </div>
          <div className="fd-hero__art">
            <HeroArt />
          </div>
        </section>

        <section className="fd-features" aria-label="Features">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article className="fd-feature" key={title}>
              <span className="fd-feature__icon">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <h3 className="fd-feature__title">{title}</h3>
              <p className="fd-feature__body">{body}</p>
            </article>
          ))}
        </section>

        <section className="fd-how" aria-labelledby="fd-how-title">
          <h2 className="fd-section-title" id="fd-how-title">How it works</h2>
          <ol className="fd-steps">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li className="fd-step" key={title}>
                <span className="fd-step__num" aria-hidden="true">{i + 1}</span>
                <span className="fd-step__icon"><Icon size={22} strokeWidth={1.7} /></span>
                <h3 className="fd-step__title">{title}</h3>
                <p className="fd-step__body">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="fd-cta-band">
          <h2 className="fd-cta-band__title">Start building — nothing to install.</h2>
          <p className="fd-cta-band__sub">
            The editor is free and runs entirely in your browser. Sign in whenever you
            want your kits saved and synced.
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
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            <Github size={15} strokeWidth={1.8} /> GitHub
          </a>
        </nav>
      </footer>
    </div>
  );
}
