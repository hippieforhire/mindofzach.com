/* ============================================================
 * galaga.js — Galaga (1981) clone, neon edition.
 *
 * Swooping entry paths, formation dives, boss capture beams and
 * dual-fighter rescues. No assets: all art is canvas vector neon.
 * ============================================================ */
(function () {
  'use strict';
  const A = window.Arcade;

  const canvas = document.getElementById('galagaCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('galagaScore');
  const hiEl = document.getElementById('galagaHi');
  const bestEl = document.getElementById('galagaBest');
  const pauseBtn = document.getElementById('galagaPause');
  const modalEl = document.getElementById('galagaModal');

  const W = 480, H = 640;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();
  const stars = A.makeStars(110, W, H);

  const SHIP_Y = H - 72;
  const SHIP_SPEED = 400;
  const BULLET_SPEED = 680;
  const FIRE_CD = 0.30;
  const DUAL_CD = 0.24;
  const MAX_LIVES = 3;

  const TYPES = {
    boss: { hp: 2, r: 17, color: '#b6ff2e', score: 150, diveScore: 400 },
    goei: { hp: 1, r: 14, color: '#ff2fd6', score: 80, diveScore: 160 },
    zako: { hp: 1, r: 12, color: '#00f0ff', score: 50, diveScore: 100 }
  };

  let enemies, bullets, ebullets;
  let score, best, newBest, lives, wave, state;
  let player, firing, keys, fireT, dual, invuln;
  let diveTimer, beamCd, swayT, respawnT, overT, clearT;

  const startOverlay = A.wireStartOverlay('galagaModal', startGame);
  const overOverlay = A.gameOverOverlay('galagaModal');

  function buildSlots() {
    const s = [];
    for (let i = 0; i < 4; i++) s.push({ type: 'boss', ox: -66 + i * 44, oy: 126 });
    for (let i = 0; i < 8; i++) s.push({ type: 'goei', ox: -66 + (i % 4) * 44, oy: 172 + ((i / 4) | 0) * 44 });
    for (let i = 0; i < 12; i++) s.push({ type: 'zako', ox: -110 + (i % 6) * 44, oy: 260 + ((i / 6) | 0) * 44 });
    return s;
  }

  function reset() {
    enemies = []; bullets = []; ebullets = [];
    particles.clear(); floaters.clear(); shake.trauma = 0;
    score = 0; lives = MAX_LIVES; wave = 0; newBest = false;
    dual = false; invuln = 0; firing = false; fireT = 0;
    keys = { left: false, right: false };
    player = { x: W / 2, alive: false };
    respawnT = 0; overT = 0; clearT = 0;
    diveTimer = 3; beamCd = 5; swayT = 0;
    best = A.getHi('galaga');
    hiEl.textContent = best;
    bestEl.textContent = ''; bestEl.classList.add('hidden');
    paintScore();
    state = 'ready';
  }

  function startGame() {
    reset();
    A.bumpPlays('galaga');
    setupWave(1);
    player.alive = true;
    invuln = 1.5;
    state = 'playing';
    loop.start();
  }

  function paintScore() {
    scoreEl.textContent = String(score).padStart(6, '0');
  }

  function addScore(n, x, y, color) {
    score += n;
    paintScore();
    if (A.setHi('galaga', score)) {
      newBest = true;
      hiEl.textContent = score;
      bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
    }
    if (x !== undefined) floaters.add(x, y, '+' + n, color || '#ffd700', 15);
  }

  function setupWave(n) {
    wave = n;
    const slots = buildSlots();
    enemies = slots.map((s, i) => {
      const side = (i % 2 === 0) ? -1 : 1;
      const sx = side < 0 ? -50 : W + 50;
      return {
        type: s.type, hp: TYPES[s.type].hp, slot: s,
        x: sx, y: -70 - i * 26,
        state: 'entering', delay: 0.4 + i * 0.09, t: 0, dur: 1.7,
        p0: { x: sx, y: -70 - i * 26 },
        p1: { x: side < 0 ? W * 0.2 : W * 0.8, y: H * 0.5 },
        fireT: A.rand(1.5, 4), diving: false, divePhase: 0, diveTx: 0,
        beam: null, captured: 0, flash: 0, wob: Math.random() * A.TAU
      };
    });
    diveTimer = 3;
    beamCd = 5;
    floaters.add(W / 2, H / 2 - 20, 'WAVE ' + n, '#ffd700', 36);
    A.sfx.power();
  }

  function slotWorld(e) {
    return { x: W / 2 + Math.sin(swayT) * 44 + e.slot.ox, y: e.slot.oy };
  }

  function qbez(p0, p1, p2, t) {
    const u = 1 - t;
    return {
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y
    };
  }

  function enemyShoot(x, y, aimed) {
    let vx = A.rand(-40, 40), vy = 240 + wave * 26;
    if (aimed && player.alive) {
      const dx = player.x - x, dy = SHIP_Y - y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 260 + wave * 26;
      vx = dx / d * sp; vy = dy / d * sp;
    }
    ebullets.push({ x, y, vx, vy });
    A.sfx.enemyShoot();
  }

  function updateBeam(e, dt) {
    const b = e.beam;
    b.t -= dt;
    if (player.alive) {
      if (Math.abs(player.x - e.x) < 26) b.prog += dt;
      else b.prog = Math.max(0, b.prog - dt * 2.5);
      if (b.prog >= 0.55) { capturePlayer(e); return; }
    }
    if (b.t <= 0) e.beam = null;
  }

  function capturePlayer(boss) {
    boss.beam = null;
    boss.captured++;
    player.alive = false;
    dual = false;
    lives--;
    A.sfx.bad();
    shake.add(0.45);
    floaters.add(player.x, SHIP_Y - 40, 'CAPTURED!', '#ff2fd6', 22);
    particles.burst(player.x, SHIP_Y, { n: 26, colors: ['#ff2fd6', '#ffffff'], speed: 260, life: 0.7, size: 4 });
    if (lives > 0) respawnT = 1.4;
    else overT = 1.4;
  }

  function hitPlayer() {
    if (!player.alive || invuln > 0) return;
    if (dual) {
      dual = false;
      invuln = 1.6;
      A.sfx.hit();
      shake.add(0.5);
      particles.burst(player.x + 16, SHIP_Y, { n: 30, colors: ['#00f0ff', '#ffffff'], speed: 320, life: 0.8, size: 4 });
      floaters.add(player.x, SHIP_Y - 44, 'WINGMAN DOWN', '#ff6b6b', 18);
      return;
    }
    player.alive = false;
    lives--;
    A.sfx.hit();
    shake.add(0.7);
    particles.burst(player.x, SHIP_Y, { n: 46, colors: ['#00f0ff', '#ffffff', '#ffd700'], speed: 380, life: 1, size: 5 });
    if (lives > 0) respawnT = 1.5;
    else overT = 1.5;
  }

  function killEnemy(e, byBullet) {
    const idx = enemies.indexOf(e);
    if (idx >= 0) enemies.splice(idx, 1);
    const T = TYPES[e.type];
    particles.burst(e.x, e.y, {
      n: e.type === 'boss' ? 34 : 20,
      colors: [T.color, '#ffffff', '#ffd700'], speed: 300, life: 0.8, size: 4
    });
    A.sfx.explode();
    if (byBullet) addScore(e.diving ? T.diveScore : T.score, e.x, e.y, T.color);
    if (e.type === 'boss' && e.captured > 0) {
      if (e.diving && byBullet) {
        dual = true;
        floaters.add(player.x, SHIP_Y - 50, 'DUAL FIGHTER!', '#00f0ff', 24);
        A.sfx.power();
        particles.burst(player.x, SHIP_Y, { n: 30, colors: ['#00f0ff', '#ffffff'], speed: 260, life: 0.8, size: 4 });
      } else {
        floaters.add(e.x, e.y, 'SHIP LOST', '#ff6b6b', 18);
      }
      e.captured = 0;
    }
    if (!enemies.length && state === 'playing' && !clearT) {
      const bonus = wave * 100;
      addScore(bonus, W / 2, H / 2 + 40, '#ffd700');
      floaters.add(W / 2, H / 2 - 60, 'WAVE CLEAR', '#a6ff00', 30);
      A.sfx.win();
      clearT = 2.4;
    }
  }

  function updateDive(e, dt) {
    const sp = 300 + wave * 34;
    if (e.divePhase === 0) {
      const tx = e.diveTx, ty = SHIP_Y - 50;
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 26) {
        e.divePhase = 1;
        if (player.alive) enemyShoot(e.x, e.y + 10, true);
        e.diveTx = A.clamp(e.x + A.rand(-190, 190), 20, W - 20);
      } else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
    } else if (e.divePhase === 1) {
      const tx = e.diveTx, ty = H + 60;
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 30) e.divePhase = 2;
      else { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
    } else {
      const p = slotWorld(e);
      const dx = p.x - e.x, dy = -60 - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 40) {
        e.state = 'entering'; e.diving = false; e.t = 0; e.dur = 0.9; e.delay = 0;
        e.p0 = { x: e.x, y: e.y };
        e.p1 = { x: p.x, y: 140 };
      } else { e.x += dx / d * sp * 0.8 * dt; e.y += dy / d * sp * 0.8 * dt; }
    }
    if (player.alive && invuln <= 0) {
      const dx = e.x - player.x, dy = e.y - SHIP_Y;
      if (dx * dx + dy * dy < 30 * 30) {
        killEnemy(e, false);
        hitPlayer();
      }
    }
  }

  function updateEnemies(dt) {
    diveTimer -= dt;
    if (diveTimer <= 0) {
      const cands = enemies.filter(e => e.state === 'formation' && !e.beam);
      if (cands.length) {
        const e = cands[(Math.random() * cands.length) | 0];
        e.state = 'diving'; e.diving = true; e.divePhase = 0;
        e.diveTx = player.x + A.rand(-30, 30);
      }
      diveTimer = Math.max(0.7, 2.6 - wave * 0.28);
    }
    beamCd -= dt;
    if (beamCd <= 0) {
      const bosses = enemies.filter(e => e.state === 'formation' && e.type === 'boss' && !e.beam);
      if (bosses.length && player.alive) {
        bosses[(Math.random() * bosses.length) | 0].beam = { t: 2.6, prog: 0 };
        A.sfx.enemyShoot();
      }
      beamCd = Math.max(3, A.rand(5, 8.5) - wave * 0.4);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.wob += dt * 6;
      if (e.flash > 0) e.flash -= dt;

      if (e.state === 'entering') {
        if (e.delay > 0) { e.delay -= dt; continue; }
        e.t += dt / e.dur;
        const p = qbez(e.p0, e.p1, slotWorld(e), Math.min(1, e.t));
        e.x = p.x; e.y = p.y;
        if (e.t >= 1) e.state = 'formation';
      } else if (e.state === 'formation') {
        const p = slotWorld(e);
        e.x = p.x + Math.sin(e.wob * 0.5) * 4;
        e.y = p.y;
        e.fireT -= dt;
        if (e.fireT <= 0 && ebullets.length < 5 + wave && player.alive) {
          enemyShoot(e.x, e.y + 14, false);
          e.fireT = A.rand(2.5, 5.5) / (1 + wave * 0.12);
        }
        if (e.beam) updateBeam(e, dt);
      } else if (e.state === 'diving') {
        updateDive(e, dt);
      }
    }
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= BULLET_SPEED * dt;
      if (b.y < -20) { bullets.splice(i, 1); continue; }
      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const r = TYPES[e.type].r + 5;
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < r * r) {
          hit = true;
          e.hp--; e.flash = 0.12;
          if (e.hp <= 0) killEnemy(e, true);
          else A.sfx.tick();
          break;
        }
      }
      if (hit) bullets.splice(i, 1);
    }
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 20 || b.x < -20 || b.x > W + 20) { ebullets.splice(i, 1); continue; }
      if (player.alive && invuln <= 0) {
        const dx = b.x - player.x, dy = b.y - SHIP_Y;
        if (dx * dx + dy * dy < 17 * 17) { ebullets.splice(i, 1); hitPlayer(); }
      }
    }
  }

  function update(dt) {
    if (state !== 'playing') return;
    swayT += dt;

    if (player.alive) {
      if (keys.left) player.x -= SHIP_SPEED * dt;
      if (keys.right) player.x += SHIP_SPEED * dt;
      player.x = A.clamp(player.x, 26, W - 26);
      if (invuln > 0) invuln -= dt;
      fireT -= dt;
      if (firing && fireT <= 0) {
        const xs = dual ? [player.x - 16, player.x + 16] : [player.x];
        for (const x of xs) bullets.push({ x, y: SHIP_Y - 18 });
        fireT = dual ? DUAL_CD : FIRE_CD;
        A.sfx.shoot();
      }
    }

    if (respawnT > 0) {
      respawnT -= dt;
      if (respawnT <= 0) { player.alive = true; player.x = W / 2; invuln = 2; dual = false; }
    }
    if (overT > 0) {
      overT -= dt;
      if (overT <= 0) { endGame(); return; }
    }
    if (clearT > 0) {
      clearT -= dt;
      if (clearT <= 0) setupWave(wave + 1);
    }

    updateEnemies(dt);
    updateBullets(dt);

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  function endGame() {
    state = 'over';
    A.sfx.lose();
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        '<div class="go-score">' + score + '</div>' +
        '<div class="go-sub">WAVE ' + wave + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="galagaRetry">PLAY AGAIN</button>'
      );
      document.getElementById('galagaRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 700);
  }

  /* ---------------- drawing ---------------- */

  function drawShip(x, y, s, flip) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.rotate(Math.PI);
    ctx.scale(s, s);
    A.neonOn(ctx, '#00f0ff', 14);
    ctx.fillStyle = '#e8feff';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(7, -2);
    ctx.lineTo(18, 12);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 12);
    ctx.lineTo(-7, 8);
    ctx.lineTo(-18, 12);
    ctx.lineTo(-7, -2);
    ctx.closePath();
    ctx.fill();
    A.neonOff(ctx);
    ctx.fillStyle = '#ff2fd6';
    ctx.fillRect(-2.5, -8, 5, 12);
    ctx.restore();
  }

  function drawEnemy(e) {
    const T = TYPES[e.type];
    const flap = Math.sin(e.wob) * 0.5;
    ctx.save();
    ctx.translate(e.x, e.y);
    const col = e.flash > 0 ? '#ffffff' : T.color;
    A.neonOn(ctx, col, 14);
    ctx.fillStyle = col;
    if (e.type === 'zako') {
      ctx.beginPath();
      ctx.moveTo(0, 12);
      ctx.lineTo(5, 0); ctx.lineTo(13, -6 - flap * 6);
      ctx.lineTo(5, -8); ctx.lineTo(0, -14);
      ctx.lineTo(-5, -8); ctx.lineTo(-13, -6 - flap * 6);
      ctx.lineTo(-5, 0);
      ctx.closePath(); ctx.fill();
    } else if (e.type === 'goei') {
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(6, 2); ctx.lineTo(17, -4 - flap * 7);
      ctx.lineTo(8, -10); ctx.lineTo(4, -16);
      ctx.lineTo(-4, -16); ctx.lineTo(-8, -10);
      ctx.lineTo(-17, -4 - flap * 7); ctx.lineTo(-6, 2);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(8, 4); ctx.lineTo(22, -2 - flap * 5);
      ctx.lineTo(12, -12); ctx.lineTo(16, -22);
      ctx.lineTo(6, -16); ctx.lineTo(0, -20);
      ctx.lineTo(-6, -16); ctx.lineTo(-16, -22);
      ctx.lineTo(-12, -12); ctx.lineTo(-22, -2 - flap * 5);
      ctx.lineTo(-8, 4);
      ctx.closePath(); ctx.fill();
      if (e.hp > 1) {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(-8, 20, 6, 4); ctx.fillRect(2, 20, 6, 4);
      }
    }
    A.neonOff(ctx);
    if (e.captured > 0) {
      ctx.fillStyle = '#ff2fd6';
      ctx.font = '700 12px Orbitron, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, -28);
    }
    ctx.restore();
  }

  function drawBeam(e) {
    const b = e.beam;
    const pulse = 0.20 + 0.10 * Math.sin(Date.now() / 90) + b.prog * 0.4;
    ctx.save();
    ctx.globalAlpha = Math.min(0.75, pulse);
    const grad = ctx.createLinearGradient(0, e.y, 0, H);
    grad.addColorStop(0, '#00f0ff');
    grad.addColorStop(1, 'rgba(0,240,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(e.x - 8, e.y + 10);
    ctx.lineTo(e.x + 8, e.y + 10);
    ctx.lineTo(e.x + 34, H);
    ctx.lineTo(e.x - 34, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, '#0b0620'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    shake.apply(ctx);
    A.drawStarfield(stars, ctx, W, H);

    for (const e of enemies) drawEnemy(e);
    for (const e of enemies) if (e.beam) drawBeam(e);
    for (const e of enemies) {
      if (e.captured > 0 && e.state === 'formation') {
        const p = slotWorld(e);
        drawShip(p.x, p.y + 48, 0.8, true);
      }
    }

    A.neonOn(ctx, '#00f0ff', 12);
    ctx.fillStyle = '#bffcff';
    for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 12, 4, 14);
    A.neonOff(ctx);
    A.neonOn(ctx, '#ff2fd6', 12);
    ctx.fillStyle = '#ff9df0';
    for (const b of ebullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, A.TAU); ctx.fill(); }
    A.neonOff(ctx);

    if (player.alive && (invuln <= 0 || (((invuln * 12) | 0) % 2 === 0))) {
      if (dual) { drawShip(player.x - 16, SHIP_Y, 1, false); drawShip(player.x + 16, SHIP_Y, 1, false); }
      else drawShip(player.x, SHIP_Y, 1, false);
    }

    particles.draw(ctx);
    floaters.draw(ctx);

    ctx.save();
    ctx.font = '700 15px Orbitron, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    A.neonOn(ctx, '#ffd700', 10);
    ctx.fillStyle = '#ffd700';
    if (wave > 0) ctx.fillText('WAVE ' + wave, W / 2, 22);
    A.neonOff(ctx);
    for (let i = 0; i < lives; i++) drawShip(26 + i * 32, H - 26, 0.55, false);
    ctx.restore();

    ctx.restore();

    if (state === 'ready') {
      A.glowText(ctx, 'GALAGA', W / 2, H / 2 - 30, '900 52px Orbitron, sans-serif', '#00f0ff');
    } else if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  /* ---------------- wiring ---------------- */

  const loop = A.createLoop(update, render);

  document.addEventListener('keydown', (e) => {
    if (modalEl.classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = true;
    else if (k === 'arrowright' || k === 'd') keys.right = true;
    else if ((k === ' ' || k === 'z') && !e.repeat) { if (state === 'playing') firing = true; }
    else if (k === 'p') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    else if (k === 'arrowright' || k === 'd') keys.right = false;
    else if (k === ' ' || k === 'z') firing = false;
  });

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  A.bindHold(document.getElementById('galagaLeft'), () => { keys.left = true; }, () => { keys.left = false; });
  A.bindHold(document.getElementById('galagaRight'), () => { keys.right = true; }, () => { keys.right = false; });
  A.bindHold(document.getElementById('galagaFire'), () => { firing = true; }, () => { firing = false; });

  A.registerModalGame('galagaModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show(); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(modalEl);

  /* Test hooks (used by the node logic test; inert in production). */
  window.__galaga = {
    get state() { return state; },
    get score() { return score; },
    get lives() { return lives; },
    get wave() { return wave; },
    get enemyCount() { return enemies.length; },
    get playerAlive() { return player.alive; },
    get dual() { return dual; },
    damagePlayer() { invuln = 0; hitPlayer(); }
  };

  reset(); render();
})();
