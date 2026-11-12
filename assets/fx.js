/* ============================================================================
   fx.js · shared motion layer for the Graphite theme (Yatharth Webs)
   Classic script, no dependencies. Load on any page with:
       <script src="assets/fx.js" defer></script>
   It is safe to load twice (second run is a no-op) and does nothing harmful on
   pages that have none of the hooks. All styling lives in assets/styles.css
   (section 17); this file only sets CSS variables and toggles classes.

   HOOKS (attributes you put in the HTML)
   data-tilt[="deg"]     Pointer 3D tilt, default 6deg, capped at 8. Sets on the element:
                           --rx, --ry   rotation, with unit        e.g. "-3.2deg"
                           --mx, --my   pointer position in %      e.g. "37.5%"   (0%-100%)
                           --nx, --ny   pointer position, -1 .. 1  (unitless, for custom parallax)
                         and toggles .is-tilting (then .is-settling for 650ms while it eases back).
     data-depth="px"     On children of a [data-tilt]: fx.js copies the number into --z on that child
                         and the CSS lifts it with translateZ(var(--z)) while tilting. Default 24.
   data-spot             Cursor spotlight. Sets --mx, --my in px relative to the element's top-left
                         corner (e.g. "214.0px") and toggles .is-spot. Ignored on [data-tilt] elements.
   data-magnetic[="k"]   Element is pulled towards the pointer. Sets --tx, --ty (px, max 12 / 8) and
                         toggles .is-magnetic. k = strength 0..1, default 0.3.
   .reveal               Gets class "in" when it scrolls into view (and "is-revealing" for the length
                         of the entrance). Coexists with a page's own IntersectionObserver.
     data-reveal="up|left|right|flip|zoom"   entrance style (CSS only, default up)
     data-delay="ms"                         delay for this element
     data-stagger="ms"   On a parent: cascade step for its .reveal descendants (default 70, 0 = off).
                         Without it, .reveal siblings that enter together still cascade by 70ms.
   data-parallax="0.15"  Slow vertical drift on scroll. Sets --plx (px). Positive = lags behind the
                         page (feels further away), negative = moves ahead. Range -1..1.
   .steps                Gets class "go" when 35% visible (timeline fill).
   .nav                  Gets class "is-scrolled" once the page is scrolled.
   <html>                Gets class "fx" (script is running) and "fx-fine" (fine pointer + motion ok).

   AMBIENT BACKGROUND
   One fixed, pointer-events:none layer is injected as the first child of <body>:
       <div class="fx-bg" aria-hidden="true">
         <i class="fx-grid"></i><i class="fx-orb fx-orb-a"></i><i class="fx-orb fx-orb-b"></i>
         <i class="fx-orb fx-orb-c"></i><i class="fx-cursor"></i>[<canvas class="fx-canvas">]</div>
   On fine-pointer devices with more than 4 cores a 2D canvas field is added (drifting nodes, thin
   links, grid lines that light up near the pointer; DPR capped at 1.5, ~30fps, paused when the tab is
   hidden) and .fx-bg gets class "is-canvas". Everywhere else the CSS orbs do the work and no JS runs
   between scrolls. The canvas also pauses while an opaque full-bleed element covers the viewport:
   .desk-hero does this automatically, any other element can opt in with data-fx-cover
   (data-fx-cover="false" opts out).

   RULES
   Tilt, spotlight, magnetic and the canvas run only when (hover:hover) and (pointer:fine) matches and
   prefers-reduced-motion is off. With reduced motion every .reveal is shown at once and nothing moves.

   API
   window.FX.refresh()   Re-scan the page for hooks. Called automatically (MutationObserver) when
                         scripts add elements, so you rarely need it.
   ========================================================================== */
