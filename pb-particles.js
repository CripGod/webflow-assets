/* pb-particles.js — PatternBreak particle hero animation
 * Drop a <canvas id="ptcl"></canvas> into a page and include this script.
 * Optionally configure by setting window.PB_PARTICLES_CONFIG before the script loads,
 * or by passing options as data- attributes on the canvas:
 *   <canvas id="ptcl" data-count="65" data-palette="purple"></canvas>
 *
 * Config options (all optional):
 *   count        : number of particles (default 65)
 *   palette      : array of color hex strings, OR a preset name:
 *                    'purple' (default), 'marlo' (MARLÖ Signal Blue), 'cool'
 *   linkDistance : max px distance for connecting lines (default 85)
 *   maxSpeed     : speed cap per particle (default .85)
 *   sizeMin/Max  : particle radius range (default .8 / 3.0)
 *   themeAware   : if true, dims for light mode (default true)
 *   selector     : canvas selector (default '#ptcl')
 */
(function () {
  const PALETTES = {
    purple: ['#7c6ff7', '#9d98f8', '#38bdf8', '#a78bfa', '#6366f1', '#818cf8'],
    marlo:  ['#2454F0', '#4F78FF', '#9DBEFF', '#DFE5F4', '#6366F1'],
    cool:   ['#22d3a5', '#38bdf8', '#818cf8', '#a78bfa']
  };

  function init() {
    const userCfg = window.PB_PARTICLES_CONFIG || {};
    const cv = document.querySelector(userCfg.selector || '#ptcl');
    if (!cv) return;

    // data- attribute overrides
    const ds = cv.dataset;
    const dsNum = (k, d) => ds[k] != null ? Number(ds[k]) : d;
    const cfg = {
      count:        dsNum('count',        userCfg.count        ?? 65),
      linkDistance: dsNum('linkDistance', userCfg.linkDistance ?? 85),
      maxSpeed:     dsNum('maxSpeed',     userCfg.maxSpeed     ?? 0.85),
      sizeMin:      dsNum('sizeMin',      userCfg.sizeMin      ?? 0.8),
      sizeMax:      dsNum('sizeMax',      userCfg.sizeMax      ?? 3.0),
      themeAware:   userCfg.themeAware ?? true,
      palette:      ds.palette ?? userCfg.palette ?? 'purple'
    };
    const colors = Array.isArray(cfg.palette) ? cfg.palette : (PALETTES[cfg.palette] || PALETTES.purple);

    const cx = cv.getContext('2d');
    let W, H, pts = [], mouse = { x: -999, y: -999, on: false };

    const resize = () => {
      W = cv.width = cv.parentElement.offsetWidth;
      H = cv.height = cv.parentElement.offsetHeight;
    };
    const sizeRange = cfg.sizeMax - cfg.sizeMin;
    const mkPt = () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * sizeRange + cfg.sizeMin,
      col: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
      freq: Math.random() * 0.015 + 0.005
    });
    const seed = () => { resize(); pts = Array.from({ length: cfg.count }, mkPt); };

    const draw = () => {
      cx.clearRect(0, 0, W, H);
      const dark = !cfg.themeAware || document.documentElement.getAttribute('data-theme') !== 'light';

      pts.forEach(p => {
        p.phase += p.freq;
        p.vx += Math.sin(p.phase) * 0.012;
        p.vy += Math.cos(p.phase * 0.7) * 0.012;
        p.vx *= 0.97; p.vy *= 0.97;
        const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (sp > cfg.maxSpeed) { p.vx = p.vx / sp * cfg.maxSpeed; p.vy = p.vy / sp * cfg.maxSpeed; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;
        if (p.y < -8) p.y = H + 8; else if (p.y > H + 8) p.y = -8;

        let drawR = p.r, drawGlow = dark ? 14 : 0, drawAlpha = dark ? 0.8 : 0.55;
        if (mouse.on && window.innerWidth > 768) {
          const mdx = mouse.x - p.x, mdy = mouse.y - p.y;
          const md = Math.sqrt(mdx * mdx + mdy * mdy);
          if (md < 100) {
            const prox = 1 - md / 100;
            drawR = p.r + (prox * 4);
            drawGlow = dark ? (14 + prox * 28) : (prox * 16);
            drawAlpha = dark ? (0.8 + prox * 0.2) : (0.55 + prox * 0.3);
          }
        }
        cx.save();
        cx.shadowBlur = drawGlow; cx.shadowColor = p.col;
        cx.beginPath(); cx.arc(p.x, p.y, drawR, 0, Math.PI * 2);
        cx.fillStyle = p.col; cx.globalAlpha = drawAlpha; cx.fill();
        cx.restore();
      });

      cx.save();
      const L = cfg.linkDistance;
      for (let i = 0; i < pts.length - 1; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < L) {
            cx.beginPath();
            cx.moveTo(pts[i].x, pts[i].y); cx.lineTo(pts[j].x, pts[j].y);
            cx.strokeStyle = pts[i].col;
            cx.globalAlpha = (1 - d / L) * (dark ? 0.22 : 0.1);
            cx.lineWidth = 0.7; cx.stroke();
          }
        }
      }
      cx.restore();
      requestAnimationFrame(draw);
    };

    cv.addEventListener('mousemove', e => {
      const r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
    });
    cv.addEventListener('mouseleave', () => { mouse.on = false; });
    window.addEventListener('resize', resize);

    seed(); draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
