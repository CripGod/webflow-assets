# Commercial architecture — living document

Required by Appendix A of the commercial business plan (July 21, 2026).
This documents what exists **today**, what is deliberately deferred, and
where every boundary for the later phases already lives. It is updated
whenever a commercial phase ships.

## Status: Phase 1 (accounts + cloud saves) — shipped

```
Browser (GitHub Pages, static Vite build)
│  editor, rendering, exports        ← all still client-side & free
│  src/generator/cloud.ts            ← single client-side account boundary
│      │ dynamic import of @supabase/supabase-js (code-split)
│      ▼
Supabase (managed auth + Postgres, RLS everywhere)
   auth.users                        ← identity; passwords never touch our code
   public.profiles                   ← 1:1 with users; plan_id pointer ('free')
   public.plans                      ← capability catalog as data (not code)
   public.workspaces                 ← the cloud save: whole ui-generator-* keyspace
   public.projects                   ← named saves; private by default; share_slug reserved
   public.terms_acceptances          ← consent records (version, locale, 13+)
   public.organizations (+members)   ← reserved, deny-all RLS (studio phase)
```

## Authentication flow

- Supabase Auth (email/password, magic link, password reset). No custom
  auth, no password storage, no service-role key anywhere in the client.
- Config resolution: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` baked
  at build time (GitHub Actions secrets), with a per-browser localStorage
  override (`forge-cloud-url`/`forge-cloud-anon`) so the owner can test a
  project against the live static deploy. Unconfigured → the entire layer
  is inert and the app is the local-only build.
- Sign-up records a consent row (version `TERMS_VERSION` in cloud.ts,
  locale, 13+ affirmation) — deferred to the first authenticated session
  when email confirmation is on.

## Cloud-save model

- The document is the app's entire `ui-generator-*` localStorage keyspace,
  as one JSONB (`workspaces.doc`). Whole-doc last-write-wins.
- Change detection: 3 s signature poll (FNV-1a over sorted keys+values) →
  debounced push (1.2 s) → flush on tab-hidden and on Sync now.
- Sign-in reconciliation: no server copy → push local; local edited more
  recently than the server row → push local; otherwise the server copy
  wins — the local copy is snapshotted to `forge-cloud-prevlocal` first,
  then the page reloads from the pulled state.
- The DB keeps one previous revision (`workspaces.previous`, maintained by
  trigger only when the doc actually changes) as a server-side undo.

## Security posture (what is and is not protected)

- The anon key is public by design; **all** access control is row-level
  security. Every table has RLS enabled; workspaces/projects/consents are
  owner-only (projects additionally world-readable only when `is_public`).
- `profiles.plan_id` cannot be self-upgraded: the update policy's WITH
  CHECK pins it to 'free' until server-side entitlement resolution exists.
- Honest limitation (per Appendix A): everything the browser renders —
  kit definitions, the renderer, exporters — remains inspectable today.
  Nothing commercially gated ships yet, so nothing needs server authority
  yet. The first paid feature must land server-side (Vercel functions),
  never as a client flag.

## Deliberately deferred (with their reserved boundaries)

| Phase (plan §12)            | Reserved today                                             |
| --------------------------- | ---------------------------------------------------------- |
| Stripe test mode, billing   | `plans` table; `profiles.plan_id`; annual-only decision     |
| Entitlement service         | capabilities-as-data in `plans.capabilities` (jsonb)        |
| Protected exports           | none client-side to remove later — exporters stay free now  |
| Opt-in showcase             | `projects.is_public` (default false) + `share_slug`         |
| Studio / classroom seats    | `organizations`, `organization_members` (deny-all RLS)      |
| Data rights                 | Download-my-data in the account menu; deletion via Supabase |

## Known limitations / open items

- Sync is whole-document LWW: two devices editing simultaneously trade the
  document; the server keeps one previous revision. Fine for a single
  designer; revisit before teams.
- Share links still encode the kit in the URL (pre-cloud mechanism);
  moving shares to `projects.share_slug` is a natural Phase-5 upgrade.
- The repo is public and the frontend is on GitHub Pages. Appendix A's
  end-state wants a private repo + Vercel (for server functions and bundle
  privacy). That migration belongs to the Stripe/protected-export phase —
  decision owner: product owner.
- Terms/Privacy documents are drafts; counsel review is a launch gate
  (plan §10). The consent record stores the accepted version string.

## Rollback

Phase 1 is additive. Removing the two GitHub secrets (or never setting
them) returns every visitor to the exact pre-cloud, local-only behavior.
The Supabase project can be paused or deleted independently; local copies
of work always survive sign-out.
