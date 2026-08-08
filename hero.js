/* ============================================================
   Hero data stream — an endless left→right flow of glowing ribbons
   with blinking data-dots riding along them.
   ------------------------------------------------------------
   Brief (his words): the flow should run from the far LEFT to the
   right, shimmer with thicker lines and blinking dots, never leave a
   dead gap on the left - an INFINITE stream, a touch faster.

   How it works:
     • a smooth field points +x (left→right) with a vertical wobble,
       so streams read as wavy data ribbons;
     • particles enter at the left edge, advect right, leave FADING
       trails (the glowing lines); when they exit right they re-enter
       left → continuous, gap-free flow across the whole width;
     • a brightness wave sweeps left→right and wraps, lighting ribbons
       in sequence (the shimmer);
     • bright "packet" dots ride a subset of ribbons and blink, for the
       мигающие точки.

   Readability: the flow now spans the FULL width, so the headline is
   protected by a soft dark scrim painted on the LEFT of the buffer
   (kept behind the copy via z-index) rather than by hiding the flow.

   Trails live in an offscreen buffer faded with 'destination-out' so
   they decay to transparent and the hero gradient shows through.

   Cost fence: canvas is hero-only; IntersectionObserver stops the loop
   when the hero scrolls off; prefers-reduced-motion paints one frame.
   ============================================================ */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COOL = [70, 120, 100];   // resting ribbon colour
  const HOT  = [166, 230, 200];  // lit ribbon / packet colour

  let dpr = 1, W = 0, H = 0;
  let buf = null, bctx = null;
  let parts = [];
  let t0 = 0;

  // +x flow with vertical wobble → wavy left→right ribbons.
  function angle(x, y, t) {
    const nx = x / W, ny = y / H;
    return (
      Math.sin(ny * 5.0 + nx * 2.0 - t * 0.55) * 0.26 +
      Math.sin(ny * 2.3 - t * 0.34) * 0.16
    );
  }

  // Gentle left→right brightness ramp so the right reads a touch hotter,
  // but the LEFT is NOT killed - the stream is visible edge to edge.
  function weight(x) {
    return 0.55 + 0.45 * Math.min(1, x / W);
  }

  let seed = 24;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  function spawn(p, initial) {
    p.x = initial ? rnd() * W : -20 - rnd() * 30;   // enter from the left
    p.y = rnd() * H;
    p.life = 240 + rnd() * 300;
    p.age = 0;
    p.packet = rnd() < 0.28;                         // some ribbons carry a blinking dot
    p.blink = rnd() * 6.28;
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

    seed = 24;
    const count = Math.round(Math.min(420, (W * H) / 3200));
    parts = [];
    for (let i = 0; i < count; i++) {
      const p = spawn({}, true);
      p.age = rnd() * p.life;
      parts.push(p);
    }
  }

  function step(t, dt) {
    // 1. fade trails toward transparent (~1.4s half-life → long ribbons)
    bctx.save();
    bctx.setTransform(1, 0, 0, 1, 0, 0);
    bctx.globalCompositeOperation = 'destination-out';
    bctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.5, dt / 1.4)})`;
    bctx.fillRect(0, 0, buf.width, buf.height);
    bctx.restore();

    // 2. advect + draw
    bctx.globalCompositeOperation = 'source-over';
    const speed = 92;                                    // px/s - a touch faster
    const wavePos = ((t * 0.13) % 1.3) - 0.15;           // L→R sweep, wraps
    for (const p of parts) {
      const a = angle(p.x, p.y, t);
      const vx = Math.cos(a), vy = Math.sin(a);
      const nxs = p.x + vx * speed * dt;
      const nys = p.y + vy * speed * dt;

      const w = weight(p.x);
      const band = 1 - Math.min(1, Math.abs((p.x / W) - wavePos) / 0.18);
      const hot = Math.max(0, band) ** 1.4;              // 0 dim .. 1 lit by wave
      const cr = COOL[0] + (HOT[0] - COOL[0]) * hot;
      const cg = COOL[1] + (HOT[1] - COOL[1]) * hot;
      const cb = COOL[2] + (HOT[2] - COOL[2]) * hot;

      // ribbon segment - thicker + brighter than before
      const alpha = w * (0.30 + 0.55 * hot);
      bctx.strokeStyle = `rgba(${cr|0},${cg|0},${cb|0},${alpha})`;
      bctx.lineWidth = 1.4 + 1.8 * hot;
      bctx.beginPath();
      bctx.moveTo(p.x, p.y);
      bctx.lineTo(nxs, nys);
      bctx.stroke();

      // blinking packet dot on some ribbons
      if (p.packet) {
        const blink = 0.5 + 0.5 * Math.sin(t * 5.5 + p.blink);   // fast blink
        const da = w * (0.25 + 0.7 * blink) * (0.5 + 0.5 * hot);
        bctx.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${da})`;
        bctx.beginPath();
        bctx.arc(nxs, nys, 1.6 + 1.7 * blink, 0, 6.283);
        bctx.fill();
      }

      p.x = nxs; p.y = nys; p.age += 1;
      if (p.age > p.life || p.x > W + 12 || p.y < -14 || p.y > H + 14) spawn(p);
    }

    // 3. blit buffer, then a soft dark scrim on the LEFT so the headline
    //    stays readable over the now full-width flow.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(buf, 0, 0);
    const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
    g.addColorStop(0, 'rgba(18,20,22,0.72)');
    g.addColorStop(0.42, 'rgba(18,20,22,0.30)');
    g.addColorStop(0.62, 'rgba(18,20,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  if (reduce) { for (let i = 0; i < 120; i++) step(i * 0.05, 0.05); return; }

  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { t0 = 0; build(); if (!running) { for (let i = 0; i < 80; i++) step(i * 0.05, 0.05); } }, 150);
  }, { passive: true });
})();
