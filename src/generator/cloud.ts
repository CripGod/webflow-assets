/* Cloud accounts + cloud saves — Phase 1 of the commercial architecture
   (docs/commercial-architecture.md). Supabase provides managed auth and
   Postgres; this module is the app's single client-side account boundary.

   Design rules, from the business plan and Appendix A:
   - No custom auth, no passwords stored here — Supabase Auth only.
   - The browser is never the authority for entitlements; today nothing is
     gated, so this layer only handles identity and saved work.
   - Zero footprint when unconfigured: every entry point no-ops and the app
     behaves exactly as the local-only build.
   - Everything the app persists lives under localStorage "ui-generator-*";
     the cloud document is that keyspace, whole-doc, last-write-wins. The
     server keeps one previous revision (workspaces.previous) as an undo.
   - supabase-js loads via dynamic import so the main bundle stays lean. */

import type { Session, SupabaseClient } from "@supabase/supabase-js";

export const TERMS_VERSION = "draft-2026-07-23";

const SYNC_PREFIX = "ui-generator";
const K_URL = "forge-cloud-url";        // owner override: Supabase project URL
const K_ANON = "forge-cloud-anon";      // owner override: anon (public) key
const K_LASTEDIT = "forge-cloud-lastedit";
const K_PREVLOCAL = "forge-cloud-prevlocal"; // local snapshot kept when the server copy wins
const K_CONSENT_PENDING = "forge-cloud-consent";

/* ── configuration ─────────────────────────────────────────────────── */

export type CloudConfig = { url: string; anonKey: string; fromOverride: boolean };

export function cloudConfig(): CloudConfig | null {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  let url = env.VITE_SUPABASE_URL ?? "";
  let anonKey = env.VITE_SUPABASE_ANON_KEY ?? "";
  let fromOverride = false;
  if (!url || !anonKey) {
    try {
      const u = localStorage.getItem(K_URL) ?? "";
      const a = localStorage.getItem(K_ANON) ?? "";
      if (u && a) { url = u; anonKey = a; fromOverride = true; }
    } catch { /* storage unavailable */ }
  }
  return url && anonKey ? { url, anonKey, fromOverride } : null;
}

/** Owner convenience: connect a Supabase project at runtime (per browser),
    so the live static deploy can be tested before build-time env vars exist.
    The anon key is public by design — safety comes from RLS, not secrecy. */
export function setCloudOverride(url: string, anonKey: string) {
  try {
    localStorage.setItem(K_URL, url.trim().replace(/\/+$/, ""));
    localStorage.setItem(K_ANON, anonKey.trim());
  } catch { /* ignore */ }
}
export function clearCloudOverride() {
  try { localStorage.removeItem(K_URL); localStorage.removeItem(K_ANON); } catch { /* ignore */ }
}

/* ── client ────────────────────────────────────────────────────────── */

let clientP: Promise<SupabaseClient | null> | null = null;

export function getClient(): Promise<SupabaseClient | null> {
  if (!clientP) {
    const cfg = cloudConfig();
    clientP = !cfg
      ? Promise.resolve(null)
      : import("@supabase/supabase-js").then(({ createClient }) =>
          createClient(cfg.url, cfg.anonKey, { auth: { persistSession: true, autoRefreshToken: true } }));
  }
  return clientP;
}

/* ── the cloud document: the whole ui-generator-* keyspace ─────────── */

export function collectDoc(): Record<string, string> {
  const doc: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SYNC_PREFIX)) doc[k] = localStorage.getItem(k) ?? "";
    }
  } catch { /* storage unavailable */ }
  return doc;
}

/** Replace-all semantics: the doc IS the keyspace, so keys absent from it
    are removed (a factory reset on one device must reset the others). */
export function applyDoc(doc: Record<string, string>) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(SYNC_PREFIX) && !(k in doc))
      .forEach((k) => localStorage.removeItem(k));
    for (const [k, v] of Object.entries(doc)) {
      if (k.startsWith(SYNC_PREFIX)) localStorage.setItem(k, v);
    }
  } catch { /* quota — cloud copy stays authoritative next pull */ }
}

