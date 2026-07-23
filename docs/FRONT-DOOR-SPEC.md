# Front Door — workstream spec

The product's **front door**: the experience around and before the editor —
routing, a marketing homepage, and a redesigned login/auth surface. This is a
self-contained brief for a dedicated Claude Code session.

**Workflow:** branch off `main` (the deployed truth) → Vercel auto-builds a
preview URL for the branch → open a PR → merge to `main`. Production deploys
from `main` (Vercel) with Supabase env vars baked in at build.

## Mission

Own the front door — everything around and before the editor:

1. A **routing shell** (the app currently boots straight into the editor).
2. A **marketing homepage / landing page**.
3. A **redesigned login/auth experience** — today a cramped top-bar popover;
   make it elegant.

**Out of scope** (the "App" workstream owns these): the generator/editor
internals, kit components, exports. Touch auth code only for its *UI/flow*,
never its sync or security logic.

## Current state — code to know

- **`src/main.tsx`** mounts `<App/>`; also renders `<SilhouetteLab/>` when the
  URL has `?lab=silhouettes`. Calls `startCloud()` on boot.
- **`src/App.tsx`** renders the editor directly (`<TopBar/>` + body with
  `Rail`/`Panel`/`CanvasView`). No router. `useSharedKit()` here reads two hash
  forms and opens the kit read-only (viewer mode):
  - `#share=<deflate+base64 blob>` — a self-contained shared kit.
  - `#p=<share_slug>` — a published cloud project, resolved via
    `loadPublicProject`.
  - **These deep links must keep working** — route them into the app in viewer
    mode.
- **`src/ui/AccountMenu.tsx`** — the current auth popover (sign in / create
  account / magic link / reset / owner "connect Supabase" form / sync status /
  download data / sign out). **`src/generator/cloud.ts`** — all auth + sync
  logic and the status pub/sub (`onCloudStatus`).
- **Auth logic to reuse as-is (do not rewrite):** `signIn`, `signUp`,
  `signInMagic` (sign-in only), `requestPasswordReset`, `setNewPassword`
  (recovery flow), consent recording (13+ / Terms), `cloudConfig()` (Supabase
  optional — app is fully local-only when unconfigured), `setCloudOverride`
  (owner runtime connect).
- **Design system:** `src/styles/tokens.css`, `global.css`, `gen.css`. CSS vars
  (`--ink`, `--ink2/3`, `--soft`, `--line`, `--accent`, `--panel`); light/dark
  via `document.documentElement.dataset.theme`. Type is Inter Variable. Brand is
  **PatternBreak**, logo at `public/pb-logo.png` / `pb-logo.png`. Legal drafts
  at `public/legal/terms.html` + `privacy.html`.
- **Store:** the editor's own `phase` (`master`/`kit`/`board`) is *intra-app*
  view state — **not** top-level routing. Leave it alone.
- **Vite:** `base: "./"` (relative), static SPA on Vercel. Supabase via
  `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (publishable key).

## Decisions already made

- **Routing = minimal, hash-based, hand-rolled** — no new heavy deps (the
  project is deliberately lean; this matches the existing `#share`/`#p`
  pattern and works on any static host with a relative `base`). Routes: `#/`
  (landing), `#/app` (editor), auth as an overlay (below). Preserve
  `#share=`/`#p=` → land in `#/app` viewer mode. (SEO-friendly path routing +
  prerender is a later upgrade, not v1.)
- **Lazy-load the editor:** `React.lazy` the current App/editor so the landing
  route paints fast and doesn't pull the large editor chunk up front.
- **Auth = an elegant overlay/modal** reachable from the homepage CTA and the
  top-bar account button, optionally deep-linkable at `#/signin`. It is a
  **reskin + flow redesign over the existing `cloud.ts` calls** — every current
  capability survives (email/password, magic link, reset, recovery, 13+/Terms
  consent, owner Supabase-connect, honest sync status, local-only messaging).
- **The editor is free & local-first** — "Open the generator" needs no account;
  accounts add cloud saves + projects. The homepage should say so.

## Homepage content (starting structure)

- **Hero:** headline + subcopy + primary CTA **"Open the generator"** (→ `#/app`)
  + secondary **"Sign in"**. Consider rendering a *real* component from the
  engine as the hero visual (authentic, on-brand).
- **Feature strip (3–4):** master-component editor · one model → canvas / HTML /
  SVG / PNG exports · cloud saves + named projects · shareable `#p=` links.
- **How it works** (optional 3-step).
- **Footer:** Terms / Privacy (`public/legal/`), GitHub, contact.
- Theme-aware (light + dark), responsive, keyboard-accessible, uses the existing
  tokens and voice.

## Guardrails (don't break)

- Local-only mode works end-to-end with no Supabase.
- `#share=` / `#p=` deep links still open the viewer.
- No changes to `cloud.ts` sync / RLS / consent logic — auth **UI** only.
- Keep the bundle lean; reuse the design system; light/dark parity.

## Build order

1. **Routing shell** — hash router; mount Landing / App / Lab; preserve
   share/`#p` deep links; lazy-load the editor.
2. **Homepage** — hero + features + footer, CTAs wired, theme-aware.
3. **Auth redesign** — overlay/modal (+ optional `#/signin`), port every
   `cloud.ts` flow, consent, recovery, local-only states.
4. **Polish** → preview deploy → PR to `main`.

## Decide in-session

Brand tone / copy · modal vs. full-page auth · live-rendered hero vs. static ·
whether SEO / path routing is needed now.
