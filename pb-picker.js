/* pb-picker.js — PatternBreak deliverable status picker (internal tracker)
 *
 * Progressive enhancement for the internal tracker. Reads from the existing
 * `allDelivs` global and posts to the existing Apps Script endpoint.
 *
 * Behavior:
 *   - Renders a status pill on every visible deliverable row (.ditem).
 *   - Click pill → menu with 4 status options (Delivered, Needs Review,
 *     In Progress, Not Started).
 *   - Click a status → updates UI in-place + writes `dstat` action to sheet.
 *   - Click outside / Esc → closes menu.
 *
 * Required globals on the host page:
 *   - window.allDelivs    (object: { groupKey: [{id, status, ...}, ...] })
 *   - window.SU           (Apps Script endpoint URL)
 *
 * Re-runs automatically when the project list re-renders (notify pill
 * "Refresh now", initial load, etc.) via MutationObserver on #proj-list.
 */
(function () {
  // status table — order = menu order
  const STATUSES = [
    { key: 'delivered',   label: 'Delivered',   cls: 's-pk-d', dot: '#22d3a5' },
    { key: 'needs review',label: 'Needs Review',cls: 's-pk-r', dot: '#38bdf8' },
    { key: 'in progress', label: 'In Progress', cls: 's-pk-p', dot: '#f59e0b' },
    { key: 'not started', label: 'Not Started', cls: 's-pk-n', dot: '#8892a4' }
  ];

  // injected styles — bigger pill style matching client tracker
  const css = `
    .ditem .pk-pill{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap;border:none;cursor:pointer;font-family:inherit;letter-spacing:.02em;transition:opacity .12s;flex-shrink:0;margin-right:4px}
    .ditem .pk-pill:hover{opacity:.82}
    .ditem .pk-pill::before{content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0;background:currentColor;opacity:.85}
    .pk-pill.s-pk-d{background:rgba(34,211,165,.14);color:#22d3a5}
    .pk-pill.s-pk-r{background:rgba(56,189,248,.14);color:#38bdf8}
    .pk-pill.s-pk-p{background:rgba(245,158,11,.14);color:#f59e0b}
    .pk-pill.s-pk-n{background:rgba(136,146,164,.14);color:#8892a4}
    [data-theme="light"] .pk-pill.s-pk-d{background:rgba(15,158,120,.12);color:#0f9e78}
    [data-theme="light"] .pk-pill.s-pk-r{background:rgba(29,111,189,.12);color:#1d6fbd}
    [data-theme="light"] .pk-pill.s-pk-p{background:rgba(180,83,9,.12);color:#b45309}
    [data-theme="light"] .pk-pill.s-pk-n{background:rgba(107,114,128,.1);color:#6b7280}
    .pk-menu{position:absolute;z-index:1100;background:var(--bg2,#161b27);border:1px solid var(--border2,#263352);border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.3);display:none;min-width:160px}
    .pk-menu.on{display:block;animation:pkin .15s ease}
    @keyframes pkin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    .pk-menu button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:7px 10px;font-size:11px;font-weight:600;background:transparent;border:none;color:var(--text,#f0f4ff);cursor:pointer;border-radius:5px;font-family:inherit;letter-spacing:.02em}
    .pk-menu button:hover{background:var(--bg3,#1e2436)}
    .pk-menu button .pk-sw{width:8px;height:8px;border-radius:50%;flex-shrink:0}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // single floating menu element
  const menu = document.createElement('div');
  menu.className = 'pk-menu';
  menu.id = 'pk-menu';
  document.body.appendChild(menu);

  // ── status lookup ────────────────────────────────────────────────
  function matchStatus(raw) {
    const k = (raw || '').toLowerCase().trim();
    // try exact match first
    let m = STATUSES.find(s => s.key === k);
    if (m) return m;
    // then partial (handles 'review' → 'needs review', 'done' → 'delivered', etc.)
    if (k.includes('deliver') || k === 'complete' || k === 'done') return STATUSES[0];
    if (k.includes('review')) return STATUSES[1];
    if (k.includes('progress')) return STATUSES[2];
    if (k.includes('not start') || k === '' || k === 'pending') return STATUSES[3];
    return STATUSES[3]; // safe default
  }

  // ── find deliverable by id, anywhere in allDelivs ───────────────
  function findDeliv(id) {
    const all = window.allDelivs || {};
    for (const k of Object.keys(all)) {
      const hit = (all[k] || []).find(d => d.id === id);
      if (hit) return hit;
    }
    return null;
  }

  // ── render pills on every .ditem that has a deliverable id ──────
  function decorate() {
    document.querySelectorAll('.ditem').forEach(row => {
      // already decorated?
      if (row.querySelector('.pk-pill')) return;
      // find the deliv id from the eye button's onclick attribute
      const eye = row.querySelector('.ditem-eye');
      if (!eye) return; // no id available
      const oc = eye.getAttribute('onclick') || '';
      const m = oc.match(/'([^']+)'/);
      if (!m) return;
      const id = m[1];
      const d = findDeliv(id);
      if (!d) return;
      const st = matchStatus(d.status);
      const pill = document.createElement('button');
      pill.className = 'pk-pill ' + st.cls;
      pill.textContent = st.label;
      pill.dataset.delivId = id;
      pill.addEventListener('click', e => openMenu(e, id));
      // insert before the eye button so order is: name, pill, eye
      eye.parentNode.insertBefore(pill, eye);
    });
  }

  // ── menu open / set / close ─────────────────────────────────────
  function openMenu(e, id) {
    e.stopPropagation();
    const btn = e.currentTarget;
    menu.innerHTML = STATUSES.map(s =>
      `<button data-status="${s.key}"><span class="pk-sw" style="background:${s.dot}"></span>${s.label}</button>`
    ).join('');
    menu.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => setStatus(id, b.dataset.status));
    });
    const r = btn.getBoundingClientRect();
    menu.style.left = (r.left + window.scrollX) + 'px';
    menu.style.top = (r.bottom + window.scrollY + 4) + 'px';
    menu.classList.add('on');
  }

  function setStatus(id, newStatus) {
    // update local data
    const d = findDeliv(id);
    if (d) d.status = newStatus;
    // update every pill for this id (might be visible on overview + projects views)
    const st = matchStatus(newStatus);
    document.querySelectorAll('.pk-pill').forEach(p => {
      if (p.dataset.delivId === id) {
        p.className = 'pk-pill ' + st.cls;
        p.textContent = st.label;
      }
    });
    menu.classList.remove('on');
    // write to sheet
    if (window.SU) {
      fetch(window.SU, {
        method: 'POST',
        body: JSON.stringify({ action: 'dstat', id: id, status: newStatus })
      }).catch(() => {});
    }
  }

  function closeMenu() { menu.classList.remove('on'); }
  document.addEventListener('click', e => {
    if (!e.target.closest('.pk-pill') && !e.target.closest('.pk-menu')) closeMenu();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // ── re-decorate whenever the project list re-renders ────────────
  function observe() {
    const targets = ['proj-list', 'proj-list-p'].map(id => document.getElementById(id)).filter(Boolean);
    targets.forEach(t => {
      const obs = new MutationObserver(() => {
        // debounce-ish: wait a tick so the new DOM is settled
        requestAnimationFrame(decorate);
      });
      obs.observe(t, { childList: true, subtree: true });
    });
  }

  function start() {
    decorate();
    observe();
    // also re-decorate when deliverable accordions open
    document.addEventListener('click', e => {
      if (e.target.closest('.dtoggle')) requestAnimationFrame(decorate);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(start, 200));
  } else {
    setTimeout(start, 200);
  }
})();
