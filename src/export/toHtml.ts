import type { MasterComponent, StateName } from "@/model/types";
import { resolveStyle } from "@/resolver/resolveStyle";
import { noiseDataUri } from "@/render/noise";

// Semantic HTML + inline CSS generated from the SAME resolver the canvas uses.
// This string is both the "HTML Preview" content and the HTML export payload.
export function toHtml(master: MasterComponent, state: StateName): string {
  const r = resolveStyle(master, state);
  const grain = noiseDataUri();
  const s = (o: Record<string, string | number>) =>
    Object.entries(o)
      .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
      .join(";");

  const root = s({
    position: "relative", display: "inline-flex", border: "0", padding: "0", overflow: "hidden",
    width: r.root.width, height: r.root.height, borderRadius: r.root.borderRadius,
    transform: r.root.transform, opacity: r.root.opacity, cursor: r.root.cursor,
    background: r.root.background, boxShadow: r.root.boxShadow, transition: r.root.transition,
  });
  const overlay = (extra: Record<string, string | number>) =>
    s({ position: "absolute", inset: "0", borderRadius: "inherit", pointerEvents: "none", ...extra });

  return `<button class="forge-component" type="button"${state === "disabled" ? " disabled" : ""} aria-label="${master.content.label}" style="${root}">
  <span aria-hidden="true" style="${overlay({ backgroundImage: `url('${grain}')`, backgroundSize: "160px 160px", mixBlendMode: "soft-light", opacity: r.grainOpacity })}"></span>
  <span aria-hidden="true" style="${overlay({ boxShadow: r.innerLine })}"></span>
  <span aria-hidden="true" style="${overlay({ background: r.rimLight.background, opacity: r.rimLight.opacity, mixBlendMode: "screen" })}"></span>
  <span style="${s({ position: "absolute", inset: "0", display: "flex", alignItems: "center", zIndex: "1" })}">
    <span style="${s({ width: `${r.content.iconRegion}px`, display: "flex", alignItems: "center", justifyContent: "center", filter: r.icon.filter, transform: `translate(${r.icon.nudgeX}px,${r.icon.nudgeY}px)` })}">
      <!-- Lucide ${master.content.icon}, live SVG, ${r.icon.size}px, stroke ${r.icon.strokeWidth}, color ${r.icon.color} -->
    </span>
    <span style="${s({ width: `${r.divider.width}px`, height: `${r.divider.height}px`, background: r.divider.background, boxShadow: r.divider.boxShadow, borderRadius: "1px", flex: "none" })}"></span>
    <span style="${s({ marginLeft: `${r.content.labelGap}px`, color: r.label.color, fontFamily: "'Inter Variable','Inter',sans-serif", fontSize: `${r.label.fontSize}px`, lineHeight: `${r.label.lineHeight}px`, letterSpacing: r.label.letterSpacing, fontWeight: r.label.fontWeight, textShadow: r.label.textShadow, whiteSpace: "nowrap" })}">${master.content.label}</span>
  </span>
</button>`;
}
