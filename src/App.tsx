import { useEffect, useRef, useState } from "react";
import { TopBar } from "./ui/TopBar";
import { Rail, Panel } from "./ui/Panel";
import { CanvasView } from "./ui/CanvasView";
import { useGen } from "./generator/store";

/* When something inside a handler throws, React can leave the UI looking fine
   while every click silently dies — the "app craps out" report. Surface it. */
function useCrashBanner() {
  const [crash, setCrash] = useState<string | null>(null);
  useEffect(() => {
    const onErr = (e: ErrorEvent) => setCrash(e.message || "Unknown error");
    const onRej = (e: PromiseRejectionEvent) => setCrash(String(e.reason).slice(0, 200));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => { window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, []);
  return crash;
}

export function App() {
  const { panelW, setPanelW, undo, redo, theme } = useGen();
  const dragFrom = useRef<{ x: number; w: number } | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

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

  const crash = useCrashBanner();
  return (
    <div className="app">
      {crash && (
        <div className="crashbar" role="alert">
          Something glitched under the hood — your work is saved. <button onClick={() => window.location.reload()}>Reload</button>
          <span className="crashdetail">{crash}</span>
        </div>
      )}
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
