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

  // Flow field: LEFT→RIGHT data streams. The base direction is +x (angle 0),
  // with a small vertical undulation so the streams read as wavy ribbons of
  // data rather than straight rules. The undulation drifts in time.
  function angle(x, y, t) {
    const nx = x / W, ny = y / H;
    const wobble =
      Math.sin(ny * 5.0 + nx * 2.2 - t * 0.5) * 0.28 +
      Math.sin(ny * 2.3 - t * 0.32) * 0.18;
    return wobble; // ~0 rad → moving right, wobble tilts it up/down
  }

  // Left→right brightness ramp: near-invisible behind the headline (left),
  // rising to full on the right. Squared for a soft toe.
  function weight(x) {
    const t = Math.min(Math.max((x / W - 0.18) / 0.82, 0), 1);
    return t * t;
  }

  let seed = 20;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  function spawn(p, initial) {
    // Streams enter from the LEFT and travel right. On respawn, start at the
    // left edge; on first build, scatter across x so the field is full at t0.
    p.x = initial ? rnd() * W : -20 - rnd() * 40;
    p.y = rnd() * H;
    p.life = 200 + rnd() * 260;  // long enough to cross the frame
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
    const count = Math.round(Math.min(320, (W * H) / 4200));
    parts = [];
    for (let i = 0; i < count; i++) {
      const p = spawn({}, true);   // initial: scatter across the frame
      p.age = rnd() * p.life;      // desync so no synchronized respawn pulse
      parts.push(p);
    }
  }

  function step(t, dt) {
    // 1. Fade the trail buffer toward transparent (decay of old lines).
    bctx.save();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'destination-out';
    bctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.5, dt / 1.4)})`; // ~1.4s half-life → long ribbons
    bctx.fillRect(0, 0, buf.width, buf.height);
    bctx.restore();

    // 2. Advect particles, draw new trail segments.
    bctx.globalCompositeOperation = 'source-over';
    const speed = 70;                 // px/s - left→right drift
    // travelling brightness wave: a band sweeping LEFT→RIGHT and wrapping,
    // so pulses of light always move in the flow direction.
    const wavePos = ((t * 0.10) % 1.3) - 0.15;        // -0.15..1.15, ~13s period
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
        const alpha = w * (0.22 + 0.55 * hot);            // brighter resting glow + wave lift
        bctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${alpha})`;
        bctx.lineWidth = 1.1 + 1.3 * hot;
        bctx.beginPath();
        bctx.moveTo(p.x, p.y);
        bctx.lineTo(nxs, nys);
        bctx.stroke();
      }

      p.x = nxs; p.y = nys; p.age += 1;
      // respawn once it exits right (or ages out / drifts off top-bottom):
      // it re-enters from the left, keeping a continuous L→R stream.
      if (p.age > p.life || p.x > W + 10 || p.y < -12 || p.y > H + 12) spawn(p);
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
