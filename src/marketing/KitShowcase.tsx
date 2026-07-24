import { useState } from "react";
import { ChevronDown, Sword, Shield, FlaskConical, Gem, User, Coins } from "lucide-react";
import { ICONS, vars, type Design } from "./studioModel";

const MODES = ["Adventure Mode", "Arena Mode", "Story Mode", "Endless Mode"];
const fmt = (n: number) => n.toLocaleString("en-US");

/* The push-to-kit showcase: one design's DNA across states + real game
   components — and they're genuinely interactive. Hover the buttons, flip the
   toggle, spend coins, claim the reward. Colors follow the studio via vars(). */
export function KitShowcase({ design, toast }: { design: Design; toast: (m: string) => void }) {
  const Icon = ICONS[design.icon];
  const label = (design.label || "PLAY").slice(0, 8);
  const [coins, setCoins] = useState(1240);
  const [gems, setGems] = useState(145);
  const [xp, setXp] = useState(72);
  const [on, setOn] = useState(true);
  const [mode, setMode] = useState(0);
  const [seg, setSeg] = useState<"EQUIP" | "UPGRADE">("EQUIP");
  const [slot, setSlot] = useState("sword");
  const [claimed, setClaimed] = useState(false);
  const ring = (k: string): React.CSSProperties => slot === k ? { boxShadow: "0 0 0 2px #fff, 0 0 16px var(--c-glow)" } : {};

  return (
    <div className="kitpanel" style={vars(design)}>
      {/* states row */}
      <div className="krow" style={{ justifyContent: "space-between" }}>
        {(["Default", "Hover", "Pressed", "Disabled"] as const).map((s) => (
          <div className="kcol" key={s}>
            <button className={`kb ${s === "Hover" ? "st-h" : s === "Pressed" ? "st-p" : s === "Disabled" ? "dis" : ""}`}
              style={s === "Hover" ? { filter: "brightness(1.1) saturate(1.08)" } : s === "Pressed" ? { transform: "translateY(2px) scale(.98)", filter: "brightness(.93)" } : undefined}
              tabIndex={-1} disabled={s === "Disabled"}>
              <Icon size={15} strokeWidth={2.6} fill={["Play", "Heart", "Star"].includes(design.icon) ? "currentColor" : "none"} /> {label}
            </button>
            <span className="kcap">{s}</span>
          </div>
        ))}
      </div>

      {/* badges + counter */}
      <div className="krow">
        <div className="badge-shield"><span className="lv">LEVEL</span><span className="n">23</span></div>
        <div className="badge-star">99+</div>
        <div className="counter">
          <span className="res"><span className="coin"><Coins size={12} /></span> {fmt(coins)}</span>
          <span className="res"><span className="gem" /> {fmt(gems)}</span>
          <button className="plus" aria-label="Get more" onClick={() => { setCoins((c) => c + 100); setGems((g) => g + 5); toast("+100 coins · +5 gems"); }}>+</button>
        </div>
      </div>

      {/* xp + toggle + dropdown */}
      <div className="krow">
        <div className="xp" role="button" tabIndex={0} title="Gain XP"
          onClick={() => setXp((v) => (v >= 100 ? 20 : Math.min(100, v + 9)))}>
          <div className="t"><span>XP PROGRESS</span><span>{xp}%</span></div>
          <div className="track"><i style={{ width: `${xp}%` }} /></div>
        </div>
        <button className={`ktoggle${on ? " on" : ""}`} onClick={() => setOn((v) => !v)} aria-pressed={on}>
          {on ? "ON" : "OFF"} <span className="sw2"><i /></span>
        </button>
        <button className="kdrop" onClick={() => setMode((m) => (m + 1) % MODES.length)}>
          {MODES[mode]} <ChevronDown />
        </button>
      </div>

      {/* segment + item slots */}
      <div className="krow">
        <div className="kseg">
          <button className={seg === "EQUIP" ? "on" : ""} onClick={() => setSeg("EQUIP")}>EQUIP</button>
          <button className={seg === "UPGRADE" ? "on" : ""} onClick={() => setSeg("UPGRADE")}>UPGRADE</button>
        </div>
        <button className="slot slot--sword" style={ring("sword")} onClick={() => setSlot("sword")} aria-label="Sword"><Sword /></button>
        <button className="slot slot--shield" style={ring("shield")} onClick={() => setSlot("shield")} aria-label="Shield"><Shield /></button>
        <button className="slot slot--potion" style={ring("potion")} onClick={() => setSlot("potion")} aria-label="Potion"><FlaskConical /></button>
        <button className="slot slot--gem" style={ring("gem")} onClick={() => setSlot("gem")} aria-label="Gem"><Gem /></button>
      </div>

      {/* hero card + quest + claim */}
      <div className="krow">
        <div className="hero-card">
          <span className="av"><User /></span>
          <div style={{ flex: 1 }}>
            <div className="nm">Shadow Knight</div>
            <div className="mt">Level 12 · Warrior</div>
            <div className="hpb"><i /></div>
          </div>
        </div>
        <div className="quest">
          <span className="qh">DAILY QUEST</span>
          <span className="qt">Defeat 12 enemies</span>
          <div className="xp" style={{ padding: 0, background: "none", border: 0 }}>
            <div className="track" style={{ height: 8 }}><i style={{ width: "58%" }} /></div>
          </div>
          <span className="mt" style={{ fontSize: 11, color: "var(--ink3)" }}>7 / 12</span>
        </div>
        <button className="claim" onClick={() => { if (!claimed) { setCoins((c) => c + 250); setClaimed(true); toast("Reward claimed — +250 coins!"); } }}>
          {claimed ? "CLAIMED" : "CLAIM"}{!claimed && <span className="bang">!</span>}
        </button>
      </div>

      <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--ink2)", textAlign: "center" }}>
        Every piece is <b style={{ color: "#fff" }}>live</b> — poke it. One master design → <b style={{ color: "#fff" }}>46 components × 4 states</b>, all yours.
      </p>
    </div>
  );
}
