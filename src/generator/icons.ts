import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { icons } from "lucide-react";

// Full Lucide icon library, searchable by name, rendered to raw SVG markup so
// the same vector lands in the canvas render, the code view, and exports.

const NAMES = Object.keys(icons); // full set (PascalCase)

export function searchIcons(query: string, limit = 24): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return NAMES.slice(0, limit);
  const starts: string[] = [], contains: string[] = [];
  for (const n of NAMES) {
    const ln = n.toLowerCase();
    if (ln.startsWith(q)) starts.push(n);
    else if (ln.includes(q)) contains.push(n);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

export function iconExists(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(icons, name);
}

const innerCache = new Map<string, string>();

/** Inner markup of a Lucide icon (24×24 space), stroke inherited from wrapper. */
export function iconInner(name: string): string {
  if (innerCache.has(name)) return innerCache.get(name)!;
  const Cmp = icons[name as keyof typeof icons] ?? icons.ArrowRight;
  const svg = renderToStaticMarkup(createElement(Cmp as React.ComponentType<Record<string, unknown>>, { size: 24 }));
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  innerCache.set(name, inner);
  return inner;
}

/** Positioned, colored icon group for embedding in a component SVG string. */
export function iconGroup(name: string, x: number, y: number, size: number, color: string, strokeWidth = 2.4, extra = ""): string {
  const s = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${extra}>${iconInner(name)}</g>`;
}
