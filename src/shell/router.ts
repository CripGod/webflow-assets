/* Minimal hand-rolled hash router — no dependency, works on any static host
   with Vite's relative `base`. It intentionally understands only three shapes
   and defaults everything else to the landing page:

   · #/app              → the editor
   · #/signin           → the landing page with the auth overlay open
   · #/  ""  (default)  → the landing page

   Two legacy hashes predate routes and must keep working untouched — they are
   read by App.tsx's useSharedKit() and open the kit read-only:

   · #share=<blob>      → editor in viewer mode (self-contained shared kit)
   · #p=<slug>          → editor in viewer mode (published cloud project)

   Supabase auth redirects (#access_token=…&type=recovery, #error=…) also live
   in the hash. They never match a route, so they fall through to `landing`;
   the recovery UI is driven by cloud status, not by the URL, and the Supabase
   client strips those tokens from the hash on boot. */

import { useEffect, useState } from "react";

export type RouteName = "landing" | "app";
export type Route = { name: RouteName; viewer: boolean; signin: boolean };

export function parseHash(hash: string): Route {
  // Deep links → editor (viewer mode handled inside App.tsx).
  if (/^#(share|p)=/.test(hash)) {
    return { name: "app", viewer: true, signin: false };
  }
  const path = hash.replace(/^#/, "");
  if (path === "/app") return { name: "app", viewer: false, signin: false };
  if (path === "/signin") return { name: "landing", viewer: false, signin: true };
  // "", "/", unknown routes, and Supabase auth hashes → landing.
  return { name: "landing", viewer: false, signin: false };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

/** Navigate by setting the hash. A no-op set still fires listeners so callers
    can rely on it. Guards against pushing a redundant history entry. */
export function navigate(to: string) {
  const hash = to.startsWith("#") ? to : "#" + to;
  if (window.location.hash === hash) {
    // Force a re-parse even when the hash is unchanged (e.g. re-open signin).
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }
  window.location.hash = hash;
}
