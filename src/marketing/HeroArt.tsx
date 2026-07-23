import { Play, Trophy, Heart, Zap } from "lucide-react";

/* The hero visual — a small cluster of "hard-candy" buttons in the spirit of
   what the engine makes: glossy, beveled, saturated. Rendered in pure CSS
   (gloss + rim + bevel are layered pseudo-elements in frontdoor.css) so the
   marketing page stays a lean, instant-paint chunk with no engine import.
   Decorative only — aria-hidden. */
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art__grid" />
      <div className="candy candy--violet candy--lg" style={{ ["--i" as string]: 0 }}>
        <Play size={20} strokeWidth={2.6} fill="currentColor" />
        <span>Play</span>
      </div>
      <div className="candy candy--pink" style={{ ["--i" as string]: 1 }}>
        <Heart size={16} strokeWidth={2.6} fill="currentColor" />
        <span>Claim</span>
      </div>
      <div className="candy candy--teal" style={{ ["--i" as string]: 2 }}>
        <Zap size={16} strokeWidth={2.6} fill="currentColor" />
        <span>Boost</span>
      </div>
      <div className="candy candy--amber candy--round" style={{ ["--i" as string]: 3 }}>
        <Trophy size={18} strokeWidth={2.6} />
      </div>
    </div>
  );
}
