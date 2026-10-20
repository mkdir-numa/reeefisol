/* ReFi Hub staking: stipple graphics, round 2.
   Five animated expressions of the stipple style (round 1, style B), mixed with flow lines (style A):
     reef      Reef bloom      polyps and fronds over a halftone disc
     current   Current         dotted flow lines with warm pulses into the validator node
     plate     Specimen plate  nine polyps linked to the centre
     tide      Tide            a halftone field where coral shapes surface; the pointer sends ripples
     pollen    Pollen drift    polyps on the reef floor with one swoosh of golden pollen drifting above
   Every graphic reacts to the pointer and adds small sparkles. With prefers-reduced-motion
   each one draws a single still frame instead.
   Prototype: not linked from the site yet. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dot(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  function sq(ctx, x, y, r) { ctx.rect(x - r, y - r, r * 2, r * 2); }

  var PAL = {
    light: { line: '#155a63', soft: '#cfe6e2', warm: '#e4b04a', accent: '#e07a5f', deep: '#355e3d', glint: '#e39a2d' },
    dark: { line: '#cfe7e3', soft: 'rgba(207,231,227,.14)', warm: '#f2c460', accent: '#f0a58f', deep: '#9cc3bf', glint: '#ffe2a0' }
  };

  /* ---------- pointer helpers ---------- */

  // Moves a point away from the pointer. Result lands in PX, PY (no allocation per dot).
  var PX = 0, PY = 0;
  function push(x, y, m, rad, str) {
    PX = x; PY = y;
    if (m.on < 0.01) return;
    var dx = x - m.x, dy = y - m.y, d2 = dx * dx + dy * dy;
    if (d2 >= rad * rad || d2 < 0.0001) return;
    var d = Math.sqrt(d2), f = 1 - d / rad;
    f = f * f * str * m.on;
    PX = x + dx / d * f; PY = y + dy / d * f;
  }
  // 0..1: how close a point is to the pointer
  function near(x, y, m, rad) {
    if (m.on < 0.01) return 0;
    var dx = x - m.x, dy = y - m.y, d = Math.sqrt(dx * dx + dy * dy);
    return d < rad ? (1 - d / rad) * m.on : 0;
  }

  /* ---------- sparkles and motes ---------- */

  function Sparks() { this.a = []; }
  Sparks.prototype.add = function (x, y, big) {
    if (this.a.length > 140) return;
    var ang = Math.random() * TAU, sp = 0.15 + Math.random() * 0.45;
    this.a.push({ x: x, y: y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.25, life: 0, max: 0.7 + Math.random() * 0.9, s: (big ? 3.2 : 1.8) + Math.random() * 1.8 });
  };
  Sparks.prototype.draw = function (ctx, pal, dt) {
    var a = this.a, f = dt * 60;
    ctx.strokeStyle = pal.glint; ctx.fillStyle = pal.glint; ctx.lineWidth = 0.8;
    for (var i = a.length - 1; i >= 0; i--) {
      var p = a[i];
      p.life += dt;
      if (p.life >= p.max) { a.splice(i, 1); continue; }
      p.x += p.vx * f; p.y += p.vy * f; p.vx *= 0.98; p.vy *= 0.98;
      var k = Math.sin(Math.PI * p.life / p.max), s = p.s * k;
      ctx.globalAlpha = k;
      ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke();
      ctx.beginPath(); dot(ctx, p.x, p.y, 0.5 + 0.7 * k); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // Plankton: slow motes drifting upwards, twinkling.
  function makeMotes(n, w, h, R) {
    var p = [];
    for (var i = 0; i < n; i++) p.push({ x: R() * w, y: R() * h, v: 0.05 + R() * 0.15, ph: R() * TAU, r: 0.6 + R() * 0.9 });
    return { p: p, w: w, h: h };
  }
  function drawMotes(ctx, M, t, f, m, pal) {
    ctx.fillStyle = pal.line;
    for (var i = 0; i < M.p.length; i++) {
      var p = M.p[i];
      p.y -= p.v * f; if (p.y < -4) { p.y = M.h + 4; }
      push(p.x + Math.sin(t * 0.5 + p.ph) * 6, p.y, m, 90, 22);
      ctx.globalAlpha = 0.2 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.7 + p.ph * 3));
      ctx.beginPath(); dot(ctx, PX, PY, p.r); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- polyp ---------- */

  // Geometry is stored as angles and positions along each tentacle, so it can breathe and sway each frame.
  function makePolyp(cx, cy, r, tilt, ang, R, o) {
    o = o || {};
    var n = Math.max(20, Math.round(r * 0.8)), m = Math.max(4, Math.round(r / 4.2)), d = [], tr = [], mo = [];
    for (var i = 0; i < n; i++) { var th = i / n * TAU + R() * 0.05; for (var j = 0; j <= m; j++) d.push(th, j / m); }
    if (o.trumpet !== false) for (var c = 0, cn = Math.round(r * 2.4); c < cn; c++) { var u = Math.sqrt(R()); tr.push(u, (R() - 0.5) * 0.6 * (1 - u)); }
    for (var q = 0, k = Math.max(6, Math.round(r * r * 0.035)); q < k; q++) mo.push(R() * TAU, Math.sqrt(R()) * 0.22);
    return { x: cx, y: cy, hx: cx, hy: cy, r: r, tilt: tilt, ang: ang, curl: o.curl == null ? 0.35 : o.curl,
      ds: o.ds || Math.max(0.6, Math.min(1.1, r / 70)), d: d, tr: tr, mo: mo, ph: R() * TAU, open: 0, sens: o.sens == null ? 1.4 : o.sens };
  }

  function drawPolyp(ctx, P, t, m, pal, sp, o) {
    o = o || {};
    var hov = near(P.x, P.y, m, P.r * P.sens);
    P.open += ((hov > 0.12 ? 1 : 0) - P.open) * 0.06;
    var cx = P.x + Math.sin(t * 0.5 + P.ph) * P.r * 0.03, cy = P.y + Math.cos(t * 0.4 + P.ph) * P.r * 0.02;
    P.hx = cx; P.hy = cy;
    var cr = Math.cos(P.ang), sr = Math.sin(P.ang), ds = P.ds, r = P.r, tilt = P.tilt, d = P.d;
    var breath = 1 + 0.035 * Math.sin(t * 0.9 + P.ph) + 0.16 * P.open;
    var sway = 0.14 * Math.sin(t * 0.6 + P.ph), curl = P.curl + 0.3 * P.open;
    var rad = Math.max(50, r * 1.2), str = Math.max(6, r * 0.18), am = o.alpha || 1;
    if (P.tr.length) {
      var tx = cx - sr * r * 0.95, ty = cy + cr * r * 0.95;
      ctx.fillStyle = pal.line; ctx.globalAlpha = 0.28 * am; ctx.beginPath();
      for (var c = 0; c < P.tr.length; c += 2) {
        var u = P.tr[c], w = P.tr[c + 1] * r;
        push(cx + (tx - cx) * u + w * cr, cy + (ty - cy) * u + w * sr, m, rad, str);
        dot(ctx, PX, PY, 0.55 * ds);
      }
      ctx.fill();
    }
    // tentacles in three passes so the inner dots stay faint and the rim reads crisp
    for (var band = 0; band < 3; band++) {
      var lo = band * 0.4, hi = band === 2 ? 1.01 : lo + 0.4;
      ctx.fillStyle = pal.line; ctx.globalAlpha = [0.5, 0.85, 1][band] * am; ctx.beginPath();
      for (var i = 0; i < d.length; i += 2) {
        var tt = d[i + 1]; if (tt < lo || tt >= hi) continue;
        var rr = r * breath * (0.3 + 0.7 * tt), a = d[i] + curl * tt * tt + sway * tt;
        var lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * tilt;
        push(cx + lx * cr - ly * sr, cy + lx * sr + ly * cr, m, rad, str);
        dot(ctx, PX, PY, (tt > 0.99 ? 1.3 : 0.38 + 0.55 * tt) * ds);
      }
      ctx.fill();
    }
    ctx.fillStyle = o.mouth || pal.warm; ctx.globalAlpha = (0.75 + 0.25 * P.open) * am; ctx.beginPath();
    for (var q = 0; q < P.mo.length; q += 2) {
      var a2 = P.mo[q] + t * 0.2, r2 = P.mo[q + 1] * r * (1 + 0.3 * P.open), lx2 = Math.cos(a2) * r2, ly2 = Math.sin(a2) * r2 * tilt;
      dot(ctx, cx + lx2 * cr - ly2 * sr, cy + lx2 * sr + ly2 * cr, 0.5 * ds);
    }
    ctx.fill(); ctx.globalAlpha = 1;
    if (sp && P.open > 0.4 && Math.random() < 0.25 * P.open) {
      var aa = Math.random() * TAU, lx3 = Math.cos(aa) * r * breath, ly3 = Math.sin(aa) * r * breath * tilt;
      sp.add(cx + lx3 * cr - ly3 * sr, cy + lx3 * sr + ly3 * cr);
    }
  }

  function drawStem(ctx, bx, by, P, pal) {
    ctx.strokeStyle = pal.deep; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.moveTo(bx, by);
    ctx.bezierCurveTo(bx, P.hy + P.r * 1.6, P.hx, P.hy + P.r * 1.3, P.hx, P.hy); ctx.stroke(); ctx.globalAlpha = 1;
  }

  /* ---------- frond and halftone disc ---------- */

  function makeFrond(x0, y0, x1, y1, W, R, g) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux, p = [];
    for (var s = g; s < L; s += g) {
      var u = s / L, half = Math.sin(Math.PI * Math.pow(u, 0.75)) * W, row = Math.round(s / g) % 2 ? g / 2 : 0;
      for (var v = -half + row; v <= half; v += g) {
        if (R() < 0.12) continue;
        var e = half ? Math.abs(v) / half : 0;
        p.push(x0 + ux * s + nx * v, y0 + uy * s + ny * v, 0.45 + 0.75 * e, u);
      }
    }
    return { p: p, nx: nx, ny: ny };
  }
  function drawFrond(ctx, F, t, m, pal) {
    var p = F.p;
    ctx.fillStyle = pal.deep; ctx.globalAlpha = 0.8; ctx.beginPath();
    for (var i = 0; i < p.length; i += 4) {
      var u = p[i + 3], wv = Math.sin(t * 0.8 + u * 3) * u * 3;
      push(p[i] + F.nx * wv, p[i + 1] + F.ny * wv, m, 70, 12);
      dot(ctx, PX, PY, p[i + 2]);
    }
    ctx.fill(); ctx.globalAlpha = 1;
  }

  function makeDisc(cx, cy, r, g) {
    var p = [];
    for (var y = -r; y <= r; y += g) {
      var row = Math.round(y / g) % 2 ? g / 2 : 0;
      for (var x = -r + row; x <= r; x += g) if (x * x + y * y <= r * r) p.push(cx + x, cy + y, g * 0.46 * (0.25 + 0.75 * ((y + r) / (2 * r))));
    }
    return { p: p };
  }
  // The disc swells under the pointer like a lens.
  function drawDisc(ctx, D, t, m, pal) {
    var p = D.p;
    ctx.fillStyle = pal.soft; ctx.beginPath();
    for (var i = 0; i < p.length; i += 3) {
      var l = near(p[i], p[i + 1], m, 110);
      dot(ctx, p[i], p[i + 1], p[i + 2] * (1 + 0.12 * Math.sin(t * 0.8 + p[i + 1] * 0.04) + 1.1 * l * l));
    }
    ctx.fill();
  }

  /* ---------- dotted lines with travelling pulses (the flow-lines part) ---------- */

  // Each line is a list of points sampled every `gap` px. Pulses run from the start of the line to its end.
  function drawDotLines(ctx, lines, t, m, pal, o) {
    var gap = o.gap, wave = o.wave || 140, speed = o.speed || 0.35, rad = o.rad || 70, str = o.str || 14;
    ctx.fillStyle = pal.line; ctx.globalAlpha = o.base || 0.35; ctx.beginPath();
    var glow = [];
    for (var l = 0; l < lines.length; l++) {
      var L = lines[l], pts = L.p;
      for (var k = 0; k < pts.length; k += 2) {
        push(pts[k], pts[k + 1], m, rad, str);
        sq(ctx, PX, PY, o.size || 0.7);
        var ph = (k / 2 * gap / wave - t * speed + L.off) % 1; if (ph < 0) ph += 1;
        if (ph < 0.1) glow.push(PX, PY, 1 - ph / 0.1);
      }
    }
    ctx.fill();
    ctx.fillStyle = pal.glint;
    for (var b = 0; b < 3; b++) {
      ctx.globalAlpha = [0.35, 0.65, 1][b]; ctx.beginPath();
      for (var g = 0; g < glow.length; g += 3) {
        var v = glow[g + 2], bucket = v < 0.33 ? 0 : v < 0.66 ? 1 : 2;
        if (bucket === b) dot(ctx, glow[g], glow[g + 1], 0.7 + v * 1.1);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function blob(cx, cy, rx, ry, R) {
    var p1 = R() * TAU, p2 = R() * TAU;
    return function (x, y) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry, th = Math.atan2(dy, dx);
      var k = 1 + 0.14 * Math.sin(3 * th + p1) + 0.07 * Math.sin(5 * th + p2);
      return dx * dx + dy * dy <= k * k;
    };
  }

  // Field lines from positive nodes until they reach a negative node or leave the boundary, sampled as dots.
  function traceField(nodes, inside, o, R) {
    var out = [], r0 = o.r0 || 6, step = 1.4, gap = o.gap;
    nodes.forEach(function (n) {
      if (n.q <= 0) return;
      var count = Math.max(4, Math.round(o.lines * n.q));
      for (var i = 0; i < count; i++) {
        var a = (i / count) * TAU + n.spin, x = n.x + Math.cos(a) * r0, y = n.y + Math.sin(a) * r0, pts = [x, y], acc = 0;
        for (var s = 0; s < 1400; s++) {
          var ex = 0, ey = 0, hit = false;
          for (var j = 0; j < nodes.length; j++) {
            var mm = nodes[j], dx = x - mm.x, dy = y - mm.y, d2 = dx * dx + dy * dy;
            if (mm.q < 0 && d2 < (mm.r0 || r0) * (mm.r0 || r0)) { hit = true; break; }
            var f = mm.q / (d2 + 1); ex += dx * f; ey += dy * f;
          }
          if (hit) break;
          var len = Math.sqrt(ex * ex + ey * ey) || 1;
          x += ex / len * step; y += ey / len * step; acc += step;
          if (!inside(x, y)) break;
          if (acc >= gap) { pts.push(x, y); acc = 0; }
        }
        if (pts.length > 6) out.push({ p: pts, off: R() });
      }
    });
    return out;
  }

  /* ---------- the five expressions ---------- */

  var EXPR = {};

  EXPR.reef = {
    build: function (w, h, R) {
      var s = Math.min(w, h), cx = w / 2, cy = h / 2, ds = Math.max(0.7, s / 420), g = Math.max(3.4, s / 110);
      var S = { base: [cx - s * 0.05, h * 0.98] };
      S.disc = makeDisc(cx + s * 0.12, cy - s * 0.12, s * 0.3, Math.max(5, s / 60));
      S.polyps = [
        makePolyp(cx - s * 0.16, cy - s * 0.2, s * 0.16, 0.34, -0.45, R, { ds: ds }),
        makePolyp(cx + s * 0.17, cy, s * 0.14, 0.5, 0.35, R, { ds: ds }),
        makePolyp(cx - s * 0.08, cy + s * 0.2, s * 0.11, 0.8, -0.1, R, { ds: ds })
      ];
      S.fronds = [
        makeFrond(S.base[0], S.base[1] - s * 0.05, cx - s * 0.42, cy + s * 0.12, s * 0.07, R, g),
        makeFrond(S.base[0], S.base[1] - s * 0.1, cx + s * 0.4, cy + s * 0.3, s * 0.06, R, g)
      ];
      S.motes = makeMotes(26, w, h, R);
      return S;
    },
    draw: function (ctx, S, t, dt, m, pal) {
      drawDisc(ctx, S.disc, t, m, pal);
      S.fronds.forEach(function (F) { drawFrond(ctx, F, t, m, pal); });
      S.polyps.forEach(function (P) { drawStem(ctx, S.base[0], S.base[1], P, pal); });
      S.polyps.forEach(function (P) { drawPolyp(ctx, P, t, m, pal, S.sp); });
      drawMotes(ctx, S.motes, t, dt * 60, m, pal);
      trail(S, m);
    }
  };

  EXPR.current = {
    build: function (w, h, R) {
      var s = Math.min(w, h), cx = w * 0.52, cy = h * 0.5, rx = w * 0.47, ry = h * 0.46, nodes = [], qsum = 0;
      for (var i = 0; i < 12; i++) {
        var a = R() * TAU, r = 0.3 + Math.sqrt(R()) * 0.6, q = (i % 5 === 4) ? -(0.4 + R() * 0.3) : 0.6 + R() * 0.8;
        if (q > 0) qsum += q;
        nodes.push({ x: cx + Math.cos(a) * r * rx, y: cy + Math.sin(a) * r * ry, q: q, spin: R() * TAU });
      }
      var core = { x: cx + (R() - 0.5) * rx * 0.2, y: cy + (R() - 0.5) * ry * 0.2, q: -qsum * 0.45, r0: s * 0.05 };
      nodes.push(core);
      var S = { core: core, gap: 5 };
      S.lines = traceField(nodes, blob(cx, cy, rx, ry, R), { lines: 14, gap: S.gap, r0: 6 }, R);
      S.polyps = nodes.filter(function (n) { return n.q > 0; }).map(function (n) {
        return makePolyp(n.x, n.y, 5 + n.q * 5, 0.85 + R() * 0.15, R() * TAU, R, { trumpet: false, curl: 0.5, ds: 0.6, sens: 2.2 });
      });
      S.hub = makePolyp(core.x, core.y, s * 0.06, 0.95, 0, R, { trumpet: false, curl: 0.6, sens: 1.8 });
      S.motes = makeMotes(14, w, h, R);
      return S;
    },
    draw: function (ctx, S, t, dt, m, pal) {
      drawDotLines(ctx, S.lines, t, m, pal, { gap: S.gap, wave: 150, speed: 0.3, base: 0.45 });
      S.polyps.forEach(function (P) { drawPolyp(ctx, P, t, m, pal, S.sp); });
      drawPolyp(ctx, S.hub, t, m, pal, S.sp, { mouth: pal.accent });
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2);
      ctx.beginPath(); ctx.arc(S.hub.hx, S.hub.hy, S.hub.r * (1.45 + 0.08 * Math.sin(t * 2)), 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      if (Math.random() < dt * 2.5) S.sp.add(S.hub.hx + (Math.random() - 0.5) * S.hub.r * 2, S.hub.hy + (Math.random() - 0.5) * S.hub.r * 2);
      drawMotes(ctx, S.motes, t, dt * 60, m, pal);
      trail(S, m);
    }
  };

  EXPR.plate = {
    build: function (w, h, R) {
      var s = Math.min(w, h) * 0.96, x0 = (w - s) / 2, y0 = (h - s) / 2, cell = s / 3, ds = Math.max(0.7, s / 520);
      var S = { disc: makeDisc(x0 + s / 2, y0 + s / 2, s * 0.44, Math.max(6, s / 52)), polyps: [], lines: [], gap: 6 };
      for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) {
        var c = i === 1 && j === 1;
        S.polyps.push(makePolyp(x0 + cell * (i + 0.5), y0 + cell * (j + 0.5), cell * (c ? 0.36 : 0.28 + R() * 0.08),
          c ? 0.7 : 0.45 + R() * 0.5, (R() - 0.5) * 0.8, R, { ds: ds, curl: 0.2 + R() * 0.3, sens: 1.2 }));
      }
      var hub = S.polyps[4];
      S.polyps.forEach(function (P, k) {
        if (k === 4) return;
        var dx = hub.x - P.x, dy = hub.y - P.y, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, bend = (R() - 0.5) * L * 0.25, pts = [];
        for (var d = P.r * 0.6; d < L - hub.r * 0.7; d += S.gap) {
          var u = d / L, b = Math.sin(Math.PI * u) * bend;
          pts.push(P.x + dx * u + nx * b, P.y + dy * u + ny * b);
        }
        S.lines.push({ p: pts, off: R() });
      });
      return S;
    },
    draw: function (ctx, S, t, dt, m, pal) {
      drawDisc(ctx, S.disc, t, m, pal);
      drawDotLines(ctx, S.lines, t, m, pal, { gap: S.gap, wave: 110, speed: 0.4, base: 0.5, size: 0.9, rad: 50, str: 8 });
      S.polyps.forEach(function (P, k) { drawPolyp(ctx, P, t, m, pal, S.sp, k === 4 ? { mouth: pal.accent } : null); });
      trail(S, m);
    }
  };

  EXPR.tide = {
    build: function (w, h, R) {
      var g = Math.max(6, Math.min(w, h) / 58), shapes = [], p = [];
      var n = w > h * 2.4 ? 3 : 2;
      function ss(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
      for (var k = 0; k < n; k++) {
        shapes.push({ x: w * ((k + 0.5) / n + (R() - 0.5) * 0.1), y: h * (0.48 + (R() - 0.5) * 0.2), r: Math.min(w / n, h) * (0.34 + R() * 0.08),
          lobes: 18 + Math.floor(R() * 10), rot: R() * TAU, tilt: 0.55 + R() * 0.35 });
      }
      // each dot stores: x, y, body (0..1, how far inside a polyp), mouth (1 inside a polyp's mouth)
      for (var y = g / 2, row = 0; y < h; y += g * 0.87, row++) {
        for (var x = (row % 2 ? g : g / 2); x < w; x += g) {
          var body = 0, mouth = 0;
          for (var s = 0; s < shapes.length; s++) {
            var S0 = shapes[s], dx = x - S0.x, dy = (y - S0.y) / S0.tilt, d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
            var edge = S0.r * (0.84 + 0.16 * Math.cos(S0.lobes * th + S0.rot));
            body = Math.max(body, ss(edge, edge * 0.62, d) * ss(S0.r * 0.18, S0.r * 0.32, d));
            if (d < S0.r * 0.17) mouth = 1;
          }
          p.push(x, y, body, mouth);
        }
      }
      return { p: p, g: g, rip: [], lastRip: 0 };
    },
    draw: function (ctx, S, t, dt, m, pal) {
      var p = S.p, g = S.g;
      if (m.on > 0.5 && m.speed > 1.5 && t - S.lastRip > 0.16) { S.rip.push({ x: m.x, y: m.y, t0: t }); S.lastRip = t; }
      S.rip = S.rip.filter(function (r) { return t - r.t0 < 1.6; });
      // three passes: background field, polyp bodies, warm mouths
      var pass = [[pal.soft, 1], [pal.line, 0.9], [pal.warm, 0.85]];
      for (var ps = 0; ps < 3; ps++) {
        ctx.fillStyle = pass[ps][0]; ctx.globalAlpha = pass[ps][1]; ctx.beginPath();
        for (var i = 0; i < p.length; i += 4) {
          var x = p[i], y = p[i + 1], body = p[i + 2], mouth = p[i + 3];
          var which = mouth ? 2 : body > 0.3 ? 1 : 0;
          if (which !== ps) continue;
          var wave = 0.5 + 0.5 * Math.sin(x * 0.012 + t * 0.7 + 1.5 * Math.sin(y * 0.009 + t * 0.25));
          var r = mouth ? g * 0.16 * (0.7 + 0.6 * wave) : g * 0.48 * (0.12 + 0.2 * wave + body * (0.42 + 0.2 * wave));
          for (var k = 0; k < S.rip.length; k++) {
            var R0 = S.rip[k], age = t - R0.t0, dd = Math.abs(Math.hypot(x - R0.x, y - R0.y) - age * 150);
            if (dd < g * 1.6) r += g * 0.26 * (1 - dd / (g * 1.6)) * (1 - age / 1.6);
          }
          r += near(x, y, m, 80) * g * 0.2;
          dot(ctx, x, y, Math.min(r, g * 0.55));
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (Math.random() < dt * 3) {
        var j = Math.floor(Math.random() * p.length / 4) * 4;
        if (p[j + 2] > 0.6) S.sp.add(p[j], p[j + 1]);
      }
    }
  };

  /* ---------- pollen drift: one swoosh of golden pollen over the reef ---------- */

  // The head follows a slow figure-eight above the reef, or drifts after the pointer and circles it.
  // A point is dropped every few pixels of travel, so the swoosh keeps the same length at any speed.
  function pollenStep(S, t, f, m) {
    var H = S.head, ease = 0.03, tx = S.w * (0.5 + 0.36 * Math.sin(t * 0.21)), ty = S.h * (0.3 + 0.12 * Math.sin(t * 0.42));
    if (m && m.on > 0.3) { tx = m.x + Math.cos(t * 1.3) * 14; ty = m.y + Math.sin(t * 1.3) * 14; ease = 0.045; }
    H.x += (tx - H.x) * Math.min(1, ease * f); H.y += (ty - H.y) * Math.min(1, ease * f);
    var last = S.trail[0];
    if (!last || Math.hypot(H.x - last.x, H.y - last.y) > 7) S.trail.unshift({ x: H.x, y: H.y, ph: Math.random() * TAU });
    if (S.trail.length > 24) S.trail.pop();
  }

  function drawPollen(ctx, S, t, pal) {
    ctx.strokeStyle = pal.glint; ctx.fillStyle = pal.glint; ctx.lineWidth = 0.8;
    for (var i = 0; i < S.trail.length; i++) {
      var p = S.trail[i], k = 1 - i / 24, tw = 0.6 + 0.4 * Math.sin(t * 3 + p.ph);
      // the tail loosens and settles a little, like pollen left behind
      var x = p.x + Math.sin(t * 0.8 + p.ph) * 5 * (1 - k), y = p.y + Math.cos(t * 0.7 + p.ph) * 5 * (1 - k) + 4 * (1 - k);
      var s = (1 + 2.2 * k) * tw;
      ctx.globalAlpha = 0.85 * k * tw;
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
      ctx.beginPath(); dot(ctx, x, y, 0.4 + 0.5 * k); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  EXPR.pollen = {
    build: function (w, h, R) {
      var s = Math.min(w, h), ds = Math.max(0.6, s / 460), xs = [0.2, 0.41, 0.62, 0.82];
      var S = { w: w, h: h, polyps: [], fronds: [], bases: [], head: { x: w * 0.5, y: h * 0.3 }, trail: [] };
      xs.forEach(function (fx) {
        var r = s * (0.08 + R() * 0.04), x = w * fx + (R() - 0.5) * w * 0.04, y = h * (0.66 + R() * 0.12);
        S.polyps.push(makePolyp(x, y, r, 0.35 + R() * 0.15, (R() - 0.5) * 0.5, R, { ds: ds }));
        S.bases.push([x + (R() - 0.5) * r, h]);
      });
      var g = Math.max(3.4, s / 110);
      S.fronds.push(makeFrond(w * 0.32, h, w * 0.08, h * 0.62, s * 0.06, R, g));
      S.fronds.push(makeFrond(w * 0.7, h, w * 0.95, h * 0.7, s * 0.05, R, g));
      // run the path for a few seconds so the first frame (and reduced motion) already shows the swoosh
      for (var k = 0; k < 300; k++) pollenStep(S, k / 60, 1, null);
      return S;
    },
    draw: function (ctx, S, t, dt, m, pal) {
      S.fronds.forEach(function (F) { drawFrond(ctx, F, t, m, pal); });
      S.polyps.forEach(function (P, i) { drawStem(ctx, S.bases[i][0], S.bases[i][1], P, pal); });
      S.polyps.forEach(function (P) { drawPolyp(ctx, P, t, m, pal, S.sp); });
      pollenStep(S, t, dt * 60, m);
      drawPollen(ctx, S, t, pal);
    }
  };

  // A few sparkles follow a moving pointer.
  function trail(S, m) {
    if (m.on > 0.5 && m.speed > 2 && Math.random() < 0.35) S.sp.add(m.x + (Math.random() - 0.5) * 16, m.y + (Math.random() - 0.5) * 16);
  }

  /* ---------- stage: one canvas, sized, animated while visible ---------- */

  var stages = [], paused = REDUCE, rafOn = false, lastT = 0;
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { var s = e.target.__stage; if (s) s.visible = e.isIntersecting; });
    kick();
  }, { rootMargin: '100px' }) : null;

  function Stage(cv, key, opts) {
    this.cv = cv; this.key = key; this.dark = !!opts.dark; this.seed = opts.seed || 7;
    this.m = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0, px: 0, py: 0, speed: 0 };
    this.visible = !io; cv.__stage = this;
    if (io) io.observe(cv);
    this.setup();
  }
  Stage.prototype.setup = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) { this.ctx = null; return; }
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.ctx = this.cv.getContext('2d'); this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round';
    this.w = w; this.h = h; this.pal = this.dark ? PAL.dark : PAL.light;
    this.S = EXPR[this.key].build(w, h, rng(this.seed + hash(this.key)));
    this.S.sp = new Sparks();
    this.frame(1.5, 0.016);
  };
  Stage.prototype.frame = function (t, dt) {
    var m = this.m;
    m.x += (m.tx - m.x) * 0.2; m.y += (m.ty - m.y) * 0.2;
    m.on += (m.ton - m.on) * 0.08;
    m.speed = Math.hypot(m.tx - m.px, m.ty - m.py); m.px = m.tx; m.py = m.ty;
    this.ctx.clearRect(0, 0, this.w, this.h);
    EXPR[this.key].draw(this.ctx, this.S, t, dt, m, this.pal);
    this.S.sp.draw(this.ctx, this.pal, dt);
  };
  Stage.prototype.destroy = function () {
    if (io) io.unobserve(this.cv);
    var i = stages.indexOf(this); if (i > -1) stages.splice(i, 1);
  };

  function loop(now) {
    var t = now / 1000, dt = Math.min(0.05, lastT ? t - lastT : 0.016); lastT = t;
    var any = false;
    stages.forEach(function (s) { if (s.visible && s.ctx) { s.frame(t, dt); any = true; } });
    if (!paused && any) requestAnimationFrame(loop); else { rafOn = false; lastT = 0; }
  }
  function kick() { if (!paused && !rafOn) { rafOn = true; requestAnimationFrame(loop); } }

  if (!REDUCE) {
    window.addEventListener('pointermove', function (e) {
      stages.forEach(function (s) {
        var r = s.cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, m = s.m;
        var inside = x > -30 && y > -30 && x < r.width + 30 && y < r.height + 30;
        if (inside && m.on < 0.02) { m.x = m.px = x; m.y = m.py = y; }
        m.tx = x; m.ty = y; m.ton = inside ? 1 : 0;
      });
    }, { passive: true });
    document.addEventListener('pointerleave', function () { stages.forEach(function (s) { s.m.ton = 0; }); });
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { stages.forEach(function (s) { s.setup(); }); kick(); }, 200);
  });

  window.RefiStipple = {
    mount: function (cv, key, opts) { var s = new Stage(cv, key, opts || {}); stages.push(s); kick(); return s; },
    setPaused: function (p) { paused = p || REDUCE; kick(); },
    // Test hook: park a fake pointer at a fraction of every canvas (used for screenshots).
    probe: function (fx, fy) { stages.forEach(function (s) { var m = s.m; m.x = m.tx = m.px = fx * s.w; m.y = m.ty = m.py = fy * s.h; m.on = m.ton = 1; }); },
    reducedMotion: REDUCE,
    keys: Object.keys(EXPR)
  };
})();
