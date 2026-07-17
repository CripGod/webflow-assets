import { fontByName } from "./model";

// Loads a Google Font stylesheet on demand (once per family). The app runs on
// the open web (GitHub Pages / localhost), so fonts.googleapis.com is available.
export function ensureFont(name: string) {
  const def = fontByName(name);
  if (!def.css) return; // Inter ships bundled
  const id = "gf-" + def.css.replace(/[^a-z0-9]/gi, "");
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${def.css}&display=swap`;
  document.head.appendChild(link);
}
