import { TopBar } from "./ui/TopBar";
import { Rail, Panel } from "./ui/Panel";
import { CanvasView } from "./ui/CanvasView";

export function App() {
  return (
    <div className="app">
      <TopBar />
      <div className="body">
        <Rail />
        <Panel />
        <CanvasView />
      </div>
    </div>
  );
}
