/* ============================================================
   Hero AI chip — a processor die on the right with circuit traces
   routing outward and lit data-dots gliding along them.
   ------------------------------------------------------------
   Brief (his words): an AI-powered chip with many links coming out
   of it and lit dots moving - and slower than the brain version.

   Design that makes it read as a CHIP, not a mesh:
     • a rounded die package with pin rows on all four sides and an
       inner core marked "AI";
     • traces leave the pins and route in right angles (Manhattan /
       PCB style) to pads scattered across the right half;
     • one dot per trace glides chip→pad at a calm speed (~70 px/s,
       a full trace takes several seconds), lighting the pad on arrival.
     • the whole thing sits on the RIGHT, clear of the headline.

   Cost fence (page's one ambient loop): canvas is hero-only; an
   IntersectionObserver stops the rAF loop when the hero scrolls off;
   prefers-reduced-motion paints a single static frame.
   ============================================================ */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DIM = [86, 132, 112];    // resting trace / outline colour
  const HOT = [150, 214, 186];   // lit dot / firing pad colour

  let dpr = 1, W = 0, H = 0;
  let chip = null, traces = [], seed = 13;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // cumulative-length helper for a polyline
  function measure(pts) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      const L = Math.hypot(dx, dy);
      seg.push(L); total += L;
    }
    return { seg, total };
  }
  // point at distance d along a measured polyline
  function at(pts, seg, d) {
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const t = seg[i] ? d / seg[i] : 0;
        return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
                 y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
      }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  }

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 13;

    // Chip: sized to the hero, anchored to the RIGHT so the die clears the
    // headline on the left. Smaller than a naive fit - it is decor, not the
    // subject; the type is.
    const s = Math.max(78, Math.min(H * 0.19, W * 0.115));  // half-size
    const cx = W - s - Math.max(48, W * 0.05);              // hug the right edge
    const cy = H * 0.5;
    chip = { cx, cy, s };

    // Left edge past which nothing may draw, so traces never reach the type.
    // Kept in the right ~40% of the hero, well clear of the copy column.
    const LEFT = Math.max(W * 0.6, cx - s - 150);
    const clampX = x => Math.max(LEFT, Math.min(W - 6, x));
    const clampY = y => Math.max(6, Math.min(H - 6, y));

    // Build pins around the perimeter and a Manhattan trace from each.
    traces = [];
    const perSide = 6;
    const sides = [
      { nx: 1, ny: 0 },   // right
      { nx: -1, ny: 0 },  // left
      { nx: 0, ny: -1 },  // top
      { nx: 0, ny: 1 },   // bottom
    ];
    for (const { nx, ny } of sides) {
      for (let k = 0; k < perSide; k++) {
        const f = (k + 1) / (perSide + 1);          // 0..1 along the side
        // pin position on that edge
        let px, py;
        if (nx !== 0) { px = cx + nx * s; py = cy - s + f * 2 * s; }
        else          { py = cy + ny * s; px = cx - s + f * 2 * s; }
        const pin = { x: px, y: py };
        const stub = { x: px + nx * (18 + rnd() * 20), y: py + ny * (18 + rnd() * 20) };

        // endpoint out in the pin's general direction. Left-facing pins get
        // a shorter reach so nothing crawls toward the headline column.
        const reach = (nx < 0 ? 60 + rnd() * 90 : 90 + rnd() * 210);
        const lateral = (rnd() - 0.5) * 220;
        let ex, ey;
        if (nx !== 0) { ex = stub.x + nx * reach; ey = stub.y + lateral; }
        else          { ey = stub.y + ny * reach; ex = stub.x + lateral; }
        ex = clampX(ex); ey = clampY(ey);

        // Manhattan route: stub, then jog on the cross axis, then in to pad.
        let pts;
        if (nx !== 0) pts = [pin, stub, { x: stub.x, y: ey }, { x: ex, y: ey }];
        else          pts = [pin, stub, { x: ex, y: stub.y }, { x: ex, y: ey }];

        const m = measure(pts);
        traces.push({
          pts, seg: m.seg, total: m.total, pad: { x: ex, y: ey, glow: 0 },
          d: rnd() * m.total,                        // staggered start
          spd: 62 + rnd() * 46,                      // px/s, calm
          gap: 0,
        });
      }
    }
  }

  function drawChip() {
    const { cx, cy, s } = chip;
    ctx.save();
    // pins (short ticks) already implied by trace stubs; draw package + core.
    // package
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(${DIM[0]},${DIM[1]},${DIM[2]},0.55)`;
    ctx.fillStyle = 'rgba(20,26,24,0.35)';
    const r = 10;
    ctx.beginPath();
    ctx.moveTo(cx - s + r, cy - s);
    ctx.arcTo(cx + s, cy - s, cx + s, cy + s, r);
    ctx.arcTo(cx + s, cy + s, cx - s, cy + s, r);
    ctx.arcTo(cx - s, cy + s, cx - s, cy - s, r);
    ctx.arcTo(cx - s, cy - s, cx + s, cy - s, r);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // inner die
    const d = s * 0.52;
    ctx.strokeStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},0.5)`;
    ctx.strokeRect(cx - d, cy - d, d * 2, d * 2);
    // core label
    ctx.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},0.85)`;
    ctx.font = `600 ${Math.round(s * 0.42)}px Manrope, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('AI', cx, cy + s * 0.02);
    ctx.restore();
  }

  function paint(dt) {
    ctx.clearRect(0, 0, W, H);

    // traces
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${DIM[0]},${DIM[1]},${DIM[2]},0.20)`;
    ctx.beginPath();
    for (const t of traces) {
      ctx.moveTo(t.pts[0].x, t.pts[0].y);
      for (let i = 1; i < t.pts.length; i++) ctx.lineTo(t.pts[i].x, t.pts[i].y);
    }
    ctx.stroke();

    // pads (with decaying glow)
    for (const t of traces) {
      const p = t.pad;
      if (p.glow > 0) p.glow = Math.max(0, p.glow - dt * 1.1);
      const g = p.glow;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${(DIM[0] + (HOT[0]-DIM[0])*g)|0},${(DIM[1]+(HOT[1]-DIM[1])*g)|0},${(DIM[2]+(HOT[2]-DIM[2])*g)|0},${0.35 + 0.5*g})`;
      ctx.arc(p.x, p.y, 1.6 + 1.8 * g, 0, 6.283);
      ctx.fill();
    }

    drawChip();

    // moving dots
    for (const t of traces) {
      if (t.gap > 0) { t.gap -= dt; continue; }
      t.d += t.spd * dt;
      if (t.d >= t.total) { t.pad.glow = 1; t.d = 0; t.gap = 0.4 + (t.total ? 0 : 0); continue; }
      const pt = at(t.pts, t.seg, t.d);
      // comet: bright head + short faint tail toward the pad
      ctx.beginPath();
      ctx.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},0.95)`;
      ctx.arc(pt.x, pt.y, 1.9, 0, 6.283);
      ctx.fill();
      const tp = at(t.pts, t.seg, Math.max(0, t.d - 10));
      ctx.strokeStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},0.35)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tp.x, tp.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    }
  }

  let raf = 0, running = false, last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    paint(dt);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  build();
  if (reduce) { paint(0); return; }                  // static frame, no loop

  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { build(); if (!running) paint(0); }, 150);
  }, { passive: true });
})();
