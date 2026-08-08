/* ============================================================
   Hero neural brain — nodes arranged in a brain silhouette with
   signals firing along the connections.
   ------------------------------------------------------------
   Brief (his words): dots forming an AI brain, not a flat grid,
   and not too slow. So:
     • nodes are sampled INSIDE a brain-shaped region (lumpy top +
       cerebellum), so the point cloud reads as a brain, not a mesh;
     • thin edges link near neighbours (the "synapses");
     • bright pulses travel edge→edge continuously and light up each
       node they reach - visible neural activity, ~0.4-0.6s per hop;
     • sits on the RIGHT of the hero, clear of the headline on the left.

   Cost fence (this is the page's one ambient loop): canvas is
   hero-only; an IntersectionObserver stops the rAF loop when the hero
   leaves the viewport; prefers-reduced-motion paints one static frame.
   ============================================================ */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const DIM = [86, 132, 112];    // resting node / edge colour
  const HOT = [150, 214, 186];   // firing colour (accent tint)

  let dpr = 1, W = 0, H = 0;
  let nodes = [], edges = [], pulses = [];

  // Brain region test in local coords u,v ∈ ~[-1.2,1.2]. Union of a body
  // ellipse, a row of top bumps (gyri) and a cerebellum lobe low-back.
  const BUMPS = [
    [-0.62, -0.52, 0.34], [-0.22, -0.62, 0.36], [0.22, -0.60, 0.36],
    [0.60, -0.50, 0.34], [0.86, -0.28, 0.28],          // top gyri, front→back
    [-0.80, 0.52, 0.34],                                // cerebellum
  ];
  function inBrain(u, v) {
    if ((u * u) / 1.02 + (v * v) / 0.70 <= 1) return true;   // main body
    for (const [bx, by, br] of BUMPS) {
      const dx = u - bx, dy = v - by;
      if (dx * dx + dy * dy <= br * br) return true;
    }
    return false;
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

    // Brain box, anchored to the right half.
    const boxH = Math.min(H * 0.74, W * 0.52);
    const boxW = boxH * 1.12;
    const cx = Math.min(W * 0.72, W - boxW * 0.46);
    const cy = H * 0.5;
    const toX = u => cx + u * boxW * 0.5;
    const toY = v => cy + v * boxH * 0.5;

    // Sample nodes on a jittered grid, keep those inside the brain.
    nodes = [];
    const step = 0.115;
    const jit = step * 0.42;
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let u = -1.15; u <= 1.15; u += step) {
      for (let v = -1.05; v <= 1.05; v += step) {
        const ju = u + (rnd() - 0.5) * jit;
        const jv = v + (rnd() - 0.5) * jit;
        if (!inBrain(ju, jv)) continue;
        nodes.push({ x: toX(ju), y: toY(jv), glow: 0 });
      }
    }

    // Edges: connect near neighbours (local-space threshold → px).
    edges = [];
    const near = (boxW * 0.5) * step * 1.85;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        if (dx * dx + dy * dy <= near * near) {
          edges.push([i, j]);
          (nodes[i].e || (nodes[i].e = [])).push(edges.length - 1);
          (nodes[j].e || (nodes[j].e = [])).push(edges.length - 1);
        }
      }
    }

    pulses = [];
  }

  // Spawn a pulse on a random edge, travelling from one end to the other.
  let rndSeed = 91;
  const rand = () => { rndSeed = (rndSeed * 1103515245 + 12345) & 0x7fffffff; return rndSeed / 0x7fffffff; };
  function spawn() {
    if (!edges.length) return;
    const ei = (rand() * edges.length) | 0;
    const [a, b] = edges[ei];
    const from = rand() < 0.5 ? a : b;
    const to = from === a ? b : a;
    pulses.push({ from, to, t: 0, spd: 1.6 + rand() * 1.2 });   // spd → ~0.4-0.6s/hop
  }

  function paint(now, dt) {
    ctx.clearRect(0, 0, W, H);

    // edges
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${DIM[0]},${DIM[1]},${DIM[2]},0.16)`;
    ctx.beginPath();
    for (const [a, b] of edges) {
      ctx.moveTo(nodes[a].x, nodes[a].y);
      ctx.lineTo(nodes[b].x, nodes[b].y);
    }
    ctx.stroke();

    // advance pulses
    for (let p = pulses.length - 1; p >= 0; p--) {
      const pl = pulses[p];
      pl.t += pl.spd * dt;
      const A = nodes[pl.from], B = nodes[pl.to];
      if (pl.t >= 1) {
        B.glow = 1;                                     // node fires on arrival
        // chain onward with high probability, so signals travel
        if (B.e && B.e.length && rand() < 0.82) {
          const ne = B.e[(rand() * B.e.length) | 0];
          const [ea, eb] = edges[ne];
          const nxt = ea === pl.to ? eb : ea;
          pulses[p] = { from: pl.to, to: nxt, t: pl.t - 1, spd: pl.spd };
        } else {
          pulses.splice(p, 1);
        }
        continue;
      }
      const x = A.x + (B.x - A.x) * pl.t;
      const y = A.y + (B.y - A.y) * pl.t;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},0.9)`;
      ctx.arc(x, y, 1.7, 0, 6.283);
      ctx.fill();
    }

    // nodes (base + decaying glow)
    for (const n of nodes) {
      if (n.glow > 0) n.glow = Math.max(0, n.glow - dt * 1.6);
      const g = n.glow;
      const cr = DIM[0] + (HOT[0] - DIM[0]) * g;
      const cg = DIM[1] + (HOT[1] - DIM[1]) * g;
      const cb = DIM[2] + (HOT[2] - DIM[2]) * g;
      const a = 0.4 + 0.55 * g;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${a})`;
      ctx.arc(n.x, n.y, 1.5 + 1.6 * g, 0, 6.283);
      ctx.fill();
    }
  }

  let raf = 0, running = false, last = 0, acc = 0;
  const TARGET = edges.length ? Math.max(8, Math.round(edges.length * 0.06)) : 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    // keep a steady population of live signals
    acc += dt;
    while (pulses.length < TARGET && acc > 0.03) { spawn(); acc -= 0.03; }
    if (rand() < dt * 6) spawn();
    paint(now, dt);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  build();
  if (reduce) { paint(0, 0); return; }                  // static frame, no loop

  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { build(); if (!running) paint(performance.now(), 0); }, 150);
  }, { passive: true });
})();
