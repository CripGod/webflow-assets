import { TopBar } from "./editor/TopBar";
import { IconRail } from "./editor/IconRail";
import { SettingsPanel } from "./editor/SettingsPanel";
import { Canvas } from "./editor/Canvas";
import { EduBar } from "./editor/EduBar";

export function App() {
  return (
    <div className="forge-app">
      <TopBar />
      <div className="forge-body">
        <IconRail />
        <SettingsPanel />
        <Canvas />
        <EduBar />
      </div>
    </div>
  );
}
