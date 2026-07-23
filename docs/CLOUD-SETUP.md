# Cloud setup — accounts & saved work (10 minutes)

The app now ships with a complete accounts + cloud-saves layer. It stays
dormant (local-only, exactly as before) until you connect a Supabase
project. One-time setup:

## 1 · Create the Supabase project (~3 min)

1. Go to https://supabase.com → sign in (GitHub login works) → **New project**.
2. Name it (e.g. `ui-generator`), pick the free plan and a region near you.
3. Wait for provisioning to finish.

## 2 · Create the database (~1 min)

1. In the project: **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](../supabase/schema.sql) and **Run**.
   It's idempotent — safe to re-run any time.

## 3 · Point auth at the app (~1 min)

1. **Authentication → URL Configuration**.
2. Set **Site URL** to `https://cripgod.github.io/webflow-assets/`.
3. Add the same URL under **Redirect URLs**.
   (Email/password sign-in is enabled by default; magic links and password
   resets use these URLs.)

## 4 · Get the two public values (~30 sec)

**Project Settings → API**:
- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — the long `eyJ…` string

The anon key is designed to be public — every table is protected by
row-level security, so the key alone grants nothing.

## 5 · Connect the deployed app — two ways

**Instant (this browser only):** open the live app → account icon (top
right) → **Connect a Supabase project…** → paste the URL and anon key →
Connect. Sign-up works immediately. Good for trying it out right now.

**Permanent (all visitors):** in the GitHub repo →
**Settings → Secrets and variables → Actions → New repository secret**:

| Secret name              | Value            |
| ------------------------ | ---------------- |
| `VITE_SUPABASE_URL`      | the Project URL  |
| `VITE_SUPABASE_ANON_KEY` | the anon key     |

Then re-run the **Deploy to GitHub Pages** workflow (Actions tab → run
workflow, or push any commit). The build bakes the connection in and every
visitor gets sign-in.

## 6 · Try it

1. Open the app → account icon → **Create account**.
2. Tick the 13+/terms box, sign up (confirm the email if prompted).
3. The header chip flips to **“Saved to your account”** — from now on your
   kits, boards, styles and settings sync automatically.
4. Open the app on another machine, sign in, and your work follows you.

## What syncs

Everything the app persists: the kit design, per-component forks, rows,
boards (including uploaded backgrounds), styles, presets, silhouettes, kit
name, layout preferences. Sign-out keeps a full local copy. “Download my
data” in the account menu exports the whole document as JSON.

## Troubleshooting

- **“Cloud error — saved locally”** in the account menu shows the raw
  message. Most common: schema.sql not run yet (missing `workspaces`
  table), or the Site URL not set (auth emails link to the wrong place).
- Email confirmations default **on**; to disable for testing:
  Authentication → Providers → Email → “Confirm email” off.
- Free-tier projects pause after ~1 week of inactivity; the dashboard
  restores them with one click.

## Hide the code: private repo + Vercel (~10 min, zero downtime)

Appendix A's end-state is a **private** repository served by **Vercel**
(which also hosts the server functions the Stripe/protected-export phases
need). GitHub Pages cannot serve a private repo on a free plan, so do
these in this order — Vercel goes live *before* the repo goes private:

1. **Import into Vercel:** vercel.com → sign in with GitHub → Add New →
   Project → import `CripGod/webflow-assets`. The repo ships a
   `vercel.json`, so build settings are automatic.
2. **Set the production branch:** Project → Settings → Git → Production
   Branch → `claude/game-ui-generator-khedvc` (the branch that's live
   today). Every push there now deploys automatically.
3. **Environment variables:** Project → Settings → Environment Variables →
   add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same two values
   as the GitHub secrets). Redeploy.
4. **Point Supabase at the new home:** Authentication → URL Configuration
   → set Site URL (and a redirect URL) to your `https://….vercel.app`
   domain. Add a custom domain in Vercel later if you want one.
5. **Flip the repo private:** GitHub → Settings → General → Danger Zone →
   Change visibility → Private. GitHub Pages stops serving; Vercel keeps
   deploying (its GitHub app retains access to private repos).
6. Optional cleanup: disable GitHub Pages in repo settings and delete the
   two `VITE_SUPABASE_*` GitHub secrets — Vercel owns the build now.

What this actually protects: the source, comments, git history, and the
commercial planning docs in `docs/` — all currently world-readable —
become private. What it cannot protect (Appendix A's own honesty rule):
the minified bundle the browser runs remains inspectable; true protection
for premium assets arrives when exports move into Vercel server functions
in the Stripe phase. Production source maps are already disabled in
`vite.config.ts`.

## What this deliberately does not do yet

Per the business plan's phasing: no Stripe/billing, no entitlement
enforcement (everything stays free), no public gallery, no
server-protected exports. The schema already reserves those boundaries —
see `docs/commercial-architecture.md`.
