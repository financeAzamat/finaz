/* ============================================================
   Hero 3D morphing lattice — dots assemble into a globe, then the
   form deforms through a cube, a torus and a helix. Confined to the
   RIGHT of the hero, clean redraw (no trails).
   ------------------------------------------------------------
   Brief (his words): keep the 3D neural-links look; START with dots
   forming the globe / Earth, then deform into the other shapes; every
   shape must be geometrically correct / proportional.

   How it works:
     • ONE point set (a 4×4×4 lattice, 64 nodes) is reused for every
       shape, so nodes keep identity and the morph reads as the same
       object deforming rather than a crossfade between two clouds;
     • shapes are generated analytically, isotropically scaled, so a
       cube is a true cube and the torus/sphere keep their ratios.
       The projection scales x and y by the same R, so nothing is
       stretched on wide screens either;
     • the edge set is the lattice adjacency. Globe, cube and torus each
       map two of the three lattice directions onto their own grid lines,
       so each holds a clean wireframe. An edge FADES OUT as it is
       stretched past E_FAR, which is what keeps the mesh legible where a
       shape's topology no longer fits the lattice - no tangle;
     • signals ride edges and light the node they arrive at, inheriting
       that edge's visibility so nothing floats in empty space;
     • intro: nodes fly in from a scattered shell and settle into the
       globe while the whole scene fades up.

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

  const G = 4, N = G * G * G;     // 4×4×4 lattice = 64 nodes
  const INTRO = 2.2;              // s - dots assembling into the globe
  const HOLD = 3.4, MORPH = 1.9;  // s - each shape is held, then deforms
  const STAGE = HOLD + MORPH;

  // An edge is fully drawn up to E_NEAR and gone past E_FAR (units are
  // the normalised model space, so this is rotation-independent).
  const E_NEAR = 0.55, E_FAR = 1.15;

  let dpr = 1, W = 0, H = 0;
  let cx = 0, cy = 0, R = 0;      // cloud centre + radius on screen

  let seed = 30;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const pos = new Float32Array(N * 3);   // current (morphed) positions
  const glow = new Float32Array(N);
  let shapes = [], scatter = null, edges = [], nodeEdges = [], signals = [];

  const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

  function buildGeometry() {
    seed = 30;
    const glb  = new Float32Array(N * 3);
    const cube = new Float32Array(N * 3);
    const tor  = new Float32Array(N * 3);
    const hel  = new Float32Array(N * 3);
    scatter    = new Float32Array(N * 3);

    const s = 0.60;                       // cube half-extent → corners at ~1.04

    for (let i = 0; i < N; i++) {
      const a = i % G, b = ((i / G) | 0) % G, c = ((i / (G * G)) | 0) % G;

      // --- cube: evenly spaced lattice, equal extent on all three axes
      const x = (a / (G - 1)) * 2 - 1;
      const y = (b / (G - 1)) * 2 - 1;
      const z = (c / (G - 1)) * 2 - 1;
      cube[i * 3] = x * s; cube[i * 3 + 1] = y * s; cube[i * 3 + 2] = z * s;

      // --- globe: a lat/lon grid on one true sphere - the opening shape.
      // lon = a + 4c (16 meridians), lat = b (4 parallels). So i→i+1 walks
      // a meridian and i→i+G walks a parallel: both lattice directions are
      // real grid lines, which is what makes it read as a wireframe Earth
      // rather than a point cloud. Only the i→i+G² edges stretch and fade.
      const lon = ((a + G * c) / (G * G)) * 6.283185;
      const lat = ((b / (G - 1)) * 2 - 1) * 0.95;           // ±54°
      const rg = 0.95, cl = Math.cos(lat);
      glb[i * 3] = rg * cl * Math.cos(lon);
      glb[i * 3 + 1] = rg * Math.sin(lat);
      glb[i * 3 + 2] = rg * cl * Math.sin(lon);

      // --- torus: (θ, φ) taken FROM the lattice coords so the wireframe
      // survives - θ = a + 4c (16 steps around the ring), φ = b (4 steps
      // around the tube). So the i→i+1 and i→i+G edges are exactly the two
      // torus grid directions; only the i→i+G² edges stretch and fade.
      // ring 0.64 / tube 0.32 → max extent 0.96, true proportions.
      const th = ((a + G * c) / (G * G)) * 6.283185;
      const ph = (b / G) * 6.283185;
      const ring = 0.64 + 0.32 * Math.cos(ph);
      tor[i * 3] = ring * Math.cos(th);
      tor[i * 3 + 1] = 0.32 * Math.sin(ph);
      tor[i * 3 + 2] = ring * Math.sin(th);

      // --- helix: 3 turns, constant radius, constant pitch
      const p = i / (N - 1);
      const ang = p * 6 * 3.141593;
      hel[i * 3] = 0.50 * Math.cos(ang);
      hel[i * 3 + 1] = (p - 0.5) * 1.70;
      hel[i * 3 + 2] = 0.50 * Math.sin(ang);

      // --- scatter: the pre-assembly shell the dots fly in from
      const sr = 1.6 + rnd() * 0.8;
      const sy = rnd() * 2 - 1, sp = Math.sqrt(Math.max(0, 1 - sy * sy)), sa = rnd() * 6.283185;
      scatter[i * 3] = Math.cos(sa) * sp * sr;
      scatter[i * 3 + 1] = sy * sr;
      scatter[i * 3 + 2] = Math.sin(sa) * sp * sr;
    }

    // Order: globe (Earth) first, then cube, torus, helix, and back round.
    shapes = [glb, cube, tor, hel];

    // Edges = lattice adjacency: the wireframe cube at rest.
    edges = [];
    nodeEdges = Array.from({ length: N }, () => []);
    const add = (i, j) => { edges.push([i, j]); nodeEdges[i].push(edges.length - 1); nodeEdges[j].push(edges.length - 1); };
    for (let i = 0; i < N; i++) {
      const a = i % G, b = ((i / G) | 0) % G, c = ((i / (G * G)) | 0) % G;
      if (a < G - 1) add(i, i + 1);
      if (b < G - 1) add(i, i + G);
      if (c < G - 1) add(i, i + G * G);
      // Seam edges. The globe's longitude index is a+4c, so the lattice
      // "a" runs break every 4 nodes; these stitch a=3 of one c-slab to
      // a=0 of the next, giving continuous meridians (and a continuous
      // torus ring). In the cube they span a whole face diagonal, so the
      // length fade hides them there - the wireframe cube stays clean.
      // (a=G-1, b, c) → (a=0, b, c+1), i.e. i - (G-1) + G²
      if (a === G - 1 && c < G - 1) add(i, i + G * G - (G - 1));
    }

    pos.set(shapes[0]);
    signals = [];
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Contained object on the right, sized so it always CLEARS the copy.
    // Every shape is normalised to a max model radius of ~1, and
    // perspective can push a near point out to ~1×R on screen, so the
    // footprint is 2R wide. Fit that into the band right of the headline
    // (the copy column runs to ~0.685W on desktop) rather than anchoring
    // by R alone, which let the cube's near face reach into the type.
    const pad = Math.max(20, W * 0.015);
    const band = W - pad - W * 0.685;
    R = Math.max(110, Math.min(band / 2, H * 0.4));
    cx = W - pad - R;
    cy = H * 0.5;
  }

  function lerpInto(A, B, k) {
    for (let j = 0; j < N * 3; j++) pos[j] = A[j] + (B[j] - A[j]) * k;
  }

  function spawnSignal() {
    if (!edges.length) return;
    const ei = (rnd() * edges.length) | 0;
    const [a, b] = edges[ei];
    const from = rnd() < 0.5 ? a : b;
    signals.push({ e: ei, from, to: from === a ? b : a, t: 0, spd: 0.5 + rnd() * 0.5 });
  }

  // rotate by yaw/pitch, project to screen
  function project(i, cy_, sy_, cp, sp) {
    const x0 = pos[i * 3], y0 = pos[i * 3 + 1], z0 = pos[i * 3 + 2];
    const x = x0 * cy_ + z0 * sy_;
    const z = -x0 * sy_ + z0 * cy_;
    const y2 = y0 * cp - z * sp;
    const z2 = y0 * sp + z * cp;
    const persp = 2.6 / (2.6 - z2);
    return { sx: cx + x * R * persp, sy: cy + y2 * R * persp, depth: z2 };
  }

  const P = Array.from({ length: N }, () => ({ sx: 0, sy: 0, depth: 0 }));
  const order = Array.from({ length: N }, (_, i) => i);
  const eVis = new Float32Array(0);
  let edgeVis = null;

  function frame(t, dt) {
    ctx.clearRect(0, 0, W, H);

    // --- geometry: assemble into the globe, then deform shape to shape
    let fade = 1;
    if (t < INTRO) {
      const k = ease(t / INTRO);
      fade = k;
      lerpInto(scatter, shapes[0], k);
    } else {
      const u = (t - INTRO) / STAGE;
      const i = Math.floor(u) % shapes.length;
      const f = u - Math.floor(u);
      const m = (f * STAGE - HOLD) / MORPH;       // 0 while held, 0→1 while morphing
      lerpInto(shapes[i], shapes[(i + 1) % shapes.length], ease(m));
    }

    // --- rotation
    const yaw = t * 0.16, pitch = Math.sin(t * 0.12) * 0.28;
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let i = 0; i < N; i++) {
      const p = project(i, cyw, syw, cp, sp);
      P[i].sx = p.sx; P[i].sy = p.sy; P[i].depth = p.depth;
    }

    // --- edges: fade out as the morph stretches them past E_FAR
    if (!edgeVis || edgeVis.length !== edges.length) edgeVis = new Float32Array(edges.length);
    ctx.lineWidth = 1;
    for (let k = 0; k < edges.length; k++) {
      const [a, b] = edges[k];
      const dx = pos[a * 3] - pos[b * 3];
      const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
      const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const vis = clamp01(1 - (len - E_NEAR) / (E_FAR - E_NEAR));
      edgeVis[k] = vis;
      if (vis <= 0.01) continue;
      const pa = P[a], pb = P[b];
      const near = ((pa.depth + pb.depth) / 2 + 1) / 2;
      const alpha = (0.06 + 0.24 * near) * vis * fade;
      ctx.strokeStyle = `rgba(${COOL[0]},${COOL[1]},${COOL[2]},${alpha})`;
      ctx.beginPath(); ctx.moveTo(pa.sx, pa.sy); ctx.lineTo(pb.sx, pb.sy); ctx.stroke();
    }

    // --- signals
    for (let s = signals.length - 1; s >= 0; s--) {
      const sig = signals[s];
      sig.t += sig.spd * dt;
      const A = P[sig.from], B = P[sig.to];
      if (sig.t >= 1) {
        glow[sig.to] = 1;
        const nb = nodeEdges[sig.to];
        if (nb.length && rnd() < 0.85) {
          const ne = nb[(rnd() * nb.length) | 0];
          const [ea, eb] = edges[ne];
          signals[s] = { e: ne, from: sig.to, to: ea === sig.to ? eb : ea, t: sig.t - 1, spd: sig.spd };
        } else signals.splice(s, 1);
        continue;
      }
      const vis = edgeVis[sig.e] ?? 1;
      if (vis <= 0.05) continue;                    // ride a stretched edge invisibly
      const x = A.sx + (B.sx - A.sx) * sig.t;
      const y = A.sy + (B.sy - A.sy) * sig.t;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${HOT[0]},${HOT[1]},${HOT[2]},${0.95 * vis * fade})`;
      ctx.arc(x, y, 2.1, 0, 6.283);
      ctx.fill();
    }

    // --- nodes, far→near so the near ones paint on top
    order.sort((i, j) => P[i].depth - P[j].depth);
    for (const i of order) {
      const p = P[i];
      if (glow[i] > 0) glow[i] = Math.max(0, glow[i] - dt * 1.5);
      const near = (p.depth + 1) / 2;
      const g = glow[i];
      const cr = COOL[0] + (HOT[0] - COOL[0]) * g;
      const cg = COOL[1] + (HOT[1] - COOL[1]) * g;
      const cb = COOL[2] + (HOT[2] - COOL[2]) * g;
      const alpha = (0.3 + 0.5 * near) * (0.7 + 0.3 * g) * fade;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${cr | 0},${cg | 0},${cb | 0},${alpha})`;
      ctx.arc(p.sx, p.sy, (1.3 + 1.7 * near) + 1.6 * g, 0, 6.283);
      ctx.fill();
    }
  }

  let raf = 0, running = false, last = 0, acc = 0, t0 = 0;
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

  buildGeometry();
  resize();
  // Static frame for reduced motion: the assembled globe, mid-rotation.
  if (reduce) { for (let i = 0; i < 4; i++) spawnSignal(); frame(INTRO + 0.4, 0.016); return; }

  new IntersectionObserver((es) => {
    for (const e of es) e.isIntersecting ? start() : stop();
  }, { threshold: 0 }).observe(hero);

  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    // Shapes are normalised, so only the screen mapping changes - the
    // animation keeps its clock instead of replaying the intro.
    rz = setTimeout(() => { resize(); if (!running) frame(INTRO + 0.4, 0.016); }, 150);
  }, { passive: true });
})();
