# Kenney UI Pack 2.0 — imported silhouette sources

Source: Kenney UI Pack 2.0 (www.kenney.nl), License: CC0 (see License.txt).
Uploaded by Chevon Hicks; geometry measured from the vector sources below and
normalized into `src/generator/shapePath` + registered in
`src/generator/silhouettes.ts`. Colors, gloss, shadows and bevels from the
pack are intentionally discarded — the UI Generator's material system
replaces them.

- `button_rectangle_flat.svg` (192×64, corner r=6 → r = 0.094 × height)
  → silhouette `kenneyRect` ("Kenney Rectangle")
- `slide_hangle.svg` (24×32 slider handle; 45° shoulders, point depth
  10/32 = 0.31 × height, corner r = 2/32 = 0.06 × height; rotated 90° to
  point along the reading direction)
  → silhouette `kenneyTag` ("Kenney Tag")

The pack's remaining button outlines (round, square, and all depth/color
variants) share the same rectangle/circle geometry, so they import as
material treatments rather than new silhouettes. Distinctive outlines live
in the Adventure / Sci-Fi / Fantasy-Borders packs.
