/* Sinistar (1983) clone — mine crystals, forge sinibombs, kill it before it lives. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('siniCanvas');
const ctx = canvas.getContext('2d');
const modalEl = document.getElementById('siniModal');
const scoreEl = document.getElementById('siniScore');
const hiEl = document.getElementById('siniHi');
const bestEl = document.getElementById('siniBest');
const pauseBtn = document.getElementById('siniPause');

const W = 640, H = 640;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();
const stars = A.makeStars(110, W, H);

const NEED = 8, HITS = 13, MAXB = 30;
const SITE = { x: W / 2, y: H / 2, r: 46 };
const TAUNTS = ['I HUNGER!', 'BEWARE, COWARD!', 'I LIVE!', 'RUN! RUN!', 'I AM SINISTAR!'];

let ship, bullets, ebullets, bombs, asts, crys, workers;
let score, lives, bombsN, sector, state, best, newBest;
let progress, hits, siniDone, sini, siniMouth, tauntT, tauntI, lastTaunt, clearT;
let invulnT, fireT, wSpawnT, astT, elapsed;

const startOverlay = A.wireStartOverlay('siniModal', startGame);
const overOverlay = A.gameOverOverlay('siniModal');

const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const wrapA = a => { while (a > Math.PI) a -= A.TAU; while (a < -Math.PI) a += A.TAU; return a; };

function mkAst(x, y) {
  const r = A.rand(18, 34), n = A.randi(7, 10), verts = [];
  for (let i = 0; i < n; i++) verts.push({ a: i / n * A.TAU, m: A.rand(0.7, 1.15) });
  const sp = A.rand(30, 80), an = A.rand(0, A.TAU);
  return { x: x == null ? A.rand(60, W - 60) : x, y: y == null ? A.rand(60, H - 60) : y,
    vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, r, verts, rot: A.rand(0, A.TAU), vr: A.rand(-1.5, 1.5) };
}
function mkCrystal(x, y) {
  return { x, y, vx: A.rand(-30, 30), vy: A.rand(-30, 30), age: 0 };
}
function mkWorker() {
  const e = A.randi(0, 3), m = 40;
  const p = [{ x: A.rand(0, W), y: m }, { x: A.rand(0, W), y: H - m },
             { x: m, y: A.rand(0, H) }, { x: W - m, y: A.rand(0, H) }][e];
  return { x: p.x, y: p.y, vx: 0, vy: 0, ang: A.rand(0, A.TAU), carrying: false, fireT: A.rand(1, 3) };
}

function reset() {
  ship = { x: W / 2, y: H - 120, vx: 0, vy: 0, ang: -Math.PI / 2, thrusting: false };
  bullets = []; ebullets = []; bombs = []; asts = []; crys = []; workers = [];
  score = 0; lives = 3; bombsN = 0; sector = 1; newBest = false;
  progress = 0; hits = 0; siniDone = false; sini = null; siniMouth = 0;
  tauntT = 5; tauntI = 0; lastTaunt = ''; clearT = 0;
  invulnT = 0; fireT = 0; wSpawnT = 1; astT = 0; elapsed = 0;
  for (let i = 0; i < 8; i++) asts.push(mkAst());
  workers.push(mkWorker()); workers.push(mkWorker());
  best = A.getHi('sini'); hiEl.textContent = best;
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  particles.clear(); floaters.clear();
  state = 'ready';
  paintScore();
}
function startGame() {
  reset();
  A.bumpPlays('sini');
  state = 'playing';
  loop.start();
  A.sfx.power();
}
function paintScore() {
  scoreEl.textContent = score + ' PTS · BOMBS ' + bombsN + ' · LIVES ' + lives + ' · SECTOR ' + sector;
}
function checkHi() {
  if (A.setHi('sini', score)) { newBest = true; hiEl.textContent = score;
    bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden'); }
}
function taunt(t) {
  lastTaunt = t;
  floaters.add(W / 2, 96, t, '#ff3355', 30);
  A.sfx.bad();
}

function fireBullet() {
  if (state !== 'playing' || fireT > 0 || bullets.length > 14) return;
  fireT = 0.16;
  const nx = ship.x + Math.cos(ship.ang) * 16, ny = ship.y + Math.sin(ship.ang) * 16;
  bullets.push({ x: nx, y: ny, vx: Math.cos(ship.ang) * 560 + ship.vx * 0.5,
    vy: Math.sin(ship.ang) * 560 + ship.vy * 0.5, life: 1.1 });
  A.sfx.shoot();
}
function fireBomb() {
  if (state !== 'playing' || bombsN <= 0) return;
  bombsN--;
  const nx = ship.x + Math.cos(ship.ang) * 18, ny = ship.y + Math.sin(ship.ang) * 18;
  bombs.push({ x: nx, y: ny, vx: Math.cos(ship.ang) * 320 + ship.vx * 0.4,
    vy: Math.sin(ship.ang) * 320 + ship.vy * 0.4, life: 4 });
  A.sfx.power();
  paintScore();
}
function collectOne() { // test hook: player collects first crystal
  if (!crys.length) return false;
  const c = crys.shift();
  score += 500; bombsN = Math.min(MAXB, bombsN + 1);
  floaters.add(c.x, c.y, '+500', '#00f0ff', 16);
  A.sfx.eat(); checkHi(); paintScore();
  return true;
}
function workerDeliver() {
  progress++;
  particles.burst(SITE.x, SITE.y, { n: 14, colors: ['#ff2fd6', '#ffffff'], speed: 160, life: 0.5, size: 3 });
  A.sfx.place();
  if (progress >= NEED && !siniDone) completeSini();
}
function completeSini() {
  siniDone = true;
  sini = { x: SITE.x, y: SITE.y, vx: 0, vy: 0 };
  taunt('I LIVE!');
  shake.add(0.6);
}
function bombDamage() {
  if (!siniDone) {
    if (progress > 0) { progress--; floaters.add(SITE.x, SITE.y - 60, 'SABOTAGED!', '#a6ff00', 18); }
    else floaters.add(SITE.x, SITE.y - 60, 'NO EFFECT', '#8b93b8', 15);
    particles.burst(SITE.x, SITE.y, { n: 20, colors: ['#ffb300', '#ffffff'], speed: 240, life: 0.6, size: 4 });
    A.sfx.hit(); return;
  }
  hits++;
  shake.add(0.5);
  particles.burst(sini.x, sini.y, { n: 34, colors: ['#ff3355', '#ffb300', '#ffffff'], speed: 320, life: 0.8, size: 5 });
  floaters.add(sini.x, sini.y - 60, hits + '/' + HITS, '#ffb300', 20);
  A.sfx.hit(); taunt('RRRAAAGH!');
  if (hits >= HITS) destroySini();
  paintScore();
}
function destroySini() {
  score += 50000; checkHi();
  particles.burst(sini.x, sini.y, { n: 90, colors: ['#ff3355', '#ffb300', '#ffffff', '#ff2fd6'], speed: 420, life: 1.2, size: 6 });
  floaters.add(W / 2, H / 2, '+50000', '#ffd700', 34);
  floaters.add(W / 2, H / 2 + 44, 'SINISTAR DESTROYED', '#a6ff00', 24);
  A.sfx.win();
  siniDone = false; sini = null; ebullets.length = 0;
  clearT = 2.5;
  paintScore();
}
function nextSector() {
  sector++;
  progress = 0; hits = 0; tauntT = 4;
  floaters.add(W / 2, H / 2, 'SECTOR ' + sector, '#00f0ff', 30);
  A.sfx.clear();
  paintScore();
}
function damagePlayer() {
  if (state !== 'playing' || invulnT > 0) return;
  lives--;
  particles.burst(ship.x, ship.y, { n: 50, colors: ['#00f0ff', '#ffffff', '#ff3355'], speed: 340, life: 1, size: 5 });
  A.sfx.explode(); shake.add(0.7);
  paintScore();
  if (lives < 0) return gameOver();
  let bx = 60, by = 60, bd = -1;
  for (const c of [{ x: 60, y: 60 }, { x: W - 60, y: 60 }, { x: 60, y: H - 60 }, { x: W - 60, y: H - 60 }]) {
    const d = Math.hypot(c.x - SITE.x, c.y - SITE.y);
    if (d > bd) { bd = d; bx = c.x; by = c.y; }
  }
  ship.x = bx; ship.y = by; ship.vx = 0; ship.vy = 0; ship.ang = -Math.PI / 2;
  invulnT = 2.5;
}
function gameOver() {
  state = 'over';
  A.sfx.lose();
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title lost">SINISTAR WINS</div>' +
      '<div class="go-score">' + score + ' PTS · SECTOR ' + sector + '</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="siniRetry">TRY AGAIN</button>');
    document.getElementById('siniRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}
function destroyAst(i) {
  const a = asts[i];
  asts.splice(i, 1);
  score += 50;
  floaters.add(a.x, a.y, '+50', '#8b93b8', 14);
  particles.burst(a.x, a.y, { n: 16, colors: ['#8b93b8', '#ffffff'], speed: 200, life: 0.6, size: 3 });
  A.sfx.hit();
  if (Math.random() < 0.65 && crys.length < 14) crys.push(mkCrystal(a.x, a.y));
  checkHi(); paintScore();
}
function killWorker(i) {
  const w = workers[i];
  workers.splice(i, 1);
  score += 1000;
  floaters.add(w.x, w.y, '+1000', '#ff2fd6', 18);
  particles.burst(w.x, w.y, { n: 26, colors: ['#ff2fd6', '#ffffff'], speed: 260, life: 0.7, size: 4 });
  A.sfx.explode();
  checkHi(); paintScore();
}

const keys = {};
let steerT = null, lastTapT = 0;

function update(dt) {
  if (state !== 'playing') return;
  elapsed += dt;
  invulnT -= dt; fireT -= dt; wSpawnT -= dt; astT -= dt;

  // --- ship control ---
  let th = 0;
  if (keys['arrowleft']) ship.ang -= 4.4 * dt;
  if (keys['arrowright']) ship.ang += 4.4 * dt;
  if (keys['arrowup']) th = 1;
  if (keys['z']) fireBullet();
  if (steerT) {
    const want = Math.atan2(steerT.y - ship.y, steerT.x - ship.x);
    const d = wrapA(want - ship.ang);
    ship.ang += A.clamp(d, -5 * dt, 5 * dt);
    th = 1;
  }
  ship.thrusting = !!th;
  if (th) {
    ship.vx += Math.cos(ship.ang) * 380 * dt;
    ship.vy += Math.sin(ship.ang) * 380 * dt;
    particles.trail(ship.x - Math.cos(ship.ang) * 12, ship.y - Math.sin(ship.ang) * 12, '#ffb300', 3);
  }
  const damp = 1 - 0.5 * dt;
  ship.vx *= damp; ship.vy *= damp;
  const spd = Math.hypot(ship.vx, ship.vy);
  if (spd > 320) { ship.vx *= 320 / spd; ship.vy *= 320 / spd; }
  ship.x += ship.vx * dt; ship.y += ship.vy * dt;
  if (ship.x < 14) { ship.x = 14; ship.vx = Math.abs(ship.vx); }
  if (ship.x > W - 14) { ship.x = W - 14; ship.vx = -Math.abs(ship.vx); }
  if (ship.y < 14) { ship.y = 14; ship.vy = Math.abs(ship.vy); }
  if (ship.y > H - 14) { ship.y = H - 14; ship.vy = -Math.abs(ship.vy); }

  // --- bullets ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { bullets.splice(i, 1); continue; }
    let hit = false;
    for (let j = asts.length - 1; j >= 0; j--) {
      if (Math.hypot(b.x - asts[j].x, b.y - asts[j].y) < asts[j].r + 4) { destroyAst(j); hit = true; break; }
    }
    if (!hit) for (let j = workers.length - 1; j >= 0; j--) {
      if (Math.hypot(b.x - workers[j].x, b.y - workers[j].y) < 16) { killWorker(j); hit = true; break; }
    }
    if (hit) bullets.splice(i, 1);
  }
  // --- bombs (only hurt Sinistar) ---
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { bombs.splice(i, 1); continue; }
    if (Math.hypot(b.x - SITE.x, b.y - SITE.y) < SITE.r + 14) { bombs.splice(i, 1); bombDamage(); }
  }
  // --- enemy bullets ---
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < 0 || b.x > W || b.y < 0 || b.y > H) { ebullets.splice(i, 1); continue; }
    if (invulnT <= 0 && Math.hypot(b.x - ship.x, b.y - ship.y) < 14) { ebullets.splice(i, 1); damagePlayer(); }
  }
  // --- asteroids drift ---
  for (const a of asts) {
    a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.vr * dt;
    if (a.x < a.r) { a.x = a.r; a.vx = Math.abs(a.vx); }
    if (a.x > W - a.r) { a.x = W - a.r; a.vx = -Math.abs(a.vx); }
    if (a.y < a.r) { a.y = a.r; a.vy = Math.abs(a.vy); }
    if (a.y > H - a.r) { a.y = H - a.r; a.vy = -Math.abs(a.vy); }
    if (invulnT <= 0 && Math.hypot(a.x - ship.x, a.y - ship.y) < a.r + 10) damagePlayer();
  }
  // --- crystals drift ---
  for (let i = crys.length - 1; i >= 0; i--) {
    const c = crys[i];
    c.x += c.vx * dt; c.y += c.vy * dt; c.age += dt;
    if (c.x < 8 || c.x > W - 8) c.vx = -c.vx;
    if (c.y < 8 || c.y > H - 8) c.vy = -c.vy;
    if (Math.hypot(c.x - ship.x, c.y - ship.y) < 30) {
      crys.splice(i, 1); score += 500; bombsN = Math.min(MAXB, bombsN + 1);
      floaters.add(c.x, c.y, '+500', '#00f0ff', 16);
      A.sfx.eat(); checkHi(); paintScore();
    }
  }
  // --- workers ---
  const wTarget = Math.min(2 + sector, 6);
  if (wSpawnT <= 0 && workers.length < wTarget && clearT <= 0) { workers.push(mkWorker()); wSpawnT = 3.5; }
  for (let i = workers.length - 1; i >= 0; i--) {
    const w = workers[i];
    w.fireT -= dt;
    let tx = null, ty = null;
    const spd = 130 + sector * 8;
    if (clearT > 0) { w.ang += dt * 2; }
    else if (w.carrying) {
      tx = SITE.x; ty = SITE.y;
      if (D(w, SITE) < 60) { w.carrying = false; workerDeliver(); }
    } else {
      let bn = null, bd = 1e9;
      for (const c of crys) { const d = D(w, c); if (d < bd) { bd = d; bn = c; } }
      if (bn) {
        tx = bn.x; ty = bn.y;
        if (bd < 22) {
          const ci = crys.indexOf(bn);
          if (ci >= 0) crys.splice(ci, 1);
          w.carrying = true; A.sfx.tick();
        }
      } else w.ang += dt * 1.5;
    }
    if (tx != null) {
      const want = Math.atan2(ty - w.y, tx - w.x);
      w.ang += A.clamp(wrapA(want - w.ang), -4 * dt, 4 * dt);
      w.vx += (Math.cos(w.ang) * spd - w.vx) * Math.min(1, dt * 3);
      w.vy += (Math.sin(w.ang) * spd - w.vy) * Math.min(1, dt * 3);
    } else {
      w.vx += (Math.cos(w.ang) * spd * 0.6 - w.vx) * Math.min(1, dt * 2);
      w.vy += (Math.sin(w.ang) * spd * 0.6 - w.vy) * Math.min(1, dt * 2);
    }
    w.x += w.vx * dt; w.y += w.vy * dt;
    if (w.x < 12 || w.x > W - 12) { w.vx = -w.vx; w.x = A.clamp(w.x, 12, W - 12); }
    if (w.y < 12 || w.y > H - 12) { w.vy = -w.vy; w.y = A.clamp(w.y, 12, H - 12); }
    if (w.fireT <= 0 && clearT <= 0 && D(w, ship) < 420 && invulnT <= 0) {
      const a = Math.atan2(ship.y - w.y, ship.x - w.x);
      if (ebullets.length < 24) ebullets.push({ x: w.x, y: w.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 3 });
      w.fireT = A.rand(2, 4.5);
      A.sfx.enemyShoot();
    }
    if (invulnT <= 0 && D(w, ship) < 24) { killWorker(i); damagePlayer(); }
  }
  // --- Sinistar itself ---
  if (siniDone && sini) {
    siniMouth += dt * 6;
    const sp = 150 + sector * 12;
    const dx = ship.x - sini.x, dy = ship.y - sini.y, d = Math.hypot(dx, dy) || 1;
    sini.vx += ((dx / d) * sp - sini.vx) * Math.min(1, dt * 1.5);
    sini.vy += ((dy / d) * sp - sini.vy) * Math.min(1, dt * 1.5);
    sini.x = A.clamp(sini.x + sini.vx * dt, SITE.r, W - SITE.r);
    sini.y = A.clamp(sini.y + sini.vy * dt, SITE.r, H - SITE.r);
    if (invulnT <= 0 && D(sini, ship) < SITE.r + 12) damagePlayer();
    tauntT -= dt;
    if (tauntT <= 0) { tauntT = A.rand(4, 7); taunt(TAUNTS[tauntI++ % TAUNTS.length]); }
  }
  // --- spawners ---
  if (astT <= 0 && asts.length < 7 + Math.min(sector, 5)) { asts.push(mkAst()); astT = 1.5; }
  // --- sector clear ---
  if (clearT > 0) { clearT -= dt; if (clearT <= 0) nextSector(); }

  particles.update(dt); floaters.update(dt); shake.update(dt);
}

function drawAst(a) {
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot);
  A.neonOn(ctx, '#8b93b8', 8);
  ctx.strokeStyle = '#8b93b8'; ctx.lineWidth = 2;
  ctx.beginPath();
  a.verts.forEach((v, i) => {
    const x = Math.cos(v.a) * a.r * v.m, y = Math.sin(v.a) * a.r * v.m;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  ctx.closePath(); ctx.stroke();
  A.neonOff(ctx); ctx.restore();
}
function drawSiniFace(x, y, mouth) {
  const pulse = 0.75 + 0.25 * Math.sin(mouth);
  A.neonOn(ctx, '#ff3355', 26);
  ctx.fillStyle = '#4a0d16';
  ctx.beginPath(); ctx.arc(x, y, SITE.r, 0, A.TAU); ctx.fill();
  ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 3 * pulse;
  ctx.beginPath(); ctx.arc(x, y, SITE.r, 0, A.TAU); ctx.stroke();
  A.neonOff(ctx);
  // angry eyes
  ctx.fillStyle = '#ffd7d7';
  ctx.save(); ctx.translate(x, y - 12); ctx.rotate(0.25);
  ctx.fillRect(-30, -8, 22, 12); ctx.restore();
  ctx.save(); ctx.translate(x, y - 12); ctx.rotate(-0.25);
  ctx.fillRect(8, -8, 22, 12); ctx.restore();
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(x - 24, y - 16, 8, 8); ctx.fillRect(x + 16, y - 16, 8, 8);
  // jagged mouth
  const mo = 6 + 8 * Math.abs(Math.sin(mouth));
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    const px = x - 28 + i * 7, py = y + 18 + (i % 2 ? mo : -mo * 0.4);
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
}
function render() {
  ctx.save();
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
  A.drawStarfield(stars, ctx, W, H, 1);
  shake.apply(ctx);

  // construction site / Sinistar
  if (!siniDone || clearT > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,53,85,0.25)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.arc(SITE.x, SITE.y, SITE.r, 0, A.TAU); ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < NEED; i++) {
      const a0 = i / NEED * A.TAU, a1 = (i + 0.75) / NEED * A.TAU;
      ctx.strokeStyle = i < progress ? '#ff3355' : 'rgba(139,147,184,0.25)';
      ctx.lineWidth = i < progress ? 7 : 4;
      if (i < progress) A.neonOn(ctx, '#ff3355', 10);
      ctx.beginPath(); ctx.arc(SITE.x, SITE.y, SITE.r - 8, a0, a1); ctx.stroke();
      A.neonOff(ctx);
    }
    ctx.restore();
  } else if (sini) {
    drawSiniFace(sini.x, sini.y, siniMouth);
  }

  // crystals
  for (const c of crys) {
    A.neonOn(ctx, '#00f0ff', 12);
    ctx.fillStyle = '#00f0ff';
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.age * 2);
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -3, 6, 6);
    ctx.restore(); A.neonOff(ctx);
  }
  // asteroids
  for (const a of asts) drawAst(a);
  // workers
  for (const w of workers) {
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.ang);
    A.neonOn(ctx, '#ff2fd6', 12);
    ctx.fillStyle = w.carrying ? '#ffd700' : '#ff2fd6';
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-9, 8); ctx.lineTo(-5, 0); ctx.lineTo(-9, -8);
    ctx.closePath(); ctx.fill();
    A.neonOff(ctx); ctx.restore();
  }
  // bullets
  A.neonOn(ctx, '#ffffff', 10); ctx.fillStyle = '#ffffff';
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, A.TAU); ctx.fill(); }
  A.neonOff(ctx);
  A.neonOn(ctx, '#ff3355', 10); ctx.fillStyle = '#ff3355';
  for (const b of ebullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, A.TAU); ctx.fill(); }
  A.neonOff(ctx);
  // bombs
  for (const b of bombs) {
    const p = 0.7 + 0.3 * Math.sin(elapsed * 12);
    A.neonOn(ctx, '#ffb300', 18);
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.arc(b.x, b.y, 11 * p, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
  }
  // ship
  if (state !== 'over') {
    ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.ang);
    if (invulnT > 0 && ((elapsed * 10) | 0) % 2 === 0) ctx.globalAlpha = 0.3;
    if (ship.thrusting) {
      A.neonOn(ctx, '#ffb300', 12); ctx.fillStyle = '#ffb300';
      ctx.beginPath(); ctx.moveTo(-10, 6); ctx.lineTo(-10 - A.rand(8, 16), 0); ctx.lineTo(-10, -6);
      ctx.closePath(); ctx.fill(); A.neonOff(ctx);
    }
    A.neonOn(ctx, '#00f0ff', 14); ctx.fillStyle = '#00f0ff';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, 10); ctx.lineTo(-6, 0); ctx.lineTo(-10, -10);
    ctx.closePath(); ctx.fill();
    A.neonOff(ctx); ctx.restore();
  }

  particles.draw(ctx);
  floaters.draw(ctx);
  ctx.restore();

  if (state === 'paused') {
    ctx.save(); ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
    ctx.restore();
  }
}

const loop = A.createLoop(update, render);

document.addEventListener('keydown', e => {
  if (modalEl.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (k === 'p') togglePause();
  if (k === 'x') fireBomb();
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function canvasPos(t) {
  const r = canvas.getBoundingClientRect();
  return { x: (t.clientX - r.left) / r.width * W, y: (t.clientY - r.top) / r.height * H };
}
canvas.addEventListener('touchstart', e => {
  if (state !== 'playing') return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const p = canvasPos(t);
    if (p.x < W / 2) steerT = { id: t.identifier, x: p.x, y: p.y };
    else {
      const now = Date.now();
      fireBullet();
      if (now - lastTapT < 350) fireBomb();
      lastTapT = now;
    }
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  if (state !== 'playing') return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (steerT && t.identifier === steerT.id) {
      const p = canvasPos(t);
      steerT.x = p.x; steerT.y = p.y;
    }
  }
}, { passive: false });
function endTouch(e) {
  for (const t of e.changedTouches) if (steerT && t.identifier === steerT.id) steerT = null;
}
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', endTouch);
canvas.addEventListener('mousedown', () => { if (state === 'playing') fireBullet(); });

function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
}
pauseBtn.addEventListener('click', togglePause);

// touch buttons (also work with mouse)
A.bindHold(document.getElementById('siniRotL'), () => keys['arrowleft'] = true, () => keys['arrowleft'] = false);
A.bindHold(document.getElementById('siniRotR'), () => keys['arrowright'] = true, () => keys['arrowright'] = false);
A.bindHold(document.getElementById('siniThrust'), () => keys['arrowup'] = true, () => keys['arrowup'] = false);
A.bindHold(document.getElementById('siniFire'), () => keys['z'] = true, () => keys['z'] = false);
document.getElementById('siniBomb').addEventListener('click', () => { if (state === 'playing') fireBomb(); });

A.registerModalGame('siniModal', {
  onOpen() { reset(); overOverlay.hide();
    startOverlay.show('<div class="go-title">SINISTAR</div>' +
      '<div class="go-sub">mine crystals · forge sinibombs · kill it before it lives</div>' +
      '<div class="go-sub">arrows: fly · Z: fire · X: sinibomb</div>' +
      '<div class="go-sub">touch: drag left = steer · tap right = fire · double-tap = bomb</div>');
    loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(modalEl);
reset(); render();

window.__sini = {
  start: startGame, update, render, fireBullet, fireBomb,
  collect: collectOne, deliver: workerDeliver, bombDamage, damagePlayer,
  mkCrystal: (x, y) => crys.push(mkCrystal(x, y)),
  mkWorker: () => workers.push(mkWorker()),
  mkAst: (x, y) => asts.push(mkAst(x, y)),
  clearInvuln: () => { invulnT = 0; },
  get state() { return state; }, get score() { return score; },
  get lives() { return lives; }, get bombs() { return bombsN; },
  get sector() { return sector; }, get progress() { return progress; },
  get hits() { return hits; }, get done() { return siniDone; },
  get taunt() { return lastTaunt; }, get ship() { return ship; },
  get bullets() { return bullets; }, get ebullets() { return ebullets; },
  get asts() { return asts; }, get workers() { return workers; },
  get crys() { return crys; }, get site() { return SITE; }
};
})();
