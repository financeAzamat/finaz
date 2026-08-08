/* ============================================================
   Hero flow field — luminous streamlines with a travelling wave.
   ------------------------------------------------------------
   Brief (his words): like the AMD AI hero - a wave of lit lines,
   AI/electric flow, not the primitive chip.

   How it reads as "flowing electric lines":
     • a smooth analytic vector field (layered sines, drifting in
       time) defines a direction at every point;
     • hundreds of particles advect along that field and leave
       FADING TRAILS - those trails are the glowing lines;
     • a diagonal brightness band sweeps across on a slow cycle, so
       lines light up in sequence as the wave passes them (the
       electric-flow pulse), then settle back to a dim resting glow;
     • the field is weighted to the RIGHT: particles fade out toward
       the left third so nothing competes with the headline.

   Trails are kept in an offscreen buffer faded with 'destination-out'
   each frame, so they decay to TRANSPARENT (not to a colour) and the
   hero gradient/aurora shows through untouched.

   Cost fence (the page's one ambient loop): canvas is hero-only; an
   IntersectionObserver stops the rAF loop when the hero scrolls off;
   prefers-reduced-motion paints one static frame.
   ============================================================ */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Resting → hot line colour (brand green → accent tint).
  const COOL = [64, 110, 92];
  const HOT  = [156, 220, 192];

  let dpr = 1, W = 0, H = 0;
  let buf = null, bctx = null;      // offscreen trail buffer
  let parts = [];
  let t0 = 0;

  // Smooth flow field: angle at (x,y) at time t. Layered sines give
  // curved, organic streamlines that slowly reshape.
  function angle(x, y, t) {
    const nx = x / W, ny = y / H;
    return (
      Math.sin(nx * 3.1 + t * 0.06) * 1.5 +
      Math.cos(ny * 2.6 - t * 0.05) * 1.2 +
      Math.sin((nx + ny) * 2.2 + t * 0.03) * 0.9
    ) + 0.15; // slight rightward bias so the flow drifts across-frame
  }

  // Right-weight: 0 on the left third (behind the headline), rising to 1
  // on the right. Squared for a soft toe.
  function weight(x) {
    const t = Math.min(Math.max((x / W - 0.30) / 0.70, 0), 1);
    return t * t;
  }

  let seed = 20;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  function spawn(p) {
    // bias spawns to the right so the density lives away from the copy
    p.x = W * (0.32 + rnd() * 0.68);
    p.y = rnd() * H;
    p.life = 60 + rnd() * 140;   // frames before respawn (keeps lines finite)
    p.age = 0;
    return p;
  }

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    buf = document.createElement('canvas');
    buf.width = canvas.width; buf.height = canvas.height;
    bctx = buf.getContext('2d');
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.lineCap = 'round';

    seed = 20;
    const count = Math.round(Math.min(560, (W * H) / 2600));
    parts = [];
    for (let i = 0; i < count; i++) {
      const p = spawn({});
      p.age = rnd() * p.life;   // desync so no synchronized respawn pulse
      parts.push(p);
    }
  }

  function step(t, dt) {
    // 1. Fade the trail buffer toward transparent (decay of old lines).
    bctx.save();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'destination-out';
    bctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.5, dt / 0.5)})`; // ~0.5s half-life
    bctx.fillRect(0, 0, buf.width, buf.height);
    bctx.restore();

    // 2. Advect particles, draw new trail segments.
    bctx.globalCompositeOperation = 'source-over';
    const speed = 42;                 // px/s - calm flow
    // travelling brightness wave: a diagonal band sweeping right→left→right
    const wavePos = (Math.sin(t * 0.28) * 0.5 + 0.5); // 0..1 cycle ~22s
    for (const p of parts) {
      const a = angle(p.x, p.y, t);
      const vx = Math.cos(a), vy = Math.sin(a);
      const nxs = p.x + vx * speed * dt;
      const nys = p.y + vy * speed * dt;

      const w = weight(p.x);
      if (w > 0.01) {
        // brightness from the sweeping wave: how close this x is to the band
        const band = 1 - Math.min(1, Math.abs((p.x / W) - wavePos) / 0.16);
        const hot = Math.max(0, band) ** 1.5;             // 0 dim .. 1 lit
        const cr = COOL[0] + (HOT[0] - COOL[0]) * hot;
        const cg = COOL[1] + (HOT[1] - COOL[1]) * hot;
        const cb = COOL[2] + (HOT[2] - COOL[2]) * hot;
        const alpha = w * (0.10 + 0.42 * hot);            // lines glow as wave hits
        bctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${alpha})`;
        bctx.lineWidth = 0.9 + 1.1 * hot;
        bctx.beginPath();
        bctx.moveTo(p.x, p.y);
        bctx.lineTo(nxs, nys);
        bctx.stroke();
      }

      p.x = nxs; p.y = nys; p.age += 1;
      // respawn when old or off-canvas
      if (p.age > p.life || p.x < W * 0.28 || p.x > W + 8 || p.y < -8 || p.y > H + 8) spawn(p);
    }

    // 3. Blit buffer onto the visible canvas (hero gradient shows through).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buf, 0, 0);
  }

  let raf = 0, running = false, last = 0;
  function loop(now) {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    step(t, dt);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  build();
  if (reduce) {
    // Static frame: advance a fixed number of steps so lines exist, no loop.
    for (let i = 0; i < 90; i++) step(i * 0.05, 0.05);
    return;
  }

  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { t0 = 0; build(); if (!running) { for (let i = 0; i < 60; i++) step(i * 0.05, 0.05); } }, 150);
  }, { passive: true });
})();
