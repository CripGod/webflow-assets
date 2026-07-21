import { useMemo } from "react";
import * as Lucide from "lucide-react";
import type { MasterComponent, StateName } from "@/model/types";
import { resolveStyle } from "@/resolver/resolveStyle";
import { noiseDataUri } from "./noise";

// The ONE canonical renderer. Real semantic HTML + CSS, layered material.
// The HTML export (src/export/toHtml.ts) mirrors this structure from the same
// resolver output so canvas and export can never diverge.
export function HeroButton({
  master,
  state,
  interactive = false,
}: {
  master: MasterComponent;
  state: StateName;
  interactive?: boolean;
}) {
  const r = useMemo(() => resolveStyle(master, state), [master, state]);
  const grain = useMemo(() => noiseDataUri(), []);
  const IconCmp = (Lucide as Record<string, unknown>)[master.content.icon] as
    | React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>
    | undefined;
  const Icon = IconCmp ?? Lucide.Rocket;

  return (
    <button
      className="forge-hero"
      type="button"
      disabled={state === "disabled"}
      aria-label={master.content.label}
      style={{
        ["--forge-hero-w" as string]: r.root.width,
        width: r.root.width,
        height: r.root.height,
        borderRadius: r.root.borderRadius,
        transform: r.root.transform,
        opacity: r.root.opacity,
        filter: r.root.filter,
        transition: r.root.transition,
        cursor: interactive ? r.root.cursor : "default",
        background: r.root.background,
        boxShadow: r.root.boxShadow,
      }}
    >
      {/* matte surface grain (soft-light) */}
      <span className="fh-grain" style={{ borderRadius: "inherit", backgroundImage: `url("${grain}")`, opacity: r.grainOpacity }} />
      {/* fine inner highlight line + dark lower edge */}
      <span className="fh-innerline" style={{ borderRadius: "inherit", boxShadow: r.innerLine }} />
      {/* thin cool rim light near the top */}
      <span className="fh-rimlight" style={{ borderRadius: "inherit", background: r.rimLight.background, opacity: r.rimLight.opacity }} />

      <span className="forge-hero__content">
        <span
          className="forge-hero__icon"
          style={{ width: r.content.iconRegion, filter: r.icon.filter, transform: `translate(${r.icon.nudgeX}px, ${r.icon.nudgeY}px)` }}
        >
          <Icon size={r.icon.size} strokeWidth={r.icon.strokeWidth} color={r.icon.color} />
        </span>
        <span
          className="forge-hero__divider"
          style={{ width: r.divider.width, height: r.divider.height, background: r.divider.background, boxShadow: r.divider.boxShadow }}
        />
        <span
          className="forge-hero__label"
          style={{
            marginLeft: r.content.labelGap,
            color: r.label.color,
            fontSize: r.label.fontSize,
            lineHeight: `${r.label.lineHeight}px`,
            letterSpacing: r.label.letterSpacing,
            fontWeight: r.label.fontWeight,
            textShadow: r.label.textShadow,
          }}
        >
          {master.content.label}
        </span>
      </span>
    </button>
  );
}
