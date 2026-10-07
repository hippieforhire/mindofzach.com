/* Donkey Kong (1981) clone — neon construction site. Climb the girders,
 * dodge the barrels, smash them with hammers, rescue the prize. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('dkongCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('dkongScore');
const hiEl = document.getElementById('dkongHi');
const bestEl = document.getElementById('dkongBest');
const pauseBtn = document.getElementById('dkongPause');
const touchEl = document.getElementById('dkongTouch');

const W = 480, H = 640;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();

const GX0 = 24, GX1 = 456;
const GY = [118, 198, 278, 358, 438, 518]; // girder base y (upper side)
const TOP_Y = 64;                          // top + ape platform y
const LADD = [[70, 390], [130, 330], [90, 410], [150, 310], [110, 370]]; // per gap 0..4
const TOPLAD_X = 400;
const GRAV = 1600, JUMPV = -540, RUN = 155, CLIMB = 135;

function gY(i, x) {
  const yl = GY[i] + (i % 2 ? 26 : 0), yr = GY[i] + (i % 2 ? 0 : 26);
  return yl + (yr - yl) * (x - GX0) / (GX1 - GX0);
}
function gDir(i) { return i % 2 ? -1 : 1; }

let player, barrels, hammers, score, lives, level, state, best, newBest;
let spawnT, keys;

const startOverlay = A.wireStartOverlay('dkongModal', startGame);
const overOverlay = A.gameOverOverlay('dkongModal');

function reset() {
  player = null; barrels = []; hammers = [];
  score = 0; lives = 3; level = 1; newBest = false;
  spawnT = 1.2; keys = {};
  best = A.getHi('dkong');
  hiEl.textContent = best;
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  state = 'ready';
  particles.clear(); floaters.clear();
  buildLevel();
  paintScore();
}
function buildLevel() {
  hammers = [{ x: 240, g: 2, taken: false }, { x: 240, g: 4, taken: false }];
  barrels = [];
  spawnT = 1.0;
  respawn();
}
function respawn() {
  player = { x: 60, y: gY(5, 60) - 14, g: 5, vy: 0, air: false, climbing: false,
             face: 1, hammerT: 0, deadT: 0 };
}
function startGame() {
  reset();
  A.bumpPlays('dkong');
  state = 'playing';
  loop.start();
  A.sfx.power();
}
function paintScore() {
  scoreEl.textContent = score + ' PTS';
}
function checkHi() {
  if (A.setHi('dkong', score)) {
    newBest = true; hiEl.textContent = score;
    bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
  }
}
function addScore(n, x, y, color) {
  score += n;
  floaters.add(x, y, '+' + n, color || '#ffd700', 16);
  checkHi(); paintScore();
}
function spawnBarrel() {
  const maxB = Math.min(8, 3 + level);
  if (barrels.length >= maxB) return;
  barrels.push({ x: 150, y: gY(0, 150) - 10, g: 0, vx: gDir(0) * (80 + level * 18),
                 vy: 0, falling: false, fellFrom: -1, jumped: false, rot: 0 });
  A.sfx.enemyShoot();
}
function die() {
  if (state !== 'playing' || player.deadT > 0) return;
  lives--;
  player.deadT = 1.2;
  shake.add(0.55);
  particles.burst(player.x, player.y, { n: 26, colors: ['#ff3355', '#ffffff'], speed: 260, life: 0.7, size: 4 });
  A.sfx.hit();
  paintScore();
}
function levelClear() {
  addScore(800, player.x, player.y - 30, '#a6ff00');
  A.sfx.win();
  particles.burst(W / 2, 200, { n: 60, colors: ['#ffd700', '#a6ff00', '#00f0ff', '#ffffff'], speed: 360, life: 1, size: 5 });
  floaters.add(W / 2, H / 2, 'LEVEL ' + level + ' CLEAR!', '#ffd700', 26);
  level++;
  buildLevel();
  state = 'playing';
}
function tryClimb(dir) {
  // dir: -1 up, 1 down. Returns true if started/continued climbing.
  const p = player;
  if (p.climbing) return true;
  if (p.air || p.hammerT > 0) return false;
  for (let g = 0; g < 5; g++) {
    for (let l = 0; l < 2; l++) {
      const lx = LADD[g][l];
      if (Math.abs(p.x - lx) > 14) continue;
      if (dir < 0 && p.g === g + 1) { p.climbing = { x: lx, top: gY(g, lx), bot: gY(g + 1, lx), g: g }; p.x = lx; A.sfx.tick(); return true; }
      if (dir > 0 && p.g === g) { p.climbing = { x: lx, top: gY(g, lx), bot: gY(g + 1, lx), g: g }; p.x = lx; A.sfx.tick(); return true; }
    }
  }
  if (dir < 0 && p.g === 0 && Math.abs(p.x - TOPLAD_X) < 14) {
    p.climbing = { x: TOPLAD_X, top: TOP_Y, bot: gY(0, TOPLAD_X), g: -1 }; p.x = TOPLAD_X; A.sfx.tick(); return true;
  }
  return false;
}

function update(dt) {
  if (state !== 'playing') return;
  const p = player;

  if (p.deadT > 0) {
    p.deadT -= dt;
    particles.update(dt); floaters.update(dt); shake.update(dt);
    if (p.deadT <= 0) {
      if (lives <= 0) return gameOver();
      barrels = []; respawn();
    }
    return;
  }

  // --- input ---
  const L = keys.left, R = keys.right, U = keys.up, D = keys.down;
  if (p.climbing) {
    const c = p.climbing;
    if (U) p.y -= CLIMB * dt;
    if (D) p.y += CLIMB * dt;
    if (L || R) { // step off ladder
      p.climbing = false;
      const nearTop = Math.abs(p.y - (c.top - 14)) < 16, nearBot = Math.abs(p.y - (c.bot - 14)) < 16;
      if (c.g === -1) { p.g = nearTop ? -2 : 0; }
      else p.g = nearTop ? c.g : c.g + 1;
      p.y = (p.g === -2 ? TOP_Y : gY(p.g, p.x)) - 14;
    } else {
      if (p.y <= c.top - 14) {
        p.climbing = false;
        p.g = c.g === -1 ? -2 : c.g;
        p.y = (p.g === -2 ? TOP_Y : gY(p.g, p.x)) - 14;
        if (p.g === -2) { p.x = A.clamp(p.x, 330, GX1); return levelClear(); }
      } else if (p.y >= c.bot - 14) {
        p.climbing = false;
        p.g = c.g === -1 ? 0 : c.g + 1;
        p.y = gY(p.g, p.x) - 14;
      }
    }
  } else if (!p.air) {
    if (L) { p.x -= RUN * dt; p.face = -1; }
    if (R) { p.x += RUN * dt; p.face = 1; }
    if (p.g === -2) {
      p.x = A.clamp(p.x, 330, GX1); p.y = TOP_Y - 14;
      return levelClear();
    }
    p.x = A.clamp(p.x, GX0, GX1);
    p.y = gY(p.g, p.x) - 14;
    if (U) tryClimb(-1);
    else if (D) tryClimb(1);
  } else {
    if (L) p.x -= RUN * dt;
    if (R) p.x += RUN * dt;
    p.x = A.clamp(p.x, GX0, GX1);
    p.vy += GRAV * dt; p.y += p.vy * dt;
    const gy = gY(p.g, p.x) - 14;
    if (p.vy > 0 && p.y >= gy) { p.y = gy; p.air = false; p.vy = 0; A.sfx.tick(); }
  }

  if (p.hammerT > 0) p.hammerT -= dt;

  // hammer pickups
  for (const h of hammers) {
    if (!h.taken && p.g === h.g && Math.abs(p.x - h.x) < 20 && !p.air && !p.climbing) {
      h.taken = true; p.hammerT = 8;
      floaters.add(p.x, p.y - 30, 'HAMMER!', '#ffb300', 18);
      A.sfx.power();
    }
  }

  // --- barrels ---
  spawnT -= dt;
  if (spawnT <= 0) { spawnT = Math.max(0.8, 2.4 - level * 0.3); spawnBarrel(); }
  const bSpeed = 80 + level * 18;
  for (let i = barrels.length - 1; i >= 0; i--) {
    const b = barrels[i];
    b.rot += dt * 6;
    if (b.falling) {
      b.vy += GRAV * dt; b.y += b.vy * dt; b.x += b.vx * dt;
      let landed = false;
      for (let k = 0; k < 6; k++) {
        if (k <= b.fellFrom) continue;
        if (b.x < GX0 - 10 || b.x > GX1 + 10) break;
        const gy = gY(k, A.clamp(b.x, GX0, GX1));
        if (b.vy > 0 && b.y >= gy - 10 && b.y <= gy + 16) {
          b.g = k; b.falling = false; b.y = gy - 10;
          b.vx = gDir(k) * bSpeed; landed = true; break;
        }
      }
      if (!landed && b.y > H + 30) { barrels.splice(i, 1); continue; }
    } else {
      b.x += b.vx * dt;
      b.y = gY(b.g, A.clamp(b.x, GX0, GX1)) - 10;
      // ladder drop chance
      if (b.g < 5) {
        for (let l = 0; l < 2; l++) {
          const lx = LADD[b.g][l];
          if (Math.abs(b.x - lx) < 7 && Math.random() < dt * 0.9) {
            b.falling = true; b.fellFrom = b.g; b.x = lx; b.vx = 0; b.vy = 60; break;
          }
        }
      }
      if (!b.falling && (b.x < GX0 || b.x > GX1)) { b.falling = true; b.fellFrom = b.g; b.x = A.clamp(b.x, GX0, GX1); b.vx = 0; b.vy = 40; }
    }
    // player interaction
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy);
    if (p.hammerT > 0 && d < 52) {
      barrels.splice(i, 1);
      addScore(300, b.x, b.y - 16, '#ffb300');
      particles.burst(b.x, b.y, { n: 20, colors: ['#ffb300', '#ffffff'], speed: 240, life: 0.5, size: 4 });
      A.sfx.explode();
      continue;
    }
    const clearing = p.air && (p.y + 14) < b.y - 6;
    if (!b.jumped && clearing && Math.abs(dx) < 30) {
      b.jumped = true;
      addScore(100, b.x, b.y - 22, '#00f0ff');
      A.sfx.good();
    }
    if (!clearing && d < 22 && p.deadT <= 0) die();
  }

  particles.update(dt); floaters.update(dt); shake.update(dt);
  paintScore();
}

function jump() {
  const p = player;
  if (state !== 'playing' || !p || p.air || p.climbing || p.hammerT > 0 || p.deadT > 0) return;
  p.air = true; p.vy = JUMPV;
  A.sfx.jump();
}

function gameOver() {
  state = 'over';
  A.sfx.lose();
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title lost">GAME OVER</div>' +
      '<div class="go-score">' + score + ' PTS · LEVEL ' + level + '</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="dkongRetry">TRY AGAIN</button>'
    );
    document.getElementById('dkongRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}

/* ---------- render ---------- */
function drawApe(x, y, t) {
  ctx.save();
  ctx.translate(x, y);
  const armSwing = Math.sin(t * 6) * 0.25;
  A.neonOn(ctx, '#8a5a2b', 12);
  ctx.fillStyle = '#5c3d1e';
  ctx.beginPath(); ctx.ellipse(0, 10, 26, 30, 0, 0, A.TAU); ctx.fill(); // body
  ctx.beginPath(); ctx.arc(0, -24, 20, 0, A.TAU); ctx.fill();            // head
  A.neonOff(ctx);
  ctx.fillStyle = '#8a5a2b';
  ctx.beginPath(); ctx.arc(-8, -28, 5, 0, A.TAU); ctx.fill();            // muzzle
  ctx.beginPath(); ctx.arc(8, -28, 5, 0, A.TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-7, -32, 3.4, 0, A.TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(7, -32, 3.4, 0, A.TAU); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-7, -32, 1.6, 0, A.TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(7, -32, 1.6, 0, A.TAU); ctx.fill();
  // arms
  ctx.strokeStyle = '#5c3d1e'; ctx.lineWidth = 12; ctx.lineCap = 'round';
  A.neonOn(ctx, '#8a5a2b', 8);
  ctx.save(); ctx.rotate(0.5 + armSwing);
  ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(-38, 26); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.rotate(-0.5 - armSwing);
  ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(38, 26); ctx.stroke(); ctx.restore();
  A.neonOff(ctx);
  ctx.restore();
}
function drawPlayer(x, y, face, climbing, hammerT, t) {
  ctx.save();
  ctx.translate(x, y);
  const bob = climbing ? Math.sin(t * 10) * 2 : 0;
  ctx.translate(0, bob);
  A.neonOn(ctx, '#ffd700', 10);
  ctx.fillStyle = '#ffd700';
  ctx.beginPath(); ctx.arc(0, -8, 8, Math.PI, 0); ctx.fill();  // hard hat
  ctx.fillRect(-10, -9, 20, 3);
  A.neonOff(ctx);
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, A.TAU); ctx.fill();     // head
  ctx.fillStyle = '#2244ff';
  A.rr(ctx, -7, 5, 14, 12, 3); ctx.fill();                    // torso
  ctx.strokeStyle = '#2244ff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  if (climbing) {
    ctx.beginPath(); ctx.moveTo(-6, 6); ctx.lineTo(-9, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, 6); ctx.lineTo(9, -4); ctx.stroke();
  } else {
    const run = Math.sin(t * 12) * 4;
    ctx.beginPath(); ctx.moveTo(-3, 16); ctx.lineTo(-3 + run * 0.4, 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, 16); ctx.lineTo(3 - run * 0.4, 26); ctx.stroke();
  }
  if (hammerT > 0) {
    const sw = Math.sin(t * 14) * 0.7;
    ctx.save(); ctx.rotate(face * (0.9 + sw));
    ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(8 * face, 4); ctx.lineTo(30 * face, -14); ctx.stroke();
    A.neonOn(ctx, '#ffb300', 10);
    ctx.fillStyle = '#8b93b8';
    A.rr(ctx, 30 * face - 11, -26, 22, 14, 3); ctx.fill();
    A.neonOff(ctx);
    ctx.restore();
  }
  ctx.restore();
}
function render() {
  const t = performance.now() / 1000;
  ctx.save();
  const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, '#0c0c22'); g.addColorStop(1, '#02030a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  shake.apply(ctx);

  // platforms (ape + top)
  A.neonOn(ctx, '#ff2fd6', 10);
  ctx.strokeStyle = '#ff2fd6'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(24, TOP_Y); ctx.lineTo(150, TOP_Y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(330, TOP_Y); ctx.lineTo(GX1, TOP_Y); ctx.stroke();
  A.neonOff(ctx);

  // girders
  for (let i = 0; i < 6; i++) {
    A.neonOn(ctx, '#ff2fd6', 8);
    ctx.strokeStyle = '#c2148a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(GX0, gY(i, GX0)); ctx.lineTo(GX1, gY(i, GX1)); ctx.stroke();
    A.neonOff(ctx);
    ctx.strokeStyle = 'rgba(255,47,214,0.35)'; ctx.lineWidth = 2;
    for (let x = GX0 + 20; x < GX1; x += 44) {
      ctx.beginPath(); ctx.moveTo(x, gY(i, x)); ctx.lineTo(x, gY(i, x) + 12); ctx.stroke();
    }
  }
  // ladders
  A.neonOn(ctx, '#00f0ff', 8);
  ctx.strokeStyle = '#00b8d4'; ctx.lineWidth = 4;
  for (let gi = 0; gi < 5; gi++) for (let l = 0; l < 2; l++) {
    const lx = LADD[gi][l];
    ctx.beginPath(); ctx.moveTo(lx - 7, gY(gi, lx)); ctx.lineTo(lx - 7, gY(gi + 1, lx)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx + 7, gY(gi, lx)); ctx.lineTo(lx + 7, gY(gi + 1, lx)); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(TOPLAD_X - 7, TOP_Y); ctx.lineTo(TOPLAD_X - 7, gY(0, TOPLAD_X)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(TOPLAD_X + 7, TOP_Y); ctx.lineTo(TOPLAD_X + 7, gY(0, TOPLAD_X)); ctx.stroke();
  A.neonOff(ctx);

  // hammers
  for (const h of hammers) {
    if (h.taken) continue;
    const hy = gY(h.g, h.x) - 16 + Math.sin(t * 3 + h.x) * 3;
    A.neonOn(ctx, '#ffb300', 12);
    ctx.fillStyle = '#8b93b8';
    A.rr(ctx, h.x - 11, hy - 7, 22, 14, 3); ctx.fill();
    A.neonOff(ctx);
    ctx.strokeStyle = '#c9a06a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(h.x, hy + 7); ctx.lineTo(h.x, hy + 22); ctx.stroke();
  }

  // Pauline (the prize)
  const px = 400, py = TOP_Y;
  A.neonOn(ctx, '#ff8ad4', 12);
  ctx.fillStyle = '#ff8ad4';
  ctx.beginPath(); ctx.arc(px, py - 22, 7, 0, A.TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(px - 10, py - 2); ctx.lineTo(px + 10, py - 2); ctx.lineTo(px, py - 18); ctx.closePath(); ctx.fill();
  A.neonOff(ctx);
  A.glowText(ctx, 'HELP!', px, py - 40, '700 13px Orbitron, sans-serif', '#ff8ad4');

  // ape
  drawApe(80, TOP_Y - 38, t);

  // barrels
  for (const b of barrels) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    A.neonOn(ctx, '#ff7b00', 10);
    ctx.fillStyle = '#a35a12';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    ctx.strokeStyle = '#5c3208'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(12, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(12, 4); ctx.stroke();
    ctx.restore();
  }

  // player
  if (player) drawPlayer(player.x, player.y, player.face, player.climbing, player.hammerT, t);

  particles.draw(ctx);
  floaters.draw(ctx);

  // HUD
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 15px Orbitron, sans-serif';
  ctx.fillStyle = '#8b93b8';
  ctx.fillText('LEVEL ' + level, 12, 20);
  ctx.fillStyle = '#ff6b6b';
  let hx = 120;
  for (let i = 0; i < lives; i++) {
    ctx.beginPath(); ctx.arc(hx, 20, 7, 0, A.TAU); ctx.fill(); hx += 20;
  }
  if (player && player.hammerT > 0) {
    ctx.fillStyle = '#ffb300';
    ctx.fillText('HAMMER ' + Math.ceil(player.hammerT) + 's', W - 150, 20);
  }
  ctx.restore();
  ctx.restore();

  if (state === 'paused') {
    ctx.save();
    ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
    ctx.restore();
  }
}

const loop = A.createLoop(update, render);

/* ---------- input ---------- */
document.addEventListener('keydown', (e) => {
  if (document.getElementById('dkongModal').classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') keys.left = true;
  else if (k === 'arrowright' || k === 'd') keys.right = true;
  else if (k === 'arrowup' || k === 'w') keys.up = true;
  else if (k === 'arrowdown' || k === 's') keys.down = true;
  else if (k === ' ') jump();
  else if (k === 'p') togglePause();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') keys.left = false;
  else if (k === 'arrowright' || k === 'd') keys.right = false;
  else if (k === 'arrowup' || k === 'w') keys.up = false;
  else if (k === 'arrowdown' || k === 's') keys.down = false;
});
function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
}
pauseBtn.addEventListener('click', togglePause);

function buildTouch() {
  touchEl.innerHTML = '';
  touchEl.style.cssText = 'display:flex;flex-wrap:wrap;justify-content:center;margin-top:.6rem';
  const mk = (label, w) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'font:700 18px Rajdhani,sans-serif;width:' + (w || 62) + 'px;height:56px;margin:3px;border-radius:12px;border:1px solid rgba(0,240,255,.4);background:rgba(0,240,255,.08);color:#e8ecff;touch-action:none;user-select:none;-webkit-user-select:none';
    touchEl.appendChild(b);
    return b;
  };
  const bl = mk('◀'), bu = mk('▲'), bd = mk('▼'), br = mk('▶'), bj = mk('JUMP', 92);
  A.bindHold(bl, () => { keys.left = true; }, () => { keys.left = false; });
  A.bindHold(br, () => { keys.right = true; }, () => { keys.right = false; });
  A.bindHold(bu, () => { keys.up = true; }, () => { keys.up = false; });
  A.bindHold(bd, () => { keys.down = true; }, () => { keys.down = false; });
  A.bindTap(bj, jump);
}

A.registerModalGame('dkongModal', {
  onOpen() { reset(); buildTouch(); overOverlay.hide(); startOverlay.show('<div class="go-title">DONKEY KONG</div><div class="go-sub">climb · dodge · smash — click to start</div>'); loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(document.getElementById('dkongModal'));
reset(); render();

window.__dkong = {
  start: startGame, update, jump, spawnBarrel,
  setPos(x, g) { player.x = x; player.g = g; player.y = (g === -2 ? TOP_Y : gY(g, x)) - 14; player.air = false; player.climbing = false; },
  setKeys(k) { keys = Object.assign(keys, k); },
  forceBarrel(x, y, g) { barrels.push({ x, y, g: g == null ? 0 : g, vx: 0, vy: 0, falling: false, fellFrom: -1, jumped: false, rot: 0 }); },
  get state() { return state; }, get score() { return score; },
  get lives() { return lives; }, get level() { return level; },
  get player() { return player; }, get barrels() { return barrels; },
  get hammers() { return hammers; }
};
})();
