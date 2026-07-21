import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useGen } from "@/generator/store";
import { renderKit } from "@/generator/bevel";
import { STOCK_ICONS, hexMix } from "@/generator/model";
import type { GenConfig } from "@/generator/model";

/* ── HeroGL — the exploded material diagram, live in WebGL ──────────────
   Six extruded plates (Shell / Bevel / Face / Type / Glow / Shadow) float
   as a breathing stack; satellite components rasterized from the real SVG
   renderer orbit on the right; dotted leaders, dimension rails and layer
   labels are projected from 3D space every frame. The whole scene reskins
   itself from the live config — repaint a role in the editor and the
   glass changes color here. Auto-animates; pointer adds gentle parallax;
   prefers-reduced-motion renders a still frame. */

const LAYERS = [
  { key: "shell", t: "Shell", y: 1.55 },
  { key: "bevel", t: "Bevel", y: 0.93 },
  { key: "face", t: "Face", y: 0.31 },
  { key: "type", t: "Type Layer", y: -0.31 },
  { key: "glow", t: "Glow Plane", y: -0.93 },
  { key: "shadow", t: "Shadow Plane", y: -1.55 },
] as const;

const SATS = [
  { t: "ICON TOKEN", s1: "Extrude", s2: "Pad perfect", y: 1.75, h: 1.5 },
  { t: "PROGRESS BAR", s1: "72% · Fill", s2: "Live value", y: 0.1, h: 1.15 },
  { t: "PANEL / CARD", s1: "9-slice · Extrude", s2: "Tokenized material", y: -1.7, h: 2.1 },
] as const;

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Rasterize an SVG string into a THREE texture (async — image decode). */
function svgTex(svg: string, cb: (tex: THREE.Texture, w: number, h: number) => void) {
  const w = +(/width="([\d.]+)"/.exec(svg)?.[1] ?? 300);
  const h = +(/height="([\d.]+)"/.exec(svg)?.[1] ?? 150);
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas");
    cv.width = Math.round(w * 2); cv.height = Math.round(h * 2);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    cb(tex, w, h);
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/** The type-layer label, drawn into a canvas with the kit's own face. */
function typeTex(cfg: GenConfig): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 1400; cv.height = 380;
  const ctx = cv.getContext("2d")!;
  const label = (cfg.content.label || "PLAY NOW").toUpperCase();
  const ink = hexMix(cfg.effects.Glow ?? "#8FF0FF", "#FFFFFF", 0.55);
  const draw = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.font = `${cfg.type.italic ? "italic " : ""}800 175px "${cfg.type.font}", Inter, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.shadowColor = cfg.effects.Glow ?? "#8FF0FF"; ctx.shadowBlur = 34;
    ctx.fillText(label, cv.width / 2, cv.height / 2, cv.width - 140);
  };
  draw();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  // redraw once the display face actually arrives
  if (document.fonts?.load) {
    document.fonts.load(`800 175px "${cfg.type.font}"`).then(() => { draw(); tex.needsUpdate = true; }).catch(() => {});
  }
  return tex;
}

interface Rig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  group: THREE.Group;
  plates: THREE.Mesh[];
  typePlane: THREE.Mesh;
  glowMat: THREE.MeshBasicMaterial;
  satGroup: THREE.Group;
  sats: THREE.Mesh[];
  particles: THREE.Points;
  keyLight: THREE.DirectionalLight;
  disposables: { dispose(): void }[];
}

export function HeroGL() {
  const { cfg } = useGen();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const satLabelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rig = useRef<Rig | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const [failed, setFailed] = useState(false);

  /* mount: build the whole scene once */
  useEffect(() => {
    const wrap = wrapRef.current, canvas = canvasRef.current, overlay = svgRef.current;
    if (!wrap || !canvas || !overlay) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 2, 0.1, 100);
    camera.position.set(0, 4.0, 11.8);
    camera.lookAt(0, -0.15, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(2, 6, 5);
    scene.add(keyLight);

    const group = new THREE.Group();
    group.position.set(-1.55, 0.05, 0);
    group.rotation.set(0.07, 0.52, 0);
    scene.add(group);

    const disposables: { dispose(): void }[] = [];
    const plateGeo = new THREE.ExtrudeGeometry(roundedRectShape(4.6, 2.2, 0.55), {
      depth: 0.13, bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 24,
    });
    plateGeo.rotateX(-Math.PI / 2);
    disposables.push(plateGeo);

    const edgeGeo = new THREE.EdgesGeometry(plateGeo, 32);
    disposables.push(edgeGeo);
    const plates: THREE.Mesh[] = [];
    let glowMat: THREE.MeshBasicMaterial = null!;
    for (const L of LAYERS) {
      let mat: THREE.Material;
      if (L.key === "glow") {
        glowMat = new THREE.MeshBasicMaterial({ color: "#8FF0FF", transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false });
        mat = glowMat;
      } else if (L.key === "shadow") {
        mat = new THREE.MeshBasicMaterial({ color: "#0e1322", transparent: true, opacity: 0.8, depthWrite: false });
      } else {
        mat = new THREE.MeshStandardMaterial({ color: "#0E9CC9", transparent: true, opacity: 0.55, roughness: 0.32, metalness: 0.08, side: THREE.DoubleSide });
      }
      disposables.push(mat);
      const mesh = new THREE.Mesh(plateGeo, mat);
      mesh.position.y = L.y;
      mesh.userData.baseY = L.y;
      mesh.userData.key = L.key;
      // crisp rim — the glassy edge line that defines each plate
      if (L.key !== "glow") {
        const lm = new THREE.LineBasicMaterial({ color: "#7ADCFF", transparent: true, opacity: L.key === "shadow" ? 0.22 : 0.6 });
        disposables.push(lm);
        const rim2 = new THREE.LineSegments(edgeGeo, lm);
        mesh.add(rim2);
        mesh.userData.rim = lm;
      }
      if (L.key === "glow") mesh.scale.set(1.1, 1, 1.16);
      group.add(mesh);
      plates.push(mesh);
    }

    // the type layer carries the live label as a floating plane just above it
    const typeGeo = new THREE.PlaneGeometry(4.3, 1.3);
    disposables.push(typeGeo);
    const typeMat = new THREE.MeshBasicMaterial({ map: typeTex(cfgRef.current), transparent: true, depthWrite: false });
    disposables.push(typeMat);
    const typePlane = new THREE.Mesh(typeGeo, typeMat);
    typePlane.renderOrder = 40;
    // ride the front of the plate — clear of the layer above at this camera
    typePlane.position.z = 0.6;
    typePlane.rotation.x = -Math.PI / 2;
    const typeIdx = LAYERS.findIndex((l) => l.key === "type");
    typePlane.position.y = LAYERS[typeIdx].y + 0.27;
    typePlane.userData.baseY = typePlane.position.y;
    group.add(typePlane);

    // satellite components — textured from the real SVG renderer
    const satGroup = new THREE.Group();
    satGroup.position.set(3.05, 0, 0.4);
    scene.add(satGroup);
    const sats: THREE.Mesh[] = [];
    for (const S of SATS) {
      const g = new THREE.PlaneGeometry(1, 1);
      const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      disposables.push(g, m);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(0, S.y, 0);
      mesh.userData.baseY = S.y;
      mesh.userData.h = S.h;
      satGroup.add(mesh);
      sats.push(mesh);
    }

    // drifting dust — tiny highlight-colored points
    const pGeo = new THREE.BufferGeometry();
    const pts = new Float32Array(140 * 3);
    for (let i = 0; i < 140; i++) {
      pts[i * 3] = (Math.random() - 0.5) * 11;
      pts[i * 3 + 1] = (Math.random() - 0.5) * 5.6;
      pts[i * 3 + 2] = (Math.random() - 0.5) * 4 - 0.5;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const pMat = new THREE.PointsMaterial({ color: "#9fd8ff", size: 0.035, transparent: true, opacity: 0.5, depthWrite: false });
    disposables.push(pGeo, pMat);
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    rig.current = { renderer, scene, camera, group, plates, typePlane, glowMat, satGroup, sats, particles, keyLight, disposables };
    wrap.dataset.gl = "on";

    /* overlay furniture — leaders, dots, dimension rails, orbit ellipse */
    const NS = "http://www.w3.org/2000/svg";
    const mk = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      overlay.appendChild(el);
      return el;
    };
    const orbit = mk("ellipse", { fill: "none", stroke: "currentColor", "stroke-width": "1", "stroke-dasharray": "3 7", opacity: "0.28" });
    const leaders = LAYERS.map(() => mk("line", { stroke: "currentColor", "stroke-width": "1", "stroke-dasharray": "2 5", opacity: "0.55" }));
    const dots = LAYERS.map(() => mk("circle", { r: "3", fill: "currentColor", opacity: "0.8" }));
    const satLeaders = SATS.map(() => mk("line", { stroke: "currentColor", "stroke-width": "1", "stroke-dasharray": "2 5", opacity: "0.55" }));
    const satDots = SATS.map(() => mk("circle", { r: "3", fill: "currentColor", opacity: "0.8" }));
    const railTop = mk("line", { stroke: "currentColor", "stroke-width": "1", opacity: "0.5" });
    const railBot = mk("line", { stroke: "currentColor", "stroke-width": "1", opacity: "0.5" });
    const railTicks = [0, 1, 2, 3].map(() => mk("line", { stroke: "currentColor", "stroke-width": "1", opacity: "0.5" }));
    const railTopText = mk("text", { fill: "currentColor", "font-size": "12", "letter-spacing": "0.08em", "text-anchor": "middle", opacity: "0.75" });
    railTopText.textContent = "128.00";
    const railBotText = mk("text", { fill: "currentColor", "font-size": "12", "letter-spacing": "0.08em", "text-anchor": "middle", opacity: "0.75" });
    railBotText.textContent = "96.00";

    let W = 10, H = 10;
    const fit = () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      overlay.setAttribute("viewBox", `0 0 ${W} ${H}`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    const v = new THREE.Vector3();
    const proj = (local: THREE.Vector3, host: THREE.Object3D) => {
      v.copy(local);
      host.localToWorld(v);
      v.project(camera);
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
    };
    const setLine = (el: SVGElement, x1: number, y1: number, x2: number, y2: number) => {
      el.setAttribute("x1", x1.toFixed(1)); el.setAttribute("y1", y1.toFixed(1));
      el.setAttribute("x2", x2.toFixed(1)); el.setAttribute("y2", y2.toFixed(1));
    };

    const projectAll = () => {
      // layer labels — left column, leaders to each plate's left edge
      LAYERS.forEach((_L, i) => {
        const p = proj(v.set(-2.5, plates[i].position.y, 0.2), group);
        const lab = labelRefs.current[i];
        const lx = Math.max(20, W * 0.045);
        if (lab) { lab.style.transform = `translate(${lx}px, ${(p.y - 10).toFixed(1)}px)`; }
        dots[i].setAttribute("cx", p.x.toFixed(1)); dots[i].setAttribute("cy", p.y.toFixed(1));
        setLine(leaders[i], lx + 128, p.y, p.x - 8, p.y);
      });
      // satellites — right column
      SATS.forEach((_S, i) => {
        const mesh = sats[i];
        const halfH = (mesh.scale.y || 1) / 2;
        const c2 = proj(v.set(mesh.position.x, mesh.position.y, 0), satGroup);
        const b2 = proj(v.set(mesh.position.x, mesh.position.y - halfH * 0.6, 0), satGroup);
        const lab = satLabelRefs.current[i];
        if (lab) { lab.style.transform = `translate(${(c2.x - 100).toFixed(1)}px, ${(b2.y + 10).toFixed(1)}px)`; }
        satDots[i].setAttribute("cx", c2.x.toFixed(1)); satDots[i].setAttribute("cy", (b2.y + 4).toFixed(1));
        setLine(satLeaders[i], c2.x, b2.y - 6, c2.x, b2.y + 2);
      });
      // dimension rails — spanning the stack, above and below
      const t1 = proj(v.set(-2.3, 2.2, 0), group), t2 = proj(v.set(2.3, 2.2, 0), group);
      const b1 = proj(v.set(-2.3, -2.25, 0), group), b2 = proj(v.set(2.3, -2.25, 0), group);
      setLine(railTop, t1.x, t1.y, t2.x, t2.y);
      setLine(railBot, b1.x, b1.y, b2.x, b2.y);
      setLine(railTicks[0], t1.x, t1.y - 5, t1.x, t1.y + 5);
      setLine(railTicks[1], t2.x, t2.y - 5, t2.x, t2.y + 5);
      setLine(railTicks[2], b1.x, b1.y - 5, b1.x, b1.y + 5);
      setLine(railTicks[3], b2.x, b2.y - 5, b2.x, b2.y + 5);
      railTopText.setAttribute("x", ((t1.x + t2.x) / 2).toFixed(1));
      railTopText.setAttribute("y", (Math.min(t1.y, t2.y) - 8).toFixed(1));
      railBotText.setAttribute("x", ((b1.x + b2.x) / 2).toFixed(1));
      railBotText.setAttribute("y", (Math.max(b1.y, b2.y) + 18).toFixed(1));
      // the faint orbit — centered on the stack
      const c = proj(v.set(0, 0, 0), group);
      orbit.setAttribute("cx", c.x.toFixed(1)); orbit.setAttribute("cy", c.y.toFixed(1));
      orbit.setAttribute("rx", (H * 0.62).toFixed(0)); orbit.setAttribute("ry", (H * 0.44).toFixed(0));
    };

    /* pointer parallax — the scene leans toward the cursor, gently */
    let px = 0, py = 0, tx = 0, ty = 0;
    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => { tx = 0; ty = 0; };
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", onLeave);

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let raf = 0, t = 0;
    const frame = () => {
      t += 1 / 60;
      px += (tx - px) * 0.04; py += (ty - py) * 0.04;
      group.rotation.y = 0.52 + Math.sin(t * 0.19) * 0.13 + px * 0.14;
      group.rotation.x = 0.07 + Math.sin(t * 0.13) * 0.028 + py * 0.07;
      // the explosion breathes — every plate drifts on its own phase
      plates.forEach((pl, i) => { pl.position.y = pl.userData.baseY * (1 + Math.sin(t * 0.5 + i * 0.9) * 0.045); });
      typePlane.position.y = plates[typeIdx].position.y + 0.27;
      glowMat.opacity = 0.34 + Math.sin(t * 0.9) * 0.1;
      sats.forEach((m2, i) => { m2.position.y = m2.userData.baseY + Math.sin(t * 0.42 + i * 1.9) * 0.09; });
      particles.rotation.y = t * 0.018;
      renderer.render(scene, camera);
      projectAll();
      raf = requestAnimationFrame(frame);
    };
    if (still) {
      renderer.render(scene, camera);
      projectAll();
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerleave", onLeave);
      overlay.innerHTML = "";
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      rig.current = null;
    };
  }, []);

  /* reskin: colors, label texture and satellite rasters follow the config */
  useEffect(() => {
    if (!rig.current) return;
    const timer = window.setTimeout(() => {
      const R = rig.current;
      if (!R) return;
      const c = cfgRef.current;
      const bevel = c.effects.Bevel ?? "#0E9CC9";
      const face = c.effects["Inner Fill"] ?? "#12B2E2";
      const glow = c.effects.Glow ?? "#8FF0FF";
      for (const pl of R.plates) {
        const key = pl.userData.key as string;
        const m = pl.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
        const rim2 = pl.userData.rim as THREE.LineBasicMaterial | undefined;
        if (key === "shell") { m.color.set(hexMix(bevel, "#FFFFFF", 0.45)); m.opacity = 0.38; (m as THREE.MeshStandardMaterial).emissive?.set(new THREE.Color(bevel).multiplyScalar(0.3)); rim2?.color.set(hexMix(bevel, "#FFFFFF", 0.7)); }
        if (key === "bevel") { m.color.set(bevel); m.opacity = 0.6; rim2?.color.set(hexMix(bevel, "#FFFFFF", 0.45)); }
        if (key === "face") { m.color.set(face); m.opacity = 0.9; (m as THREE.MeshStandardMaterial).emissive?.set(new THREE.Color(face).multiplyScalar(0.25)); rim2?.color.set(hexMix(face, "#FFFFFF", 0.5)); }
        if (key === "type") { m.color.set("#0b0e17"); m.opacity = 0.58; rim2?.color.set(hexMix(glow, "#FFFFFF", 0.2)); }
        if (key === "glow") { m.color.set(glow); }
        if (key === "shadow") { rim2?.color.set(hexMix(bevel, "#FFFFFF", 0.1)); }
      }
      R.keyLight.position.set(Math.cos((c.lighting.angle * Math.PI) / 180) * 5, Math.sin((c.lighting.angle * Math.PI) / 180) * 5 + 2.5, 4.5);
      (R.particles.material as THREE.PointsMaterial).color.set(hexMix(glow, "#FFFFFF", 0.4));
      // label plane
      const tm = R.typePlane.material as THREE.MeshBasicMaterial;
      tm.map?.dispose();
      tm.map = typeTex(c);
      tm.needsUpdate = true;
      // satellites re-raster from the live renderer
      const svgs = [
        renderKit(c, "iconbtn", "m", "default", undefined, undefined, { icon: STOCK_ICONS.gem }),
        renderKit(c, "progress", "m", "default", 0.72),
        renderKit(c, "panel", "m"),
      ];
      svgs.forEach((svg, i) => {
        svgTex(svg, (tex, w, h) => {
          const R2 = rig.current;
          if (!R2) { tex.dispose(); return; }
          const mesh = R2.sats[i];
          const m = mesh.material as THREE.MeshBasicMaterial;
          m.map?.dispose();
          m.map = tex; m.opacity = 1; m.needsUpdate = true;
          const wh = mesh.userData.h as number;
          mesh.scale.set((w / h) * wh, wh, 1);
        });
      });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [cfg]);

  const glowC = cfg.effects.Glow ?? "#8FF0FF";
  const bevelC = cfg.effects.Bevel ?? "#0E9CC9";
  return (
    <div className="kp-glhero" ref={wrapRef} aria-label="Exploded material diagram — live WebGL" style={{
      backgroundImage: [
        `radial-gradient(ellipse 62% 54% at 52% 40%, ${hexMix(glowC, "#000000", 0)}1a, transparent 70%)`,
        `radial-gradient(ellipse 50% 44% at 26% 74%, ${hexMix(bevelC, "#000000", 0)}14, transparent 70%)`,
        "radial-gradient(rgba(150,160,200,0.35) 1px, transparent 1.6px)",
        "radial-gradient(rgba(150,160,200,0.22) 1px, transparent 1.4px)",
      ].join(", "),
      backgroundSize: "100% 100%, 100% 100%, 110px 110px, 66px 66px",
      backgroundPosition: "0 0, 0 0, 12px 8px, 40px 50px",
    }}>
      {failed ? (
        <div className="kp-glfallback">
          {LAYERS.map((L, i) => (
            <div key={L.key} className="kp-glfrow"><b>{String(i + 1).padStart(2, "0")}</b><span>{L.t}</span></div>
          ))}
          <p>WebGL isn't available here — the material still explodes into these six layers, top to bottom.</p>
        </div>
      ) : (
        <>
          <canvas ref={canvasRef} className="kp-glcanvas" />
          <svg ref={svgRef} className="kp-glleads" aria-hidden="true" />
          {LAYERS.map((L, i) => (
            <div key={L.key} className="kp-gllabel" ref={(el) => { labelRefs.current[i] = el; }}>{L.t}</div>
          ))}
          {SATS.map((S, i) => (
            <div key={S.t} className="kp-glsat" ref={(el) => { satLabelRefs.current[i] = el; }}>
              <b>{S.t}</b><span>{S.s1}</span><span>{S.s2}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
