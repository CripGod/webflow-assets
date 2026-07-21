import { Layers, Type, Image, Lightbulb, Box, Download, Settings, HelpCircle } from "lucide-react";
import { useForge } from "@/state/store";

const ITEMS = [
  { id: "material", label: "Surface / Material", Icon: Layers },
  { id: "content", label: "Content", Icon: Type },
  { id: "background", label: "Background", Icon: Image },
  { id: "lighting", label: "Lighting", Icon: Lightbulb },
  { id: "output", label: "Output", Icon: Box },
  { id: "export", label: "Export", Icon: Download },
];

export function IconRail() {
  const { activeRailTab, setRailTab } = useForge();
  return (
    <nav className="forge-rail" aria-label="Sections">
      {ITEMS.map(({ id, label, Icon }) => (
        <button key={id} className={`rail-item${activeRailTab === id ? " is-active" : ""}`}
          title={label} aria-label={label} aria-current={activeRailTab === id}
          onClick={() => setRailTab(id)}>
          <Icon size={20} strokeWidth={1.5} />
        </button>
      ))}
      <span className="rail-spacer" />
      <button className="rail-item" title="Settings" aria-label="Settings"><Settings size={20} strokeWidth={1.5} /></button>
      <button className="rail-item" title="Help" aria-label="Help"><HelpCircle size={20} strokeWidth={1.5} /></button>
    </nav>
  );
}
