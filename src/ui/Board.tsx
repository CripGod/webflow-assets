import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, Grid3x3, ImagePlus, LayoutTemplate, Lock, Monitor, Plus, Search, Smartphone, SquarePen, Trash2, X } from "lucide-react";
import { useGen, fileToBgDataUrl } from "@/generator/store";
import type { BoardDef, BoardItem } from "@/generator/store";
import { renderBevel, renderKit, glowPadOf } from "@/generator/bevel";
import { KIT_COMPONENTS, applyKitTextFill, resolveKitIcon } from "@/generator/model";
import type { GenConfig, KitComponentId } from "@/generator/model";
import { download, downloadSvg } from "@/generator/exportUtils";
import { LiveArt } from "./LiveArt";

/* ── The Board v3 — a vertical stack of named artboards ────────────
   Left: searchable asset drawer (live kit components + saved pieces).
   Center: every artboard in a scrolling column; each has its own name,
   aspect, pieces and background (cropped to the board bounds).
   Right: an InDesign-style pages tray to add / reorder / delete boards,
   then the inspector for the selected piece or the active background.
   Cmd+Z undoes (100 levels), Delete removes, Cmd+D duplicates. */

const ASSET_GROUPS: { name: string; ids: KitComponentId[] }[] = [
  { name: "Buttons", ids: ["primary", "secondary", "small", "ghost", "iconbtn"] },
  { name: "Containers", ids: ["panel", "header", "tab", "dropdown"] },
  { name: "HUD", ids: ["resource", "chip", "badge", "datarow", "slot", "orb", "ring", "flipclock", "stopwatch", "timerdigits"] },
  { name: "Controls", ids: ["toggle", "slider", "progress", "input", "segment", "checkbox", "radio", "joystick"] },
  { name: "Combat & spatial", ids: ["reticle", "minimap", "ammo", "lives", "bignum"] },
  { name: "Racing", ids: ["speedo", "speedo2", "circuit", "leaderboard", "laptimes", "telemetry", "startlights"] },
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
  "Racing HUD": [
    { kitId: "speedo", x: 760, y: 620, scale: 1.1 },
    { kitId: "circuit", x: 60, y: 80 },
    { kitId: "leaderboard", x: 1450, y: 70 },
    { kitId: "telemetry", x: 1440, y: 640, scale: 0.9 },
    { kitId: "progress", x: 640, y: 60, scale: 1.05 },
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
  "169": [1920, 1080, "16:9"],
  mobile: [390, 844, "Mobile"],
};

const clone = (c: GenConfig) => (typeof structuredClone === "function" ? structuredClone(c) : JSON.parse(JSON.stringify(c))) as GenConfig;

export function BoardView({ playing }: { playing: boolean }) {
  const {
    cfg, boards, activeBoard, library, kitShapes, kitSizes, kitTextFill, kitIcons, kitLabels, kitRow,
    setActiveBoard, addBoard, removeBoard, renameBoard, moveBoard, clearBoard, setBoardBg,
    addBoardItems, setBoardAspect, boardSnap, setBoardSnap, boardSel, setBoardSel,
    addToBoard, addKitToBoard, moveBoardItem, scaleBoardItem, rotateBoardItem, removeBoardItem,
    duplicateBoardItem,
  } = useGen();
  const [q, setQ] = useState("");
  // rolling over a tray thumbnail previews the asset large in a viewport
  const [preview, setPreview] = useState<{ name: string; svg: string } | null>(null);
  const act = boards.find((b) => b.id === activeBoard) ?? boards[0];
  const frameRef = useRef<HTMLDivElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; ox: number; oy: number; fit: number } | null>(null);
  const [frameW, setFrameW] = useState(900);

  // stage scale follows the frame width — every artboard reads like a device
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const read = () => setFrameW(el.getBoundingClientRect().width);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fitOf = (bd: BoardDef) => {
    const [W, H] = STAGE[bd.aspect];
    return Math.min((frameW - 56) / W, 820 / H, 1);
  };

  /* keyboard: Delete removes, Cmd+D duplicates, Cmd+Z / Shift+Cmd+Z undo/redo */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const st = useGen.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redoBoard(); else st.undoBoard();
      } else if (mod && e.key.toLowerCase() === "d" && st.boardSel) {
        e.preventDefault();
        st.duplicateBoardItem(st.boardSel);
      } else if ((e.key === "Delete" || e.key === "Backspace") && st.boardSel) {
        e.preventDefault();
        st.removeBoardItem(st.boardSel);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // asset thumbnails render tight (glow pads collapse) and follow the style
  const assets = useMemo(() => {
    const tc = clone(cfg);
    for (const s of Object.values(tc.states)) s.glow = 0;
    const name = (id: KitComponentId) => KIT_COMPONENTS.find((c) => c.id === id)?.name ?? id;
    return ASSET_GROUPS.map((g) => ({
      name: g.name,
      items: g.ids.map((id) => ({ id, name: name(id), svg: renderKit(applyKitTextFill(tc, kitTextFill[id]), id, "s", "default", undefined, kitShapes[id], { icon: resolveKitIcon(kitIcons[id], undefined), label: kitLabels[id] }) })),
    }));
  }, [cfg, kitShapes, kitTextFill, kitIcons, kitLabels]);

  const selBoard = boards.find((bd) => bd.items.some((b) => b.id === boardSel)) ?? null;
  const sel = selBoard?.items.find((b) => b.id === boardSel) ?? null;

  /* the exact svg a board item shows — shared by display, export and PNG */
  const svgOf = (b: BoardItem): { svg: string; cfg: GenConfig } => {
    if (b.kitId) {
      return { svg: renderKit(applyKitTextFill(cfg, kitTextFill[b.kitId]), b.kitId, kitSizes[b.kitId] ?? "l", "default", undefined, kitShapes[b.kitId], { icon: resolveKitIcon(kitIcons[b.kitId], undefined), label: kitLabels[b.kitId], row: b.kitId === "datarow" ? kitRow : undefined }), cfg };
    }
    const item = library.find((l) => l.id === b.libId);
    if (!item) return { svg: "", cfg };
    return { svg: item.kit ? renderKit(item.cfg, item.kit.id, item.kit.size, "default", undefined, item.kit.shape) : renderBevel(item.cfg, "default"), cfg: item.cfg };
  };

  const nameOf = (b: BoardItem): string => {
    if (b.kitId) return KIT_COMPONENTS.find((c) => c.id === b.kitId)?.name ?? b.kitId;
    return library.find((l) => l.id === b.libId)?.name ?? "Piece";
  };

  /* composite one artboard to a PNG at native resolution */
  const exportPng = async (bd: BoardDef) => {
    const [W, H] = STAGE[bd.aspect];
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#0D0F16";
    ctx.fillRect(0, 0, W, H);
    if (bd.bgImage && (bd.bgShow ?? true)) {
      await new Promise<void>((res) => {
        const img = new Image();
        img.onload = () => {
          const s = Math.max(W / img.width, H / img.height); // cover, cropped to the board
          ctx.save();
          ctx.globalAlpha = (bd.bgOpacity ?? 100) / 100;
          if (bd.bgBlur) ctx.filter = `blur(${bd.bgBlur}px)`;
          ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
          ctx.restore(); res();
        };
        img.onerror = () => res();
        img.src = bd.bgImage!;
      });
    }
    for (const b of bd.items) {
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
    const slug = bd.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "board";
    cv.toBlob((bl) => { if (bl) download(`${slug}-${W}x${H}.png`, bl); }, "image/png");
  };

  const snapV = (v: number) => (boardSnap ? Math.round(v / 16) * 16 : Math.round(v));
  const scrollToBoard = (id: string) => {
    frameRef.current?.querySelector(`[data-board="${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

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
                    <button key={it.id} className="bd-asset" title={`Add ${it.name} to ${act?.name ?? "the board"}`}
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
                  <button key={l.id} className="bd-asset" title={`Add ${l.name} to ${act?.name ?? "the board"}`} onClick={() => addToBoard(l.id)}
                    onPointerEnter={() => setPreview({ name: l.name, svg: l.kit ? renderKit(l.cfg, l.kit.id, l.kit.size, "default", undefined, l.kit.shape) : renderBevel(l.cfg, "default") })}
                    onPointerLeave={() => setPreview(null)}>
                    <span dangerouslySetInnerHTML={{ __html: l.kit ? renderKit(l.cfg, l.kit.id, l.kit.size, "default", undefined, l.kit.shape) : renderBevel(l.cfg, "default") }} />
                    <i>{l.name}</i>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="bd-hint">Click an asset to place it on the active board · ⌘Z undo · ⌘D duplicate · Delete removes</div>
        </div>
      </aside>

      {preview && (
        <div className="bd-preview" aria-hidden="true">
          <div className="bd-pvart" dangerouslySetInnerHTML={{ __html: preview.svg }} />
          <div className="bd-pvname">{preview.name}</div>
        </div>
      )}

      {/* ── artboards ── */}
      <div className="bd-main">
        <header className="bd-top">
          <div className="bd-title"><h2>The Board</h2><span>Arrange components across artboards.</span></div>
          <div className="bd-aspect" role="radiogroup" aria-label="Active board aspect">
            <button className={act?.aspect === "169" ? "on" : ""} role="radio" aria-checked={act?.aspect === "169"}
              onClick={() => setBoardAspect("169")}><Monitor size={13} strokeWidth={2} /> 16:9</button>
            <button className={act?.aspect === "mobile" ? "on" : ""} role="radio" aria-checked={act?.aspect === "mobile"}
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
          <button className="bd-export" onClick={() => { if (act) exportPng(act); }}><Download size={14} strokeWidth={2.2} /> Export PNG</button>
        </header>
        <div className="bd-frame bd-boards" ref={frameRef}>
          {boards.map((bd) => {
            const [W, H, aspName] = STAGE[bd.aspect];
            const fit = fitOf(bd);
            return (
              <section key={bd.id} className={`bd-artboard${bd.id === activeBoard ? " on" : ""}`} data-board={bd.id}>
                <header className="bd-abhead">
                  <input className="bd-abname" value={bd.name} aria-label="Board name" maxLength={40}
                    onFocus={() => setActiveBoard(bd.id)}
                    onChange={(e) => renameBoard(bd.id, e.target.value)} />
                  <span className="bd-abmeta">{aspName} · {W} × {H}</span>
                  <button className="bd-abtool" title="Clear every piece from this board"
                    onClick={() => { if (bd.items.length === 0 || window.confirm(`Clear all ${bd.items.length} pieces from ${bd.name}?`)) clearBoard(bd.id); }}>
                    Clear
                  </button>
                  <button className="bd-abtool danger" title="Delete this board"
                    onClick={() => { if (bd.items.length === 0 || window.confirm(`Delete ${bd.name} and its ${bd.items.length} pieces?`)) removeBoard(bd.id); }}>
                    <Trash2 size={12} strokeWidth={2.2} />
                  </button>
                </header>
                <div className="bd-stage" style={{ width: W * fit, height: H * fit }}
                  onPointerDown={(e) => { setActiveBoard(bd.id); if (e.target === e.currentTarget) setBoardSel(null); }}>
                  {bd.bgImage && (bd.bgShow ?? true) && (
                    <div className="bd-bg" style={{ backgroundImage: `url(${bd.bgImage})`, opacity: (bd.bgOpacity ?? 100) / 100, filter: bd.bgBlur ? `blur(${bd.bgBlur}px)` : undefined }} />
                  )}
                  <div className="bd-canvas" style={{ width: W, height: H, transform: `scale(${fit})` }}>
                    {bd.items.map((b) => (
                      <StagePiece key={b.id} b={b} playing={playing} selected={boardSel === b.id}
                        onSelect={() => { setActiveBoard(bd.id); setBoardSel(b.id); }}
                        onDragStart={(e) => { dragRef.current = { id: b.id, dx: e.clientX, dy: e.clientY, ox: b.x, oy: b.y, fit }; setBoardSel(b.id); }}
                        onDragMove={(e) => {
                          const d = dragRef.current;
                          if (!d || d.id !== b.id) return;
                          moveBoardItem(b.id, snapV(d.ox + (e.clientX - d.dx) / d.fit), snapV(d.oy + (e.clientY - d.dy) / d.fit));
                        }}
                        onDragEnd={() => { dragRef.current = null; }} />
                    ))}
                    {bd.items.length === 0 && <div className="bd-empty">Click an asset on the left to place it here.</div>}
                  </div>
                </div>
              </section>
            );
          })}
          <button className="bd-addboard-inline" onClick={addBoard}><Plus size={14} strokeWidth={2.2} /> Add board</button>
        </div>
      </div>

      {/* ── pages tray + inspector ── */}
      <aside className="bd-side">
        <div className="bd-h">Boards</div>
        <div className="bd-pages">
          {boards.map((bd, i) => (
            <div key={bd.id} className={`bd-page${bd.id === activeBoard ? " on" : ""}`} role="button" tabIndex={0}
              onClick={() => { setActiveBoard(bd.id); scrollToBoard(bd.id); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setActiveBoard(bd.id); scrollToBoard(bd.id); } }}>
              <span className={`bd-pagethumb${bd.aspect === "mobile" ? " mob" : ""}`}
                style={bd.bgImage ? { backgroundImage: `url(${bd.bgImage})` } : undefined}>
                {bd.items.length}
              </span>
              <span className="bd-pagename">{bd.name}</span>
              <span className="bd-pagectl">
                <button title="Move up" disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveBoard(bd.id, -1); }}><ArrowUp size={11} strokeWidth={2.4} /></button>
                <button title="Move down" disabled={i === boards.length - 1} onClick={(e) => { e.stopPropagation(); moveBoard(bd.id, 1); }}><ArrowDown size={11} strokeWidth={2.4} /></button>
                <button title={`Delete ${bd.name}`} className="danger"
                  onClick={(e) => { e.stopPropagation(); if (bd.items.length === 0 || window.confirm(`Delete ${bd.name} and its ${bd.items.length} pieces?`)) removeBoard(bd.id); }}>
                  <X size={11} strokeWidth={2.4} />
                </button>
              </span>
            </div>
          ))}
          <button className="bd-addboard" onClick={addBoard}><Plus size={13} strokeWidth={2.2} /> Add board</button>
        </div>

        {sel ? (
          <>
            <div className="bd-h" style={{ marginTop: 16 }}>Selected</div>
            <div className="bd-selname">{nameOf(sel)}{selBoard ? <em> · {selBoard.name}</em> : null}</div>
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
              <button onClick={() => duplicateBoardItem(sel.id)} title="Duplicate this piece (⌘D)">
                <Copy size={13} strokeWidth={2.2} /> Duplicate
              </button>
              <button onClick={() => downloadSvg(svgOf(sel).svg, `board-${nameOf(sel).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`)}>
                <Download size={13} strokeWidth={2.2} /> Export asset
              </button>
              <button className="danger" onClick={() => removeBoardItem(sel.id)} title="Remove (Delete)">
                <Trash2 size={13} strokeWidth={2.2} /> Remove
              </button>
            </div>
            {sel.kitId && <div className="bd-note"><Lock size={11} strokeWidth={2.2} /> Live asset — restyling the kit restyles this piece.</div>}
          </>
        ) : act ? (
          <>
            <div className="bd-h" style={{ marginTop: 16 }}>Background · {act.name}</div>
            {act.bgImage ? (
              <>
                <div className="bd-bgprev" style={{ backgroundImage: `url(${act.bgImage})` }} />
                <div className="bd-actions">
                  <button onClick={() => bgInput.current?.click()}><ImagePlus size={13} strokeWidth={2.2} /> Replace</button>
                  <button className="danger" onClick={() => setBoardBg({ bgImage: null })}><X size={13} strokeWidth={2.2} /> Clear</button>
                </div>
                <label className="bd-slider">Opacity · {act.bgOpacity ?? 100}%
                  <input type="range" min={10} max={100} value={act.bgOpacity ?? 100} onChange={(e) => setBoardBg({ bgOpacity: +e.target.value })} />
                </label>
                <label className="bd-slider">Blur · {act.bgBlur ?? 0}px
                  <input type="range" min={0} max={14} value={act.bgBlur ?? 0} onChange={(e) => setBoardBg({ bgBlur: +e.target.value })} />
                </label>
                <div className="bd-note">The image crops to the board bounds — cover fit, nothing spills.</div>
              </>
            ) : (
              <>
                <div className="bd-note">A plain dark ground, or your own screenshot / concept art behind the pieces — cropped to this board.</div>
                <div className="bd-actions">
                  <button onClick={() => bgInput.current?.click()}><ImagePlus size={13} strokeWidth={2.2} /> Upload background</button>
                </div>
              </>
            )}
            <input ref={bgInput} type="file" accept="image/*" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void fileToBgDataUrl(f).then((url) => setBoardBg({ bgImage: url, bgShow: true })); e.target.value = ""; }} />
            <div className="bd-h" style={{ marginTop: 18 }}>Stage</div>
            <div className="bd-note">{act.name} · {STAGE[act.aspect][0]} × {STAGE[act.aspect][1]} · shown at {Math.round(fitOf(act) * 100)}% · Export renders at full resolution.</div>
          </>
        ) : null}
      </aside>
    </div>
  );
}

/** One piece on the stage — draggable, selectable, optionally rotated.
 *  The wrapper takes the art's MEASURED size × scale, so the selection
 *  box always hugs the piece at any scale. */
function StagePiece({ b, playing, selected, onSelect, onDragStart, onDragMove, onDragEnd }: {
  b: BoardItem; playing: boolean; selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onDragEnd: () => void;
}) {
  const { cfg, library, kitShapes, kitSizes, kitTextFill, kitIcons, kitLabels, kitRow } = useGen();
  const sc = b.scale ?? 1;
  const artRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState<{ w: number; h: number; shell: [number, number, number, number] | null } | null>(null);
  useEffect(() => {
    const host = artRef.current;
    if (!host) return;
    const read = () => {
      const svg = host.querySelector("svg");
      const w = svg ? parseFloat(svg.getAttribute("width") ?? "0") : 0;
      const h = svg ? parseFloat(svg.getAttribute("height") ?? "0") : 0;
      // the renderer stamps the true shell rect (viewBox units) on the root;
      // with anchorContent the wrapper origin IS viewBox 0,0, so the shell
      // maps to CSS by a plain × scale — the selection box hugs the art,
      // not the glow-padded canvas
      const raw = svg?.getAttribute("data-shell")?.split(" ").map(Number);
      const shell = raw && raw.length === 4 && raw.every(Number.isFinite) ? (raw as [number, number, number, number]) : null;
      if (w && h) setDim((d) => (d && d.w === w && d.h === h && String(d.shell) === String(shell) ? d : { w, h, shell }));
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ["width", "height", "data-shell"] });
    return () => mo.disconnect();
  }, []);
  const item = b.kitId ? null : library.find((l) => l.id === b.libId);
  if (!b.kitId && !item) return null;
  return (
    <div className={`board-item${playing ? " playing" : ""}${selected ? " sel" : ""}`}
      style={{ left: b.x, top: b.y, transform: b.rot ? `rotate(${b.rot}deg)` : undefined,
        width: dim ? dim.w * sc : undefined, height: dim ? dim.h * sc : undefined }}
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
      <div ref={artRef} style={{ transform: `scale(${sc})`, transformOrigin: "top left" }}>
        {b.kitId ? (
          <LiveArt cfg={applyKitTextFill(cfg, kitTextFill[b.kitId])} playing={playing} anchorContent
            kit={{ id: b.kitId, size: kitSizes[b.kitId] ?? "l", shape: kitShapes[b.kitId], icon: resolveKitIcon(kitIcons[b.kitId], undefined), label: kitLabels[b.kitId], row: b.kitId === "datarow" ? kitRow : undefined }} />
        ) : (
          <LiveArt cfg={item!.cfg} playing={playing} anchorContent
            kit={item!.kit ? { id: item!.kit.id, size: item!.kit.size, shape: item!.kit.shape } : undefined} />
        )}
      </div>
      {selected && (
        <i className="board-selbox" aria-hidden="true" style={dim?.shell
          ? { left: dim.shell[0] * sc, top: dim.shell[1] * sc, width: dim.shell[2] * sc, height: dim.shell[3] * sc }
          : { left: 0, top: 0, width: "100%", height: "100%" }} />
      )}
    </div>
  );
}
