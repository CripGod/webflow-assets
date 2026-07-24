import { lazy, Suspense, useEffect } from "react";
import { useRoute } from "./router";
import { useAuthOverlay, openAuth } from "./authOverlay";
import { useCloudStatus } from "./useCloudStatus";
import { Landing } from "@/marketing/Landing";
import { LegalPage } from "@/marketing/LegalPage";

/* The editor is the heavy chunk (engine + roughjs + three + icon libs). It is
   lazy so the landing route paints without pulling any of it. The dev-only
   silhouette lab and the auth overlay are split off for the same reason. */
const App = lazy(() => import("../App").then((m) => ({ default: m.App })));
const SilhouetteLab = lazy(() =>
  import("../ui/SilhouetteLab").then((m) => ({ default: m.SilhouetteLab })),
);
const AuthOverlay = lazy(() =>
  import("../auth/AuthOverlay").then((m) => ({ default: m.AuthOverlay })),
);

// `?lab=silhouettes` is a boot-time dev harness, decided once and never at
// runtime — it bypasses routing entirely, exactly as main.tsx did before.
const IS_LAB =
  new URLSearchParams(window.location.search).get("lab") === "silhouettes";

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-spinner" aria-hidden="true" />
      <span className="route-loading__label">Loading the generator…</span>
    </div>
  );
}

export function Shell() {
  const route = useRoute();
  const overlay = useAuthOverlay();
  const cloud = useCloudStatus();

  // The #/signin deep link opens the overlay on the sign-in form.
  useEffect(() => {
    if (route.signin) openAuth("signin");
  }, [route.signin]);

  // Landing here from a password-reset email: cloud.ts flips to "recovery".
  // Surface the overlay so the user can set a new password from any route.
  useEffect(() => {
    if (cloud.state === "recovery") openAuth("signin");
  }, [cloud.state]);

  if (IS_LAB) {
    return (
      <Suspense fallback={<RouteLoading />}>
        <SilhouetteLab />
      </Suspense>
    );
  }

  return (
    <>
      {route.name === "app" ? (
        <Suspense fallback={<RouteLoading />}>
          <App />
        </Suspense>
      ) : route.name === "terms" || route.name === "privacy" ? (
        <LegalPage doc={route.name} />
      ) : (
        <Landing />
      )}
      {overlay.open && (
        <Suspense fallback={null}>
          <AuthOverlay />
        </Suspense>
      )}
    </>
  );
}
