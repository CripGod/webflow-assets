import { useMemo, useRef, useState, useEffect } from "react";
import { Hand, Minus, Plus, LayoutGrid, Grip, AlignJustify, Square, SquarePen, Play, ImagePlus, X, PenTool } from "lucide-react";
import { useGen } from "@/generator/store";
import type { BoardItem, LibItem } from "@/generator/store";
import { renderBevel, renderKit } from "@/generator/bevel";
import { KIT_COMPONENTS, CANVAS_BGS, STATE_NAMES } from "@/generator/model";
import type { GenStateName } from "@/generator/model";
import { KitPage } from "./KitPage";
import { LiveArt } from "./LiveArt";

const CAP: Record<GenStateName, string> = { default: "Default", hover: "Hover", pressed: "Pressed", disabled: "Disabled" };

export function CanvasView() {
  const { cfg, update, zoom, setZoom, panMode, setPanMode, gridStyle, setGridStyle, phase, setPhase, selectedState, setSelectedState, canvasMode, setCanvasMode, board, library, moveBoardItem, scaleBoardItem, removeBoardItem, bgImage, setBgImage, focus, setFocus, kitShapes, kitSizes, kitTextOy, kitRow, bgShow, bgOpacity, bgBlur } = useGen();
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
  // the hero previews the focused component at its kit-selected size, with its
  // own vertical text nudge — the same key the Typography panel edits, so the
  // slider responds live on the surface the user is actually looking at
  const fSize = focus ? (kitSizes[focus] ?? "m") : "m";
  const fOy = focus ? kitTextOy[`${focus}:${fSize}`] : undefined;
  const heroSvg = useMemo(
    () => (focus ? renderKit(cfg, focus, fSize, displayed, focus === "toggle" && displayed === "pressed" ? 0 : undefined, kitShapes[focus], { textOy: fOy, row: focus === "datarow" ? kitRow : undefined }) : renderBevel(cfg, displayed)),
    [cfg, displayed, focus, kitShapes, fSize, fOy, kitRow]
  );
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
    <div className={`canvas-wrap${phase !== "master" ? " kitmode" : ""}${phase === "kit" ? " kitread" : ""}`}>
      <div className="canvas-col">
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
            {focus && (
              <button className="focuschip" onClick={() => setFocus(null)} title="Back to the master button">
                <PenTool size={13} strokeWidth={2} /> Editing: {KIT_COMPONENTS.find((c) => c.id === focus)?.name} — back to button
              </button>
            )}
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
          <div className="board stage169" style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
            {bgImage && bgShow && (
              <div className="board-bg" style={{ backgroundImage: `url(${bgImage})`, opacity: bgOpacity / 100, filter: bgBlur ? `blur(${bgBlur}px)` : undefined }} />
            )}
            {board.map((b) => {
              const item = library.find((l) => l.id === b.libId);
              if (!item) return null;
              return (
                <BoardPiece key={b.id} b={b} item={item} playing={playing}
                  onDragStart={(e) => {
                    boardDrag.current = { id: b.id, dx: e.clientX, dy: e.clientY, ox: b.x, oy: b.y };
                  }}
                  onDragMove={(e) => {
                    const d = boardDrag.current;
                    if (!d || d.id !== b.id) return;
                    moveBoardItem(b.id, d.ox + (e.clientX - d.dx) / zoom, d.oy + (e.clientY - d.dy) / zoom);
                  }}
                  onDragEnd={() => { boardDrag.current = null; }}
                  onScale={(dir) => scaleBoardItem(b.id, (b.scale ?? 1) + dir * 0.15)}
                  onRemove={() => removeBoardItem(b.id)} />
              );
            })}
            {board.length === 0 && (
              <div className="board-hint" style={{ color: capColor }}>
                The sketch board is empty — open the Library and send components here.
              </div>
            )}
            <button className="makekit second" onClick={() => setPhase("master")} title="Back to the component editor">
              <PenTool size={14} strokeWidth={2} /> Edit master
            </button>
          </div>
        ) : (
          <div className="kitwrap" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            <KitPage />
          </div>
        )}

        {/* the toolbar lives OUTSIDE the scroller so it floats over the canvas
            instead of scrolling away with a long page (the Kit sheet) */}
      </div>
        <div className="zoolbar" role="toolbar" aria-label="Canvas tools">
          {/* the Kit page is permanently alive — Design/Play only applies to
              the editor hero and the board */}
          {phase !== "kit" && (<>
          <button className={!playing ? "on" : ""} title="Design mode — canvas stays on the state you're editing"
            aria-pressed={!playing} onClick={() => setCanvasMode("design")}>
            <SquarePen size={17} strokeWidth={1.8} />
          </button>
          <button className={playing ? "on" : ""} title="Play mode — hover and press the button live"
            aria-pressed={playing} onClick={() => { setCanvasMode("play"); }}>
            <Play size={17} strokeWidth={1.8} />
          </button>
          <span className="zdiv" />
          </>)}
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
          {(focus === "toggle" || focus === "badge"
            ? ([["default", focus === "toggle" ? "On" : "Presented", 1], ["pressed", focus === "toggle" ? "Off" : "Awarded", 0], ["disabled", "Disabled", 1]] as [GenStateName, string, number][])
            : sideStates.map((s) => [s, CAP[s], undefined] as [GenStateName, string, number | undefined])
          ).map(([s, cap, v]) => (
            <button className={`scard clickable${s === selectedState ? " sel" : ""}`} key={s}
              onClick={() => setSelectedState(s)} title={`Edit ${cap}`} aria-pressed={s === selectedState}>
              <div className="scard-title">{cap}{s === selectedState ? " · editing" : ""}</div>
              <div className="scard-body" dangerouslySetInnerHTML={{ __html: focus ? renderKit(cfg, focus, fSize, s, v, kitShapes[focus], { textOy: fOy, row: focus === "datarow" ? kitRow : undefined }) : renderBevel(cfg, s) }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


/** A component placed on the sketch board — draggable and scalable in design
 *  mode, fully alive in Play mode: buttons hover and press, and a saved
 *  slider, toggle, segment, dropdown or progress plays as that component. */
function BoardPiece({ b, item, playing, onDragStart, onDragMove, onDragEnd, onScale, onRemove }: {
  b: BoardItem; item: LibItem; playing: boolean;
  onDragStart: (e: React.PointerEvent) => void; onDragMove: (e: React.PointerEvent) => void; onDragEnd: () => void;
  onScale: (dir: 1 | -1) => void; onRemove: () => void;
}) {
  const sc = b.scale ?? 1;
  return (
    <div className={`board-item${playing ? " playing" : ""}`} style={{ left: b.x, top: b.y }}
      {...(playing ? {} : {
        onPointerDown: (e: React.PointerEvent) => {
          onDragStart(e);
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        },
        onPointerMove: onDragMove,
        onPointerUp: onDragEnd,
        onPointerCancel: onDragEnd,
      })}>
      {!playing && (
        <div className="board-tools" onPointerDown={(e) => e.stopPropagation()}>
          <button title="Smaller" onClick={() => onScale(-1)}><Minus size={12} strokeWidth={2.4} /></button>
          <button title="Bigger" onClick={() => onScale(1)}><Plus size={12} strokeWidth={2.4} /></button>
          <button title="Remove from stage" onClick={onRemove}><X size={12} strokeWidth={2.4} /></button>
        </div>
      )}
      <div style={{ transform: `scale(${sc})`, transformOrigin: "top left" }}>
        {/* anchorContent: the saved x/y keeps pointing at the shell, not the
            glow pad — layouts arranged before the pad existed stay put */}
        <LiveArt cfg={item.cfg} playing={playing} anchorContent
          kit={item.kit ? { id: item.kit.id, size: item.kit.size, shape: item.kit.shape } : undefined} />
      </div>
    </div>
  );
}
