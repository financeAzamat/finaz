/* ============================================================
   Hero 3D neural network — a rotating node cloud with links and
   signals firing along them. Confined to the RIGHT of the hero.
   ------------------------------------------------------------
   Brief (his words): the trailing flow polluted the page; make it a
   NARROW visual (not full width) and more like a 3D neural-links
   animation.

   So this is a clean, redraw-every-frame scene (NO trail buffer, no
   accumulation - the canvas is cleared each frame, nothing smears):
     • ~70 nodes placed in a 3D sphere, slowly rotating around Y (and a
       touch around X) so the network has real depth;
     • perspective projection → near nodes larger/brighter, far nodes
       small/dim (the 3D read);
     • edges link near neighbours in 3D; their opacity follows depth;
     • signals ride edges and light the node they arrive at, then hop on
       - visible neural activity;
     • the whole cloud is parked on the RIGHT and radially masked, so it
       is a contained object, not a full-bleed background. The headline
       on the left is never touched.

   Cost fence: canvas is hero-only; IntersectionObserver stops the loop
   off-screen; prefers-reduced-motion paints one static frame.
   ============================================================ */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('hero-dots');
  if (!hero || !canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COOL = [96, 150, 128];    // resting node/edge
  const HOT  = [176, 236, 208];   // firing

  let dpr = 1, W = 0, H = 0;
  let nodes = [], edges = [], signals = [];
  let cx = 0, cy = 0, R = 0;      // cloud centre + radius on screen

  let seed = 30;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  function build() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Cloud sits on the right; radius scales with hero but stays contained.
    // Pushed further right and slightly smaller so it clears the headline
    // (its right edge ends near "результат") and reads as its own object.
    R = Math.max(132, Math.min(H * 0.38, W * 0.21));
    cx = W - R - Math.max(16, W * 0.02);
    cy = H * 0.5;

    seed = 30;
    // Nodes on a jittered sphere (Fibonacci-ish) for even 3D spread.
    const N = 66;
    nodes = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;              // -1..1
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = i * 2.399963;                       // golden angle
      const jitter = 0.86 + rnd() * 0.14;
      nodes.push({
        x: Math.cos(th) * r * jitter,
        y: y * jitter,
        z: Math.sin(th) * r * jitter,
        glow: 0,
      });
    }

    // Edges: nearest neighbours in 3D (cap per node so it stays legible).
    edges = [];
    for (let i = 0; i < N; i++) {
      const d = [];
      for (let j = 0; j < N; j++) if (j !== i) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dz = nodes[i].z - nodes[j].z;
        d.push([dx * dx + dy * dy + dz * dz, j]);
      }
      d.sort((a, b) => a[0] - b[0]);
      const k = 3;
      for (let m = 0; m < k; m++) {
        const j = d[m][1];
        if (i < j) { edges.push([i, j]); (nodes[i].e ||= []).push(edges.length - 1); (nodes[j].e ||= []).push(edges.length - 1); }
        else {
          // ensure the reverse pair is registered if not already added
          if (!edges.some(([a, b]) => (a === j && b === i))) {
            edges.push([j, i]); (nodes[i].e ||= []).push(edges.length - 1); (nodes[j].e ||= []).push(edges.length - 1);
          }
        }
      }
    }

    signals = [];
  }

  function spawnSignal() {
    if (!edges.length) return;
    const ei = (rnd() * edges.length) | 0;
    const [a, b] = edges[ei];
    const from = rnd() < 0.5 ? a : b;
    signals.push({ from, to: from === a ? b : a, t: 0, spd: 0.5 + rnd() * 0.5 });
  }

  // rotate a node by yaw/pitch, project to screen. Returns {sx,sy,scale,depth}.
  function project(n, yaw, pitch) {
    // yaw around Y
    let x = n.x * Math.cos(yaw) + n.z * Math.sin(yaw);
    let z = -n.x * Math.sin(yaw) + n.z * Math.cos(yaw);
    let y = n.y;
    // pitch around X
    let y2 = y * Math.cos(pitch) - z * Math.sin(pitch);
    let z2 = y * Math.sin(pitch) + z * Math.cos(pitch);
    const persp = 2.6 / (2.6 - z2);                  // z2 in ~[-1,1]; near→larger
    return { sx: cx + x * R * persp, sy: cy + y2 * R * persp, scale: persp, depth: z2 };
  }

  let t0 = 0;
  function frame(t, dt) {
    ctx.clearRect(0, 0, W, H);                        // CLEAN redraw - no trails

    const yaw = t * 0.16;                             // slow spin
    const pitch = Math.sin(t * 0.12) * 0.28;

    // project all
    const P = nodes.map(n => project(n, yaw, pitch));

    // edges (draw back-to-front-ish via depth-based alpha)
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      const pa = P[a], pb = P[b];
      const dep = (pa.depth + pb.depth) / 2;          // -1 far .. 1 near
      const near = (dep + 1) / 2;                      // 0..1
      const alpha = 0.05 + 0.22 * near;
      ctx.strokeStyle = `rgba(${COOL[0]},${COOL[1]},${COOL[2]},${alpha})`;
      ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke();
    }

    // signals
    for (let s = signals.length - 1; s >= 0; s--) {
      const sig = signals[s];
      sig.t += sig.spd * dt;
      const A = P[sig.from], B = P[sig.to];
      if (sig.t >= 1) {
        nodes[sig.to].glow = 1;
        if (nodes[sig.to].e && rnd() < 0.8) {
          const ne = nodes[sig.to].e[(rnd() * nodes[sig.to].e.length) | 0];
          const [ea, eb] = edges[ne];
          signals[s] = { from: sig.to, to: ea === sig.to ? eb : ea, t: sig.t - 1, spd: sig.spd };
        } else signals.splice(s, 1);
        continue;
      }
      const x = A.sx + (B.sx - A.sx) * sig.t;
      const y = A.sy + (B.sy - A.sy) * sig.t;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},0.95)`;
      ctx.arc(x, y, 2.1, 0, 6.283);
      ctx.fill();
    }

    // nodes, sorted far→near so near ones paint on top
    const order = P.map((p, i) => i).sort((i, j) => P[i].depth - P[j].depth);
    for (const i of order) {
      const p = P[i], n = nodes[i];
      if (n.glow > 0) n.glow = Math.max(0, n.glow - dt * 1.5);
      const near = (p.depth + 1) / 2;                  // 0..1
      const g = n.glow;
      const cr = COOL[0] + (HOT[0] - COOL[0]) * g;
      const cg = COOL[1] + (HOT[1] - COOL[1]) * g;
      const cb = COOL[2] + (HOT[2] - COOL[2]) * g;
      const alpha = (0.3 + 0.5 * near) * (0.7 + 0.3 * g);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${cr|0},${cg|0},${cb|0},${alpha})`;
      ctx.arc(p.sx, p.sy, (1.3 + 1.7 * near) + 1.6 * g, 0, 6.283);
      ctx.fill();
    }
  }

  let raf = 0, running = false, last = 0, acc = 0;
  const TARGET = 7;
  function loop(now) {
    if (!t0) t0 = now;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    acc += dt;
    while (signals.length < TARGET && acc > 0.15) { spawnSignal(); acc -= 0.15; }
    frame(t, dt);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { running = false; cancelAnimationFrame(raf); }

  build();
  if (reduce) { for (let i = 0; i < 4; i++) spawnSignal(); frame(0.4, 0.016); return; }

  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => { t0 = 0; build(); if (!running) frame(0.4, 0.016); }, 150);
  }, { passive: true });
})();
