import { useEffect, useRef } from "react";
import { TopBar } from "./ui/TopBar";
import { Rail, Panel } from "./ui/Panel";
import { CanvasView } from "./ui/CanvasView";
import { useGen } from "./generator/store";

export function App() {
  const { panelW, setPanelW, undo, redo } = useGen();
  const dragFrom = useRef<{ x: number; w: number } | null>(null);

  // Cmd/Ctrl+Z undo, Shift for redo. Text fields keep their native undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement;
      if (t instanceof HTMLTextAreaElement) return;
      if (t instanceof HTMLInputElement && (t.type === "text" || t.type === "number" || t.type === "search")) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const onHandleDown = (e: React.PointerEvent) => {
    dragFrom.current = { x: e.clientX, w: panelW };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragFrom.current) return;
    setPanelW(dragFrom.current.w + (e.clientX - dragFrom.current.x));
  };
  const onHandleUp = () => { dragFrom.current = null; };

  return (
    <div className="app">
      <TopBar />
      <div className="body" style={{ gridTemplateColumns: `84px ${panelW}px 6px 1fr` }}>
        <Rail />
        <Panel />
        <div className="panel-resize" role="separator" aria-orientation="vertical" aria-label="Resize panel"
          onPointerDown={onHandleDown} onPointerMove={onHandleMove}
          onPointerUp={onHandleUp} onPointerCancel={onHandleUp} />
        <CanvasView />
      </div>
    </div>
  );
}
