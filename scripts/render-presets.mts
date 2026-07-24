/* Render REAL engine presets to static SVG files for the marketing site.
   Pure renderBevel(config, state) → SVG string — no browser, no approximation.
   Run: npx -y tsx scripts/render-presets.mts */

// fonts.ts injects a <link> via document at call time — shim it for Node.
(globalThis as any).document ??= {
  getElementById: () => null,
  createElement: () => ({ rel: "", href: "", id: "" }),
  head: { appendChild() {} },
};
(globalThis as any).window ??= globalThis;

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { renderBevel } from "../src/generator/bevel";
import { defaultConfig, applyPresetCandy, presetById, PRESETS, type GenStateName } from "../src/generator/model";

const OUT = "src/marketing/presetArt";
mkdirSync(OUT, { recursive: true });

const STATES: GenStateName[] = ["default", "hover", "pressed", "disabled"];

// deep-merge an authored JSON design over the default config (candy etc.)
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
function deepMerge(base: any, over: any) {
  for (const k of Object.keys(over)) {
    if (isObj(base[k]) && isObj(over[k])) deepMerge(base[k], over[k]);
    else base[k] = over[k];
  }
}

function renderSet(id: string, cfg: any, label: string, states: GenStateName[]) {
  cfg.content = { ...cfg.content, label };
  for (const st of states) {
    try {
      const svg = renderBevel(cfg, st);
      writeFileSync(`${OUT}/${id}--${st}.svg`, svg);
      console.log(`ok  ${id}--${st}  ${(svg.length / 1024).toFixed(1)}kB`);
    } catch (e) {
      console.log(`ERR ${id}--${st}: ${(e as Error).message.slice(0, 120)}`);
    }
  }
}

// 1 · fully authored designs (the looks from the screenshots)
for (const [id, label] of [["grape-jelly", "JELLY"], ["neon-versus", "JELLY"], ["bubble-pop", "PLAY"]] as const) {
  try {
    const json = JSON.parse(readFileSync(`src/generator/preset-${id}.json`, "utf8"));
    const cfg = defaultConfig();
    deepMerge(cfg, json);
    renderSet(id, cfg, label, STATES);
  } catch (e) {
    console.log(`ERR authored ${id}: ${(e as Error).message.slice(0, 120)}`);
  }
}

// 2 · every picker preset at default state (thumbs) — the app's exact
// setPreset recipe: shape + bevel + effects + fresh candy + text retint.
import { defaultCandy, darken } from "../src/generator/model";
function retintText(c: any) {
  const bevel = c.effects.Bevel ?? "#0E9CC9";
  const glow = c.effects.Glow ?? darken(bevel, -0.4);
  c.type.outline.color = darken(bevel, 0.5);
  if (c.type.outline.color2) c.type.outline.color2 = darken(bevel, 0.7);
  c.type.shadow.color = darken(bevel, 0.62);
  c.type.glow.color = glow;
}
console.log("presets:", PRESETS.map((p: any) => p.id).join(", "));
for (const p of PRESETS as any[]) {
  try {
    const cfg = defaultConfig();
    const pr = presetById(p.id);
    cfg.presetId = p.id; cfg.shape = pr.shape; cfg.bevel = { ...pr.bevel }; cfg.effects = { ...pr.effects };
    const candy = defaultCandy(); applyPresetCandy(candy, pr); cfg.candy = candy;
    retintText(cfg);
    renderSet(p.id + "--thumb", cfg, "PLAY", ["default"]);
  } catch (e) {
    console.log(`ERR thumb ${p.id}: ${(e as Error).message.slice(0, 120)}`);
  }
}
