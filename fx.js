/* Page effects: first-visit explosion intro, anime slice into Projects, fire burn into Resume. */
(function () {
  'use strict';

  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var inFrame = window.self !== window.top;
  var root = document.documentElement;

  function store(k, v) {
    try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; }
  }

  // Inside a preview iframe (used behind transitions) show everything at once.
  if (inFrame) {
    root.classList.remove('intro-pending');
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    return;
  }

  // Arrived via a transition: skip the reveal fade so the swap from preview to real page is seamless.
  if (store('rs-nav') === '1') {
    store('rs-nav', '0');
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------------- Sound (Web Audio, synthesized) ---------------- */
  var actx = null;
  function audio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { actx = new AC(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') actx.resume().catch(function () {});
    return actx;
  }
  function noiseBuffer(ctx, secs) {
    var len = Math.floor(ctx.sampleRate * secs), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function noise(ctx, secs, filterType, f0, f1, q, peak, attack, when) {
    var t = ctx.currentTime + (when || 0);
    var src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx, secs);
    var f = ctx.createBiquadFilter(); f.type = filterType; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + secs);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + secs + 0.05);
  }
  function tone(ctx, type, f0, f1, secs, peak, when) {
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + secs);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + secs + 0.05);
  }
  var sfx = {
    woosh: function (ctx, secs) { noise(ctx, secs, 'bandpass', 250, 2600, 0.8, 0.35, secs * 0.85); },
    boom: function (ctx) {
      noise(ctx, 2.2, 'lowpass', 1800, 40, 0.7, 0.9, 0.01);
      tone(ctx, 'sine', 110, 28, 1.6, 0.9);
      noise(ctx, 1.1, 'bandpass', 3000, 300, 0.6, 0.25, 0.02, 0.05);
    },
    shing: function (ctx, when) {
      noise(ctx, 0.28, 'bandpass', 7000, 1800, 1.5, 0.35, 0.005, when);
      tone(ctx, 'triangle', 2900, 2400, 0.5, 0.06, when);
    },
    clunk: function (ctx) { noise(ctx, 0.5, 'lowpass', 900, 80, 0.8, 0.5, 0.005); tone(ctx, 'sine', 90, 40, 0.4, 0.4); },
    ignite: function (ctx) {
      noise(ctx, 0.9, 'bandpass', 300, 1800, 0.7, 0.45, 0.25);
      noise(ctx, 2.6, 'lowpass', 600, 250, 0.5, 0.25, 0.4, 0.1);
      for (var i = 0; i < 26; i++) noise(ctx, 0.03 + Math.random() * 0.04, 'highpass', 2500, 1500, 0.5, 0.08 + Math.random() * 0.2, 0.002, 0.1 + Math.random() * 2.4);
    }
  };
  function play(name, a) { var c = audio(); if (c && c.state === 'running') try { sfx[name](c, a); } catch (e) {} }

  /* ---------------- Helpers ---------------- */
  var layers = [];
  function layer(tag, css) {
    var el = document.createElement(tag);
    el.className = 'fx-layer';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;' + (css || '');
    document.body.appendChild(el);
    layers.push(el);
    return el;
  }
  function cleanup() { layers.forEach(function (el) { el.remove(); }); layers = []; busy = false; root.classList.remove('intro-pending'); }
  window.addEventListener('pageshow', function (e) { if (e.persisted) cleanup(); });

  function hiDPICanvas(css) {
    var c = layer('canvas', css), dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr);
    c.style.width = '100%'; c.style.height = '100%';
    var g = c.getContext('2d'); g.scale(dpr, dpr);
    return { el: c, g: g };
  }

  // Shake everything on the page (not the effect layers).
  function shake(px, ms) {
    var kf = [];
    for (var i = 0; i < 10; i++) {
      var k = px * (1 - i / 10);
      kf.push({ transform: 'translate(' + ((Math.random() * 2 - 1) * k).toFixed(1) + 'px,' + ((Math.random() * 2 - 1) * k).toFixed(1) + 'px)' });
    }
    kf.push({ transform: 'none' });
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (!el.classList.contains('fx-layer') && el.tagName !== 'SCRIPT' && el.animate) el.animate(kf, { duration: ms, easing: 'linear' });
    });
  }

  /* ---------------- 1. Intro explosion ---------------- */
  function intro() {
    store('rs-intro', '1');
    var safety = setTimeout(cleanup, 6000);
    var cv = hiDPICanvas('z-index:10000;pointer-events:auto;cursor:pointer;');
    var g = cv.g, W = innerWidth, H = innerHeight, cx = W / 2, cy = H / 2;
    var maxR = Math.hypot(W, H) / 2 + 80;
    var CHARGE = 1.0, start = performance.now(), last = start, boomed = false, flash = 0, done = false;
    var sparks = [], debris = [];
    var colors = ['#ffffff', '#c7d2fe', '#6d8bff', '#8b5cf6', '#2dd4bf', '#fde68a'];

    play('woosh', CHARGE);

    function boom() {
      boomed = true; flash = 1;
      root.classList.remove('intro-pending');
      document.body.classList.add('intro-pop');
      setTimeout(function () { document.body.classList.remove('intro-pop'); }, 1200);
      shake(16, 550);
      play('boom');
      for (var i = 0; i < 220; i++) {
        var a = Math.random() * Math.PI * 2, s = 250 + Math.random() * 1500;
        debris.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 1.1, age: 0,
          w: 1 + Math.random() * 3, c: colors[(Math.random() * colors.length) | 0] });
      }
    }

    function skip() { if (!boomed) { start = performance.now() - CHARGE * 1000; } }
    cv.el.addEventListener('click', skip);

    function frame(now) {
      if (done) return;
      var t = (now - start) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      g.setTransform(cv.el.width / W, 0, 0, cv.el.height / H, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, W, H);

      if (t < CHARGE) {
        var p = t / CHARGE, j = p * p * 6;
        var ox = (Math.random() * 2 - 1) * j, oy = (Math.random() * 2 - 1) * j;
        g.fillStyle = '#05070f'; g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'lighter';
        // inward sparks
        for (var n = 0; n < 6; n++) {
          var a = Math.random() * Math.PI * 2, r = 250 + Math.random() * 450;
          sparks.push({ a: a, r: r, v: 500 + Math.random() * 700, c: colors[(Math.random() * colors.length) | 0] });
        }
        sparks = sparks.filter(function (s) { return s.r > 6; });
        sparks.forEach(function (s) {
          var r0 = s.r; s.r -= s.v * dt; s.v *= 1 + dt * 2;
          g.strokeStyle = s.c; g.globalAlpha = 0.8; g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(cx + ox + Math.cos(s.a) * r0, cy + oy + Math.sin(s.a) * r0);
          g.lineTo(cx + ox + Math.cos(s.a) * Math.max(0, s.r - 18), cy + oy + Math.sin(s.a) * Math.max(0, s.r - 18));
          g.stroke();
        });
        g.globalAlpha = 1;
        var cr = 6 + p * p * 70 + Math.random() * 6;
        var grd = g.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, cr * 3);
        grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(199,210,254,0.9)');
        grd.addColorStop(0.6, 'rgba(109,139,255,0.35)'); grd.addColorStop(1, 'rgba(109,139,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(cx + ox, cy + oy, cr * 3, 0, Math.PI * 2); g.fill();
        // horizontal lens streak
        if (p > 0.5) {
          var sw = (p - 0.5) * 2 * W * 0.8;
          var lg = g.createLinearGradient(cx - sw, 0, cx + sw, 0);
          lg.addColorStop(0, 'rgba(45,212,191,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(139,92,246,0)');
          g.fillStyle = lg; g.fillRect(cx - sw, cy + oy - 1.5, sw * 2, 3);
        }
        requestAnimationFrame(frame);
        return;
      }

      if (!boomed) boom();
      var e = t - CHARGE, q = Math.min(e / 1.0, 1), ease = 1 - Math.pow(1 - q, 3);
      var hole = maxR * ease;

      // dark cover with an expanding hole that reveals the page
      g.fillStyle = '#05070f'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'destination-out';
      var hg = g.createRadialGradient(cx, cy, Math.max(0, hole - 70), cx, cy, hole + 1);
      hg.addColorStop(0, 'rgba(0,0,0,1)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hg; g.beginPath(); g.arc(cx, cy, hole + 1, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, Math.max(0, hole - 70), 0, Math.PI * 2); g.fill();

      g.globalCompositeOperation = 'lighter';
      // shockwave rings
      [1, 0.72].forEach(function (k, i) {
        var rr = hole * k, alpha = (1 - q) * (i ? 0.5 : 0.9);
        if (alpha <= 0) return;
        g.strokeStyle = i ? 'rgba(45,212,191,' + alpha + ')' : 'rgba(199,210,254,' + alpha + ')';
        g.lineWidth = 4 + 30 * (1 - q);
        g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
      });
      // debris with trails
      var alive = 0;
      debris.forEach(function (d) {
        d.age += dt; if (d.age > d.life) return; alive++;
        var drag = Math.exp(-dt * 2.2); d.vx *= drag; d.vy *= drag; d.vy += 120 * dt;
        var x0 = d.x, y0 = d.y; d.x += d.vx * dt; d.y += d.vy * dt;
        g.globalAlpha = 1 - d.age / d.life; g.strokeStyle = d.c; g.lineWidth = d.w;
        g.beginPath(); g.moveTo(x0 - d.vx * dt * 2, y0 - d.vy * dt * 2); g.lineTo(d.x, d.y); g.stroke();
      });
      g.globalAlpha = 1;
      // white flash
      flash *= Math.exp(-dt * 5);
      if (flash > 0.01) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(255,255,255,' + flash + ')'; g.fillRect(0, 0, W, H); }

      if (e > 1.1 && alive === 0 && flash < 0.02) {
        done = true; clearTimeout(safety);
        cv.el.style.transition = 'opacity .25s'; cv.el.style.opacity = '0';
        setTimeout(cleanup, 260);
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- Shared: preview of the target page + snapshot of the current one ---------------- */
  function preview(url) {
    var f = layer('iframe', 'z-index:9990;width:100%;height:100%;border:0;background:#0b1020;');
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    var ready = new Promise(function (res) { f.addEventListener('load', res); setTimeout(res, 2500); });
    f.src = url;
    return ready;
  }

  function snapshot(z) {
    var wrap = layer('div', 'z-index:' + z + ';overflow:hidden;will-change:transform;');
    wrap.classList.add('fx-snap');
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el.classList.contains('fx-layer') || el.tagName === 'SCRIPT') return;
      var c = el.cloneNode(true);
      c.querySelectorAll('iframe').forEach(function (fr) {
        var ph = document.createElement('div');
        ph.style.cssText = 'width:100%;height:' + fr.offsetHeight + 'px;background:#fff;border-radius:10px;';
        fr.replaceWith(ph);
      });
      c.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
      wrap.appendChild(c);
    });
    wrap.scrollTop = window.scrollY;
    return wrap;
  }

  function go(url) {
    store('rs-nav', '1');
    window.location.href = url;
  }

  /* ---------------- 2. Anime slice ---------------- */
  function splitPoly(poly, a, b) {
    var L = [], R = [];
    function side(p) { return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); }
    for (var i = 0; i < poly.length; i++) {
      var p = poly[i], q = poly[(i + 1) % poly.length], sp = side(p), sq = side(q);
      (sp >= 0 ? L : R).push(p);
      if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
        var t = sp / (sp - sq), x = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
        L.push(x); R.push(x);
      }
    }
    return [L, R].filter(function (P) { return P.length >= 3; });
  }

  function sliceTo(url) {
    busy = true;
    var W = innerWidth, H = innerHeight, rnd = function (a, b) { return a + Math.random() * (b - a); };
    var ready = preview(url);
    var cuts = [
      [{ x: -50, y: H * rnd(0.15, 0.35) }, { x: W + 50, y: H * rnd(0.55, 0.8) }],
      [{ x: W * rnd(0.55, 0.75), y: -50 }, { x: W * rnd(0.2, 0.4), y: H + 50 }],
      [{ x: -50, y: H * rnd(0.7, 0.9) }, { x: W + 50, y: H * rnd(0.25, 0.45) }]
    ];
    var pieces = [[{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }]];
    cuts.forEach(function (c) {
      var next = []; pieces.forEach(function (P) { next = next.concat(splitPoly(P, c[0], c[1])); }); pieces = next;
    });

    var els = pieces.map(function (P, i) {
      var el = snapshot(9991 + i);
      el.style.clipPath = 'polygon(' + P.map(function (p) { return p.x.toFixed(1) + 'px ' + p.y.toFixed(1) + 'px'; }).join(',') + ')';
      var cxp = 0, cyp = 0; P.forEach(function (p) { cxp += p.x; cyp += p.y; }); cxp /= P.length; cyp /= P.length;
      // small push away from each cut line
      var px = 0, py = 0;
      cuts.forEach(function (c) {
        var dx = c[1].x - c[0].x, dy = c[1].y - c[0].y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
        var s = Math.sign((cxp - c[0].x) * nx + (cyp - c[0].y) * ny) || 1;
        px += nx * s * 5; py += ny * s * 5;
      });
      return { el: el, cy: cyp, cx: cxp, px: px, py: py };
    });

    // slash lines
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'fx-layer');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.cssText = 'position:fixed;inset:0;z-index:10001;pointer-events:none;overflow:visible;';
    svg.innerHTML = '<defs><filter id="fxglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    document.body.appendChild(svg); layers.push(svg);
    var flash = layer('div', 'z-index:10000;background:#fff;opacity:0;');

    cuts.forEach(function (c, i) {
      var len = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y);
      [['#8b5cf6', 14, 0.55], ['#c7d2fe', 5, 0.9], ['#ffffff', 2, 1]].forEach(function (st) {
        var ln = document.createElementNS(svgNS, 'line');
        ln.setAttribute('x1', c[0].x); ln.setAttribute('y1', c[0].y); ln.setAttribute('x2', c[1].x); ln.setAttribute('y2', c[1].y);
        ln.setAttribute('stroke', st[0]); ln.setAttribute('stroke-width', st[1]); ln.setAttribute('stroke-linecap', 'round');
        ln.setAttribute('opacity', st[2]); ln.setAttribute('filter', 'url(#fxglow)');
        ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len;
        svg.appendChild(ln);
        var d = 80 + i * 150;
        ln.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 110, delay: d, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)' });
        ln.animate([{ opacity: st[2], strokeWidth: st[1] }, { opacity: st[2] * 0.6, strokeWidth: st[1] * 0.4 }, { opacity: 0, strokeWidth: 0.5 }],
          { duration: 900, delay: d + 110, fill: 'forwards' });
      });
      setTimeout(function () { flash.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 160 }); }, 80 + i * 150 + 60);
      play('shing', (80 + i * 150) / 1000);
    });

    // anime beat: pieces slip along the cuts, then fall
    setTimeout(function () {
      els.forEach(function (p) {
        p.el.animate([{ transform: 'none' }, { transform: 'translate(' + p.px + 'px,' + p.py + 'px)' }],
          { duration: 140, fill: 'forwards', easing: 'ease-out' });
      });
      play('clunk');
    }, 760);

    Promise.all([ready, new Promise(function (r) { setTimeout(r, 1050); })]).then(function () {
      var order = els.slice().sort(function (a, b) { return b.cy - a.cy; });
      var longest = 0;
      order.forEach(function (p, i) {
        var delay = i * 60 + Math.random() * 40, dur = 950 + Math.random() * 350;
        var rot = (p.cx < W / 2 ? -1 : 1) * (8 + Math.random() * 30);
        var dx = (p.cx - W / 2) * 0.25 + (Math.random() * 2 - 1) * 60;
        p.el.animate([
          { transform: 'translate(' + p.px + 'px,' + p.py + 'px) rotate(0deg)' },
          { transform: 'translate(' + (p.px + dx) + 'px,' + (H * 1.35) + 'px) rotate(' + rot + 'deg)' }
        ], { duration: dur, delay: delay, fill: 'forwards', easing: 'cubic-bezier(.55,0,.85,.45)' });
        longest = Math.max(longest, delay + dur);
      });
      setTimeout(function () { go(url); }, longest + 60);
    });
  }

  /* ---------------- 3. Fire burn ---------------- */
  function burnTo(url, ox, oy) {
    busy = true;
    var W = innerWidth, H = innerHeight;
    var ready = preview(url);
    var snap = snapshot(9991);
    var fire = hiDPICanvas('z-index:9995;');
    var g = fire.g;

    var GW = 200, GH = Math.max(60, Math.round(GW * H / W)), cw = W / GW, ch = H / GH;
    var mask = document.createElement('canvas'); mask.width = GW; mask.height = GH;
    var mg = mask.getContext('2d'), img = mg.createImageData(GW, GH);
    var heat = document.createElement('canvas'); heat.width = GW; heat.height = GH;
    var hg = heat.getContext('2d'), himg = hg.createImageData(GW, GH), scorch = document.createElement('canvas');
    scorch.width = GW; scorch.height = GH;
    var sg = scorch.getContext('2d'), simg = sg.createImageData(GW, GH);

    // value noise
    var NS = 12, grid = [];
    for (var i = 0; i < (NS + 1) * (NS + 1); i++) grid.push(Math.random());
    function vn(x, y) {
      x *= NS; y *= NS; var xi = Math.min(NS - 1, x | 0), yi = Math.min(NS - 1, y | 0), fx = x - xi, fy = y - yi;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = grid[yi * (NS + 1) + xi], b = grid[yi * (NS + 1) + xi + 1], c = grid[(yi + 1) * (NS + 1) + xi], d = grid[(yi + 1) * (NS + 1) + xi + 1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }
    var origins = [{ x: ox, y: oy, d: 0 }, { x: W * 0.15, y: H + 20, d: 0.35 }, { x: W * 0.85, y: H + 20, d: 0.5 }];
    var tt = new Float32Array(GW * GH), maxT = 0, diag = Math.hypot(W, H);
    for (var y = 0; y < GH; y++) for (var x = 0; x < GW; x++) {
      var px = (x + 0.5) * cw, py = (y + 0.5) * ch, best = 1e9;
      origins.forEach(function (o) { best = Math.min(best, o.d + Math.hypot(px - o.x, py - o.y) / diag * 2.0); });
      var v = best + (vn(x / GW, y / GH) - 0.5) * 0.55 + (vn(y / GH * 0.7 + 0.3, x / GW * 0.7) - 0.5) * 0.25;
      tt[y * GW + x] = v; if (v > maxT) maxT = v;
    }

    var parts = [], start = performance.now(), last = start, SPEED = 1.0, ended = false;
    play('ignite');

    function frame(now) {
      var T = (now - start) / 1000 * SPEED - 0.1, dt = Math.min(0.05, (now - last) / 1000); last = now;

      // mask (intact = opaque), scorch band and glowing edge, all on small grids upscaled smoothly
      var d = img.data, hd = himg.data, sd = simg.data;
      for (var k = 0; k < GW * GH; k++) {
        var dtc = tt[k] - T, a = dtc / 0.1, i4 = k * 4;
        a = a < 0 ? 0 : a > 1 ? 1 : a;
        d[i4 + 3] = a * 255;
        // scorch: dark char just ahead of the flame
        var sc = dtc > 0 && dtc < 0.22 ? 1 - dtc / 0.22 : 0;
        sd[i4] = 28; sd[i4 + 1] = 12; sd[i4 + 2] = 4; sd[i4 + 3] = sc * sc * 235;
        // glow: hot band right at the burning edge
        var gl = Math.max(0, 1 - Math.abs(dtc + 0.01) / 0.06);
        hd[i4] = 255; hd[i4 + 1] = 110 + gl * 110; hd[i4 + 2] = 30 + gl * 40; hd[i4 + 3] = gl * 255;
        if (gl > 0.6 && Math.random() < 0.06 && parts.length < 1400) {
          parts.push({ x: ((k % GW) + Math.random()) * cw, y: ((k / GW | 0) + 0.5) * ch, vx: (Math.random() - 0.5) * 30, vy: -60 - Math.random() * 150,
            r: 5 + Math.random() * 10, age: 0, life: 0.5 + Math.random() * 0.7, ph: Math.random() * 6 });
        }
      }
      mg.putImageData(img, 0, 0); sg.putImageData(simg, 0, 0); hg.putImageData(himg, 0, 0);
      var url_ = 'url(' + mask.toDataURL() + ')';
      snap.style.webkitMaskImage = url_; snap.style.maskImage = url_;
      snap.style.webkitMaskSize = '100% 100%'; snap.style.maskSize = '100% 100%';

      g.setTransform(fire.el.width / W, 0, 0, fire.el.height / H, 0, 0);
      g.clearRect(0, 0, W, H);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.globalCompositeOperation = 'source-over';
      g.drawImage(scorch, 0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      g.drawImage(heat, 0, 0, W, H);
      g.globalAlpha = 0.6; g.drawImage(heat, -cw, -ch * 2, W + cw * 2, H + ch * 2); g.globalAlpha = 1;
      // flame particles
      parts = parts.filter(function (p) { return p.age < p.life; });
      parts.forEach(function (p) {
        p.age += dt; var k = p.age / p.life;
        p.vy -= 60 * dt; p.x += (p.vx + Math.sin(p.ph + p.age * 9) * 25) * dt; p.y += p.vy * dt;
        var r = p.r * (1 - k * 0.6);
        var col = k < 0.25 ? '255,240,180' : k < 0.55 ? '255,150,40' : '220,60,20';
        var gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, 'rgba(' + col + ',' + (0.9 * (1 - k)).toFixed(3) + ')');
        gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
      });

      if (T > maxT + 0.1 && !ended) {
        ended = true;
        ready.then(function () {
          fire.el.style.transition = 'opacity .35s'; fire.el.style.opacity = '0';
          setTimeout(function () { go(url); }, 380);
        });
      }
      if (!ended || parts.length) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------------- Link interception ---------------- */
  var busy = false;
  function page(path) { var m = path.match(/([^\/]*)$/); return (m && m[1]) || 'index.html'; }

  if (!reduced) {
    document.addEventListener('click', function (e) {
      if (busy) { e.preventDefault(); return; }
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return;
      var to = page(u.pathname), here = page(location.pathname);
      if (to === here) return;
      if (to === 'projects.html') { e.preventDefault(); audio(); sliceTo(u.href); }
      else if (to === 'resume.html') { e.preventDefault(); audio(); burnTo(u.href, e.clientX || innerWidth / 2, e.clientY || innerHeight / 2); }
    });
  }

  if (root.classList.contains('intro-pending')) {
    if (reduced) root.classList.remove('intro-pending');
    else intro();
  }
})();