/** FNV-1a over sorted keys+values — full-content signature, order-proof. */
export function docSignature(doc: Record<string, string>): string {
  let h = 0x811c9dc5;
  const mix = (s: string) => {
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= 0xff; h = Math.imul(h, 0x01000193);
  };
  const keys = Object.keys(doc).sort();
  for (const k of keys) { mix(k); mix(doc[k]); }
  return (h >>> 0).toString(36) + ":" + keys.length;
}

/* ── status pub/sub (TopBar chip + account menu subscribe here) ────── */

export type CloudState = "off" | "signedout" | "syncing" | "synced" | "error" | "recovery";
export type CloudStatus = { state: CloudState; email?: string; syncedAt?: number; detail?: string };

let status: CloudStatus = { state: "off" };
const listeners = new Set<(s: CloudStatus) => void>();

function setStatus(next: CloudStatus) {
  status = next;
  listeners.forEach((fn) => fn(status));
}
export function cloudStatus() { return status; }
export function onCloudStatus(fn: (s: CloudStatus) => void): () => void {
  listeners.add(fn); fn(status);
  return () => listeners.delete(fn);
}

/* ── sync engine ───────────────────────────────────────────────────── */

let session: Session | null = null;
let pollT: ReturnType<typeof setInterval> | null = null;
let pushT: ReturnType<typeof setTimeout> | null = null;
let lastSig = "";
let pushedSig = "";
let started = false;

function stampEdit() {
  try { localStorage.setItem(K_LASTEDIT, String(Date.now())); } catch { /* ignore */ }
}

async function push() {
  const client = await getClient();
  if (!client || !session) return;
  const doc = collectDoc();
  const sig = docSignature(doc);
  if (sig === pushedSig) { setStatus({ state: "synced", email: session.user.email ?? undefined, syncedAt: Date.now() }); return; }
  setStatus({ state: "syncing", email: session.user.email ?? undefined });
  const { error } = await client.from("workspaces").upsert(
    { user_id: session.user.id, doc },
    { onConflict: "user_id" });
  if (error) {
    setStatus({ state: "error", email: session.user.email ?? undefined, detail: error.message });
  } else {
    pushedSig = sig;
    setStatus({ state: "synced", email: session.user.email ?? undefined, syncedAt: Date.now() });
  }
}

function schedulePush(ms = 1200) {
  if (pushT) clearTimeout(pushT);
  pushT = setTimeout(() => { pushT = null; void push(); }, ms);
}

/** Force a push right now (Sync now button, tab going hidden). */
export function syncNow() { if (pushT) { clearTimeout(pushT); pushT = null; } void push(); }

function startWatch() {
  if (pollT) clearInterval(pollT);
  lastSig = docSignature(collectDoc());
  pollT = setInterval(() => {
    if (!session) return;
    const sig = docSignature(collectDoc());
    if (sig !== lastSig) { lastSig = sig; stampEdit(); schedulePush(); }
  }, 3000);
}

function stopWatch() {
  if (pollT) { clearInterval(pollT); pollT = null; }
  if (pushT) { clearTimeout(pushT); pushT = null; }
}

async function recordPendingConsent(client: SupabaseClient) {
  let pending = "";
  try { pending = localStorage.getItem(K_CONSENT_PENDING) ?? ""; } catch { /* ignore */ }
  if (!pending || !session) return;
  const { error } = await client.from("terms_acceptances").insert({
    user_id: session.user.id, version: pending,
    locale: typeof navigator !== "undefined" ? navigator.language : null, age_13_plus: true,
  });
  if (!error) { try { localStorage.removeItem(K_CONSENT_PENDING); } catch { /* ignore */ } }
}

/** Sign-in reconciliation: whole-doc last-write-wins.
    - no server copy → this device's work becomes the account's work
    - server newer than the last local edit → server wins; the local copy is
      snapshotted to forge-cloud-prevlocal first, then the page reloads so
      every store boots from the pulled state
    - local newer → local wins and pushes (server keeps its own `previous`) */
