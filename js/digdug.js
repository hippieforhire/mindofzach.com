/* DIG DUG (1982) — neon clone. Dig tunnels, pump up Pookas and
 * Fygars until they pop, dodge dragon fire, drop rocks for big
 * depth-scaled bonuses. 3 lives, escalating levels. */
(function () {
  'use strict';
  const A = window.Arcade;
  const canvas = document.getElementById('digdugCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('digdugScore');
  const hiEl = document.getElementById('digdugHi');
  const bestEl = document.getElementById('digdugBest');
  const pauseBtn = document.getElementById('digdugPause');

  const COLS = 15, ROWS = 13, TILE = 32;
  const W = 480, H = 480, FIELD_H = ROWS * TILE; // 416; bottom 64px = HUD strip
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  const TUNNEL_ROWS = [3, 9];
  const PUMP_RANGE = 4;
  const POP_PTS = [200, 400, 800];      // by depth band
  const ROCK_PTS = [1000, 2000, 3000];  // by depth band x1/x2/x3

  let dirt, enemies, rocks, player;
  let score, best, newBest, lives, level, state;
  let pumping, pumpTarget, pumpPulseT, clearT, deathT, time;

  const startOverlay = A.wireStartOverlay('digdugModal', startGame);
  const overOverlay = A.gameOverOverlay('digdugModal');

  /* ---------------- helpers ---------------- */
  function inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
  function dug(c, r) { return inBounds(c, r) && !dirt[r][c]; }
  function band(r) { return r < 5 ? 0 : r < 9 ? 1 : 2; }
  function rockAt(c, r) {
    const x = c * TILE, y = r * TILE;
    return rocks.some(k => k.px < x + TILE && k.px + TILE > x && k.py < y + TILE && k.py + TILE > y);
  }
  function overlapBox(ax, ay, bx, by) {
    return ax < bx + TILE && ax + TILE > bx && ay < by + TILE && ay + TILE > by;
  }

  /* ---------------- setup ---------------- */
  function newEnemy(kind, c, r) {
    return {
      kind, c, r, px: c * TILE, py: r * TILE, tx: c, ty: r, moving: false,
      dir: A.choice(DIRS), ndir: null,
      mode: 'ghost',                       // ghost | tunnel | pumped | fire
      speed: 55 + level * 8 + (kind === 'fygar' ? 8 : 0),
      ghostSpeed: 30 + level * 5,
      inflate: 0, deflateT: 0, ghostT: A.rand(0, 4), thinkT: A.rand(0, 0.4),
      stuckT: 0, fireT: 0, firePhase: 0, fireDir: { x: 1, y: 0 },
      wob: A.rand(0, A.TAU)
    };
  }

  function farFromStart(c, r, d) { return Math.abs(c) + Math.abs(r) >= d; }

  function buildLevel() {
    dirt = [];
    for (let r = 0; r < ROWS; r++) { dirt.push([]); for (let c = 0; c < COLS; c++) dirt[r].push(true); }
    TUNNEL_ROWS.forEach(r => { for (let c = 0; c < COLS; c++) dirt[r][c] = false; });

    player = { c: 0, r: 0, px: 0, py: 0, tx: 0, ty: 0, moving: false, dir: { x: 1, y: 0 }, alive: true };
    dirt[0][0] = false;

    rocks = [];
    const nRocks = Math.min(2 + (level >= 3 ? 1 : 0), 3);
    let guard = 0;
    while (rocks.length < nRocks && guard++ < 300) {
      const c = A.randi(1, COLS - 1), r = A.randi(1, ROWS - 1);
      if (!dirt[r][c] || TUNNEL_ROWS.indexOf(r) >= 0) continue;
      if (!farFromStart(c, r, 4)) continue;
      if (rocks.some(k => k.c === c && k.r === r)) continue;
      rocks.push({ c, r, px: c * TILE, py: r * TILE, state: 'rest', vy: 0, wobbleT: 0 });
    }

    enemies = [];
    const n = Math.min(3 + level, 9);
    const nFygar = Math.min(1 + ((level / 2) | 0), 3);
    guard = 0;
    while (enemies.length < n && guard++ < 500) {
      const kind = enemies.length < nFygar ? 'fygar' : 'pooka';
      let c, r;
      if (enemies.length % 2 === 0) {           // start in open tunnels
        r = A.choice(TUNNEL_ROWS); c = A.randi(2, COLS - 1);
      } else {                                  // start buried as ghosts
        c = A.randi(0, COLS - 1); r = A.randi(0, ROWS - 1);
        if (!dirt[r][c]) continue;
      }
      if (!farFromStart(c, r, 5)) continue;
      if (enemies.some(e => e.c === c && e.r === r)) continue;
      enemies.push(newEnemy(kind, c, r));
    }
    pumping = false; pumpTarget = null;
  }

  function reset() {
    score = 0; lives = 3; level = 1; newBest = false; time = 0;
    best = A.getHi('digdug');
    hiEl.textContent = best; bestEl.textContent = ''; bestEl.classList.add('hidden');
    buildLevel();
    state = 'ready';
    particles.clear(); floaters.clear();
    paintScore();
  }

  function startGame() {
    reset();
    A.bumpPlays('digdug');
    state = 'playing';
    loop.start();
    floaters.add(W / 2, FIELD_H / 2, 'LEVEL 1', '#00f0ff', 30);
    A.sfx.power();
  }

  function paintScore() { scoreEl.textContent = score; }

  function addScore(n, x, y) {
    score += n;
    floaters.add(x, y, '+' + n, '#ffd700', 18);
    if (A.setHi('digdug', score)) { newBest = true; best = score; hiEl.textContent = score; bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden'); }
    paintScore();
  }

  /* ---------------- player ---------------- */
  function step(dx, dy) {
    if (state !== 'playing' || !player.alive) return;
    player.dir = { x: dx, y: dy };
    if (pumping) detachPump();          // moving breaks the hose
    if (player.moving) return;
    const nc = player.c + dx, nr = player.r + dy;
    if (!inBounds(nc, nr) || rockAt(nc, nr)) { A.sfx.tick(); return; }
    player.tx = nc; player.ty = nr; player.moving = true;
  }

  function updatePlayer(dt) {
    if (!player.alive || !player.moving) return;
    const sp = 175 * dt;
    const txp = player.tx * TILE, typ = player.ty * TILE;
    player.px += A.clamp(txp - player.px, -sp, sp);
    player.py += A.clamp(typ - player.py, -sp, sp);
    if (player.px === txp && player.py === typ) {
      player.c = player.tx; player.r = player.ty; player.moving = false;
      if (dirt[player.r][player.c]) {
        dirt[player.r][player.c] = false;
        particles.burst(player.px + TILE / 2, player.py + TILE / 2,
          { n: 8, colors: ['#c98a3d', '#8a5a22', '#e8b25c'], speed: 120, life: 0.5, size: 3 });
        A.sfx.tick();
      }
    }
  }

  /* ---------------- pump ---------------- */
  function startPump() {
    if (state !== 'playing' || !player.alive || pumping) return;
    pumping = true; pumpPulseT = 0.22;
    A.sfx.shoot();
  }
  function stopPump() { if (pumping) detachPump(); }
  function detachPump() {
    pumping = false;
    if (pumpTarget) { pumpTarget.mode = 'tunnel'; pumpTarget.deflateT = 1.2; }
    pumpTarget = null;
  }
  function pumpRay() {
    const d = player.dir;
    for (let i = 1; i <= PUMP_RANGE; i++) {
      const c = player.c + d.x * i, r = player.r + d.y * i;
      if (!inBounds(c, r) || rockAt(c, r)) break;
      const e = enemies.find(e => (e.mode === 'tunnel' || e.mode === 'ghost') && e.c === c && e.r === r);
      if (e) return e;
    }
    return null;
  }
  function pulseFx(e) {
    A.sfx.tone({ f: 420 + e.inflate * 160, t: 0.09, type: 'square', v: 0.09 });
    particles.burst(e.px + TILE / 2, e.py + TILE / 2,
      { n: 6, colors: ['#9df3ff', '#ffffff'], speed: 90, life: 0.35, size: 3 });
  }
  function updatePump(dt) {
    if (!pumping) return;
    if (pumpTarget && pumpTarget.mode !== 'pumped') pumpTarget = null;
    pumpPulseT -= dt;
    if (pumpPulseT > 0) return;
    pumpPulseT = 0.32;
    if (!pumpTarget) {
      const hit = pumpRay();
      if (!hit) { detachPump(); return; }
      pumpTarget = hit; hit.mode = 'pumped';
      hit.inflate = Math.max(hit.inflate, 1);
      pulseFx(hit);
      if (hit.inflate >= 4) popEnemy(hit);
      return;
    }
    pumpTarget.inflate++;
    pulseFx(pumpTarget);
    if (pumpTarget.inflate >= 4) popEnemy(pumpTarget);
  }

  function popEnemy(e) {
    const pts = POP_PTS[band(e.r)];
    const col = e.kind === 'pooka' ? '#ff4d5e' : '#39ff7a';
    particles.burst(e.px + TILE / 2, e.py + TILE / 2,
      { n: 34, colors: [col, '#ffffff', '#ffd700'], speed: 300, life: 0.8, size: 4 });
    A.sfx.explode(); shake.add(0.25);
    addScore(pts, e.px + TILE / 2, e.py);
    if (pumpTarget === e) { pumping = false; pumpTarget = null; }
    removeEnemy(e);
  }
  function crushEnemy(e) {
    const pts = ROCK_PTS[band(e.r)];
    const col = e.kind === 'pooka' ? '#ff4d5e' : '#39ff7a';
    particles.burst(e.px + TILE / 2, e.py + TILE / 2,
      { n: 40, colors: [col, '#ffffff', '#ffd700'], speed: 340, life: 0.9, size: 5 });
    A.sfx.explode(); shake.add(0.3);
    addScore(pts, e.px + TILE / 2, e.py);
    if (pumpTarget === e) { pumping = false; pumpTarget = null; }
    removeEnemy(e);
  }
  function removeEnemy(e) {
    const i = enemies.indexOf(e);
    if (i >= 0) enemies.splice(i, 1);
  }

  /* ---------------- enemies ---------------- */
  function chooseDir(e) {
    const opts = [];
    DIRS.forEach(d => {
      const nc = e.c + d.x, nr = e.r + d.y;
      if (dug(nc, nr) && !rockAt(nc, nr)) opts.push(d);
    });
    if (!opts.length) { e.ndir = null; return; }
    const nonRev = opts.filter(d => !(d.x === -e.dir.x && d.y === -e.dir.y));
    const pool = nonRev.length ? nonRev : opts;
    if (Math.random() < 0.22) { e.ndir = A.choice(pool); return; }
    let bd = pool[0], bs = 1e9;
    pool.forEach(d => {
      const s = Math.abs(e.c + d.x - player.c) + Math.abs(e.r + d.y - player.r);
      if (s < bs) { bs = s; bd = d; }
    });
    e.ndir = bd;
  }

  function tryFire(e) {
    const dx = player.c - e.c, dy = player.r - e.r;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist === 0 || dist > 5 || (dx !== 0 && dy !== 0)) return false;
    const d = { x: Math.sign(dx), y: Math.sign(dy) };
    for (let i = 1; i < dist; i++) if (!dug(e.c + d.x * i, e.r + d.y * i)) return false;
    e.mode = 'fire'; e.firePhase = 0; e.fireT = 0.55; e.fireDir = d; e.moving = false;
    A.sfx.enemyShoot();
    return true;
  }
  function checkFireHit(e) {
    const pcx = player.px + TILE / 2, pcy = player.py + TILE / 2;
    for (let i = 1; i <= 3; i++) {
      const c = e.c + e.fireDir.x * i, r = e.r + e.fireDir.y * i;
      if (!inBounds(c, r) || !dug(c, r)) break;
      if (pcx > c * TILE && pcx < (c + 1) * TILE && pcy > r * TILE && pcy < (r + 1) * TILE) {
        if (player.alive) killPlayer('burned');
        break;
      }
    }
  }

  function updateEnemy(e, dt) {
    e.wob += dt * 6;
    if (e.mode === 'pumped') return;   // frozen on the hose; wobbles in render

    if (e.mode === 'ghost') {
      e.ghostT += dt;
      const dx = player.px - e.px, dy = player.py - e.py, d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(e.ghostSpeed * dt, d);
      e.px += dx / d * sp; e.py += dy / d * sp;
      e.c = A.clamp(Math.round(e.px / TILE), 0, COLS - 1);
      e.r = A.clamp(Math.round(e.py / TILE), 0, ROWS - 1);
      if (dug(e.c, e.r)) { e.mode = 'tunnel'; e.moving = false; e.thinkT = 0.2; }
      else if (e.ghostT > 18) {        // stuck too long: digs out and surfaces
        dirt[e.r][e.c] = false;
        particles.burst(e.px + TILE / 2, e.py + TILE / 2,
          { n: 10, colors: ['#c98a3d', '#8a5a22'], speed: 120, life: 0.5, size: 3 });
        e.mode = 'tunnel'; e.moving = false; e.ghostT = 0; e.thinkT = 0.2;
      }
      return;
    }

    if (e.mode === 'fire') {
      e.fireT -= dt;
      if (e.firePhase === 0 && e.fireT <= 0) { e.firePhase = 1; e.fireT = 1.0; A.sfx.enemyShoot(); }
      else if (e.firePhase === 1 && e.fireT <= 0) { e.mode = 'tunnel'; e.thinkT = 0.3; }
      if (e.firePhase === 1) checkFireHit(e);
      return;
    }

    // tunnel mode
    if (e.inflate > 0) {               // deflating after the hose detached
      e.deflateT -= dt;
      if (e.deflateT <= 0) { e.inflate--; e.deflateT = 1.2; }
    }
    if (e.moving) {
      const sp = e.speed * dt;
      const txp = e.tx * TILE, typ = e.ty * TILE;
      e.px += A.clamp(txp - e.px, -sp, sp);
      e.py += A.clamp(typ - e.py, -sp, sp);
      if (e.px === txp && e.py === typ) { e.c = e.tx; e.r = e.ty; e.moving = false; }
    } else {
      e.thinkT -= dt;
      if (e.thinkT <= 0) {
        e.thinkT = 0.12;
        if (e.kind === 'fygar' && tryFire(e)) return;
        chooseDir(e);
        if (e.ndir) {
          e.tx = e.c + e.ndir.x; e.ty = e.r + e.ndir.y;
          e.dir = e.ndir; e.moving = true; e.stuckT = 0;
        } else {
          e.stuckT += 0.12;
          if (e.stuckT > 6) { e.mode = 'ghost'; e.ghostT = 0; e.stuckT = 0; } // re-phase, never stuck forever
        }
      }
    }
  }

  /* ---------------- rocks ---------------- */
  function updateRock(k, dt) {
    if (k.state === 'rest') {
      const below = k.r + 1;
      if (below < ROWS && !dirt[below][k.c]) { k.state = 'wobble'; k.wobbleT = 0.45; }
      return;
    }
    if (k.state === 'wobble') {
      k.wobbleT -= dt;
      k.px = k.c * TILE + Math.sin(time * 40) * 2;
      if (k.wobbleT <= 0) { k.state = 'fall'; k.vy = 60; A.sfx.place(); }
      return;
    }
    k.vy = Math.min(k.vy + 1400 * dt, 640);
    k.py += k.vy * dt;
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (overlapBox(k.px, k.py, enemies[i].px, enemies[i].py)) crushEnemy(enemies[i]);
    }
    if (player.alive && overlapBox(k.px, k.py, player.px, player.py)) killPlayer('crushed');
    const bottomRow = Math.floor((k.py + TILE) / TILE);
    if (bottomRow >= ROWS || dirt[bottomRow][k.c]) {
      k.py = bottomRow * TILE - TILE;
      k.r = bottomRow - 1;
      k.state = 'rest';
      particles.burst(k.px + TILE / 2, k.py + TILE,
        { n: 14, colors: ['#9aa3b2', '#5b6472', '#ffffff'], speed: 160, life: 0.6, size: 3 });
      shake.add(0.2);
      A.sfx.hit();
    }
  }

  /* ---------------- death / level flow ---------------- */
  function killPlayer(how) {
    if (!player.alive || state !== 'playing') return;
    player.alive = false;
    detachPump();
    const px = player.px + TILE / 2, py = player.py + TILE / 2;
    particles.burst(px, py, { n: 46, colors: ['#00f0ff', '#ffffff', '#ff2fd6'], speed: 340, life: 1, size: 5 });
    shake.add(0.55);
    A.sfx.hit(); A.sfx.lose();
    state = 'dying'; deathT = 1.4;
    floaters.add(px, py - 20, how === 'burned' ? 'FRIED!' : how === 'crushed' ? 'SQUASHED!' : 'CAUGHT!', '#ff5d5d', 22);
  }

  function afterDeath() {
    lives--;
    if (lives > 0) {
      player.c = 0; player.r = 0; player.px = 0; player.py = 0;
      player.tx = 0; player.ty = 0; player.moving = false;
      player.alive = true; player.dir = { x: 1, y: 0 };
      dirt[0][0] = false;
      const keep = Math.max(enemies.length, 2);
      enemies = [];
      let guard = 0;
      while (enemies.length < keep && guard++ < 300) {
        const r = A.choice(TUNNEL_ROWS), c = A.randi(2, COLS - 1);
        if (!farFromStart(c, r, 5)) continue;
        if (enemies.some(e => e.c === c && e.r === r)) continue;
        enemies.push(newEnemy(A.rand(0, 1) < 0.3 ? 'fygar' : 'pooka', c, r));
      }
      rocks.forEach(k => { k.state = 'rest'; k.vy = 0; k.px = k.c * TILE; k.py = k.r * TILE; });
      state = 'playing';
      floaters.add(W / 2, FIELD_H / 2, lives + (lives === 1 ? ' LIFE' : ' LIVES') + ' LEFT', '#00f0ff', 24);
    } else {
      endGame();
    }
  }

  function endGame() {
    state = 'over';
    A.sfx.lose();
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        '<div class="go-score">' + score + '</div>' +
        '<div class="go-sub">LEVEL ' + level + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="digdugRetry">PLAY AGAIN</button>'
      );
      document.getElementById('digdugRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 700);
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    time += dt;
    if (state === 'dying') {
      deathT -= dt;
      if (deathT <= 0) afterDeath();
      particles.update(dt); floaters.update(dt); shake.update(dt);
      return;
    }
    if (state === 'clearing') {
      clearT -= dt;
      if (clearT <= 0) {
        level++; buildLevel(); state = 'playing';
        floaters.add(W / 2, FIELD_H / 2, 'LEVEL ' + level, '#00f0ff', 30);
        A.sfx.power();
      }
      particles.update(dt); floaters.update(dt); shake.update(dt);
      return;
    }
    if (state !== 'playing') return;

    updatePlayer(dt);
    updatePump(dt);
    for (let i = enemies.length - 1; i >= 0; i--) updateEnemy(enemies[i], dt);
    for (let i = rocks.length - 1; i >= 0; i--) updateRock(rocks[i], dt);

    // touch kills (tunnel / ghost / firing enemies)
    if (player.alive) {
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (e.mode === 'pumped') continue;
        const dx = (e.px + TILE / 2) - (player.px + TILE / 2);
        const dy = (e.py + TILE / 2) - (player.py + TILE / 2);
        if (Math.hypot(dx, dy) < TILE * 0.65) { killPlayer('caught'); break; }
      }
    }

    if (state === 'playing' && enemies.length === 0) {
      state = 'clearing'; clearT = 1.6;
      A.sfx.clear();
      floaters.add(W / 2, FIELD_H / 2, 'LEVEL CLEAR!', '#ffd700', 30);
    }
    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  /* ---------------- render ---------------- */
  function drawDirt() {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!dirt[r][c]) continue;
      const x = c * TILE, y = r * TILE;
      ctx.fillStyle = ['#3d2410', '#452a13', '#38200d'][(c * 7 + r * 13) % 3];
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(255,190,110,0.10)';
      ctx.fillRect(x, y, TILE, 2);
      ctx.fillRect(x, y, 2, TILE);
    }
    A.neonOn(ctx, '#ff9f1c', 10);
    ctx.strokeStyle = 'rgba(255,159,28,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, FIELD_H - 2);
    A.neonOff(ctx);
  }

  function drawPlayer() {
    const x = player.px + TILE / 2, y = player.py + TILE / 2;
    A.neonOn(ctx, '#00f0ff', 14);
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath(); ctx.arc(x, y, 12, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(player.dir.y, player.dir.x));
    ctx.fillStyle = '#0a1a2a';                       // visor
    A.rr(ctx, -2, -6, 14, 12, 6); ctx.fill();
    ctx.fillStyle = '#9df3ff';                       // hose nozzle
    ctx.fillRect(10, -3, 8, 6);
    ctx.restore();
  }

  function drawEnemy(e) {
    const x = e.px + TILE / 2, y = e.py + TILE / 2;
    ctx.save();
    if (e.mode === 'ghost') ctx.globalAlpha = 0.45;
    if (e.mode === 'pumped') ctx.translate(Math.sin(e.wob * 3) * e.inflate * 1.6, 0);
    ctx.translate(x, y);
    if (e.mode === 'pumped') { const s = 1 + e.inflate * 0.22; ctx.scale(s, s); }
    if (e.kind === 'pooka') {
      A.neonOn(ctx, '#ff4d5e', 12);
      ctx.fillStyle = '#ff4d5e';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, A.TAU); ctx.fill();
      A.neonOff(ctx);
      ctx.fillStyle = '#ffffff';                     // goggles
      ctx.beginPath(); ctx.arc(-4, -2, 4, 0, A.TAU); ctx.arc(4, -2, 4, 0, A.TAU); ctx.fill();
      ctx.fillStyle = '#101020';
      ctx.beginPath(); ctx.arc(-4, -2, 2, 0, A.TAU); ctx.arc(4, -2, 2, 0, A.TAU); ctx.fill();
      ctx.fillStyle = '#b0303c';                     // feet
      ctx.fillRect(-8, 9, 6, 4); ctx.fillRect(2, 9, 6, 4);
    } else {
      A.neonOn(ctx, '#39ff7a', 12);
      ctx.fillStyle = '#2fd96a';
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, A.TAU); ctx.fill();
      A.neonOff(ctx);
      const fd = e.mode === 'fire' ? e.fireDir : e.dir;
      ctx.save();                                    // snout
      ctx.rotate(Math.atan2(fd.y, fd.x));
      ctx.fillStyle = '#1fae54';
      ctx.beginPath(); ctx.moveTo(6, -5); ctx.lineTo(18, 0); ctx.lineTo(6, 5); ctx.closePath(); ctx.fill();
      ctx.restore();
      const flap = Math.sin(e.wob * 2) * 3;          // wings
      ctx.fillStyle = 'rgba(57,255,122,0.7)';
      ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-12, -14 - flap); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-4, 8); ctx.lineTo(-12, 14 + flap); ctx.lineTo(-8, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';                     // eyes
      ctx.beginPath(); ctx.arc(-3, -4, 3.4, 0, A.TAU); ctx.arc(4, -4, 3.4, 0, A.TAU); ctx.fill();
      ctx.fillStyle = '#101020';
      ctx.beginPath(); ctx.arc(-3, -4, 1.6, 0, A.TAU); ctx.arc(4, -4, 1.6, 0, A.TAU); ctx.fill();
    }
    if (e.mode === 'pumped') {                       // inflate stage pips
      ctx.fillStyle = '#9df3ff';
      for (let i = 0; i < e.inflate; i++) ctx.fillRect(-14 + i * 8, 14, 6, 4);
    }
    ctx.restore();
    if (e.mode === 'fire' && e.firePhase === 1) drawFlame(e);
  }

  function drawFlame(e) {
    const d = e.fireDir;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    A.neonOn(ctx, '#ff7b1c', 18);
    for (let i = 1; i <= 3; i++) {
      const c = e.c + d.x * i, r = e.r + d.y * i;
      if (!inBounds(c, r) || !dug(c, r)) break;
      const x = c * TILE, y = r * TILE;
      ctx.fillStyle = 'rgba(255,' + ((120 + Math.random() * 80) | 0) + ',20,0.75)';
      ctx.beginPath();
      if (d.x !== 0) {
        const x0 = d.x > 0 ? x : x + TILE;
        ctx.moveTo(x0, y + 4); ctx.lineTo(x0 + d.x * TILE, y + TILE / 2); ctx.lineTo(x0, y + TILE - 4);
      } else {
        const y0 = d.y > 0 ? y : y + TILE;
        ctx.moveTo(x + 4, y0); ctx.lineTo(x + TILE / 2, y0 + d.y * TILE); ctx.lineTo(x + TILE - 4, y0);
      }
      ctx.closePath(); ctx.fill();
    }
    A.neonOff(ctx);
    ctx.restore();
  }

  function drawHose() {
    const d = player.dir;
    const x0 = player.px + TILE / 2 + d.x * 14, y0 = player.py + TILE / 2 + d.y * 14;
    let x1, y1;
    if (pumpTarget) { x1 = pumpTarget.px + TILE / 2; y1 = pumpTarget.py + TILE / 2; }
    else {
      x1 = A.clamp(x0 + d.x * TILE * PUMP_RANGE, 4, W - 4);
      y1 = A.clamp(y0 + d.y * TILE * PUMP_RANGE, 4, FIELD_H - 4);
    }
    A.neonOn(ctx, '#9df3ff', 10);
    ctx.strokeStyle = '#cfefff'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#1c6f8f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    A.neonOff(ctx);
    const t = (time * 3) % 1;                        // travelling pulse dot
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 3, 0, A.TAU); ctx.fill();
  }

  function drawRock(k) {
    const x = k.px + (k.state === 'wobble' ? Math.sin(time * 40) * 2 : 0), y = k.py;
    A.neonOn(ctx, '#9aa3b2', 10);
    ctx.fillStyle = k.state === 'fall' ? '#aab4c4' : '#8b95a7';
    A.rr(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 8); ctx.fill();
    A.neonOff(ctx);
    ctx.strokeStyle = 'rgba(20,26,36,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 10); ctx.lineTo(x + 16, y + 18); ctx.lineTo(x + 12, y + 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 22, y + 8); ctx.lineTo(x + 20, y + 16); ctx.stroke();
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(2,4,12,0.85)';
    ctx.fillRect(0, FIELD_H, W, H - FIELD_H);
    ctx.fillStyle = 'rgba(0,240,255,0.35)';
    ctx.fillRect(0, FIELD_H, W, 2);
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px Orbitron, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('LEVEL ' + level, 14, FIELD_H + 22);
    ctx.fillStyle = '#ff9f1c';
    ctx.fillText('LIVES', 14, FIELD_H + 46);
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = '#e8f6ff';
      ctx.beginPath(); ctx.arc(92 + i * 24, FIELD_H + 46, 8, 0, A.TAU); ctx.fill();
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd700';
    ctx.fillText('LEFT: ' + enemies.length, W - 14, FIELD_H + 22);
    ctx.fillStyle = pumping ? '#9df3ff' : 'rgba(157,243,255,0.35)';
    ctx.fillText(pumping ? 'PUMPING...' : 'HOLD PUMP', W - 14, FIELD_H + 46);
  }

  function render() {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, FIELD_H / 2, 60, W / 2, FIELD_H / 2, W * 0.75);
    g.addColorStop(0, '#0b0b24'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    shake.apply(ctx);

    drawDirt();
    rocks.forEach(drawRock);
    enemies.forEach(drawEnemy);
    if (pumping) drawHose();
    if (player.alive) drawPlayer();
    particles.draw(ctx);
    floaters.draw(ctx);
    drawHUD();

    ctx.restore();

    if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  /* ---------------- wiring (pong structure) ---------------- */
  const loop = A.createLoop(update, render);

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('digdugModal').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') step(0, -1);
    else if (k === 'arrowdown' || k === 's') step(0, 1);
    else if (k === 'arrowleft' || k === 'a') step(-1, 0);
    else if (k === 'arrowright' || k === 'd') step(1, 0);
    else if (k === ' ' || k === 'z') { if (!e.repeat) startPump(); }
    else if (k === 'p') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'z') stopPump();
  });

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  A.bindTap(document.getElementById('digdugUp'), () => step(0, -1));
  A.bindTap(document.getElementById('digdugDown'), () => step(0, 1));
  A.bindTap(document.getElementById('digdugLeft'), () => step(-1, 0));
  A.bindTap(document.getElementById('digdugRight'), () => step(1, 0));
  A.bindHold(document.getElementById('digdugPump'), () => startPump(), () => stopPump());

  A.registerModalGame('digdugModal', {
    onOpen() {
      reset(); overOverlay.hide();
      startOverlay.show(
        '<div class="go-title">DIG DUG</div>' +
        '<div class="go-sub">dig &#8226; pump &#8226; pop &mdash; don\'t get fried</div>' +
        '<div class="go-sub small">D-pad / WASD to move &bull; hold PUMP (or Space) to inflate</div>'
      );
      loop.stop(); state = 'ready'; render();
    },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(document.getElementById('digdugModal'));
  reset(); render();

  /* test hook (node harness only) */
  window.DIGDUG_TEST = {
    update, render, startGame, step, startPump, stopPump, killPlayer,
    clearEnemies() { enemies.length = 0; },
    snap() {
      return {
        state, score, lives, level, pumping,
        enemies: enemies.length, rocks: rocks.length,
        pc: player.c, pr: player.r, alive: player.alive,
        foes: enemies.map(e => ({ c: e.c, r: e.r, mode: e.mode, inflate: e.inflate, kind: e.kind }))
      };
    }
  };
})();
