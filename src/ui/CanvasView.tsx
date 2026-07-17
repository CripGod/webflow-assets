import { useMemo, useRef, useState } from "react";
import { Hand, Minus, Plus, LayoutGrid, Download } from "lucide-react";
import { useGen } from "@/generator/store";
import { renderBevel, renderKit } from "@/generator/bevel";
import { KIT_COMPONENTS, CANVAS_BGS, STATE_NAMES } from "@/generator/model";
import type { GenStateName, KitSize } from "@/generator/model";
import { downloadSvg } from "@/generator/exportUtils";

const CAP: Record<GenStateName, string> = { default: "Default", hover: "Hover", pressed: "Pressed", disabled: "Disabled" };

export function CanvasView() {
  const { cfg, update, zoom, setZoom, panMode, setPanMode, gridOn, setGridOn, phase, kitSizes, setKitSize, selectedState, setSelectedState } = useGen();
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  // live interaction: hovering/pressing the hero previews those states ("hot"),
  // while edits keep applying to the selected state.
  const [live, setLive] = useState<"hover" | "pressed" | null>(null);

  const displayed: GenStateName = phase === "master" && live && selectedState !== "disabled" ? live : selectedState;
  const heroSvg = useMemo(() => renderBevel(cfg, displayed), [cfg, displayed]);
  const sideStates = STATE_NAMES.filter(
    (s) => s !== selectedState && (s === "default" || cfg.visible[s as Exclude<GenStateName, "default">])
  );
  const dark = cfg.canvas === "#1C1D22" || cfg.canvas === "#000000";
  const capColor = dark ? "rgba(235,238,255,0.62)" : undefined;
  const dotColor = dark ? "rgba(235,238,255,0.16)" : "rgba(24,28,48,0.13)";

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
        style={{
          backgroundColor: cfg.canvas,
          backgroundImage: gridOn ? `radial-gradient(circle, ${dotColor} 1px, transparent 1.4px)` : undefined,
          backgroundSize: gridOn ? "22px 22px" : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {phase === "master" ? (
          <div className="stage" style={{ transform: `scale(${zoom})` }}>
            <div className="state-cap" style={{ color: capColor }}>
              {CAP[displayed]}{live ? " · live" : ""}
            </div>
            <div
              className="hero-slot hot"
              onPointerEnter={(e) => setLive(e.buttons === 1 ? "pressed" : "hover")}
              onPointerLeave={() => setLive(null)}
              onPointerDown={(e) => { e.stopPropagation(); setLive("pressed"); }}
              onPointerUp={() => setLive("hover")}
              onPointerCancel={() => setLive(null)}
              dangerouslySetInnerHTML={{ __html: heroSvg }}
            />
            <div className="editing-note" style={{ color: capColor ?? "rgba(60,64,78,0.55)" }}>
              editing: {CAP[selectedState]}
            </div>
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
          {CANVAS_BGS.map((b) => (
            <button key={b.id} className={`bgdot${cfg.canvas === b.id ? " on" : ""}`} title={`Canvas: ${b.name}`}
              onClick={() => update((c) => { c.canvas = b.id; })}>
              <span style={{ background: b.id }} />
            </button>
          ))}
        </div>
      </div>

      {phase === "master" && sideStates.length > 0 && (
        <div className="stack" aria-label="State previews">
          {sideStates.map((s) => (
            <button className="scard clickable" key={s} onClick={() => setSelectedState(s)} title={`Edit ${CAP[s]}`}>
              <div className="scard-title">{CAP[s]}</div>
              <div className="scard-body" dangerouslySetInnerHTML={{ __html: renderBevel(cfg, s) }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
