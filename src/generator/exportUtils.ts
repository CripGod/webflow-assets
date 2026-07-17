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

  // live, playable button — CSS swaps the pre-rendered state art
  const hasHover = cfg.visible.hover, hasPressed = cfg.visible.pressed;
  const live = `<div class="live" role="button" tabindex="0" aria-label="${label}">
  <span class="s s-default">${renderBevel(cfg, "default")}</span>
  ${hasHover ? `<span class="s s-hover">${renderBevel(cfg, "hover")}</span>` : ""}
  ${hasPressed ? `<span class="s s-pressed">${renderBevel(cfg, "pressed")}</span>` : ""}
</div>`;
  const liveCss = `
  .live { cursor: pointer; -webkit-tap-highlight-color: transparent; }
  .live .s { display: none; }
  .live .s-default { display: block; }
  ${hasHover ? `.live:hover .s-default { display: none; } .live:hover .s-hover { display: block; }` : ""}
  ${hasPressed ? `.live:active .s-default, .live:active .s-hover { display: none; } .live:active .s-pressed { display: block; }` : ""}`;
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
  .art svg, .live svg { display: block; }
  .try { font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: ${ink}; }
  footer { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: ${ink}; opacity: 0.7; }
${liveCss}
</style>
</head>
<body>
${live}
<div class="try">↑ try me — hover &amp; press</div>
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

/** Full settings as a portable JSON file — re-importable, and shareable as a
 *  new default. */
export function downloadSettings(cfg: GenConfig) {
  download("ui-generator-settings.json", new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" }));
}

/** Game-engine kit: one sprite sheet PNG @2x (states stacked vertically) plus
 *  a JSON manifest with per-state rects and suggested 9-slice insets — the
 *  shape Unity's Sprite Editor and Unreal's UMG box-draw both ingest. */
export async function downloadGameKit(cfg: GenConfig): Promise<void> {
  const scale = 2;
  const states = STATE_NAMES.filter(
    (s) => s === "default" || cfg.visible[s as Exclude<GenStateName, "default">]
  );
  const loaded = await Promise.all(states.map((s) => new Promise<{ s: GenStateName; img: HTMLImageElement }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ s, img });
    img.onerror = () => reject(new Error("svg load failed"));
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(renderBevel(cfg, s))));
  })));
  const w = Math.max(...loaded.map((l) => l.img.width)) * scale;
  const heights = loaded.map((l) => l.img.height * scale);
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = heights.reduce((a, b) => a + b, 0);
  const ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const rects: { name: GenStateName; x: number; y: number; width: number; height: number }[] = [];
  let yy = 0;
  loaded.forEach((l, i) => {
    const sw = l.img.width * scale, sh = heights[i];
    ctx.drawImage(l.img, Math.round((w - sw) / 2), yy, sw, sh);
    rects.push({ name: l.s, x: Math.round((w - sw) / 2), y: yy, width: sw, height: sh });
    yy += sh;
  });
  // conservative 9-slice caps: wall + rim + corner sweep, at sheet scale
  const cap = Math.round((cfg.bevel.width + cfg.candy.rim.width + 34) * scale);
  const manifest = {
    generator: "The UI Generator (PatternBreak)",
    sheet: `ui-${cfg.presetId}-sheet@${scale}x.png`,
    scale,
    label: cfg.content.label,
    states: rects,
    nineSlice: { left: cap, right: cap, top: cap, bottom: cap,
      note: "Suggested border insets in sheet pixels. Unity: Sprite Editor > Border. Unreal: Brush > Margin (divide by width/height for 0–1 values)." },
    engines: {
      unity: "Import sheet as Sprite (2D and UI), Sprite Mode: Multiple, slice with the state rects, set Border for 9-slice, use on UI Image (Sliced).",
      unreal: "Import sheet as Texture2D, make one Material or use DrawAs: Box in a Widget Brush per state rect, set Margin from nineSlice.",
    },
  };
  await new Promise<void>((resolve, reject) => {
    cv.toBlob((b) => { if (b) { download(manifest.sheet, b); resolve(); } else reject(new Error("raster failed")); }, "image/png");
  });
  download(`ui-${cfg.presetId}-kit.json`, new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }));
}
