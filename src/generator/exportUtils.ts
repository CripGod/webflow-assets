import type { GenConfig, GenStateName } from "./model";
import { fontByName, STATE_NAMES } from "./model";
import { renderBevel } from "./bevel";

// Export utilities — every artifact derives from the same renderer string.

export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function downloadSvg(svg: string, name: string) {
  download(name, new Blob([svg], { type: "image/svg+xml" }));
}

/** Rasterize an SVG string to a transparent PNG at the given scale. */
export function downloadPng(svg: string, name: string, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = img.width * scale; cv.height = img.height * scale;
      const ctx = cv.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => { if (b) { download(name, b); resolve(); } else reject(new Error("raster failed")); }, "image/png");
    };
    img.onerror = () => reject(new Error("svg load failed"));
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  });
}

/** Self-contained HTML page: the button in every visible state, rendered by
 *  the exact same engine as the canvas. Opens locally with a double-click. */
export function buildHtml(cfg: GenConfig): string {
  const font = fontByName(cfg.type.font);
  const fontLink = font.css
    ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font.css}&display=swap">`
    : "";
  const states = STATE_NAMES.filter(
    (s) => s === "default" || cfg.visible[s as Exclude<GenStateName, "default">]
  );
  const cap: Record<GenStateName, string> = { default: "Default", hover: "Hover", pressed: "Pressed", disabled: "Disabled" };
  const dark = cfg.canvas === "#1C1D22" || cfg.canvas === "#000000";
  const ink = dark ? "rgba(235,238,255,0.6)" : "rgba(28,32,44,0.55)";
  const cards = states.map((s) =>
    `<figure><div class="art">${renderBevel(cfg, s)}</div><figcaption>${cap[s]}</figcaption></figure>`
  ).join("\n");
  const label = (cfg.content.label || "component").replace(/[<>&"]/g, "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${label} — The UI Generator</title>
${fontLink}
<style>
  * { margin: 0; box-sizing: border-box; }
  body { min-height: 100vh; background: ${cfg.canvas}; font-family: system-ui, sans-serif;
         display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 34px; padding: 48px 24px; }
  .row { display: flex; flex-wrap: wrap; gap: 30px; align-items: flex-end; justify-content: center; }
  figure { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  figcaption { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: ${ink}; }
  .art svg { display: block; }
  footer { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${ink}; opacity: 0.7; }
</style>
</head>
<body>
<div class="row">
${cards}
</div>
<footer>Made with The UI Generator · PatternBreak</footer>
</body>
</html>`;
}

export function downloadHtml(cfg: GenConfig, name: string) {
  download(name, new Blob([buildHtml(cfg)], { type: "text/html" }));
}
