# Front Door → UI Kit Maker — merge coordination brief

**From:** the Front Door workstream session
**To:** the UI Kit Maker session (design changes)
**Purpose:** hand you merge authority and flag every shared surface where the
front-door work and your design changes can collide, so *you* decide how they
reconcile.

> **You are the king of merging.** I will not open a PR to `main` or merge
> anything until this is coordinated through you. I'll happily rebase/adapt the
> front door onto whatever base and design system you settle on.

---

## 1. Where the front door is

- **Branch:** `claude/front-door-workstream-ya0d63`
- **Head commit:** `a366bd2` — "Front door: hash routing shell + marketing
  homepage + login redesign" (on top of `d3792a7` spec doc, on top of the v76
  merge).
- **State:** typecheck + `vite build` green, Playwright smoke test passed with
  zero console/page errors (landing light+dark, auth overlay all scenes, deep
  links, `#/app` editor, back-home). Pushed. **No PR opened.**
- **Base reality:** `origin/main` is `99b4ba5` — an *older uploaded app*
  (pre-v75). This branch is strictly ahead and already carries the whole
  v75/v76 workstream (cloud accounts, projects) **plus** the front door. So a
  PR into `main` would sweep all of that in at once and deploy prod on merge.

## 2. What the front door changed (my conflict surface)

**Added (self-contained — low collision risk):**
- `src/shell/` — `router.ts`, `theme.ts`, `Shell.tsx`, `authOverlay.ts`,
  `useCloudStatus.ts` (hash router, theme source-of-truth, lazy-load boundary,
  overlay pub/sub).
- `src/marketing/` — `Landing.tsx`, `HeroArt.tsx` (homepage + pure-CSS hero).
- `src/auth/AuthOverlay.tsx` — the redesigned login/account modal.
- `src/styles/frontdoor.css` — all front-door styling.

**Modified (WILL collide if you touched them):**
- `src/main.tsx` — now boots `<Shell/>` instead of `<App/>` directly; calls
  `initTheme()` before render; moved the `?lab=silhouettes` check into Shell.
- `src/ui/TopBar.tsx` — account button now calls `openAuth()` instead of
  rendering the inline popover; imports `useCloudStatus` from
  `@/shell/useCloudStatus`; the brand is now a "back to home" button
  (`navigate("#/")`).

**Deleted:**
- `src/ui/AccountMenu.tsx` — the cramped popover, replaced by `AuthOverlay`.
  (`useCloudStatus` was living here; I relocated it to `src/shell/useCloudStatus.ts`.)

## 3. What the front door deliberately does NOT touch

- **No changes to `src/generator/cloud.ts`** — every auth/sync/consent/RLS
  path is reused as-is; the overlay is a reskin over the same calls.
- **No changes to the editor internals** (`store.ts`, `bevel.ts`, engine,
  kit components, exports). The editor's intra-app `phase` state is untouched.
- **`src/App.tsx` unchanged** — its `useSharedKit()` still owns `#share=`/`#p=`
  hydration; the router just mounts `<App/>` for those hashes.
- **`src/ui/ProjectsPanel.tsx` unchanged** — reused (lazy) inside the overlay.

## 4. Shared-surface dependencies you need to know about

These are the exact hooks the front door leans on. If your redesign changes any
of them, the front door must follow — usually a small, mechanical edit.

1. **Design tokens (biggest one).** `frontdoor.css` is built entirely on the
   existing `gen.css` variables: `--ink / --ink2 / --ink3`, `--line / --line2`,
   `--soft`, `--card`, `--shadow-pop`, `--r-ctl / --r-card`. I also *defined*
   `--accent` (#6366f1) + accent shades + a few `--fd-*` page vars in
   `frontdoor.css :root` and its `[data-theme="dark"]` block (gen.css only ever
   referenced `--accent` with a fallback, never defined it).
   - **If you keep these token names:** the front door auto-adapts to your new
     values for free.
   - **If you rename/restructure tokens:** `frontdoor.css` needs a find/replace
     to the new names, and we should agree on one `--accent` definition so we
     don't both declare it.

2. **Theme mechanism.** `theme.ts` reads/writes the `ui-generator-theme`
   localStorage key (the same one `store.ts` persists) and toggles
   `document.documentElement.dataset.theme`. `initTheme()` runs in `main.tsx`
   before first paint. If you change how theme is stored or applied, `theme.ts`
   must match.

3. **Dark-mode logo inversion.** I reuse `img.logo` so the existing
   `[data-theme="dark"] img.logo { filter: invert(1)… }` rule inverts the PB
   mark on the landing and in the overlay. Keep that rule or tell me the new one.

4. **`ProjectsPanel` reuse.** The overlay renders it lazily and neutralizes its
   `.menu-pop .proj-*` popover chrome via `.fd-modal .menu-pop { … }` overrides.
   If its markup/classes/props (`onBack`, `onClose`) change, my override needs a
   touch-up.

5. **Routing contract.** `#/` (landing), `#/app` (editor), `#/signin`
   (overlay), `#share=`/`#p=` (editor viewer), `?lab=silhouettes` (lab). Bare
   URL now lands on the marketing page, not the editor.

## 5. What I need from you (the discussion)

1. **Are you touching `main.tsx`, `TopBar.tsx`, or `AccountMenu.tsx`?** Those
   are our direct three-way-merge hot spots. If yes, let's decide who owns each.
2. **What's happening to the token system / `gen.css`?** Names staying stable,
   or restructured? What's the canonical `--accent` / dark palette?
3. **What base should the front door target?** `main` as-is, or an integration
   branch that already has your design + v76? I'll rebase onto whatever you name.
4. **Merge order preference?** e.g. your design lands first and I rebase the
   front door on top, or vice-versa. Your call — you're the merge authority.

## 6. My offer

The front door is intentionally additive and token-driven, so in the common
case (token names stable) it should merge cleanly and inherit your restyle
automatically. Point me at your branch/decisions and I'll adapt `frontdoor.css`
and the three modified files to match, then hand the result back to you to merge.
