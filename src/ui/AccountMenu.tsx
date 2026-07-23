import { useEffect, useState } from "react";
import { LogIn, LogOut, UserPlus, Mail, KeyRound, RefreshCw, FileDown, Cable, History } from "lucide-react";
import {
  cloudConfig, setCloudOverride, clearCloudOverride, onCloudStatus, cloudStatus,
  signIn, signUp, signInMagic, requestPasswordReset, setNewPassword, signOutCloud,
  syncNow, downloadMyData, hasLocalSnapshot, restoreLocalSnapshot, type CloudStatus,
} from "@/generator/cloud";

export function useCloudStatus(): CloudStatus {
  const [s, setS] = useState<CloudStatus>(() => cloudStatus());
  useEffect(() => onCloudStatus(setS), []);
  return s;
}

/* The account popover. Three worlds:
   - no cloud config    → explain local-only mode + owner "connect" form
   - config, signed out → sign in / create account / magic link / reset
   - signed in          → sync state, sync now, download my data, sign out */
export function AccountMenu({ onClose }: { onClose: () => void }) {
  const status = useCloudStatus();
  const cfg = cloudConfig();
  const [mode, setMode] = useState<"signin" | "signup" | "magic" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [connOpen, setConnOpen] = useState(false);
  const [connUrl, setConnUrl] = useState("");
  const [connKey, setConnKey] = useState("");

  const run = async (fn: () => Promise<string | null>, okNote: string) => {
    setBusy(true); setNote(null);
    const err = await fn();
    setBusy(false);
    setNote(err ? err : okNote);
    return !err;
  };

  /* recovery: the user landed here from a password-reset email */
  if (status.state === "recovery") {
    return (
      <div className="menu-pop acct-pop">
        <div className="menu-note">Set a new password for {status.email}</div>
        <input className="acct-in" type="password" placeholder="New password (8+ characters)"
          value={pw} onChange={(e) => setPw(e.target.value)} />
        <button disabled={busy || pw.length < 8}
          onClick={() => void run(() => setNewPassword(pw), "Password updated — you're signed in.")}>
          <KeyRound size={15} strokeWidth={1.8} /> Save new password
        </button>
        {note && <div className="menu-note acct-note">{note}</div>}
      </div>
    );
  }

  /* signed in */
  if (status.state === "synced" || status.state === "syncing" || status.state === "error") {
    return (
      <div className="menu-pop acct-pop">
        <div className="menu-note"><b>{status.email}</b></div>
        <div className="menu-note acct-note">
          {status.state === "synced" && `Saved to your account${status.syncedAt ? " · " + new Date(status.syncedAt).toLocaleTimeString() : ""}`}
          {status.state === "syncing" && "Syncing…"}
          {status.state === "error" && `Cloud error — your work is safe locally. ${status.detail ?? ""}`}
        </div>
        <button onClick={() => syncNow()}><RefreshCw size={15} strokeWidth={1.8} /> Sync now</button>
        <button onClick={() => downloadMyData()}><FileDown size={15} strokeWidth={1.8} /> Download my data</button>
        {hasLocalSnapshot() && (
          <button onClick={() => {
            if (window.confirm("Bring back the work this device had before your cloud copy loaded? Your account will sync to the restored version.")) restoreLocalSnapshot();
          }}><History size={15} strokeWidth={1.8} /> Restore this device's earlier work</button>
        )}
        <button onClick={() => { void signOutCloud(); onClose(); }}><LogOut size={15} strokeWidth={1.8} /> Sign out</button>
        <div className="menu-note acct-note">Signing out keeps your work on this device.</div>
      </div>
    );
  }

  /* configured, signed out */
  if (cfg) {
    return (
      <div className="menu-pop acct-pop">
        <div className="menu-note">
          {mode === "signup" ? "Create your account — your kits and boards will save to it."
            : mode === "magic" ? "We'll email a one-time sign-in link (existing accounts only)."
            : mode === "reset" ? "We'll email you a password-reset link."
            : "Sign in — your saved work follows you to any device."}
        </div>
        <input className="acct-in" type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        {(mode === "signin" || mode === "signup") && (
          <input className="acct-in" type="password"
            placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
            value={pw} onChange={(e) => setPw(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        )}
        {mode === "signup" && (
          <label className="acct-agree">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I'm 13 or older and accept the{" "}
              <a href="legal/terms.html" target="_blank" rel="noreferrer">Terms</a> &amp;{" "}
              <a href="legal/privacy.html" target="_blank" rel="noreferrer">Privacy Policy</a> (drafts).
            </span>
          </label>
        )}
        {mode === "signin" && (
          <button disabled={busy || !email || !pw}
            onClick={() => void run(() => signIn(email, pw), "Signed in.")}>
            <LogIn size={15} strokeWidth={1.8} /> Sign in
          </button>
        )}
        {mode === "signup" && (
          <button disabled={busy || !email || pw.length < 8 || !agree}
            onClick={() => void run(() => signUp(email, pw), "Account created — check your email if confirmation is required.")}>
            <UserPlus size={15} strokeWidth={1.8} /> Create account
          </button>
        )}
        {mode === "magic" && (
          <button disabled={busy || !email}
            onClick={() => void run(() => signInMagic(email), "Link sent — check your email.")}>
            <Mail size={15} strokeWidth={1.8} /> Email me a sign-in link
          </button>
        )}
        {mode === "reset" && (
          <button disabled={busy || !email}
            onClick={() => void run(() => requestPasswordReset(email), "Reset link sent — check your email.")}>
            <KeyRound size={15} strokeWidth={1.8} /> Send reset link
          </button>
        )}
        {note && <div className="menu-note acct-note">{note}</div>}
        <div className="acct-links">
          {mode !== "signin" && <button className="acct-link" onClick={() => { setMode("signin"); setNote(null); }}>Sign in</button>}
          {mode !== "signup" && <button className="acct-link" onClick={() => { setMode("signup"); setNote(null); }}>Create account</button>}
          {mode !== "magic" && <button className="acct-link" onClick={() => { setMode("magic"); setNote(null); }}>Email link</button>}
          {mode !== "reset" && <button className="acct-link" onClick={() => { setMode("reset"); setNote(null); }}>Forgot password</button>}
        </div>
        {hasLocalSnapshot() && (
          <button className="acct-link" onClick={() => {
            if (window.confirm("Bring back the work this device had before a cloud copy loaded?")) restoreLocalSnapshot();
          }}>Restore this device's earlier work</button>
        )}
        {cfg.fromOverride && (
          <button className="acct-link" onClick={() => { clearCloudOverride(); window.location.reload(); }}>
            Disconnect this browser's cloud project
          </button>
        )}
      </div>
    );
  }

  /* unconfigured: local-only build */
  return (
    <div className="menu-pop acct-pop">
      <div className="menu-note">Working locally — everything saves to this browser.</div>
      <div className="menu-note acct-note">
        Accounts aren't connected on this deployment yet. Once a Supabase project
        is linked (see docs/CLOUD-SETUP.md), sign-in and cloud saves switch on here.
      </div>
      <button onClick={() => setConnOpen(!connOpen)}><Cable size={15} strokeWidth={1.8} /> Connect a Supabase project…</button>
      {connOpen && (
        <>
          <input className="acct-in" type="url" placeholder="https://YOUR-PROJECT.supabase.co"
            value={connUrl} onChange={(e) => setConnUrl(e.target.value)} />
          <input className="acct-in" type="text" placeholder="anon public key (eyJ…)"
            value={connKey} onChange={(e) => setConnKey(e.target.value)} />
          <button disabled={!/^https:\/\/.+supabase\.co$/.test(connUrl.trim().replace(/\/+$/, "")) || connKey.trim().length < 20}
            onClick={() => { setCloudOverride(connUrl, connKey); window.location.reload(); }}>
            Connect (this browser only)
          </button>
          <div className="menu-note acct-note">
            The anon key is public by design — access is protected by row-level
            security, not by hiding the key.
          </div>
        </>
      )}
    </div>
  );
}
