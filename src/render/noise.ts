// Deterministic monochrome fractal-noise texture (§11).
// Same seed + parameters are used for preview and export so the surface grain
// is identical everywhere. Rendered as a data URI, blended soft-light.
export function noiseDataUri(seed = 7, baseFrequency = 0.85, octaves = 2): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${baseFrequency}" numOctaves="${octaves}" seed="${seed}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
<rect width="180" height="180" filter="url(#n)"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
