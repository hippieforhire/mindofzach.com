/* ============================================================
 * arcade.js — shared core for the Mind of Zach arcade
 * Fixed-timestep loop, WebAudio synth SFX, particles, screen
 * shake, floating score popups, high scores, input helpers,
 * neon drawing helpers, modal lifecycle utilities.
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- storage / high scores ---------------- */
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('moz:' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem('moz:' + k, JSON.stringify(v)); } catch (e) {}
    }
  };

  function getHi(game) { return store.get('hi:' + game, 0) | 0; }

  // Returns true when score is a new record.
  function setHi(game, score) {
    score = score | 0;
    if (score > getHi(game)) { store.set('hi:' + game, score); return true; }
    return false;
  }

  function bumpPlays(game) {
    const n = store.get('plays:' + game, 0) | 0;
    store.set('plays:' + game, n + 1);
  }

  /* ---------------- audio: tiny synth, no assets ---------------- */
  const sfx = (function () {
    let ctx = null;
    let muted = store.get('muted', false);

    function ac() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(o) {
      if (muted) return;
      const c = ac(); if (!c) return;
      const t0 = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.f || 440, t0);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + (o.t || 0.1));
      g.gain.setValueAtTime(o.v || 0.12, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.t || 0.1));
      osc.connect(g); g.connect(c.destination);
      osc.start(t0); osc.stop(t0 + (o.t || 0.1) + 0.02);
    }

    function noise(o) {
      if (muted) return;
      const c = ac(); if (!c) return;
      o = o || {};
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.t || 0.3;
      const len = Math.max(1, (dur * c.sampleRate) | 0);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.setValueAtTime(o.f || 1200, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(60, o.fEnd || 120), t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(o.v || 0.2, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start(t0);
    }

    return {
      unlock() { try { ac(); } catch (e) {} },
      toggleMute() { muted = !muted; store.set('muted', muted); return muted; },
      isMuted() { return muted; },
      tone, noise,
      click()  { tone({ f: 660, t: 0.06, type: 'square', v: 0.07 }); },
      shoot()  { tone({ f: 900, t: 0.09, type: 'square', v: 0.06, slide: 240 }); },
      enemyShoot() { tone({ f: 300, t: 0.12, type: 'sawtooth', v: 0.05, slide: 120 }); },
      eat()    { tone({ f: 520, t: 0.09, type: 'sine', v: 0.12, slide: 1040 }); },
      jump()   { tone({ f: 300, t: 0.12, type: 'square', v: 0.08, slide: 700 }); },
      hit()    { noise({ t: 0.25, v: 0.22, f: 900, fEnd: 90 }); tone({ f: 160, t: 0.25, type: 'sawtooth', v: 0.12, slide: 50 }); },
      explode(){ noise({ t: 0.5, v: 0.28, f: 1600, fEnd: 60 }); },
      pop()    { tone({ f: 700, t: 0.05, type: 'triangle', v: 0.1, slide: 1400 }); },
      power()  { tone({ f: 440, t: 0.16, type: 'sine', v: 0.12, slide: 1320 }); tone({ f: 660, t: 0.16, type: 'sine', v: 0.1, slide: 1760, delay: 0.08 }); },
      win()    { [523, 659, 784, 1046].forEach((f, i) => tone({ f, t: 0.14, type: 'triangle', v: 0.12, delay: i * 0.1 })); },
      lose()   { [392, 330, 262, 196].forEach((f, i) => tone({ f, t: 0.18, type: 'triangle', v: 0.12, delay: i * 0.12 })); },
      tick()   { tone({ f: 1200, t: 0.03, type: 'square', v: 0.04 }); },
      place()  { tone({ f: 220, t: 0.07, type: 'triangle', v: 0.1, slide: 180 }); },
      clear()  { [440, 554, 659, 880].forEach((f, i) => tone({ f, t: 0.1, type: 'square', v: 0.07, delay: i * 0.05 })); },
      good()   { tone({ f: 587, t: 0.12, type: 'sine', v: 0.1, slide: 880 }); },
      bad()    { tone({ f: 200, t: 0.2, type: 'sawtooth', v: 0.1, slide: 90 }); },
    };
  })();

  /* ---------------- particles ---------------- */
  class Particles {
    constructor() { this.list = []; }
    burst(x, y, o) {
      o = o || {};
      const n = o.n || 18;
      const colors = o.colors || o.color || ['#ffffff'];
      const cols = Array.isArray(colors) ? colors : [colors];
      const speed = o.speed || 220;
      const life = o.life || 0.7;
      const size = o.size || 3;
      const grav = o.gravity || 0;
      const spread = o.spread == null ? Math.PI * 2 : o.spread;
      const dir = o.dir || 0;
      for (let i = 0; i < n; i++) {
        const a = dir + (Math.random() - 0.5) * spread;
        const sp = speed * (0.3 + Math.random() * 0.9);
        this.list.push({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: life * (0.6 + Math.random() * 0.7), age: 0,
          size: size * (0.5 + Math.random()),
          color: cols[(Math.random() * cols.length) | 0],
          grav
        });
      }
      if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
    }
    trail(x, y, color, size) {
      this.list.push({
        x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
        life: 0.35, age: 0, size: (size || 3) * (0.5 + Math.random() * 0.5),
        color: color || '#ffffff', grav: 0
      });
    }
    update(dt) {
      const l = this.list;
      for (let i = l.length - 1; i >= 0; i--) {
        const p = l[i];
        p.age += dt;
        if (p.age >= p.life) { l.splice(i, 1); continue; }
        p.vy += p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= (1 - 1.6 * dt); p.vy *= (1 - 1.6 * dt);
      }
    }
    draw(ctx) {
      const l = this.list;
      if (!l.length) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < l.length; i++) {
        const p = l[i];
        const t = 1 - p.age / p.life;
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        const s = p.size * (0.4 + 0.6 * t);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.restore();
    }
    clear() { this.list.length = 0; }
  }

  /* ---------------- screen shake ---------------- */
  class Shake {
    constructor() { this.trauma = 0; }
    add(a) { this.trauma = Math.min(1, this.trauma + a); }
    update(dt) { this.trauma = Math.max(0, this.trauma - dt * 1.6); }
    apply(ctx) {
      if (this.trauma <= 0) return;
      const s = this.trauma * this.trauma * 14;
      ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
    }
  }

  /* ---------------- floating score popups ---------------- */
  class Floaters {
    constructor() { this.list = []; }
    add(x, y, text, color, size) {
      this.list.push({ x, y, text: String(text), color: color || '#fff', size: size || 16, age: 0, life: 1.0 });
    }
    update(dt) {
      const l = this.list;
      for (let i = l.length - 1; i >= 0; i--) {
        const f = l[i];
        f.age += dt; f.y -= 42 * dt;
        if (f.age >= f.life) l.splice(i, 1);
      }
    }
    draw(ctx) {
      const l = this.list;
      if (!l.length) return;
      ctx.save();
      ctx.textAlign = 'center';
      for (let i = 0; i < l.length; i++) {
        const f = l[i];
        ctx.globalAlpha = 1 - f.age / f.life;
        ctx.font = 'bold ' + f.size + 'px Rajdhani, sans-serif';
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.restore();
    }
    clear() { this.list.length = 0; }
  }

  /* ---------------- fixed-timestep game loop ---------------- */
  function createLoop(update, render, stepMs) {
    stepMs = stepMs || 1000 / 60;
    let acc = 0, last = 0, raf = 0, running = false;
    function frame(t) {
      if (!running) return;
      if (!last) last = t;
      let dt = t - last; last = t;
      if (dt > 250) dt = 250;
      acc += dt;
      let guard = 0;
      while (acc >= stepMs && guard++ < 5) { update(stepMs / 1000); acc -= stepMs; }
      if (guard >= 5) acc = 0;
      render();
      raf = requestAnimationFrame(frame);
    }
    return {
      start() { if (running) return; running = true; last = 0; acc = 0; raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      get running() { return running; }
    };
  }

  /* ---------------- neon drawing helpers ---------------- */
  function neonOn(ctx, color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur == null ? 14 : blur;
  }
  function neonOff(ctx) { ctx.shadowBlur = 0; }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function glowText(ctx, text, x, y, font, color, align) {
    ctx.save();
    ctx.font = font;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    neonOn(ctx, color, 16);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    neonOff(ctx);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawStarfield(stars, ctx, w, h, speedMul) {
    ctx.save();
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.y += s.speed * (speedMul || 1);
      if (s.y > h) { s.y -= h; s.x = Math.random() * w; }
      ctx.globalAlpha = s.tw * (0.5 + 0.5 * Math.sin(s.phase += 0.03));
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.restore();
  }

  function makeStars(n, w, h) {
    const stars = [];
    const colors = ['#ffffff', '#aee2ff', '#ffd7f5', '#d0ffd7'];
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * w, y: Math.random() * h,
        size: Math.random() < 0.85 ? 1 : 2,
        speed: 8 + Math.random() * 42,
        tw: 0.35 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
    return stars;
  }

  /* ---------------- input helpers ---------------- */
  // Hold-to-repeat binder for on-screen touch buttons.
  function bindHold(el, on, off) {
    if (!el) return;
    const start = (e) => { e.preventDefault(); sfx.unlock(); on(); };
    const end = (e) => { e.preventDefault(); if (off) off(); };
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  function bindTap(el, fn) {
    if (!el) return;
    el.addEventListener('click', (e) => { e.preventDefault(); sfx.unlock(); fn(e); });
  }

  // Prevent page scroll when arrows/space are used inside a game area.
  function trapGameKeys(el) {
    (el || document).addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    });
  }

  /* ---------------- modal lifecycle ---------------- */
  // Standard modal game shell. Games register onPause/onResume handlers.
  const modalGames = {};
  function registerModalGame(modalId, handlers) {
    modalGames[modalId] = handlers || {};
  }
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('hidden');
    document.body.classList.add('arcade-modal-open');
    sfx.unlock();
    const h = modalGames[id];
    if (h && h.onOpen) h.onOpen();
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.classList.add('hidden');
    document.body.classList.remove('arcade-modal-open');
    const h = modalGames[id];
    if (h && h.onClose) h.onClose();
  }

  // Canvas fit: fixed internal resolution, CSS scales to container.
  function fitCanvas(canvas, w, h) {
    canvas.width = w; canvas.height = h;
    canvas.style.aspectRatio = w + ' / ' + h;
  }

  // Wiring helper: standard start overlay inside a modal.
  // overlay el covers canvas; click/keypress starts the game.
  function wireStartOverlay(modalId, startFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return { show() {}, hide() {} };
    let overlay = modal.querySelector('.game-start-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'game-start-overlay';
      const wrap = modal.querySelector('.game-canvas-wrap') || modal;
      wrap.style.position = 'relative';
      wrap.appendChild(overlay);
    }
    const show = (html) => {
      overlay.innerHTML = html || '<div class="go-title">READY</div><div class="go-sub">click / tap to start</div>';
      overlay.classList.remove('hidden');
    };
    const hide = () => overlay.classList.add('hidden');
    overlay.onclick = () => { sfx.unlock(); hide(); startFn(); };
    return { show, hide };
  }

  function gameOverOverlay(modalId, html) {
    const modal = document.getElementById(modalId);
    if (!modal) return { show() {}, hide() {} };
    let overlay = modal.querySelector('.game-over-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'game-over-overlay';
      const wrap = modal.querySelector('.game-canvas-wrap') || modal;
      wrap.style.position = 'relative';
      wrap.appendChild(overlay);
    }
    return {
      show(inner) { overlay.innerHTML = inner || html; overlay.classList.remove('hidden'); },
      hide() { overlay.classList.add('hidden'); },
      el: overlay
    };
  }

  /* ---------------- export ---------------- */
  window.Arcade = {
    store, getHi, setHi, bumpPlays,
    sfx, Particles, Shake, Floaters,
    createLoop,
    neonOn, neonOff, rr, glowText, drawStarfield, makeStars,
    bindHold, bindTap, trapGameKeys,
    registerModalGame, openModal, closeModal,
    fitCanvas, wireStartOverlay, gameOverOverlay,
    clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp(a, b, t) { return a + (b - a) * t; },
    rand(a, b) { return a + Math.random() * (b - a); },
    randi(a, b) { return (a + Math.random() * (b - a + 1)) | 0; },
    choice(arr) { return arr[(Math.random() * arr.length) | 0]; },
    TAU: Math.PI * 2
  };
})();
