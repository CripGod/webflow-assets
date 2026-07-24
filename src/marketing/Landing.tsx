/* The approved front door, ported faithfully from the design artifact.
   The markup/styles/behavior are generated extracts (landingHtml.ts,
   landing.css, landingInit.ts); this component mounts them, swaps asset
   tokens for bundled URLs, and hands the behavior the real engine, the
   hash router, and the cloud auth overlay. */
import { useEffect, useRef } from "react";
import "@/styles/landing.css";
import { LANDING_HTML } from "./landingHtml";
import { initLanding } from "./landingInit";
import { engineApi } from "./engine";
import { navigate } from "@/shell/router";
import { openAuth } from "@/shell/authOverlay";

import gameDev from "./assets/people/game-dev.jpg";
import indie from "./assets/people/indie.jpg";
import hobbyist from "./assets/people/hobbyist.jpg";
import students from "./assets/people/students.jpg";
import uiArtists from "./assets/people/ui-artists.jpg";
import prototypers from "./assets/people/prototypers.jpg";
import valley from "./assets/boards/valley.jpg";
import strategy from "./assets/boards/strategy.jpg";
import tavern from "./assets/boards/tavern.jpg";
import fps from "./assets/boards/fps.jpg";

const TOKENS: Record<string, string> = {
  __FD_people_gamedev__: gameDev,
  __FD_people_indie__: indie,
  __FD_people_hobbyist__: hobbyist,
  __FD_people_students__: students,
  __FD_people_uiartists__: uiArtists,
  __FD_people_prototypers__: prototypers,
  __FD_boards_valley__: valley,
};

export function Landing() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let html = LANDING_HTML;
    for (const [token, url] of Object.entries(TOKENS)) html = html.replaceAll(token, url);
    host.innerHTML = html;

    const ctrl = new AbortController();
    initLanding({
      engine: engineApi,
      assets: { strategy, tavern, fps },
      navigate,
      openAuth: () => openAuth("signin"),
      signal: ctrl.signal,
    });
    return () => {
      ctrl.abort();
      host.innerHTML = "";
      document.body.style.overflow = "";
    };
  }, []);

  return <div className="fd-landing" ref={ref} />;
}
