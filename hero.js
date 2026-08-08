/* ============================================================
   Hero dot-field — a "pixel picture" of pulsing points.
   ------------------------------------------------------------
   Brief (his words): pulsing dots forming a pixel picture of AI;
   the pulse SLOW so it doesn't pull the eye, dots rising from
   muted to bright, in the first page's palette.

   Why it can exist here after the mesh/flow diagrams were removed:
   those were dense networks with edges that fought the headline.
   This is a sparse point matrix, weighted to the RIGHT half where
   there is no type, dim on the left where the copy sits. It reads
   as texture, not a diagram.

   Cost control — this is the one ambient loop on the page, so it is
   fenced in:
     • canvas is hero-only, sized to the hero box, not the document;
     • an IntersectionObserver stops the rAF loop the moment the hero
       scrolls out of view and restarts it on the way back;
     • prefers-reduced-motion paints one static frame and never loops.
   ============================================================ */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Palette pulled from the hero: brand green (#2b5945) lifting toward the
  // lighter accent-on-dark tint (#8fd0b4). Dots interpolate between them.
  const DIM = [86, 132, 112];   // muted green-grey
  const HOT = [143, 208, 180];  // bright accent tint

  const GAP = 30;               // grid pitch in CSS px
  const R = 1.5;                // dot radius in CSS px
  let dpr = 1, W = 0, H = 0, dots = [];

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    dots = [];
    const cols = Math.ceil(W / GAP) + 1;
    const rows = Math.ceil(H / GAP) + 1;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * GAP;
        const y = r * GAP;
        // Left→right brightness ramp: near-invisible where the headline is
        // (left third), rising across the right. Squared for a soft toe.
        const t = Math.min(Math.max((x / W - 0.28) / 0.72, 0), 1);
        const weight = t * t;
        if (weight < 0.015) continue;                 // skip the dead-left dots
        dots.push({
          x, y, weight,
          phase: (x * 0.9 + y * 1.7) * 0.012,          // spatial phase, gives a drift
          speed: 0.55 + (r % 3) * 0.12,                // slight per-row variance
        });
      }
    }
  }

  function paint(now) {
    ctx.clearRect(0, 0, W, H);
    const ms = now * 0.001;
    for (const d of dots) {
      // Slow pulse: ~0.55 rad/s base → period ~11s. 0 (muted) → 1 (bright).
      const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(ms * d.speed + d.phase);
      const level = 0.25 + 0.75 * pulse;               // never fully off
      const a = d.weight * level * 0.6;                // overall cap keeps type readable
      const cr = Math.round(DIM[0] + (HOT[0] - DIM[0]) * pulse);
      const cg = Math.round(DIM[1] + (HOT[1] - DIM[1]) * pulse);
      const cb = Math.round(DIM[2] + (HOT[2] - DIM[2]) * pulse);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.arc(d.x, d.y, R * (0.75 + 0.35 * pulse), 0, 6.283);
      ctx.fill();
    }
  }

  let raf = 0, running = false;
  const loop = (t) => { paint(t); raf = requestAnimationFrame(loop); };
  function start() { if (!running) { running = true; raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  build();
  if (reduce) { paint(0); return; }                    // one static frame, no loop

  // Only animate while the hero is on screen.
  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { build(); if (!running) paint(performance.now()); }, 150);
  }, { passive: true });
})();
