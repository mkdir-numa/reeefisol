/* ReFi Hub staking: generative graphics.
   Three styles drawn on <canvas>, all seeded so a given seed always draws the same picture:
     A  Flow lines  field lines from many stake sources into one node (the validator)
     B  Stipple     polyps and fronds drawn in dots, like a halftone print
     C  Branching   coral grown by a branching rule over a flat disc
   Each style has a motif per site section: hero, card, steps, inst, dil.
   Prototype: not linked from the site yet. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;

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

  function setup(cv) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = cv.clientWidth, h = cv.clientHeight;
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    return { ctx: ctx, w: w, h: h };
  }
  function dot(ctx, x, y, r) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); }
  function full(c) { return { x: 0, y: 0, w: c.w, h: c.h }; }

  /* ---------- A. Flow lines ---------- */

  // Irregular blob boundary so the bloom has an organic edge, not a perfect ellipse.
  function blob(cx, cy, rx, ry, R) {
    var p1 = R() * TAU, p2 = R() * TAU;
    return function (x, y) {
      var dx = (x - cx) / rx, dy = (y - cy) / ry, th = Math.atan2(dy, dx);
      var k = 1 + 0.14 * Math.sin(3 * th + p1) + 0.07 * Math.sin(5 * th + p2);
      return dx * dx + dy * dy <= k * k;
    };
  }

  // Trace field lines out of every positive node until they reach a negative node or leave the boundary.
  function fieldLines(ctx, nodes, inside, o) {
    var step = o.step || 1.5, r0 = o.r0 || 4, maxSteps = o.maxSteps || 1200;
    ctx.beginPath();
    nodes.forEach(function (n) {
      if (n.q <= 0) return;
      var count = Math.max(4, Math.round(o.lines * n.q));
      for (var i = 0; i < count; i++) {
        var a = (i / count) * TAU + n.spin;
        var x = n.x + Math.cos(a) * r0, y = n.y + Math.sin(a) * r0;
        ctx.moveTo(x, y);
        for (var s = 0; s < maxSteps; s++) {
          var ex = 0, ey = 0, hit = false;
          for (var j = 0; j < nodes.length; j++) {
            var m = nodes[j], dx = x - m.x, dy = y - m.y, d2 = dx * dx + dy * dy;
            if (m.q < 0 && d2 < r0 * r0) { ctx.lineTo(m.x, m.y); hit = true; break; }
            var f = m.q / (d2 + 1);
            ex += dx * f; ey += dy * f;
          }
          if (hit) break;
          var len = Math.sqrt(ex * ex + ey * ey) || 1;
          x += ex / len * step; y += ey / len * step;
          ctx.lineTo(x, y);
          if (!inside(x, y)) break;
        }
      }
    });
    ctx.stroke();
  }

  function drawNodes(ctx, nodes, pal, scale) {
    ctx.fillStyle = pal.line; ctx.beginPath();
    nodes.forEach(function (n) { if (!n.core) dot(ctx, n.x, n.y, (n.q > 0 ? 2.4 : 1.8) * scale); });
    ctx.fill();
    nodes.forEach(function (n) {
      if (!n.core) return;
      ctx.fillStyle = pal.accent; ctx.beginPath(); dot(ctx, n.x, n.y, 4.2 * scale); ctx.fill();
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(n.x, n.y, 9 * scale, 0, TAU); ctx.stroke();
    });
  }

  // Bloom: sources scattered in a blob, one core sink (the validator) near the middle.
  function flowBloom(ctx, b, pal, R, o) {
    o = o || {};
    var cx = b.x + b.w * (o.cx || 0.5), cy = b.y + b.h * (o.cy || 0.5);
    var rx = b.w * (o.rx || 0.46), ry = b.h * (o.ry || 0.46), n = o.nodes || 14;
    var nodes = [], qsum = 0;
    for (var i = 0; i < n; i++) {
      var a = R() * TAU, r = 0.25 + Math.sqrt(R()) * 0.6;
      var q = (i % 4 === 3) ? -(0.5 + R() * 0.5) : 0.5 + R() * 0.9;
      if (q > 0) qsum += q;
      nodes.push({ x: cx + Math.cos(a) * r * rx, y: cy + Math.sin(a) * r * ry, q: q, spin: R() * TAU });
    }
    nodes.push({ x: cx + (R() - 0.5) * rx * 0.2, y: cy + (R() - 0.5) * ry * 0.2, q: -qsum * 0.4, core: !o.noCore });
    ctx.strokeStyle = pal.line; ctx.lineWidth = o.lw || 0.7; ctx.globalAlpha = o.alpha || 0.85;
    var sc = Math.min(rx, ry) / 200;
    fieldLines(ctx, nodes, blob(cx, cy, rx, ry, R), { lines: o.lines || 26, step: 1.4, r0: Math.max(3, 4 * sc) });
    ctx.globalAlpha = 1;
    drawNodes(ctx, nodes, pal, Math.max(0.6, Math.min(1.2, sc)));
  }

  // Grid pulled towards a few nodes: the same idea in a more ordered, institutional form.
  function flowGrid(ctx, b, pal, R, o) {
    o = o || {};
    var size = Math.min(b.w, b.h) * 0.94, x0 = b.x + (b.w - size) / 2, y0 = b.y + (b.h - size) / 2;
    var gap = o.gap || Math.max(10, size / 30), n = o.nodes || 5, nodes = [];
    for (var i = 0; i < n; i++) nodes.push({ x: x0 + size * (0.18 + 0.64 * R()), y: y0 + size * (0.18 + 0.64 * R()), s: 0.55 + R() * 0.35, sig: size * (0.07 + R() * 0.07) });
    function warp(x, y) {
      var dx = 0, dy = 0;
      for (var j = 0; j < nodes.length; j++) {
        var m = nodes[j], ddx = m.x - x, ddy = m.y - y, f = m.s * Math.exp(-(ddx * ddx + ddy * ddy) / (2 * m.sig * m.sig));
        dx += ddx * f; dy += ddy * f;
      }
      return [x + dx, y + dy];
    }
    ctx.strokeStyle = pal.line; ctx.lineWidth = o.lw || 0.7; ctx.globalAlpha = 0.75; ctx.beginPath();
    for (var gy = 0; gy <= size + 0.1; gy += gap) {
      for (var gx = 0; gx <= size; gx += 3) { var p = warp(x0 + gx, y0 + gy); gx ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    }
    for (gx = 0; gx <= size + 0.1; gx += gap) {
      for (gy = 0; gy <= size; gy += 3) { p = warp(x0 + gx, y0 + gy); gy ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    }
    ctx.stroke();
    // spokes: each node reaches out to the grid crossings around it
    ctx.globalAlpha = 0.9; ctx.beginPath();
    nodes.forEach(function (m) {
      for (var a = 0; a < 22; a++) {
        var t = a / 22 * TAU, rr = m.sig * 1.5, q = warp(m.x + Math.cos(t) * rr, m.y + Math.sin(t) * rr);
        ctx.moveTo(m.x, m.y); ctx.lineTo(q[0], q[1]);
      }
    });
    ctx.stroke(); ctx.globalAlpha = 1;
    nodes[0].core = true;
    drawNodes(ctx, nodes, pal, 0.9);
  }

  // Dipole: two nodes and the lines between them. Quiet, for small bands.
  function flowDipole(ctx, b, pal, R) {
    var cy = b.y + b.h / 2, gap = b.w * 0.28;
    var nodes = [
      { x: b.x + b.w / 2 - gap, y: cy + (R() - 0.5) * 20, q: 1, spin: R() },
      { x: b.x + b.w / 2 + gap, y: cy + (R() - 0.5) * 20, q: -1, core: true }
    ];
    ctx.strokeStyle = pal.line; ctx.lineWidth = 0.7; ctx.globalAlpha = 0.85;
    fieldLines(ctx, nodes, blob(b.x + b.w / 2, cy, b.w * 0.48, b.h * 0.46, R), { lines: 44, step: 1.3 });
    ctx.globalAlpha = 1; drawNodes(ctx, nodes, pal, 1);
  }

  /* ---------- B. Stipple ---------- */

  function rot(cx, cy, lx, ly, cr, sr) { return [cx + lx * cr - ly * sr, cy + lx * sr + ly * cr]; }

  // A polyp seen at an angle: a stippled trumpet below, then tentacles of fine dots that thin out
  // and curl towards the rim, each ending in a slightly bigger tip dot, and a small warm mouth.
  function polyp(ctx, cx, cy, r, tilt, ang, R, pal, o) {
    o = o || {};
    var n = Math.max(22, Math.round(r * 0.8)), cr = Math.cos(ang), sr = Math.sin(ang), curl = o.curl == null ? 0.35 : o.curl;
    var m = Math.max(5, Math.round(r / 4.2)), ds = o.ds || 1;
    // trumpet: dots scattered in a cone from the mouth down to a point
    var tip = rot(cx, cy, 0, r * 0.95, cr, sr);
    ctx.fillStyle = pal.line; ctx.globalAlpha = 0.28; ctx.beginPath();
    for (var c = 0, cn = Math.round(r * 2.6); c < cn; c++) {
      var u = Math.sqrt(R()), w = (R() - 0.5) * 2 * r * 0.3 * (1 - u);
      var bx = cx + (tip[0] - cx) * u, by = cy + (tip[1] - cy) * u;
      dot(ctx, bx + w * cr, by + w * sr, 0.55 * ds);
    }
    ctx.fill(); ctx.globalAlpha = 1;
    // tentacles: three passes so the inner dots stay faint and the rim reads crisp
    [[0, 0.4, 0.5], [0.4, 0.8, 0.85], [0.8, 1.01, 1]].forEach(function (band) {
      ctx.fillStyle = pal.line; ctx.globalAlpha = band[2]; ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var th = i / n * TAU + ((i * 9301 + 49297) % 233280) / 233280 * 0.05;
        for (var j = 0; j <= m; j++) {
          var t = j / m; if (t < band[0] || t >= band[1]) continue;
          var rr = r * (0.3 + 0.7 * t), a = th + curl * t * t;
          var p = rot(cx, cy, Math.cos(a) * rr, Math.sin(a) * rr * tilt, cr, sr);
          dot(ctx, p[0], p[1], (j === m ? 1.3 : 0.38 + 0.55 * t) * ds);
        }
      }
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.warm; ctx.globalAlpha = 0.8; ctx.beginPath();
    var k = Math.round(r * r * 0.035);
    for (var q = 0; q < k; q++) {
      var a2 = R() * TAU, r2 = Math.sqrt(R()) * r * 0.22, p2 = rot(cx, cy, Math.cos(a2) * r2, Math.sin(a2) * r2 * tilt, cr, sr);
      dot(ctx, p2[0], p2[1], 0.5 * ds);
    }
    ctx.fill(); ctx.globalAlpha = 1;
  }

  // Leaf-like frond on a dot lattice; dots grow towards the edges, like the reference print.
  function frond(ctx, x0, y0, x1, y1, W, R, pal, g) {
    var dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    g = g || 4.2;
    ctx.fillStyle = pal.deep; ctx.globalAlpha = 0.8; ctx.beginPath();
    for (var s = g; s < L; s += g) {
      var u = s / L, half = Math.sin(Math.PI * Math.pow(u, 0.75)) * W, row = Math.round(s / g) % 2 ? g / 2 : 0;
      for (var v = -half + row; v <= half; v += g) {
        if (R() < 0.12) continue;
        var e = half ? Math.abs(v) / half : 0;
        dot(ctx, x0 + ux * s + nx * v, y0 + uy * s + ny * v, 0.45 + 0.75 * e);
      }
    }
    ctx.fill(); ctx.globalAlpha = 1;
  }

  // Halftone disc: dots on a lattice, bigger towards one side. Stands in for the sun / a SOL coin.
  function halftone(ctx, cx, cy, r, pal, g) {
    g = g || 7;
    ctx.fillStyle = pal.soft; ctx.beginPath();
    for (var y = -r; y <= r; y += g) {
      var row = Math.round(y / g) % 2 ? g / 2 : 0;
      for (var x = -r + row; x <= r; x += g) {
        if (x * x + y * y > r * r) continue;
        var f = 0.25 + 0.75 * ((y + r) / (2 * r));
        dot(ctx, cx + x, cy + y, g * 0.46 * f);
      }
    }
    ctx.fill();
  }

  function stem(ctx, pts, pal, lw) {
    ctx.strokeStyle = pal.deep; ctx.lineWidth = lw || 1.1; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]); ctx.stroke();
  }

  function plankton(ctx, b, n, R, pal) {
    ctx.fillStyle = pal.line; ctx.globalAlpha = 0.5; ctx.beginPath();
    for (var i = 0; i < n; i++) dot(ctx, b.x + R() * b.w, b.y + R() * b.h, 0.6 + R() * 0.9);
    ctx.fill(); ctx.globalAlpha = 1;
  }

  function stippleCluster(ctx, b, pal, R, o) {
    o = o || {};
    var s = Math.min(b.w, b.h), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (!o.noDisc) halftone(ctx, cx + s * 0.12, cy - s * 0.12, s * 0.3, pal, Math.max(5, s / 60));
    var base = [cx - s * 0.05, b.y + b.h * 0.98];
    var heads = [
      [cx - s * 0.16, cy - s * 0.2, s * 0.16, 0.34, -0.45],
      [cx + s * 0.17, cy + s * 0.0, s * 0.14, 0.5, 0.35],
      [cx - s * 0.08, cy + s * 0.2, s * 0.11, 0.8, -0.1]
    ].slice(0, o.count || 3);
    heads.forEach(function (h) { stem(ctx, [base[0], base[1], base[0], h[1] + s * 0.25, h[0], h[1] + s * 0.2, h[0], h[1]], pal, 0.9); });
    frond(ctx, base[0], base[1] - s * 0.05, cx - s * 0.42, cy + s * 0.12, s * 0.07, R, pal, Math.max(3.4, s / 110));
    if ((o.count || 3) > 2) frond(ctx, base[0], base[1] - s * 0.1, cx + s * 0.4, cy + s * 0.3, s * 0.06, R, pal, Math.max(3.4, s / 110));
    heads.forEach(function (h) { polyp(ctx, h[0], h[1], h[2], h[3], h[4], R, pal, { ds: Math.max(0.7, s / 420) }); });
    if (!o.noPlankton) plankton(ctx, b, 26, R, pal);
  }

  // Specimen plate: a calm grid of polyps, for the institutional page.
  function stipplePlate(ctx, b, pal, R) {
    var s = Math.min(b.w, b.h), x0 = b.x + (b.w - s) / 2, y0 = b.y + (b.h - s) / 2, cols = 3, cell = s / cols;
    halftone(ctx, x0 + s / 2, y0 + s / 2, s * 0.48, pal, Math.max(6, s / 52));
    for (var i = 0; i < cols; i++) for (var j = 0; j < cols; j++) {
      var cx = x0 + cell * (i + 0.5), cy = y0 + cell * (j + 0.5);
      polyp(ctx, cx, cy, cell * (0.26 + R() * 0.1), 0.45 + R() * 0.5, (R() - 0.5) * 0.8, R, pal, { ds: Math.max(0.7, s / 520), curl: 0.2 + R() * 0.3 });
    }
  }

  /* ---------- C. Branching ---------- */

  function grow(ctx, x, y, ang, len, wid, depth, R, o, tips) {
    var bend = (R() - 0.5) * o.wiggle * len, ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    var mx = (x + ex) / 2 - Math.sin(ang) * bend, my = (y + ey) / 2 + Math.cos(ang) * bend;
    ctx.lineWidth = wid; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
    if (depth <= 0 || len < o.minLen) { tips.push([ex, ey]); return; }
    var k = R() < o.tri ? 3 : 2;
    for (var i = 0; i < k; i++) {
      var sp = o.spread * (0.6 + R() * 0.8);
      var a = ang + (k === 2 ? (i ? sp : -sp) : (i - 1) * sp);
      a += (-Math.PI / 2 - a) * o.tropism;
      grow(ctx, ex, ey, a, len * o.decay * (0.88 + R() * 0.24), Math.max(o.minW, wid * o.wd), depth - 1, R, o, tips);
    }
  }

  // Staghorn-like: few levels, thick limbs that stay thick, blunt tips, strong pull upwards.
  var CORAL = { wiggle: 0.25, minLen: 4, tri: 0.18, spread: 0.5, tropism: 0.28, decay: 0.8, minW: 1, wd: 0.82 };
  // Sea fan: many fine branches spreading sideways into a net.
  var FAN = { wiggle: 0.5, minLen: 3, tri: 0.12, spread: 0.3, tropism: 0.04, decay: 0.8, minW: 0.5, wd: 0.72 };

  function tipsDots(ctx, tips, R, pal, share, r) {
    ctx.fillStyle = pal.accent; ctx.beginPath();
    tips.forEach(function (t) { if (R() < share) dot(ctx, t[0], t[1], r); });
    ctx.fill();
  }

  function branchCoral(ctx, b, pal, R, o) {
    o = o || {};
    var s = Math.min(b.w, b.h), cx = b.x + b.w / 2, tips = [];
    if (!o.noDisc) { ctx.fillStyle = pal.soft; ctx.beginPath(); dot(ctx, cx - s * 0.08, b.y + b.h * 0.58, s * 0.3); ctx.fill(); }
    ctx.strokeStyle = pal.line;
    var depth = o.depth || 7, roots = o.roots || 5, len = s * (o.len || 0.13), span = roots > 1 ? s * 0.5 : 0;
    for (var i = 0; i < roots; i++) {
      var f = roots > 1 ? i / (roots - 1) - 0.5 : 0, a = -Math.PI / 2 + f * 1.4 + (R() - 0.5) * 0.2;
      grow(ctx, cx + f * span * 0.5, b.y + b.h * 0.97, a, len * (0.8 + R() * 0.4), Math.max(1.4, s / 60), depth - (Math.abs(f) > 0.3 ? 1 : 0), R, CORAL, tips);
    }
    tipsDots(ctx, tips, R, pal, o.tipShare || 0.12, Math.max(1.4, s / 180));
  }

  function branchFan(ctx, b, pal, R) {
    var s = Math.min(b.w, b.h), cx = b.x + b.w / 2, by = b.y + b.h * 0.96, tips = [];
    ctx.fillStyle = pal.soft; ctx.beginPath(); dot(ctx, cx, b.y + b.h * 0.5, s * 0.42); ctx.fill();
    ctx.strokeStyle = pal.line;
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + (i - 3) * 0.24;
      grow(ctx, cx, by, a, s * 0.14 * (0.9 + R() * 0.2), Math.max(1, s / 140), 7, R, FAN, tips);
    }
    tipsDots(ctx, tips, R, pal, 0.08, Math.max(1, s / 300));
  }

  function branchSprig(ctx, b, pal, R) {
    var s = Math.min(b.w, b.h), tips = [];
    ctx.fillStyle = pal.soft; ctx.beginPath(); dot(ctx, b.x + b.w * 0.58, b.y + b.h * 0.45, s * 0.36); ctx.fill();
    ctx.strokeStyle = pal.line;
    grow(ctx, b.x + b.w * 0.5, b.y + b.h * 0.98, -Math.PI / 2 - 0.2, s * 0.24, Math.max(1.4, s / 60), 6, R, CORAL, tips);
    grow(ctx, b.x + b.w * 0.53, b.y + b.h * 0.98, -Math.PI / 2 + 0.5, s * 0.17, Math.max(1.2, s / 75), 5, R, CORAL, tips);
    tipsDots(ctx, tips, R, pal, 0.15, Math.max(1.1, s / 220));
  }

  /* ---------- How to start: four growth stages ---------- */

  function stage(style, ctx, b, k, pal, R) {
    if (style === 'A') {
      if (k === 1) { flowDipole(ctx, { x: b.x + b.w * 0.3, y: b.y + b.h * 0.15, w: b.w * 0.4, h: b.h * 0.7 }, pal, R); return; }
      var bw = b.w * (0.3 + 0.17 * k);
      flowBloom(ctx, { x: b.x + (b.w - bw) / 2, y: b.y, w: bw, h: b.h }, pal, R, { nodes: [0, 0, 3, 5, 9][k], lines: 14 + 2 * k });
    } else if (style === 'B') {
      var s = Math.min(b.w, b.h), cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      if (k === 1) { halftone(ctx, cx, cy, s * 0.22, pal, 5); return; }
      if (k === 2) { stem(ctx, [cx, b.y + b.h, cx, cy + s * 0.3, cx, cy + s * 0.2, cx, cy + s * 0.05], pal, 0.9); polyp(ctx, cx, cy, s * 0.2, 0.5, 0, R, pal, { ds: 0.8 }); return; }
      stippleCluster(ctx, b, pal, R, { count: k === 3 ? 2 : 3, noDisc: k === 3, noPlankton: true });
    } else {
      branchCoral(ctx, b, pal, R, { depth: [0, 1, 3, 4, 6][k], roots: [0, 1, 1, 3, 5][k], len: 0.24 - 0.025 * k, noDisc: k < 4, tipShare: 0.25 });
    }
  }

  /* ---------- motif table ---------- */

  var MOTIFS = {
    A: {
      hero: function (ctx, b, pal, R) { flowBloom(ctx, b, pal, R, { nodes: 20, lines: 22 }); },
      card: function (ctx, b, pal, R) { flowBloom(ctx, { x: b.x + b.w * 0.1, y: b.y - b.h * 0.05, w: b.w, h: b.h * 1.1 }, pal, R, { nodes: 12, lines: 22, alpha: 0.7 }); },
      inst: function (ctx, b, pal, R) { flowGrid(ctx, b, pal, R); },
      dil: function (ctx, b, pal, R) { flowDipole(ctx, b, pal, R); }
    },
    B: {
      hero: function (ctx, b, pal, R) { stippleCluster(ctx, b, pal, R); },
      card: function (ctx, b, pal, R) { stippleCluster(ctx, { x: b.x + b.w * 0.15, y: b.y + b.h * 0.05, w: b.w * 0.9, h: b.h }, pal, R, { noDisc: false }); },
      inst: function (ctx, b, pal, R) { stipplePlate(ctx, b, pal, R); },
      dil: function (ctx, b, pal, R) {
        var s = Math.min(b.w, b.h), px = b.x + b.w * 0.6, py = b.y + b.h * 0.36;
        halftone(ctx, b.x + b.w * 0.68, b.y + b.h * 0.5, s * 0.4, pal, 6);
        frond(ctx, b.x + b.w * 0.5, b.y + b.h, b.x + b.w * 0.2, b.y + b.h * 0.3, s * 0.11, R, pal, 4);
        stem(ctx, [b.x + b.w * 0.5, b.y + b.h, px, b.y + b.h * 0.8, px, py + s * 0.3, px, py], pal, 0.9);
        polyp(ctx, px, py, s * 0.24, 0.42, 0.2, R, pal, { ds: 0.9 });
      }
    },
    C: {
      hero: function (ctx, b, pal, R) { branchCoral(ctx, b, pal, R, { depth: 7 }); },
      card: function (ctx, b, pal, R) { branchCoral(ctx, { x: b.x + b.w * 0.1, y: b.y, w: b.w, h: b.h }, pal, R, { depth: 7, noDisc: true }); },
      inst: function (ctx, b, pal, R) { branchFan(ctx, b, pal, R); },
      dil: function (ctx, b, pal, R) { branchSprig(ctx, b, pal, R); }
    }
  };

  /* ---------- palettes (colours come later; these are quick previews) ---------- */

  var PALETTES = {
    site: { line: '#155a63', accent: '#e07a5f', soft: '#cfe6e2', warm: '#e4b04a', deep: '#355e3d',
      dark: { line: '#cfe7e3', accent: '#f0a58f', soft: 'rgba(255,255,255,.08)', warm: '#e4b04a', deep: '#9cc3bf' } },
    ink: { line: '#1f1f1f', accent: '#715441', soft: '#e6e0d9', warm: '#b9a27a', deep: '#3d3d3d',
      dark: { line: '#f2ece8', accent: '#d9b99b', soft: 'rgba(255,255,255,.07)', warm: '#d9b99b', deep: '#c9c2bb' } },
    blue: { line: '#2638d9', accent: '#e07a5f', soft: '#dde2fa', warm: '#e8b64c', deep: '#2f4a3a',
      dark: { line: '#b9c3ff', accent: '#f0a58f', soft: 'rgba(255,255,255,.08)', warm: '#e8b64c', deep: '#a9b4f5' } }
  };

  // Draw one canvas. data-style (A|B|C), data-motif (hero|card|steps|inst|dil), data-dark for dark backgrounds.
  function render(cv, opts) {
    var style = cv.getAttribute('data-style'), motif = cv.getAttribute('data-motif');
    var base = PALETTES[opts.palette] || PALETTES.site, pal = cv.hasAttribute('data-dark') ? base.dark : base;
    var c = setup(cv), R = rng((opts.seed || 1) + hash(style + motif));
    if (motif === 'steps') {
      var boxes = stageBoxes(cv, c);
      boxes.forEach(function (b, i) { stage(style, c.ctx, b, i + 1, pal, rng((opts.seed || 1) + hash(style + 'step' + i))); });
      return;
    }
    MOTIFS[style][motif](c.ctx, full(c), pal, R);
  }

  // Line each growth stage up with its step in the timeline next to it, or lay them in a row on narrow screens.
  function stageBoxes(cv, c) {
    var steps = cv.parentNode.querySelectorAll('.tl-step'), top = cv.getBoundingClientRect().top, out = [];
    if (c.w > c.h * 1.6 || steps.length !== 4) {
      for (var i = 0; i < 4; i++) out.push({ x: c.w / 4 * i + 6, y: 6, w: c.w / 4 - 12, h: c.h - 12 });
      return out;
    }
    var bh = Math.min(190, c.h / 4 + 20);
    for (var j = 0; j < 4; j++) {
      var yc = steps[j].getBoundingClientRect().top - top + 30;
      out.push({ x: c.w * 0.1, y: Math.max(0, Math.min(c.h - bh, yc - bh / 2)), w: c.w * 0.8, h: bh });
    }
    return out;
  }

  window.RefiGraphics = { render: render, palettes: Object.keys(PALETTES) };
})();
