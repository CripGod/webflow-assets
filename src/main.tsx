import React from "react";
import { createRoot } from "react-dom/client";
// Self-hosted Inter Variable via Fontsource — weights 400–700 in one variable file.
import "@fontsource-variable/inter";
import "./styles/gen.css";
import { App } from "./App";
import { SilhouetteLab } from "./ui/SilhouetteLab";

// Dev-only feasibility harness — completely isolated from the generator UI.
// `?lab=silhouettes` mounts the lab instead of the app; nothing else changes.
const lab = new URLSearchParams(window.location.search).get("lab");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {lab === "silhouettes" ? <SilhouetteLab /> : <App />}
  </React.StrictMode>
);
