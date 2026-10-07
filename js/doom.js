/* DOOM-like neon raycaster (1993). 150-ray DDA, billboard sprites,
 * 3 levels, imps + demons, pistol + shotgun, pickups, minimap. */
(function () {
  'use strict';
  const A = window.Arcade;
  const canvas = document.getElementById('doomCanvas');
  const ctx = canvas.getContext('2d');
  const modalEl = document.getElementById('doomModal');
  const scoreEl = document.getElementById('doomScore');
  const hiEl = document.getElementById('doomHi');
  const bestEl = document.getElementById('doomBest');
  const pauseBtn = document.getElementById('doomPause');
  const W = 480, H = 360;
  A.fitCanvas(canvas, W, H);
  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();
  const NRAYS = 150, SW = W / NRAYS, PL = 0.66; // ~66deg FOV
  const WALLC = { '1': '#00f0ff', '2': '#ff2fd6', '3': '#ffb300' };
  const LEVELS = [
    ["11111111111111111","1P....1.....2...1","1.11..1..2..2.2.1","1.1...1.....2...1",
     "1.1.11111.2222..1","1...1...1.2...2.1","111.1.h.1.2222..1","1...1...1.......1",
     "1.11111.11111.1.1","1.....i.........1","1.222.1111.1.b..1","1.222......1..s.1","11111111111111E11"],
    ["11111111111111111","1P..1.....1...d.1","1...1..h..1.111.1","1.2.1.....1...1.1",
     "1.2.111.1.1.1.1.1","1.2.....1...1...1","1.22222.1.b.1.2.1","1.......1...1.2.1",
     "11111.111.1.1.2.1","1...i...1...1...1","1.11111.1.111.1.1","1.....d.....s.E.1","11111111111111111"],
    ["11111111111111111","1P..g.....1...1.1","1111..1.d.1.2.1.1","1.....1...1.2...1",
     "1.222.11..1.222.1","1.2...1...1.2...1","1.2.h.1.b.1.2.i.1","1.222.1...1.222.1",
     "1.....11111.....1","1.111.......111.1","1.1..d..111..d..1","1.1..s..111..E..1","11111111111111111"]
  ];
  const ENEMY = {
    i: { hp: 40, speed: 1.7, color: '#ff6a2a', eye: '#ffe14d', size: 0.85, melee: [8, 15], mr: 1.2 },
    d: { hp: 90, speed: 2.7, color: '#ff2fd6', eye: '#ffffff', size: 1.2, melee: [15, 28], mr: 1.4 }
  };

  let grid, GW, GH, P, enemies, pickups, projs, zbuf;
  let score, kills, level, state, best, newBest, time;
  let bullets, shells, hasShotgun, weapon, fireCd, muzzleT, bobT, dmgFlash, shotsFired;
  let turnL, turnR, moveF, moveB, fireHeld;

  const startOverlay = A.wireStartOverlay('doomModal', startGame);
  const overOverlay = A.gameOverOverlay('doomModal');

  function tileAt(x, y) {
    const cx = x | 0, cy = y | 0;
    if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return '1';
    return grid[cy][cx];
  }
  function solid(x, y) { const t = tileAt(x, y); return t === '1' || t === '2' || t === '3'; }

  // DDA raycast. Returns {d, side, tile}.
  function cast(px, py, dx, dy, maxD) {
    let mx = px | 0, my = py | 0;
    const ddx = Math.abs(dx) < 1e-9 ? 1e9 : Math.abs(1 / dx);
    const ddy = Math.abs(dy) < 1e-9 ? 1e9 : Math.abs(1 / dy);
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let sdx = dx < 0 ? (px - mx) * ddx : (mx + 1 - px) * ddx;
    let sdy = dy < 0 ? (py - my) * ddy : (my + 1 - py) * ddy;
    let side = 0, guard = 0;
    while (guard++ < 64) {
      if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
      const t = (mx < 0 || my < 0 || mx >= GW || my >= GH) ? '1' : grid[my][mx];
      if (t === '1' || t === '2' || t === '3') {
        const d = side === 0 ? sdx - ddx : sdy - ddy;
        if (d > maxD) return null;
        return { d: Math.max(d, 0.02), side, tile: t };
      }
    }
    return null;
  }
  function los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist / 0.2);
    for (let i = 1; i < steps; i++) {
      if (solid(x0 + dx * i / steps, y0 + dy * i / steps)) return false;
    }
    return true;
  }

  function loadLevel(idx) {
    const rows = LEVELS[idx];
    GH = rows.length; GW = rows[0].length;
    grid = rows.map(r => r.split(''));
    enemies = []; pickups = []; projs = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const c = grid[y][x];
      if (c === 'P') { P = { x: x + 0.5, y: y + 0.5, a: 0, hp: P ? P.hp : 100 }; grid[y][x] = '.'; }
      else if (c === 'i' || c === 'd') { enemies.push({ x: x + 0.5, y: y + 0.5, type: c, hp: ENEMY[c].hp, st: 'chase', cd: A.rand(0.3, 1), painT: 0, dieT: 0, animT: A.rand(0, 1) }); grid[y][x] = '.'; }
      else if ('hbsg'.indexOf(c) >= 0) { pickups.push({ x: x + 0.5, y: y + 0.5, kind: c, taken: false }); grid[y][x] = '.'; }
    }
    if (!P) P = { x: 1.5, y: 1.5, a: 0, hp: 100 };
  }

  function reset() {
    score = 0; kills = 0; level = 0; newBest = false; time = 0;
    bullets = 50; shells = 0; hasShotgun = false; weapon = 0;
    fireCd = 0; muzzleT = 0; bobT = 0; dmgFlash = 0; shotsFired = 0;
    turnL = turnR = moveF = moveB = fireHeld = false;
    P = null;
    loadLevel(0);
    best = A.getHi('doom');
    hiEl.textContent = best; scoreEl.textContent = '0';
    bestEl.textContent = ''; bestEl.classList.add('hidden');
    state = 'ready';
    particles.clear(); floaters.clear();
  }

  function startGame() {
    reset();
    A.bumpPlays('doom');
    state = 'playing';
    loop.start();
    A.sfx.power();
  }

  function addScore(n) {
    score += n; scoreEl.textContent = score;
    if (A.setHi('doom', score)) {
      newBest = true; hiEl.textContent = score;
      bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
    }
  }

  function project(x, y) {
    const rx = x - P.x, ry = y - P.y;
    const ca = Math.cos(P.a), sa = Math.sin(P.a);
    const depth = ca * rx + sa * ry;
    const tx = (ca * ry - sa * rx) / PL;
    return { sx: (W / 2) * (1 + tx / depth), depth };
  }

  function hurtPlayer(dmg) {
    if (state !== 'playing') return;
    P.hp -= dmg; dmgFlash = 1;
    shake.add(0.4); A.sfx.hit();
    particles.burst(W / 2, H / 2, { n: 16, colors: ['#ff3355', '#aa0000'], speed: 200, life: 0.5, size: 4 });
    if (P.hp <= 0) { P.hp = 0; die(); }
  }

  function damageEnemy(e, dmg) {
    if (e.st === 'die') return;
    e.hp -= dmg; e.painT = 0.18;
    const pr = project(e.x, e.y);
    particles.burst(A.clamp(pr.sx, 0, W), H / 2, { n: 12, colors: ['#ff2222', '#ff6a2a', '#ffffff'], speed: 170, life: 0.5, size: 4 });
    if (e.hp <= 0) {
      e.st = 'die'; e.dieT = 0; kills++; addScore(100);
      floaters.add(A.clamp(pr.sx, 40, W - 40), H / 2 - 60, '+100', '#ffd700', 16);
      A.sfx.explode();
    } else A.sfx.tick();
  }

  function shoot() {
    const sg = weapon === 1;
    if (sg && !hasShotgun) return;
    if (sg && shells <= 0) { A.sfx.bad(); floaters.add(W / 2, H - 90, 'NO SHELLS', '#ff6b6b', 14); return; }
    if (!sg && bullets <= 0) { A.sfx.bad(); floaters.add(W / 2, H - 90, 'NO BULLETS', '#ff6b6b', 14); return; }
    if (sg) { shells--; fireCd = 0.85; } else { bullets--; fireCd = 0.32; }
    shotsFired++; muzzleT = 0.07;
    shake.add(sg ? 0.35 : 0.12);
    if (sg) A.sfx.noise({ t: 0.3, v: 0.3, f: 2200, fEnd: 100 }); else A.sfx.shoot();
    const pellets = sg ? 6 : 1, cone = sg ? 0.14 : 0.07;
    for (let i = 0; i < pellets; i++) {
      let bestE = null, bestAng = cone * (0.5 + Math.random());
      const ca = Math.cos(P.a), sa = Math.sin(P.a);
      for (const e of enemies) {
        if (e.st !== 'chase') continue;
        const rx = e.x - P.x, ry = e.y - P.y;
        const dist = Math.hypot(rx, ry);
        if (dist > 11) continue;
        let da = Math.atan2(ry, rx) - P.a;
        while (da > Math.PI) da -= A.TAU; while (da < -Math.PI) da += A.TAU;
        if (Math.abs(da) < bestAng && los(P.x, P.y, e.x, e.y)) { bestAng = Math.abs(da); bestE = e; }
      }
      if (bestE) damageEnemy(bestE, sg ? A.randi(8, 15) : A.randi(14, 24));
    }
  }

  function moveEnemy(e, dt, sp) {
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
    const nx = e.x + dx / d * sp * dt, ny = e.y + dy / d * sp * dt;
    const r = 0.3;
    if (!solid(nx + (nx > e.x ? r : -r), e.y)) e.x = nx;
    if (!solid(e.x, ny + (ny > e.y ? r : -r))) e.y = ny;
  }

  function update(dt) {
    if (state !== 'playing') return;
    time += dt;
    const ca = Math.cos(P.a), sa = Math.sin(P.a);
    if (turnL) P.a -= 2.7 * dt;
    if (turnR) P.a += 2.7 * dt;
    const mv = ((moveF ? 1 : 0) - (moveB ? 1 : 0)) * 3.4 * dt;
    if (mv !== 0) {
      const r = 0.25, nx = P.x + ca * mv, ny = P.y + sa * mv;
      if (!solid(nx + (mv > 0 ? r : -r) * ca, P.y + (mv > 0 ? r : -r) * sa)) { P.x = nx; }
      if (!solid(P.x + (mv > 0 ? r : -r) * ca, ny + (mv > 0 ? r : -r) * sa)) { P.y = ny; }
      bobT += dt * 11;
    }
    if (fireCd > 0) fireCd -= dt;
    if (muzzleT > 0) muzzleT -= dt;
    if (dmgFlash > 0) dmgFlash -= dt * 1.8;
    if (fireHeld && fireCd <= 0) shoot();

    // enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], def = ENEMY[e.type];
      e.animT += dt;
      if (e.st === 'die') { e.dieT += dt; if (e.dieT > 0.7) enemies.splice(i, 1); continue; }
      if (e.painT > 0) { e.painT -= dt; continue; }
      if (e.cd > 0) e.cd -= dt;
      const dx = P.x - e.x, dy = P.y - e.y, dist = Math.hypot(dx, dy);
      const canSee = dist < 12 && los(e.x, e.y, P.x, P.y);
      if (dist < def.mr && e.cd <= 0) {
        hurtPlayer(A.randi(def.melee[0], def.melee[1])); e.cd = e.type === 'd' ? 1.0 : 0.85;
      } else if (e.type === 'i' && dist < 6.5 && dist > 1.4 && canSee && e.cd <= 0) {
        const sp = 4.6;
        projs.push({ x: e.x, y: e.y, vx: dx / dist * sp, vy: dy / dist * sp, life: 3 });
        e.cd = 1.8; A.sfx.enemyShoot();
      } else if (canSee || dist < 9) {
        moveEnemy(e, dt, def.speed);
      }
    }

    // projectiles
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      const pd = Math.hypot(pr.x - P.x, pr.y - P.y);
      if (pd < 0.35) { hurtPlayer(A.randi(8, 14)); projs.splice(i, 1); continue; }
      if (pr.life <= 0 || solid(pr.x, pr.y)) {
        const s = project(pr.x, pr.y);
        particles.burst(A.clamp(s.sx, 0, W), H / 2, { n: 8, colors: ['#ffae00', '#ff6a2a'], speed: 120, life: 0.4, size: 3 });
        projs.splice(i, 1);
      }
    }

    // pickups + exit
    for (const pk of pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.x - P.x, pk.y - P.y) < 0.55) {
        pk.taken = true;
        if (pk.kind === 'h') { P.hp = Math.min(100, P.hp + 30); floaters.add(W / 2, H - 110, '+30 HP', '#a6ff00', 16); A.sfx.eat(); }
        else if (pk.kind === 'b') { bullets += 12; floaters.add(W / 2, H - 110, '+12 BULLETS', '#ffe14d', 16); A.sfx.good(); }
        else if (pk.kind === 's') { shells += 8; floaters.add(W / 2, H - 110, '+8 SHELLS', '#ff7b00', 16); A.sfx.good(); }
        else if (pk.kind === 'g') { hasShotgun = true; weapon = 1; shells += 4; floaters.add(W / 2, H - 110, 'SHOTGUN!', '#ff2fd6', 20); A.sfx.power(); }
      }
    }
    if (tileAt(P.x, P.y) === 'E') {
      addScore(500); A.sfx.win();
      floaters.add(W / 2, H / 2 - 40, 'LEVEL CLEAR +500', '#ffd700', 24);
      if (level >= LEVELS.length - 1) return victory();
      level++;
      const hp = Math.min(100, P.hp + 25);
      const keep = { bullets, shells, hasShotgun, weapon, score, kills };
      P = null; loadLevel(level);
      P.hp = hp; bullets = keep.bullets; shells = keep.shells;
      hasShotgun = keep.hasShotgun; weapon = keep.weapon;
      state = 'playing';
    }

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  function victory() {
    state = 'over'; A.sfx.win();
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title">YOU WIN</div>' +
        '<div class="go-score">' + score + ' PTS · ' + kills + ' KILLS</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="doomRetry">PLAY AGAIN</button>'
      );
      document.getElementById('doomRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 600);
  }

  function die() {
    state = 'over'; A.sfx.lose();
    particles.burst(W / 2, H / 2, { n: 50, colors: ['#ff3355', '#aa0000', '#ffffff'], speed: 300, life: 0.9, size: 5 });
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">YOU DIED</div>' +
        '<div class="go-score">' + score + ' PTS · LEVEL ' + (level + 1) + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="doomRetry">TRY AGAIN</button>'
      );
      document.getElementById('doomRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 900);
  }

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }

  /* ---------------- render ---------------- */
  function render() {
    // ceiling + floor
    let g = ctx.createLinearGradient(0, 0, 0, H / 2);
    g.addColorStop(0, '#05051a'); g.addColorStop(1, '#0b0b28');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H / 2);
    g = ctx.createLinearGradient(0, H / 2, 0, H);
    g.addColorStop(0, '#14101e'); g.addColorStop(1, '#050308');
    ctx.fillStyle = g; ctx.fillRect(0, H / 2, W, H / 2);
    ctx.save();
    shake.apply(ctx);

    const ca = Math.cos(P.a), sa = Math.sin(P.a);
    const px = -sa * PL, py = ca * PL; // camera plane
    zbuf = new Array(NRAYS);
    for (let i = 0; i < NRAYS; i++) {
      const cam = 2 * i / (NRAYS - 1) - 1;
      const hit = cast(P.x, P.y, ca + px * cam, sa + py * cam, 24);
      const d = hit ? hit.d : 24;
      zbuf[i] = d;
      const lh = Math.min(H * 2.4, H / d);
      const y0 = H / 2 - lh / 2;
      let sh = A.clamp(1.6 / (d * 0.85 + 0.25), 0.16, 1) * (hit && hit.side ? 0.68 : 1);
      ctx.fillStyle = hit ? WALLC[hit.tile] : '#111122';
      ctx.fillRect(i * SW, y0, SW + 1, lh);
      ctx.fillStyle = 'rgba(2,2,10,' + (1 - sh).toFixed(3) + ')';
      ctx.fillRect(i * SW, y0, SW + 1, lh);
      // neon top edge
      if (hit && d < 9) {
        ctx.fillStyle = WALLC[hit.tile];
        ctx.globalAlpha = sh * 0.9;
        ctx.fillRect(i * SW, y0, SW + 1, 2);
        ctx.globalAlpha = 1;
      }
    }

    // sprites far -> near
    const sprites = [];
    for (const e of enemies) sprites.push({ k: 'e', e, x: e.x, y: e.y });
    for (const pk of pickups) if (!pk.taken) sprites.push({ k: 'p', pk, x: pk.x, y: pk.y });
    for (const pr of projs) sprites.push({ k: 'f', pr, x: pr.x, y: pr.y });
    sprites.sort((a, b) => (Math.hypot(b.x - P.x, b.y - P.y) - Math.hypot(a.x - P.x, a.y - P.y)));
    for (const s of sprites) {
      const pr = project(s.x, s.y);
      if (pr.depth < 0.15) continue;
      const size = (H / pr.depth) * (s.k === 'e' ? ENEMY[s.e.type].size : 0.42);
      if (size < 2 || size > H * 4) continue;
      drawSlices(pr.sx, size, pr.depth, s);
    }

    drawWeapon();
    drawHud();
    drawMinimap();

    // damage vignette
    const vig = Math.max(dmgFlash, P.hp <= 30 ? 0.45 + 0.2 * Math.sin(time * 6) : 0);
    if (vig > 0.01 && state !== 'over') {
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      vg.addColorStop(0, 'rgba(255,0,40,0)');
      vg.addColorStop(1, 'rgba(255,0,40,' + (0.55 * Math.min(1, vig)).toFixed(3) + ')');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  function drawSlices(sx, size, depth, s) {
    const NS = 8, sliceW = size / NS;
    for (let i = 0; i < NS; i++) {
      const px = sx - size / 2 + i * sliceW;
      const ri = A.clamp((px / SW) | 0, 0, NRAYS - 1);
      if (depth >= zbuf[ri]) continue;
      if (s.k === 'e') drawEnemySlice(s.e, i, px, sliceW + 1, size, depth);
      else if (s.k === 'p') drawPickupSlice(s.pk, i, px, sliceW + 1, size);
      else drawFireballSlice(i, px, sliceW + 1, size);
    }
  }

  function drawEnemySlice(e, i, px, w, size, depth) {
    const def = ENEMY[e.type];
    const t = (i - 3.5) / 3.5, prof = Math.cos(t * 1.25);
    if (prof <= 0.05) return;
    let bh = size * 0.9 * prof, cy = H / 2 + size * 0.12;
    if (e.st === 'die') { const k = Math.max(0.05, 1 - e.dieT / 0.7); bh *= k; cy += size * 0.3 * (1 - k); }
    const fr = Math.sin(e.animT * 7) > 0 ? 1.06 : 0.94;
    bh *= fr;
    const pain = e.painT > 0;
    const col = pain ? '#ffffff' : def.color;
    A.neonOn(ctx, def.color, 12);
    ctx.fillStyle = col;
    A.rr(ctx, px, cy - bh / 2, w, bh, 3); ctx.fill();
    A.neonOff(ctx);
    if ((i === 3 || i === 4) && e.st !== 'die') { // eyes
      A.neonOn(ctx, def.eye, 10);
      ctx.fillStyle = def.eye;
      const ey = cy - bh * 0.28, ex = px + w / 2 + (i === 3 ? -w * 0.9 : w * 0.9);
      ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
      A.neonOff(ctx);
    }
    if (e.type === 'd') { // horns
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + w / 2 - 3, cy - bh / 2 - 3, 2, 5);
      ctx.fillRect(px + w / 2 + 1, cy - bh / 2 - 3, 2, 5);
    }
  }

  function drawPickupSlice(pk, i, px, w, size) {
    const bob = Math.sin(time * 4 + pk.x * 3) * size * 0.06;
    const cy = H / 2 + size * 0.15 + bob;
    const cols = { h: '#a6ff00', b: '#ffe14d', s: '#ff7b00', g: '#ff2fd6' };
    A.neonOn(ctx, cols[pk.kind], 12);
    ctx.fillStyle = cols[pk.kind];
    if (pk.kind === 'h') {
      const s2 = size * 0.5;
      ctx.fillRect(px + w / 2 - s2 / 2, cy - s2 / 6, s2, s2 / 3);
      ctx.fillRect(px + w / 2 - s2 / 6, cy - s2 / 2, s2 / 3, s2);
    } else if (pk.kind === 'g') {
      ctx.fillRect(px, cy - size * 0.12, w, size * 0.24);
      ctx.fillRect(px + w / 2 - 1, cy - size * 0.3, 2, size * 0.2);
    } else {
      A.rr(ctx, px, cy - size * 0.15, w, size * 0.3, 2); ctx.fill();
    }
    A.neonOff(ctx);
  }

  function drawFireballSlice(i, px, w, size) {
    const t = (i - 3.5) / 3.5, prof = Math.cos(t * 1.3);
    if (prof <= 0.1) return;
    const r = size * 0.28 * prof, cy = H / 2;
    A.neonOn(ctx, '#ffae00', 14);
    ctx.fillStyle = '#ffae00';
    ctx.beginPath(); ctx.arc(px + w / 2, cy, r, 0, A.TAU); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(px + w / 2, cy, r * 0.45, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
  }

  function drawWeapon() {
    const bobY = Math.sin(bobT) * 4, bobX = Math.cos(bobT * 0.5) * 3;
    const cx = W / 2 + bobX, base = H - 8 + bobY;
    const sg = weapon === 1;
    ctx.fillStyle = '#151522';
    A.neonOn(ctx, sg ? '#ff2fd6' : '#00f0ff', 8);
    if (sg) { A.rr(ctx, cx - 22, base - 46, 44, 40, 5); ctx.fill(); }
    else { A.rr(ctx, cx - 12, base - 52, 24, 46, 5); ctx.fill(); }
    A.neonOff(ctx);
    ctx.fillStyle = '#0a0a14';
    if (sg) ctx.fillRect(cx - 16, base - 44, 32, 14);
    else ctx.fillRect(cx - 7, base - 50, 14, 16);
    if (muzzleT > 0) {
      const my = base - (sg ? 52 : 58);
      A.neonOn(ctx, '#ffe14d', 22);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.arc(cx, my, sg ? 20 : 13, 0, A.TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(cx, my, sg ? 9 : 6, 0, A.TAU); ctx.fill();
      A.neonOff(ctx);
    }
  }

  function drawHud() {
    ctx.fillStyle = 'rgba(2,3,10,0.85)';
    ctx.fillRect(0, H - 30, W, 30);
    ctx.font = '700 14px Orbitron, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = P.hp > 50 ? '#a6ff00' : P.hp > 25 ? '#ffe14d' : '#ff3355';
    ctx.fillText('HP ' + Math.ceil(P.hp), 10, H - 15);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText((weapon === 1 ? 'SG ' + shells : 'PISTOL ' + bullets), 92, H - 15);
    ctx.fillStyle = '#ff2fd6';
    ctx.fillText('KILLS ' + kills, 210, H - 15);
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'right';
    ctx.fillText('LV ' + (level + 1), W - 10, H - 15);
    ctx.textAlign = 'left';
  }

  function drawMinimap() {
    const s = 5, ox = W - GW * s - 8, oy = 8;
    ctx.fillStyle = 'rgba(2,3,10,0.7)';
    ctx.fillRect(ox - 3, oy - 3, GW * s + 6, GH * s + 6);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const t = grid[y][x];
      if (t === '1' || t === '2' || t === '3') { ctx.fillStyle = WALLC[t]; ctx.globalAlpha = 0.75; }
      else if (t === 'E') { ctx.fillStyle = '#a6ff00'; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 5); }
      else continue;
      ctx.fillRect(ox + x * s, oy + y * s, s - 1, s - 1);
      ctx.globalAlpha = 1;
    }
    for (const e of enemies) if (e.st === 'chase') {
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(ox + e.x * s - 1.5, oy + e.y * s - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ox + P.x * s, oy + P.y * s, 2.5, 0, A.TAU); ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ox + P.x * s, oy + P.y * s);
    ctx.lineTo(ox + (P.x + Math.cos(P.a) * 1.6) * s, oy + (P.y + Math.sin(P.a) * 1.6) * s); ctx.stroke();
  }

  const loop = A.createLoop(update, render);

  document.addEventListener('keydown', (e) => {
    if (modalEl.classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') turnL = true;
    else if (k === 'arrowright' || k === 'd') turnR = true;
    else if (k === 'arrowup' || k === 'w') moveF = true;
    else if (k === 'arrowdown' || k === 's') moveB = true;
    else if (k === ' ') fireHeld = true;
    else if (k === '1') weapon = 0;
    else if (k === '2' && hasShotgun) weapon = 1;
    else if (k === 'p') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') turnL = false;
    else if (k === 'arrowright' || k === 'd') turnR = false;
    else if (k === 'arrowup' || k === 'w') moveF = false;
    else if (k === 'arrowdown' || k === 's') moveB = false;
    else if (k === ' ') fireHeld = false;
  });

  A.bindTap(pauseBtn, togglePause);
  A.bindHold(document.getElementById('doomLeft'), () => { turnL = true; }, () => { turnL = false; });
  A.bindHold(document.getElementById('doomRight'), () => { turnR = true; }, () => { turnR = false; });
  A.bindHold(document.getElementById('doomFwd'), () => { moveF = true; }, () => { moveF = false; });
  A.bindHold(document.getElementById('doomBack'), () => { moveB = true; }, () => { moveB = false; });
  A.bindHold(document.getElementById('doomFire'), () => { fireHeld = true; }, () => { fireHeld = false; });

  A.registerModalGame('doomModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">DOOM</div><div class="go-sub">WASD / arrows + SPACE — find the exit</div>'); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(modalEl);
  reset(); render();

  // minimal hook for headless logic tests
  window.__doom = {
    start: startGame, update, shoot,
    input: {
      set fwd(v) { moveF = v; }, set back(v) { moveB = v; },
      set left(v) { turnL = v; }, set right(v) { turnR = v; },
      set fire(v) { fireHeld = v; }
    },
    get state() { return state; },
    get score() { return score; },
    get kills() { return kills; },
    get hp() { return P.hp; },
    get shots() { return shotsFired; },
    get level() { return level; },
    get px() { return P.x; }, get py() { return P.y; },
    get enemyCount() { return enemies.length; }
  };
})();
