import { useMemo, useRef } from "react";
import { Hand, Minus, Plus, LayoutGrid, Download } from "lucide-react";
import { useGen } from "@/generator/store";
import { renderBevel, renderKit } from "@/generator/bevel";
import { KIT_COMPONENTS } from "@/generator/model";
import type { GenStateName, CanvasBg, KitSize } from "@/generator/model";
import { downloadSvg } from "@/generator/exportUtils";

const CAP: Record<GenStateName, string> = { default: "Default", hover: "Hover", pressed: "Pressed", disabled: "Disabled" };

const GRAIN =
  "data:image/svg+xml;base64," +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="240" height="240" filter="url(#n)" opacity="0.42"/></svg>`);

const BGS: { id: CanvasBg; name: string; preview: string }[] = [
  { id: "light", name: "Light", preview: "#F4F5F7" },
  { id: "white", name: "White", preview: "#FFFFFF" },
  { id: "deep", name: "Deep", preview: "#0B0C20" },
  { id: "nebula", name: "Nebula", preview: "radial-gradient(130% 130% at 15% 100%, #fff 0%, #c26bfa 34%, #12132e 78%)" },
];

function canvasStyle(bg: CanvasBg, gridOn: boolean): { style: React.CSSProperties; dark: boolean } {
  const dots = (c: string) => `radial-gradient(circle, ${c} 1px, transparent 1.4px)`;
  if (bg === "nebula" || bg === "deep") {
    const glow = bg === "nebula"
      ? "radial-gradient(115% 100% at 10% 102%, #ffffff 0%, #f3e3ff 5%, #c26bfa 16%, #7c3aed 30%, #3d2f8f 48%, #131331 68%, rgba(9,10,26,0) 80%), "
      : "";
    return {
      dark: true,
      style: {
        backgroundColor: "#090A1E",
        backgroundImage: `url("${GRAIN}"), ${glow}${gridOn ? dots("rgba(235,238,255,0.16)") : "none"}`.replace(", none", ""),
        backgroundSize: `240px 240px, ${bg === "nebula" ? "100% 100%, " : ""}${gridOn ? "22px 22px" : "auto"}`,
        backgroundBlendMode: `overlay, ${bg === "nebula" ? "normal, " : ""}normal`,
      },
    };
  }
  return {
    dark: false,
    style: {
      backgroundColor: bg === "white" ? "#FFFFFF" : "#FBFBFD",
      backgroundImage: gridOn ? dots("rgba(24,28,48,0.13)") : undefined,
      backgroundSize: gridOn ? "22px 22px" : undefined,
    },
  };
}

export function CanvasView() {
  const { cfg, update, zoom, setZoom, panMode, setPanMode, gridOn, setGridOn, phase, kitSizes, setKitSize } = useGen();
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);

  const heroSvg = useMemo(() => renderBevel(cfg, "default"), [cfg]);
  const sideStates = (["hover", "pressed", "disabled"] as const).filter((s) => cfg.visible[s]);
  const { style, dark } = canvasStyle(cfg.canvas, gridOn);
  const capColor = dark ? "rgba(235,238,255,0.62)" : undefined;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!panMode || !scroller.current) return;
    drag.current = { x: e.clientX, y: e.clientY, sl: scroller.current.scrollLeft, st: scroller.current.scrollTop };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !scroller.current) return;
    scroller.current.scrollLeft = drag.current.sl - (e.clientX - drag.current.x);
    scroller.current.scrollTop = drag.current.st - (e.clientY - drag.current.y);
  };
  const onPointerUp = () => { drag.current = null; };

  return (
    <div className={`canvas-wrap${phase === "kit" ? " kitmode" : ""}`}>
      <div
        ref={scroller}
        className={`canvas${panMode ? " pan" : ""}`}
        style={style}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {phase === "master" ? (
          <div className="stage" style={{ transform: `scale(${zoom})` }}>
            <div className="state-cap" style={{ color: capColor }}>Default</div>
            <div className="hero-slot" dangerouslySetInnerHTML={{ __html: heroSvg }} />
          </div>
        ) : (
          <div className="kitgrid" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            {KIT_COMPONENTS.map(({ id, name }) => {
              const size: KitSize = kitSizes[id] ?? "m";
              return (
                <div className={`kitcard${dark ? " dark" : ""}`} key={id}>
                  <div className="kitcard-head" style={{ color: capColor }}>
                    <span>{name}</span>
                    <span className="sizechips">
                      {(["s", "m", "l"] as const).map((s) => (
                        <button key={s} className={size === s ? "on" : ""} onClick={() => setKitSize(id, s)}>{s.toUpperCase()}</button>
                      ))}
                    </span>
                    <button className="kitdl" title={`Export ${name} SVG`}
                      onClick={() => downloadSvg(renderKit(cfg, id, size), `kit-${id}-${size}.svg`)}>
                      <Download size={13} strokeWidth={2} />
                    </button>
                  </div>
                  <div className="kitcard-body" dangerouslySetInnerHTML={{ __html: renderKit(cfg, id, size) }} />
                </div>
              );
            })}
          </div>
        )}

        <div className="zoolbar" role="toolbar" aria-label="Canvas tools">
          <button className={panMode ? "on" : ""} title="Pan" aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>
            <Hand size={18} strokeWidth={1.8} />
          </button>
          <span className="zdiv" />
          <button title="Zoom out" onClick={() => setZoom(zoom - 0.1)}><Minus size={18} strokeWidth={1.8} /></button>
          <span className="zpct">{Math.round(zoom * 100)}%</span>
          <button title="Zoom in" onClick={() => setZoom(zoom + 0.1)}><Plus size={18} strokeWidth={1.8} /></button>
          <span className="zdiv" />
          <button className={gridOn ? "on" : ""} title="Toggle grid" aria-pressed={gridOn} onClick={() => setGridOn(!gridOn)}>
            <LayoutGrid size={17} strokeWidth={1.8} />
          </button>
          <span className="zdiv" />
          {BGS.map((b) => (
            <button key={b.id} className={`bgdot${cfg.canvas === b.id ? " on" : ""}`} title={`Canvas: ${b.name}`}
              onClick={() => update((c) => { c.canvas = b.id; })}>
              <span style={{ background: b.preview }} />
            </button>
          ))}
        </div>
      </div>

      {phase === "master" && sideStates.length > 0 && (
        <div className="stack" aria-label="State previews">
          {sideStates.map((s) => (
            <div className="scard" key={s}>
              <div className="scard-title">{CAP[s]}</div>
              <div className="scard-body" dangerouslySetInnerHTML={{ __html: renderBevel(cfg, s) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
