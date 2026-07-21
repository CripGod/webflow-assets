import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Grid3x3, ImagePlus, LayoutTemplate, Lock, Monitor, Search, Smartphone, SquarePen, Trash2, X } from "lucide-react";
import { useGen } from "@/generator/store";
import type { BoardItem } from "@/generator/store";
import { renderBevel, renderKit, glowPadOf } from "@/generator/bevel";
import { KIT_COMPONENTS, applyKitTextFill } from "@/generator/model";
import type { GenConfig, KitComponentId } from "@/generator/model";
import { download, downloadSvg } from "@/generator/exportUtils";
import { LiveArt } from "./LiveArt";

/* ── The Board v2 — arrange components on a target layout ─────────
   Left: searchable asset drawer (live kit components + saved pieces).
   Center: a fixed-resolution stage (16:9 or mobile portrait), scaled to
   fit, with a plain dark ground or a user-uploaded background.
   Right: inspector for the selected piece, or the background when
   nothing is selected. Everything stays live and editable. */

const ASSET_GROUPS: { name: string; ids: KitComponentId[] }[] = [
  { name: "Buttons", ids: ["primary", "secondary", "small", "ghost", "iconbtn"] },
  { name: "Containers", ids: ["panel", "header", "tab", "dropdown"] },
  { name: "HUD", ids: ["resource", "chip", "badge", "datarow", "slot", "orb", "ring", "flipclock", "stopwatch", "timerdigits"] },
  { name: "Controls", ids: ["toggle", "slider", "progress", "input", "segment", "checkbox", "radio", "joystick"] },
  { name: "Combat & spatial", ids: ["reticle", "minimap", "ammo", "lives", "bignum"] },
  { name: "Racing", ids: ["speedo", "speedo2", "circuit"] },
];

/* Starter templates — approximate compositions for the 16:9 stage. The
   user nudges from here; every piece stays a live kit asset. */
const BOARD_TEMPLATES: Record<string, { kitId: KitComponentId; x: number; y: number; scale?: number }[]> = {
  "Main menu": [
    { kitId: "header", x: 560, y: 90, scale: 1.1 },
    { kitId: "primary", x: 700, y: 420, scale: 1.1 },
    { kitId: "small", x: 790, y: 640 },
    { kitId: "ghost", x: 790, y: 790 },
    { kitId: "resource", x: 70, y: 60 },
    { kitId: "iconbtn", x: 1680, y: 60, scale: 0.9 },
  ],
  "Game HUD": [
    { kitId: "resource", x: 70, y: 55 },
    { kitId: "lives", x: 90, y: 200, scale: 0.9 },
    { kitId: "progress", x: 640, y: 60, scale: 1.1 },
    { kitId: "minimap", x: 1540, y: 55, scale: 0.9 },
    { kitId: "joystick", x: 110, y: 640 },
    { kitId: "ammo", x: 1470, y: 850 },
    { kitId: "iconbtn", x: 1720, y: 620, scale: 0.85 },
  ],
  "Settings": [
    { kitId: "header", x: 620, y: 80 },
    { kitId: "slider", x: 640, y: 350 },
    { kitId: "slider", x: 640, y: 500 },
    { kitId: "toggle", x: 700, y: 650 },
    { kitId: "toggle", x: 1000, y: 650 },
    { kitId: "small", x: 820, y: 830 },
  ],
  "Match-3 round": [
    { kitId: "resource", x: 70, y: 55 },
    { kitId: "flipclock", x: 1480, y: 55, scale: 0.75 },
    ...([0, 1, 2] as const).flatMap((r) => ([0, 1, 2] as const).map((c) => (
      { kitId: "slot" as KitComponentId, x: 730 + c * 160, y: 300 + r * 160, scale: 0.9 }
    ))),
    { kitId: "progress", x: 660, y: 890, scale: 1.05 },
  ],
};

const STAGE: Record<"169" | "mobile", [number, number, string]> = {
  "169": [1920, 1080, "16:9 Board"],
  mobile: [390, 844, "Mobile Board"],
};

