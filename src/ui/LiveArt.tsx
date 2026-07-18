import { useEffect, useMemo, useRef, useState } from "react";
import type { GenConfig, GenStateName, IconDef, KitComponentId, KitSize, Shape } from "@/generator/model";
import { renderBevel, renderKit } from "@/generator/bevel";

/** What a piece of live art is: the master button (no kit), or one kit
 *  component with optional per-instance overrides. */
export interface LiveKit {
  id: KitComponentId;
  size?: KitSize;
  shape?: Shape;
  label?: string;
  segments?: string[];
  icon?: IconDef | null;
  /** Starting value — toggle on/off (1/0), slider/progress fill, segment index. */
  value?: number;
  /** Resting state when idle — e.g. an awarded badge or an open dropdown. */
  baseState?: GenStateName;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** One living piece of art. Design mode: a plain render (click = edit when the
 *  host wires it). Play mode: hover/press states, toggles flip, sliders drag,
 *  segments switch, progress animates, dropdowns open, badges award — every
 *  interaction the component implies, all through the same pure renderer. */
export function LiveArt({ cfg, kit, playing, scale, anchorContent, className, style, title, onDesignClick }: {
  cfg: GenConfig;
  kit?: LiveKit;
  playing: boolean;
  /** Display scale — 1 renders at the SVG's natural pixel size. */
  scale?: number;
  /** Anchor the shell, not the glow pad: pulls the art up-left by the pad so
   *  top-left-positioned hosts (the board) keep their saved layouts. */
  anchorContent?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  onDesignClick?: () => void;
}) {
  const id = kit?.id;
  const [live, setLive] = useState<GenStateName>("default");
  const [on, setOn] = useState((kit?.value ?? 1) > 0.5);            // toggle
  const [val, setVal] = useState(clamp01(kit?.value ?? 0.62));      // slider
  const [pval, setPval] = useState(clamp01(kit?.value ?? 0.62));    // progress
  const [sel, setSel] = useState(Math.round(kit?.value ?? 1));      // segment
  const [open, setOpen] = useState(kit?.baseState === "pressed");   // dropdown / badge award
  const sliding = useRef(false);
  const raf = useRef(0);
  const pvalRef = useRef(pval);
  pvalRef.current = pval;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const value = id === "toggle" ? (playing ? (on ? 1 : 0) : kit?.value)
    : id === "slider" ? (playing ? val : kit?.value)
    : id === "progress" ? (playing ? pval : kit?.value)
    : id === "segment" ? (playing ? sel : kit?.value)
    : kit?.value;

  // dropdown-open and badge-awarded override the pointer state
  const held = (id === "dropdown" || id === "badge") && (playing ? open : kit?.baseState === "pressed");
  const state: GenStateName = held ? "pressed" : playing ? live : (kit?.baseState ?? "default");

  // hosts pass fresh kit literals every render — key on the fields, not the
  // object, so the (string-building) renderer only runs when something changed
  const kitKey = kit
    ? `${kit.id}|${kit.size ?? "m"}|${kit.shape ?? ""}|${kit.label ?? ""}|${(kit.segments ?? []).join(",")}|${kit.icon ? kit.icon.lib + ":" + kit.icon.name : kit.icon === null ? "none" : ""}`
    : "";
  const svg = useMemo(
    () => kit
      ? renderKit(cfg, kit.id, kit.size ?? "m", state, value, kit.shape, { label: kit.label, segments: kit.segments, icon: kit.icon })
      : renderBevel(cfg, state),
    [cfg, kitKey, state, value] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // natural width × scale — uniform physical scale across every piece, so a
  // chip and a header sit in true proportion on the guideline page
  const width = useMemo(() => {
    if (scale === undefined) return undefined;
    const m = svg.match(/width="([\d.]+)"/);
    return m ? +m[1] * scale : undefined;
  }, [svg, scale]);

  // the glow pad the renderer added — read back from the viewBox origin
  const pad = useMemo(() => {
    if (!anchorContent) return 0;
    const m = svg.match(/viewBox="(-?[\d.]+)/);
    return m ? -+m[1] : 0;
  }, [svg, anchorContent]);

  /* Map a pointer to the control's track using the exact geometry the renderer
     stamped on the svg (viewBox units) — precise at any scale or glow pad. */
  const trackCoord = (e: React.PointerEvent): { u: number; thirds: number } | null => {
    const el = ref.current?.querySelector("svg") as SVGSVGElement | null;
    const track = el?.getAttribute("data-track")?.split(" ").map(Number);
    if (!el || !track || track.length !== 2 || !track[1]) return null;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    const vb = el.viewBox.baseVal;
    const cx = vb.x + ((e.clientX - r.left) / r.width) * vb.width;
    const t = (cx - track[0]) / track[1];
    return { u: clamp01(t), thirds: Math.max(0, Math.min(2, Math.floor(t * 3))) };
  };

  const animateProgress = (to: number) => {
    cancelAnimationFrame(raf.current);
    const from = pvalRef.current;
    const t0 = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / 650);
      const e = 1 - (1 - u) ** 3;
      setPval(from + (to - from) * e);
      if (u < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const playHandlers = {
    onPointerEnter: (e: React.PointerEvent) => setLive(e.buttons === 1 ? "pressed" : "hover"),
    onPointerLeave: (e: React.PointerEvent) => { if (e.buttons !== 1) { setLive("default"); sliding.current = false; } },
    onPointerDown: (e: React.PointerEvent) => {
      setLive("pressed");
      if (id === "slider") {
        sliding.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        const c = trackCoord(e);
        if (c) setVal(c.u);
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (id === "slider" && sliding.current) {
        const c = trackCoord(e);
        if (c) setVal(c.u);
      }
    },
    onPointerUp: () => { setLive("hover"); sliding.current = false; },
    onPointerCancel: () => { setLive("default"); sliding.current = false; },
    onClick: (e: React.MouseEvent) => {
      if (id === "toggle") setOn((v) => !v);
      else if (id === "dropdown" || id === "badge") setOpen((v) => !v);
      else if (id === "progress") animateProgress(0.12 + Math.random() * 0.86);
      else if (id === "segment") {
        const c = trackCoord(e as unknown as React.PointerEvent);
        if (c) setSel(c.thirds);
      }
    },
  };

  const anchorStyle = pad > 0 ? { marginLeft: -pad, marginTop: -pad } : undefined;
  return (
    <div ref={ref} className={className} title={title}
      style={{ ...style, ...(width !== undefined ? { width } : {}), ...anchorStyle }}
      {...(playing ? playHandlers
        : onDesignClick ? {
            onClick: onDesignClick, role: "button", tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDesignClick(); } },
          } : {})}
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