(() => {
  'use strict';
  if (window.FX && typeof window.FX.refresh === 'function') return; // already running

  const doc = document, root = doc.documentElement;
  const mq = q => (window.matchMedia ? window.matchMedia(q) : { matches: false });
  const mqFine = mq('(hover:hover) and (pointer:fine)');
  const mqReduce = mq('(prefers-reduced-motion: reduce)');
  const onMQ = (m, fn) => {
    if (m.addEventListener) m.addEventListener('change', fn);
    else if (m.addListener) m.addListener(fn);
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const reduced = () => mqReduce.matches;
  const interactive = () => mqFine.matches && !mqReduce.matches;
  const hasIO = 'IntersectionObserver' in window;

  /* ------------------------------------------------------------ reveal --- */
  const seenReveal = new WeakSet(), seenSteps = new WeakSet(), seenPlx = new WeakSet();
  let revealIO = null, stepsIO = null, plxIO = null;

  function show(el, delay) {
    if (reduced()) { el.classList.add('in'); return; }
    el.style.setProperty('--rv-delay', delay + 'ms');
    el.classList.add('is-revealing', 'in');
    setTimeout(() => {
      el.classList.remove('is-revealing');
      el.style.removeProperty('--rv-delay');
    }, delay + 1000);
  }

  function onReveal(entries) {
    const groups = new Map();
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target;
      const vh = en.rootBounds ? en.rootBounds.height : window.innerHeight;
      /* wait for 12% (same as the pages' own observers) unless the element is too tall to ever get there */
      if (en.intersectionRatio < 0.12 && en.boundingClientRect.height * 0.12 < vh * 0.9) continue;
      revealIO.unobserve(el);
      let delay;
      if (el.hasAttribute('data-delay')) {
        delay = clamp(num(el.getAttribute('data-delay'), 0), 0, 3000);
      } else {
        const host = el.closest('[data-stagger]');
        const step = host ? clamp(num(host.getAttribute('data-stagger'), 70), 0, 400) : 70;
        const key = host || el.parentElement || el;
        const i = groups.get(key) || 0;
        groups.set(key, i + 1);
        delay = Math.min(i * step, 490);
      }
      show(el, delay);
    }
  }

  function onSteps(entries) {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add('go');
      stepsIO.unobserve(en.target);
    }
  }

  /* ---------------------------------------------------------- parallax --- */
  const plxLive = new Set(), plxNow = new WeakMap();

  function onPlx(entries) {
    for (const en of entries) {
      if (en.isIntersecting) plxLive.add(en.target); else plxLive.delete(en.target);
    }
    if (plxLive.size && !reduced()) updateParallax();
  }

  function updateParallax() {
    if (!plxLive.size) return;
    const vh = window.innerHeight, half = vh / 2, writes = [];
    const y = window.scrollY || root.scrollTop || 0;
    const lastRef = Math.max(half, root.scrollHeight - half);
    plxLive.forEach(el => {                                   // read phase
      if (!el.isConnected) { plxLive.delete(el); return; }
      const r = el.getBoundingClientRect();
      const speed = clamp(num(el.getAttribute('data-parallax'), 0.15), -1, 1);
      /* natural centre in page coordinates (without the offset we applied ourselves) */
      const centre = r.top - (plxNow.get(el) || 0) + r.height / 2 + y;
      /* offset is zero when the element sits mid-screen. Elements that can never get there (top of the
         first screen, bottom of the last) are anchored to the page start / end, so they rest in place. */
      const ref = Math.min(Math.max(centre, half), lastRef);
      writes.push([el, clamp((y + half - ref) * speed, -140, 140)]);
    });
    for (const [el, v] of writes) {                           // write phase
      plxNow.set(el, v);
      el.style.setProperty('--plx', v.toFixed(1) + 'px');
    }
  }

  function clearParallax() {
    doc.querySelectorAll('[data-parallax]').forEach(el => {
      plxNow.delete(el);
      el.style.removeProperty('--plx');
    });
  }

  /* ------------------------------------------- pointer: tilt/spot/magnet --- */
  let px = -1, py = -1, pTarget = null, pQueued = false, hasPointer = false;
  let tiltEl = null, tiltRect = null, tiltMax = 6;
  let spotEl = null, spotRect = null;
  let magEl = null, magRect = null, magK = 0.3;
  const settleTimer = new WeakMap();

  function setDepth(el) {
    el.style.setProperty('--z', clamp(num(el.getAttribute('data-depth'), 24), -60, 120) + 'px');
  }

  function releaseTilt(el) {
    el.classList.remove('is-tilting');
    el.classList.add('is-settling');
    const s = el.style;
    s.setProperty('--rx', '0deg'); s.setProperty('--ry', '0deg');
    s.setProperty('--nx', '0'); s.setProperty('--ny', '0');
    clearTimeout(settleTimer.get(el));
    settleTimer.set(el, setTimeout(() => el.classList.remove('is-settling'), 650));
  }

  function setTilt(el) {
    if (el !== tiltEl) {
      if (tiltEl) releaseTilt(tiltEl);
      tiltEl = el; tiltRect = null;
      if (el) {
        clearTimeout(settleTimer.get(el));
        el.classList.remove('is-settling');
        el.classList.add('is-tilting');
        tiltMax = clamp(num(el.getAttribute('data-tilt'), 6), 0, 8);
        el.querySelectorAll('[data-depth]').forEach(setDepth);
      }
    }
    if (!el) return;
    const r = tiltRect || (tiltRect = el.getBoundingClientRect());
    if (!r.width || !r.height) return;
    const fx = clamp((px - r.left) / r.width, 0, 1), fy = clamp((py - r.top) / r.height, 0, 1);
    const nx = fx * 2 - 1, ny = fy * 2 - 1, s = el.style;
    s.setProperty('--rx', (-ny * tiltMax).toFixed(2) + 'deg');   // pointer at the top: top edge leans away
    s.setProperty('--ry', (nx * tiltMax).toFixed(2) + 'deg');    // pointer on the right: right edge leans away
    s.setProperty('--mx', (fx * 100).toFixed(1) + '%');
    s.setProperty('--my', (fy * 100).toFixed(1) + '%');
    s.setProperty('--nx', nx.toFixed(3));
    s.setProperty('--ny', ny.toFixed(3));
  }

  function setSpot(el) {
    if (el !== spotEl) {
      if (spotEl) spotEl.classList.remove('is-spot');
      spotEl = el; spotRect = null;
      if (el) el.classList.add('is-spot');
    }
    if (!el) return;
    const r = spotRect || (spotRect = el.getBoundingClientRect());
    el.style.setProperty('--mx', (px - r.left).toFixed(1) + 'px');
    el.style.setProperty('--my', (py - r.top).toFixed(1) + 'px');
  }

  function releaseMagnet(el) {
    el.classList.remove('is-magnetic');
    el.style.setProperty('--tx', '0px');
    el.style.setProperty('--ty', '0px');
  }

  function setMagnet(el) {
    if (el !== magEl) {
      if (magEl) releaseMagnet(magEl);
      magEl = el; magRect = null;
      if (el) {
        el.classList.add('is-magnetic');
        magK = clamp(num(el.getAttribute('data-magnetic'), 0.3), 0, 1);
      }
    }
    if (!el) return;
    /* rect is cached on entry (before the pull is applied) so the pull does not feed back into itself */
    const r = magRect || (magRect = el.getBoundingClientRect());
    el.style.setProperty('--tx', clamp((px - (r.left + r.width / 2)) * magK, -12, 12).toFixed(1) + 'px');
    el.style.setProperty('--ty', clamp((py - (r.top + r.height / 2)) * magK, -8, 8).toFixed(1) + 'px');
  }

  function dropPointer() {
    setTilt(null); setSpot(null); setMagnet(null);
    hasPointer = false; pTarget = null;
    if (bg) bg.classList.remove('has-pointer');
  }

  function pointerFrame() {
    pQueued = false;
    if (!hasPointer) return;
    if (!interactive()) { dropPointer(); return; }
    const t = pTarget && pTarget.nodeType === 1 && pTarget.isConnected ? pTarget : null;
    setTilt(t ? t.closest('[data-tilt]') : null);
    setSpot(t ? t.closest('[data-spot]:not([data-tilt])') : null);
    setMagnet(t ? t.closest('[data-magnetic]') : null);
    if (bg && cursorEl) {
      cursorEl.style.transform = 'translate3d(' + px.toFixed(1) + 'px,' + py.toFixed(1) + 'px,0)';
      bg.classList.add('has-pointer');
    }
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    px = e.clientX; py = e.clientY; pTarget = e.target; hasPointer = true;
    if (!pQueued) { pQueued = true; requestAnimationFrame(pointerFrame); }
  }

  /* ------------------------------------------------------------ scroll --- */
  let scrollQueued = false, nav = null;

  /* things that depend on where the page is scrolled to */
  function syncScroll() {
    const y = window.scrollY || root.scrollTop || 0;
    if (nav) nav.classList.toggle('is-scrolled', y > 8);
    if (!reduced()) updateParallax();
    if (field) field.checkCover();
  }

  function scrollFrame() {
    scrollQueued = false;
    syncScroll();
    /* content moved under a still pointer: cached boxes are stale */
    if (tiltEl) setTilt(null);
    if (magEl) setMagnet(null);
    if (spotEl) { spotRect = null; setSpot(spotEl); }
  }

  function queueScroll() {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(scrollFrame); }
  }

  /* ------------------------------------------------ ambient background --- */
  let bg = null, cursorEl = null, field = null, resizeTimer = 0;

  function mountBg() {
    if (!doc.body) return;
    bg = doc.querySelector('.fx-bg');
    if (!bg) {
      bg = doc.createElement('div');
      bg.className = 'fx-bg';
      bg.setAttribute('aria-hidden', 'true');
      bg.innerHTML = '<i class="fx-grid"></i><i class="fx-orb fx-orb-a"></i><i class="fx-orb fx-orb-b"></i><i class="fx-orb fx-orb-c"></i><i class="fx-cursor"></i>';
      doc.body.insertBefore(bg, doc.body.firstChild);
    }
    cursorEl = bg.querySelector('.fx-cursor');
  }

  function wantsCanvas() {
    const c = navigator.connection;
    return interactive() && !doc.hidden &&
      (navigator.hardwareConcurrency || 0) > 4 &&
      !(navigator.deviceMemory && navigator.deviceMemory < 4) &&
      !(c && c.saveData);
  }

  function syncField() {
    if (!bg) return;
    if (wantsCanvas()) {
      if (!field) field = createField(bg);
      if (field) field.start();
    } else if (field) {
      field.stop(doc.hidden ? false : true);
    }
  }

  /* a light 2D field: drifting nodes, thin links, grid lines that glow near the pointer */
  function createField(host) {
    const cv = doc.createElement('canvas');
    const ctx = cv.getContext ? cv.getContext('2d') : null;
    if (!ctx) return null;
    cv.className = 'fx-canvas';
    host.appendChild(cv);

    const GRID = 64, LINK = 150, REACH = 190, PAD = 30, TAU = Math.PI * 2;
    let w = 0, h = 0, nodes = [], covers = [], covered = false, running = false, raf = 0, last = 0;

    const make = () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16,   // px per second
      r: 0.7 + Math.random() * 1.3, ph: Math.random() * TAU,
      warm: Math.random() < 0.35, dx: 0, dy: 0
    });

    function resize() {
      w = host.clientWidth || window.innerWidth;
      h = host.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = clamp(Math.round(w * h / 34000), 16, 54);
      while (nodes.length < want) nodes.push(make());
      nodes.length = want;
    }

    function checkCover() {
      let c = false;
      const vh = window.innerHeight;
      for (const el of covers) {
        if (!el.isConnected) continue;
        const r = el.getBoundingClientRect();
        if (r.top <= 90 && r.bottom >= vh - 1 && r.width >= w - 2) { c = true; break; }
      }
      if (c && !covered) ctx.clearRect(0, 0, w, h);
      covered = c;
    }

    function draw(dt, t) {
      const n = nodes.length, W = w + PAD * 2, H = h + PAD * 2;
      const drift = (window.scrollY || 0) * 0.08;            // nodes slide a little as the page scrolls
      const ptr = hasPointer && px >= 0;
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < n; i++) {
        const p = nodes[i];
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -PAD) p.x += W; else if (p.x > w + PAD) p.x -= W;
        if (p.y < -PAD) p.y += H; else if (p.y > h + PAD) p.y -= H;
        p.dx = p.x;
        p.dy = (((p.y + PAD - drift) % H) + H) % H - PAD;
      }

      ctx.lineWidth = 1;
      if (ptr) {                                              // grid lines light up around the pointer
        const R = 230, g = ctx.createRadialGradient(px, py, 0, px, py, R);
        g.addColorStop(0, 'rgba(150,163,255,.36)');
        g.addColorStop(1, 'rgba(150,163,255,0)');
        ctx.strokeStyle = g;
        ctx.beginPath();
        for (let x = Math.floor((px - R) / GRID) * GRID; x <= px + R; x += GRID) { ctx.moveTo(x + 0.5, py - R); ctx.lineTo(x + 0.5, py + R); }
        for (let y = Math.floor((py - R) / GRID) * GRID; y <= py + R; y += GRID) { ctx.moveTo(px - R, y + 0.5); ctx.lineTo(px + R, y + 0.5); }
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgb(124,140,255)';                   // links
      for (let i = 0; i < n; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n; j++) {
          const b = nodes[j], dx = a.dx - b.dx, dy = a.dy - b.dy, d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          ctx.globalAlpha = (1 - Math.sqrt(d2) / LINK) * 0.2;
          ctx.beginPath(); ctx.moveTo(a.dx, a.dy); ctx.lineTo(b.dx, b.dy); ctx.stroke();
        }
        if (ptr) {
          const dx = a.dx - px, dy = a.dy - py, d2 = dx * dx + dy * dy;
          if (d2 < REACH * REACH) {
            ctx.globalAlpha = (1 - Math.sqrt(d2) / REACH) * 0.32;
            ctx.beginPath(); ctx.moveTo(a.dx, a.dy); ctx.lineTo(px, py); ctx.stroke();
          }
        }
      }

      for (let pass = 0; pass < 2; pass++) {                  // nodes, two colours
        ctx.fillStyle = pass ? '#b57bff' : '#8c9bff';
        for (let i = 0; i < n; i++) {
          const p = nodes[i];
          if (p.warm !== !!pass) continue;
          ctx.globalAlpha = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(t * 0.0012 + p.ph));
          ctx.beginPath(); ctx.arc(p.dx, p.dy, p.r, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function frame(t) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const gap = t - last;
      if (gap < 31) return;                                   // ~30fps is plenty for a slow drift
      last = t;
      if (covered) return;
      draw(Math.min(gap, 100) / 1000, t);
    }

    return {
      resize() { if (running) { resize(); checkCover(); } },
      checkCover() { if (running) checkCover(); },
      setCovers(list) { covers = list; if (running) checkCover(); },
      start() {
        if (running) return;
        running = true; last = 0;
        host.classList.add('is-canvas');
        resize(); checkCover();
        raf = requestAnimationFrame(frame);
      },
      stop(hide) {
        running = false;
        cancelAnimationFrame(raf);
        if (hide) { host.classList.remove('is-canvas'); ctx.clearRect(0, 0, w, h); }
      }
    };
  }

  /* ----------------------------------------------------------- refresh --- */
  let refreshQueued = false, ready = false;

  function refresh() {
    refreshQueued = false;
    if (!ready || !doc.body) return;   // called before the DOM is parsed: init() will scan
    const still = reduced();

    doc.querySelectorAll('.reveal:not(.in)').forEach(el => {
      if (still || !revealIO) { el.classList.add('in'); return; }
      if (!seenReveal.has(el)) { seenReveal.add(el); revealIO.observe(el); }
    });
    doc.querySelectorAll('.steps:not(.go)').forEach(el => {
      if (still || !stepsIO) { el.classList.add('go'); return; }
      if (!seenSteps.has(el)) { seenSteps.add(el); stepsIO.observe(el); }
    });
    if (plxIO) doc.querySelectorAll('[data-parallax]').forEach(el => {
      if (!seenPlx.has(el)) { seenPlx.add(el); plxIO.observe(el); }
    });
    doc.querySelectorAll('[data-tilt] [data-depth]').forEach(setDepth);

    nav = doc.querySelector('.nav');
    if (field) field.setCovers(Array.from(doc.querySelectorAll('.desk-hero:not([data-fx-cover="false"]),[data-fx-cover]:not([data-fx-cover="false"])')));
    syncScroll();
  }

  function queueRefresh() {
    if (!refreshQueued) { refreshQueued = true; requestAnimationFrame(refresh); }
  }

  /* -------------------------------------------------------------- init --- */
  function syncMode() {
    root.classList.toggle('fx-fine', interactive());
    if (!interactive()) dropPointer();
    if (reduced()) clearParallax();
    syncField();
    refresh();
  }

  function init() {
    ready = true;
    root.classList.add('fx');
    if (hasIO) {
      revealIO = new IntersectionObserver(onReveal, { threshold: [0, 0.12] });
      stepsIO = new IntersectionObserver(onSteps, { threshold: 0.35 });
      plxIO = new IntersectionObserver(onPlx, { rootMargin: '25% 0px 25% 0px' });
    }
    mountBg();
    syncMode();

    doc.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerleave', dropPointer);
    /* an iframe swallows pointer events, so nothing would tell us the pointer left a tilted card */
    doc.addEventListener('pointerover', e => { if (e.target && e.target.tagName === 'IFRAME') dropPointer(); }, { passive: true });
    window.addEventListener('blur', dropPointer);
    window.addEventListener('scroll', queueScroll, { passive: true });
    window.addEventListener('resize', () => {
      queueScroll();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (field) field.resize(); }, 160);
    }, { passive: true });
    doc.addEventListener('visibilitychange', syncField);
    window.addEventListener('pageshow', e => { if (e.persisted) syncMode(); });
    onMQ(mqFine, syncMode);
    onMQ(mqReduce, syncMode);

    /* pages build cards from scripts after load: pick those up without anyone having to call refresh() */
    if ('MutationObserver' in window) {
      new MutationObserver(list => {
        for (const m of list) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && node !== bg && !(bg && bg.contains(node))) { queueRefresh(); return; }
          }
        }
      }).observe(doc.body, { childList: true, subtree: true });
    }
  }

  window.FX = { refresh };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
