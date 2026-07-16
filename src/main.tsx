import React from "react";
import { createRoot } from "react-dom/client";
// Self-hosted Inter Variable via Fontsource (design lock §Typography — no system
// substitution). The variable file covers weights 400/500/600/700 in one asset.
import "@fontsource-variable/inter";
import "./styles/tokens.css";
import "./styles/global.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
