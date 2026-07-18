import { useMemo, useRef, useState, useEffect } from "react";
import { Hand, Minus, Plus, LayoutGrid, Download, Grip, AlignJustify, Square, SquarePen, Play, ImagePlus, X, Hammer } from "lucide-react";
import { useGen } from "@/generator/store";
import { renderBevel, renderKit } from "@/generator/bevel";
import { KIT_COMPONENTS, CANVAS_BGS, STATE_NAMES } from "@/generator/model";
import type { GenStateName, KitSize } from "@/generator/model";
import { downloadSvg } from "@/generator/exportUtils";

const CAP: Record<GenStateName, string> = { default: "Default", hover: "Hover", pressed: "Pressed", disabled: "Disabled" };

export function CanvasView() {
  const { cfg, update, zoom, setZoom, panMode, setPanMode, gridStyle, setGridStyle, phase, setPhase, kitSizes, setKitSize, selectedState, setSelectedState, canvasMode, setCanvasMode, board, library, moveBoardItem, removeBoardItem, bgImage, setBgImage } = useGen();
  const [gridPop, setGridPop] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (gridRef.current && !gridRef.current.contains(e.target as Node)) setGridPop(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const scroller = useRef<HTMLDivElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const boardDrag = useRef<{ id: string; dx: number; dy: number; ox: number; oy: number } | null>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  // live interaction: hovering/pressing the hero previews those states ("hot"),
  // while edits keep applying to the selected state.
  const [live, setLive] = useState<"hover" | "pressed" | null>(null);

  // Design mode locks the canvas to the state being edited; Play mode makes
  // the hero live under the pointer.
  const playing = canvasMode === "play";
  const displayed: GenStateName = phase === "master" && playing && live && selectedState !== "disabled" ? live : selectedState;
  const heroSvg = useMemo(() => renderBevel(cfg, displayed), [cfg, displayed]);
  // Fixed order, selected included — the stack never reshuffles.
  const sideStates = STATE_NAMES.filter(
    (s) => s === "default" || cfg.visible[s as Exclude<GenStateName, "default">]
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
        style={bgImage ? {
          backgroundColor: cfg.canvas,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        } : {
          backgroundColor: cfg.canvas,
          backgroundImage:
            gridStyle === "dots" ? `radial-gradient(circle, ${dotColor} 1px, transparent 1.4px)` :
            gridStyle === "lines" ? `linear-gradient(${dotColor} 1px, transparent 1px), linear-gradient(90deg, ${dotColor} 1px, transparent 1px)` :
            gridStyle === "both" ? `radial-gradient(circle, ${dotColor} 1px, transparent 1.4px), linear-gradient(${dotColor} 1px, transparent 1px), linear-gradient(90deg, ${dotColor} 1px, transparent 1px)` :
            undefined,
          backgroundSize:
            gridStyle === "lines" ? "44px 44px" :
            gridStyle === "both" ? "22px 22px, 44px 44px, 44px 44px" :
            gridStyle === "dots" ? "22px 22px" : undefined,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {phase === "master" ? (
          <div className="stage" style={{ transform: `scale(${zoom})` }}>
            <div className="state-cap" style={{ color: capColor }}>
              {CAP[displayed]}{playing && live ? " · live" : ""}
            </div>
            <div
              className={`hero-slot${playing ? " hot" : ""}`}
              {...(playing ? {
                onPointerEnter: (e: React.PointerEvent) => setLive(e.buttons === 1 ? "pressed" : "hover"),
                onPointerLeave: () => setLive(null),
                onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); setLive("pressed"); },
                onPointerUp: () => setLive("hover"),
                onPointerCancel: () => setLive(null),
              } : {})}
              dangerouslySetInnerHTML={{ __html: heroSvg }}
            />
          </div>
        ) : phase === "board" ? (
          <div className="board" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
            {board.map((b) => {
              const item = library.find((l) => l.id === b.libId);
              if (!item) return null;
              return (
                <div className="board-item" key={b.id} style={{ left: b.x, top: b.y }}
                  onPointerDown={(e) => {
                    boardDrag.current = { id: b.id, dx: e.clientX, dy: e.clientY, ox: b.x, oy: b.y };
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const d = boardDrag.current;
                    if (!d || d.id !== b.id) return;
                    moveBoardItem(b.id, d.ox + (e.clientX - d.dx) / zoom, d.oy + (e.clientY - d.dy) / zoom);
                  }}
                  onPointerUp={() => { boardDrag.current = null; }}
                  onPointerCancel={() => { boardDrag.current = null; }}>
                  <button className="board-x" title="Remove from board" onClick={() => removeBoardItem(b.id)}>
                    <X size={12} strokeWidth={2.4} />
                  </button>
                  <div dangerouslySetInnerHTML={{ __html: renderBevel(item.cfg, "default") }} />
                </div>
              );
            })}
            {board.length === 0 && (
              <div className="board-hint" style={{ color: capColor }}>
                The sketch board is empty — open the Library and send components here.
              </div>
            )}
            <button className="makekit" onClick={() => setPhase("kit")} title="Arrange everything as an organized kit">
              <Hammer size={14} strokeWidth={2} /> Make kit
            </button>
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
          <button className={!playing ? "on" : ""} title="Design mode — canvas stays on the state you're editing"
            aria-pressed={!playing} onClick={() => setCanvasMode("design")}>
            <SquarePen size={17} strokeWidth={1.8} />
          </button>
          <button className={playing ? "on" : ""} title="Play mode — hover and press the button live"
            aria-pressed={playing} onClick={() => { setCanvasMode("play"); }}>
            <Play size={17} strokeWidth={1.8} />
          </button>
          <span className="zdiv" />
          <button className={panMode ? "on" : ""} title="Pan" aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>
            <Hand size={18} strokeWidth={1.8} />
          </button>
          <span className="zdiv" />
          <button title="Zoom out" onClick={() => setZoom(zoom - 0.1)}><Minus size={18} strokeWidth={1.8} /></button>
          <span className="zpct">{Math.round(zoom * 100)}%</span>
          <button title="Zoom in" onClick={() => setZoom(zoom + 0.1)}><Plus size={18} strokeWidth={1.8} /></button>
          <span className="zdiv" />
          <div ref={gridRef} style={{ position: "relative", display: "flex" }}>
            <button className={gridStyle !== "off" ? "on" : ""} title="Grid style" aria-haspopup="menu" aria-expanded={gridPop}
              onClick={() => setGridPop(!gridPop)}>
              <LayoutGrid size={17} strokeWidth={1.8} />
            </button>
            {gridPop && (
              <div className="gridpop" role="menu">
                <button className={gridStyle === "dots" ? "on" : ""} onClick={() => { setGridStyle("dots"); setGridPop(false); }}>
                  <Grip size={15} strokeWidth={1.8} /> Dots
                </button>
                <button className={gridStyle === "lines" ? "on" : ""} onClick={() => { setGridStyle("lines"); setGridPop(false); }}>
                  <AlignJustify size={15} strokeWidth={1.8} /> Lines
                </button>
                <button className={gridStyle === "both" ? "on" : ""} onClick={() => { setGridStyle("both"); setGridPop(false); }}>
                  <LayoutGrid size={15} strokeWidth={1.8} /> Dots + Lines
                </button>
                <button className={gridStyle === "off" ? "on" : ""} onClick={() => { setGridStyle("off"); setGridPop(false); }}>
                  <Square size={15} strokeWidth={1.8} /> Off
                </button>
              </div>
            )}
          </div>
          <span className="zdiv" />
          <button title="Upload a background image — see your assets on a real game screen" onClick={() => bgInput.current?.click()}
            className={bgImage ? "on" : ""}>
            <ImagePlus size={17} strokeWidth={1.8} />
          </button>
          {bgImage && (
            <button title="Clear background image" onClick={() => setBgImage(null)}>
              <X size={16} strokeWidth={2} />
            </button>
          )}
          <input ref={bgInput} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setBgImage(URL.createObjectURL(f));
              e.target.value = "";
            }} />
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
            <button className={`scard clickable${s === selectedState ? " sel" : ""}`} key={s}
              onClick={() => setSelectedState(s)} title={`Edit ${CAP[s]}`} aria-pressed={s === selectedState}>
              <div className="scard-title">{CAP[s]}{s === selectedState ? " · editing" : ""}</div>
              <div className="scard-body" dangerouslySetInnerHTML={{ __html: renderBevel(cfg, s) }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
