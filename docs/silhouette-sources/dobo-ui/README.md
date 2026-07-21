# Vector UI Pack (dobo_ui) — imported silhouette sources

Source: "Vector UI Pack" by Duplo (itch.io — dobo_ui), uploaded by Chevon
Hicks. The zip ships PNG renders (no vector files) and no license text —
only a developer thank-you note (included). Verify redistribution terms on
the pack's itch.io page before shipping these silhouettes publicly.

Geometry was measured from the PNG outlines below and normalized into
`src/generator/shapePath` + `src/generator/silhouettes.ts`. Pack colors,
outlines, gloss and shadows are discarded — the material system replaces
them.

- `headerAsim_cyan.png`  → `doboMarquee` ("Marquee Plaque"): tapered plate
  over side drapes with rounded feet
- `headerBow_cyan.png`   → `doboRibbon` ("Bow Ribbon"): tapered plate with
  swallowtail side tails
- `labelAdvanced_cyan.png` → `doboBracket` ("Bracket Label"): bar with
  half-round side lobes and meeting notches

The pack's plain buttons (rounded rectangles) duplicate existing
silhouettes and were not imported; its cards/containers/progress bars are
component-level art rather than outline geometry.