const clone = (c: GenConfig) => (typeof structuredClone === "function" ? structuredClone(c) : JSON.parse(JSON.stringify(c))) as GenConfig;

export function BoardView({ playing }: { playing: boolean }) {
  const {
    cfg, board, library, kitShapes, kitSizes, kitTextFill, kitRow,
    addBoardItems, boardAspect, setBoardAspect, boardSnap, setBoardSnap, boardSel, setBoardSel,
    addToBoard, addKitToBoard, moveBoardItem, scaleBoardItem, rotateBoardItem, removeBoardItem,
    bgImage, setBgImage, bgShow, bgOpacity, bgBlur, setBg,
  } = useGen();
  const [q, setQ] = useState("");
  // rolling over a tray thumbnail previews the asset large in a viewport
  const [preview, setPreview] = useState<{ name: string; svg: string } | null>(null);
  const [LW, LH, stageName] = STAGE[boardAspect];
  const frameRef = useRef<HTMLDivElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; ox: number; oy: number } | null>(null);
  const [fit, setFit] = useState(0.5);

  // stage scale follows the available frame — the board reads like a device
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setFit(Math.min((r.width - 24) / LW, (r.height - 44) / LH, 1));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [LW, LH]);

  // asset thumbnails render tight (glow pads collapse) and follow the style
  const assets = useMemo(() => {
    const tc = clone(cfg);
    for (const s of Object.values(tc.states)) s.glow = 0;
    const name = (id: KitComponentId) => KIT_COMPONENTS.find((c) => c.id === id)?.name ?? id;
    return ASSET_GROUPS.map((g) => ({
      name: g.name,
      items: g.ids.map((id) => ({ id, name: name(id), svg: renderKit(applyKitTextFill(tc, kitTextFill[id]), id, "s", "default", undefined, kitShapes[id]) })),
    }));
  }, [cfg, kitShapes, kitTextFill]);

  const sel = board.find((b) => b.id === boardSel) ?? null;

  /* the exact svg a board item shows — shared by display, export and PNG */
  const svgOf = (b: BoardItem): { svg: string; cfg: GenConfig } => {
    if (b.kitId) {
      return { svg: renderKit(applyKitTextFill(cfg, kitTextFill[b.kitId]), b.kitId, kitSizes[b.kitId] ?? "l", "default", undefined, kitShapes[b.kitId], { row: b.kitId === "datarow" ? kitRow : undefined }), cfg };
    }
    const item = library.find((l) => l.id === b.libId);
    if (!item) return { svg: "", cfg };
    return { svg: item.kit ? renderKit(item.cfg, item.kit.id, item.kit.size, "default", undefined, item.kit.shape) : renderBevel(item.cfg, "default"), cfg: item.cfg };
  };

  const nameOf = (b: BoardItem): string => {
    if (b.kitId) return KIT_COMPONENTS.find((c) => c.id === b.kitId)?.name ?? b.kitId;
    return library.find((l) => l.id === b.libId)?.name ?? "Piece";
  };

  /* composite the whole stage to a PNG at native resolution */
  const exportPng = async () => {
    const cv = document.createElement("canvas");
    cv.width = LW; cv.height = LH;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#0D0F16";
    ctx.fillRect(0, 0, LW, LH);
    if (bgImage && bgShow) {
      await new Promise<void>((res) => {
        const img = new Image();
        img.onload = () => {
          const s = Math.max(LW / img.width, LH / img.height); // cover
          ctx.save();
          ctx.globalAlpha = bgOpacity / 100;
          if (bgBlur) ctx.filter = `blur(${bgBlur}px)`;
          ctx.drawImage(img, (LW - img.width * s) / 2, (LH - img.height * s) / 2, img.width * s, img.height * s);
          ctx.restore(); res();
        };
        img.onerror = () => res();
        img.src = bgImage;
      });
    }
    for (const b of board) {
      const { svg, cfg: pc } = svgOf(b);
      if (!svg) continue;
      const pad = glowPadOf(pc);
      const s = b.scale ?? 1;
      await new Promise<void>((res) => {
        const img = new Image();
        img.onload = () => {
          const w = img.width * s, h = img.height * s;
          const cx = b.x - pad * s + w / 2, cy = b.y - pad * s + h / 2;
          ctx.save();
          ctx.translate(cx, cy);
          if (b.rot) ctx.rotate((b.rot * Math.PI) / 180);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
          ctx.restore(); res();
        };
        img.onerror = () => res();
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
      });
    }
    cv.toBlob((bl) => { if (bl) download(`board-${boardAspect === "169" ? "1920x1080" : "390x844"}.png`, bl); }, "image/png");
  };

  const snapV = (v: number) => (boardSnap ? Math.round(v / 16) * 16 : Math.round(v));

  return (
    <div className="board2">
      {/* ── assets ── */}
      <aside className="bd-assets">
        <div className="bd-h">Assets</div>
        <label className="bd-search"><Search size={13} strokeWidth={2.2} />
          <input placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search assets" />
        </label>
        <div className="bd-scroll">
          {assets.map((g) => {
            const items = g.items.filter((it) => !q || it.name.toLowerCase().includes(q.toLowerCase()));
            if (!items.length) return null;
            return (
              <div key={g.name}>
                <div className="bd-cat">{g.name}</div>
                <div className="bd-grid">
                  {items.map((it) => (
                    <button key={it.id} className="bd-asset" title={`Add ${it.name} to the board`}
                      onClick={() => addKitToBoard(it.id)}
                      onPointerEnter={() => setPreview({ name: it.name, svg: svgOf({ id: "pv", libId: "", kitId: it.id, x: 0, y: 0 } as BoardItem).svg })}
                      onPointerLeave={() => setPreview(null)}>
                      <span dangerouslySetInnerHTML={{ __html: it.svg }} />
                      <i>{it.name}</i>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {library.length > 0 && (
            <div>
              <div className="bd-cat">Saved components</div>
              <div className="bd-grid">
                {library.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase())).map((l) => (
                  <button key={l.id} className="bd-asset" title={`Add ${l.name} to the board`} onClick={() => addToBoard(l.id)}
                    onPointerEnter={() => setPreview({ name: l.name, svg: l.kit ? renderKit(l.cfg, l.kit.id, l.kit.size, "default", undefined, l.kit.shape) : renderBevel(l.cfg, "default") })}
                    onPointerLeave={() => setPreview(null)}>
                    <span dangerouslySetInnerHTML={{ __html: l.kit ? renderKit(l.cfg, l.kit.id, l.kit.size, "default", undefined, l.kit.shape) : renderBevel(l.cfg, "default") }} />
                    <i>{l.name}</i>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="bd-hint">Click an asset to place it · drag pieces on the stage · assets follow the master style live</div>
        </div>
      </aside>

      {preview && (
        <div className="bd-preview" aria-hidden="true">
          <div className="bd-pvart" dangerouslySetInnerHTML={{ __html: preview.svg }} />
          <div className="bd-pvname">{preview.name}</div>
        </div>
      )}

      {/* ── stage ── */}
      <div className="bd-main">
        <header className="bd-top">
          <div className="bd-title"><h2>The Board</h2><span>Arrange components on a target layout.</span></div>
          <div className="bd-aspect" role="radiogroup" aria-label="Board aspect">
            <button className={boardAspect === "169" ? "on" : ""} role="radio" aria-checked={boardAspect === "169"}
              onClick={() => setBoardAspect("169")}><Monitor size={13} strokeWidth={2} /> 16:9</button>
            <button className={boardAspect === "mobile" ? "on" : ""} role="radio" aria-checked={boardAspect === "mobile"}
              onClick={() => setBoardAspect("mobile")}><Smartphone size={13} strokeWidth={2} /> Mobile</button>
          </div>
          <label className="bd-tpl" title="Add a full starter composition — pieces land pre-sized and pre-placed">
            <LayoutTemplate size={13} strokeWidth={2} />
            <select value="" aria-label="Add a starter template"
              onChange={(e) => { const t = BOARD_TEMPLATES[e.target.value]; if (t) addBoardItems(t); }}>
              <option value="">Starter template…</option>
              {Object.keys(BOARD_TEMPLATES).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="bd-snap"><Grid3x3 size={13} strokeWidth={2} /> Snap to grid
            <input type="checkbox" checked={boardSnap} onChange={(e) => setBoardSnap(e.target.checked)} />
          </label>
          <button className="bd-export" onClick={exportPng}><Download size={14} strokeWidth={2.2} /> Export PNG</button>
        </header>
        <div className="bd-frame" ref={frameRef}>
          <div className="bd-meta">{stageName} · {LW} × {LH}{boardSnap ? " · snap 16" : ""}</div>
          <div className="bd-stage" style={{ width: LW * fit, height: LH * fit }}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setBoardSel(null); }}>
            {bgImage && bgShow && (
              <div className="bd-bg" style={{ backgroundImage: `url(${bgImage})`, opacity: bgOpacity / 100, filter: bgBlur ? `blur(${bgBlur}px)` : undefined }} />
            )}
            <div className="bd-canvas" style={{ width: LW, height: LH, transform: `scale(${fit})` }}>
              {board.map((b) => (
                <StagePiece key={b.id} b={b} playing={playing} fit={fit} selected={boardSel === b.id}
                  svgOf={svgOf}
                  onSelect={() => setBoardSel(b.id)}
                  onDragStart={(e) => { dragRef.current = { id: b.id, dx: e.clientX, dy: e.clientY, ox: b.x, oy: b.y }; setBoardSel(b.id); }}
                  onDragMove={(e) => {
                    const d = dragRef.current;
                    if (!d || d.id !== b.id) return;
                    moveBoardItem(b.id, snapV(d.ox + (e.clientX - d.dx) / fit), snapV(d.oy + (e.clientY - d.dy) / fit));
                  }}
                  onDragEnd={() => { dragRef.current = null; }} />
              ))}
              {board.length === 0 && <div className="bd-empty">Click an asset on the left to place it here.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── inspector ── */}
      <aside className="bd-side">
        {sel ? (
          <>
            <div className="bd-h">Selected</div>
            <div className="bd-selname">{nameOf(sel)}</div>
            <div className="bd-row2">
              <label>X <input type="number" value={Math.round(sel.x)} onChange={(e) => moveBoardItem(sel.id, +e.target.value, sel.y)} /></label>
              <label>Y <input type="number" value={Math.round(sel.y)} onChange={(e) => moveBoardItem(sel.id, sel.x, +e.target.value)} /></label>
            </div>
            <label className="bd-slider">Scale · {Math.round((sel.scale ?? 1) * 100)}%
              <input type="range" min={30} max={200} value={Math.round((sel.scale ?? 1) * 100)}
                onChange={(e) => scaleBoardItem(sel.id, +e.target.value / 100)} />
            </label>
            <label className="bd-slider">Rotation · {sel.rot ?? 0}°
              <input type="range" min={-45} max={45} value={sel.rot ?? 0}
                onChange={(e) => rotateBoardItem(sel.id, +e.target.value)} />
            </label>
            <div className="bd-actions">
              {sel.kitId && (
                <button onClick={() => { useGen.getState().setFocus(sel.kitId!); useGen.getState().setPhase("master"); }}
                  title="Open this component in the editor — every control shapes it live">
                  <SquarePen size={13} strokeWidth={2.2} /> Edit component
                </button>
              )}
              <button onClick={() => downloadSvg(svgOf(sel).svg, `board-${nameOf(sel).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`)}>
                <Download size={13} strokeWidth={2.2} /> Export asset
              </button>
              <button className="danger" onClick={() => { removeBoardItem(sel.id); setBoardSel(null); }}>
                <Trash2 size={13} strokeWidth={2.2} /> Remove
              </button>
            </div>
            {sel.kitId && <div className="bd-note"><Lock size={11} strokeWidth={2.2} /> Live asset — restyling the kit restyles this piece.</div>}
          </>
        ) : (
          <>
            <div className="bd-h">Background</div>
            {bgImage ? (
              <>
                <div className="bd-bgprev" style={{ backgroundImage: `url(${bgImage})` }} />
                <div className="bd-actions">
                  <button onClick={() => bgInput.current?.click()}><ImagePlus size={13} strokeWidth={2.2} /> Replace</button>
                  <button className="danger" onClick={() => setBgImage(null)}><X size={13} strokeWidth={2.2} /> Clear</button>
                </div>
                <label className="bd-slider">Opacity · {bgOpacity}%
                  <input type="range" min={10} max={100} value={bgOpacity} onChange={(e) => setBg({ bgOpacity: +e.target.value })} />
                </label>
                <label className="bd-slider">Blur · {bgBlur}px
                  <input type="range" min={0} max={14} value={bgBlur} onChange={(e) => setBg({ bgBlur: +e.target.value })} />
                </label>
              </>
            ) : (
              <>
                <div className="bd-note">A plain dark ground, or your own screenshot / concept art behind the pieces.</div>
                <div className="bd-actions">
                  <button onClick={() => bgInput.current?.click()}><ImagePlus size={13} strokeWidth={2.2} /> Upload background</button>
                </div>
              </>
            )}
            <input ref={bgInput} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setBgImage(URL.createObjectURL(f)); e.target.value = ""; }} />
            <div className="bd-h" style={{ marginTop: 18 }}>Stage</div>
            <div className="bd-note">{stageName} · {LW} × {LH} · shown at {Math.round(fit * 100)}% · Export renders at full resolution.</div>
          </>
        )}
      </aside>
    </div>
  );
}

/** One piece on the stage — draggable, selectable, optionally rotated. */
function StagePiece({ b, playing, fit, selected, svgOf, onSelect, onDragStart, onDragMove, onDragEnd }: {
  b: BoardItem; playing: boolean; fit: number; selected: boolean;
  svgOf: (b: BoardItem) => { svg: string; cfg: GenConfig };
  onSelect: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: () => void;
}) {
  const { cfg, library, kitShapes, kitSizes, kitTextFill, kitRow } = useGen();
  void svgOf;
  const sc = b.scale ?? 1;
  const item = b.kitId ? null : library.find((l) => l.id === b.libId);
  if (!b.kitId && !item) return null;
  return (
    <div className={`board-item${playing ? " playing" : ""}${selected ? " sel" : ""}`}
      style={{ left: b.x, top: b.y, transform: b.rot ? `rotate(${b.rot}deg)` : undefined }}
      {...(!playing ? {
        onPointerDown: (e: React.PointerEvent) => {
          onSelect();
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          onDragStart(e);
        },
        onPointerMove: onDragMove,
        onPointerUp: onDragEnd,
        onPointerCancel: onDragEnd,
      } : { onPointerDown: onSelect })}>
      <div style={{ transform: `scale(${sc})`, transformOrigin: "top left" }}>
        {b.kitId ? (
          <LiveArt cfg={applyKitTextFill(cfg, kitTextFill[b.kitId])} playing={playing} anchorContent
            kit={{ id: b.kitId, size: kitSizes[b.kitId] ?? "l", shape: kitShapes[b.kitId], row: b.kitId === "datarow" ? kitRow : undefined }} />
        ) : (
          <LiveArt cfg={item!.cfg} playing={playing} anchorContent
            kit={item!.kit ? { id: item!.kit.id, size: item!.kit.size, shape: item!.kit.shape } : undefined} />
        )}
      </div>
      {void fit}
    </div>
  );
}