async function beginSession(client: SupabaseClient, s: Session) {
  session = s;
  setStatus({ state: "syncing", email: s.user.email ?? undefined });
  await recordPendingConsent(client);
  const { data, error } = await client.from("workspaces")
    .select("doc, updated_at").eq("user_id", s.user.id).maybeSingle();
  if (error) {
    setStatus({ state: "error", email: s.user.email ?? undefined, detail: error.message });
    startWatch();
    return;
  }
  const localDoc = collectDoc();
  const localSig = docSignature(localDoc);
  if (!data) {
    startWatch();
    await push();
    return;
  }
  const serverDoc = (data.doc ?? {}) as Record<string, string>;
  const serverSig = docSignature(serverDoc);
  if (serverSig === localSig) {
    pushedSig = serverSig;
    setStatus({ state: "synced", email: s.user.email ?? undefined, syncedAt: Date.now() });
    startWatch();
    return;
  }
  let lastEdit = 0;
  try { lastEdit = Number(localStorage.getItem(K_LASTEDIT) ?? 0); } catch { /* ignore */ }
  const serverAt = Date.parse(data.updated_at as string) || 0;
  if (lastEdit > serverAt) {
    startWatch();
    await push();
  } else {
    try { localStorage.setItem(K_PREVLOCAL, JSON.stringify(localDoc)); } catch { /* too big — proceed */ }
    applyDoc(serverDoc);
    window.location.reload();
  }
}

function endSession() {
  session = null;
  stopWatch();
  pushedSig = "";
  setStatus(cloudConfig() ? { state: "signedout" } : { state: "off" });
}

/** Boot the cloud layer. Safe to call unconditionally: without config this
    resolves immediately and the app remains the local-only build. */
export async function startCloud() {
  if (started) return;
  started = true;
  const cfg = cloudConfig();
  if (!cfg) { setStatus({ state: "off" }); return; }
  const client = await getClient();
  if (!client) { setStatus({ state: "off" }); return; }
  setStatus({ state: "signedout" });
  client.auth.onAuthStateChange((event, s) => {
    if (event === "PASSWORD_RECOVERY" && s) {
      session = s;
      setStatus({ state: "recovery", email: s.user.email ?? undefined });
      return;
    }
    if (event === "SIGNED_OUT") { endSession(); return; }
    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && s && !session) {
      void beginSession(client, s);
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && session && pushT) syncNow();
  });
}

/* ── auth actions (thin wrappers; return an error string or null) ──── */

function appUrl() {
  return window.location.origin + window.location.pathname;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return "Cloud is not configured on this deployment.";
  try { localStorage.setItem(K_CONSENT_PENDING, TERMS_VERSION); } catch { /* ignore */ }
  const { error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: appUrl() } });
  return error ? error.message : null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return "Cloud is not configured on this deployment.";
  const { error } = await client.auth.signInWithPassword({ email, password });
  return error ? error.message : null;
}

export async function signInMagic(email: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return "Cloud is not configured on this deployment.";
  const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl() } });
  return error ? error.message : null;
}

export async function requestPasswordReset(email: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return "Cloud is not configured on this deployment.";
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  return error ? error.message : null;
}

export async function setNewPassword(password: string): Promise<string | null> {
  const client = await getClient();
  if (!client) return "Cloud is not configured on this deployment.";
  const { error } = await client.auth.updateUser({ password });
  if (!error && session) setStatus({ state: "synced", email: session.user.email ?? undefined, syncedAt: Date.now() });
  return error ? error.message : null;
}

export async function signOutCloud(): Promise<void> {
  const client = await getClient();
  if (pushT) syncNow();
  await client?.auth.signOut();
  endSession();
}

/** Data rights: hand the user their complete saved document as JSON. */
export function downloadMyData() {
  const blob = new Blob([JSON.stringify(collectDoc(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ui-generator-my-data.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
