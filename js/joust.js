/* Joust (1982) clone — neon sky jousting. Flap higher than the
 * buzzard riders, lance them, grab the eggs before they hatch. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('joustCanvas');
const ctx = canvas.getContext('2d');
const modalEl = document.getElementById('joustModal');
const scoreEl = document.getElementById('joustScore');
const hiEl = document.getElementById('joustHi');
const bestEl = document.getElementById('joustBest');
const pauseBtn = document.getElementById('joustPause');

const W = 640, H = 480, GRAV = 1500, FLAP_V = -470, LAVA_Y = 452;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();
const stars = A.makeStars(90, W, H);

const PLATS = [
  { x: 40, y: 140, w: 150 }, { x: 450, y: 140, w: 150 },
  { x: 245, y: 265, w: 150 },
  { x: 90, y: 385, w: 130 }, { x: 420, y: 385, w: 130 }
];
const TIERS = {
  bounder: { c: '#ff6b6b', sp: 135, pts: 500, ai: 'wander' },
  hunter:  { c: '#ff9f1c', sp: 200, pts: 750, ai: 'hunt' },
  shadow:  { c: '#b967ff', sp: 265, pts: 1000, ai: 'hunt2' }
};
const input = { left: false, right: false, flap: false };

let player, enemies, eggs, ptero, pteroT, pteroDone;
let score, lives, wave, state, best, newBest, waveT, spawnT, waveMsg, waveMsgT, respawnT;

const startOverlay = A.wireStartOverlay('joustModal', startGame);
const overOverlay = A.gameOverOverlay('joustModal');

function mkRider(x, y, face) {
  return { x, y, vx: 0, vy: 0, face: face || 1, flapT: 0, flapPh: A.rand(0, 6), dead: false };
}
function reset() {
  player = mkRider(W / 2, 300, 1);
  enemies = []; eggs = []; ptero = null;
  score = 0; lives = 3; wave = 1; waveT = 0; spawnT = 0; respawnT = 0;
  pteroT = 0; pteroDone = false; waveMsg = ''; waveMsgT = 0; newBest = false;
  best = A.getHi('joust'); hiEl.textContent = best;
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  particles.clear(); floaters.clear();
  state = 'ready';
  paintScore();
}
function startGame() {
  reset();
  A.bumpPlays('joust');
  state = 'playing';
  spawnWave();
  loop.start();
  A.sfx.power();
}
function paintScore() {
  scoreEl.textContent = score + ' PTS · WAVE ' + wave + ' · ×' + lives;
}
function addScore(n, x, y) {
  score += n;
  floaters.add(x, y, '+' + n, '#ffd700', 16);
  if (A.setHi('joust', score)) {
    newBest = true; hiEl.textContent = score;
    bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
  }
  paintScore();
}
function waveComp(n) {
  const c = [];
  const total = Math.min(2 + n, 6);
  for (let i = 0; i < total; i++) {
    c.push(n >= 4 && i === 0 ? 'shadow' : (n >= 2 && i % 2 === 1 ? 'hunter' : 'bounder'));
  }
  if (n >= 5) c.push('shadow');
  return c;
}
function spawnEnemy(tier, x, y, boost) {
  const t = TIERS[tier];
  const e = mkRider(x == null ? (Math.random() < 0.5 ? 30 : W - 30) : x,
                    y == null ? A.rand(70, 200) : y, x == null ? (x < W / 2 ? 1 : -1) : 1);
  e.tier = tier; e.c = t.c; e.sp = t.sp * (boost || 1); e.ai = t.ai; e.pts = t.pts;
  e.face = e.x < W / 2 ? 1 : -1;
  enemies.push(e);
  return e;
}
function spawnWave() {
  waveMsg = 'WAVE ' + wave; waveMsgT = 2.2;
  waveComp(wave).forEach((t, i) => {
    setTimeout(() => { if (state === 'playing') spawnEnemy(t); }, 400 * i);
  });
  A.sfx.clear();
}
function landOnPlats(r, prevB) {
  if (r.vy <= 0) return;
  for (const p of PLATS) {
    if (r.x > p.x - 12 && r.x < p.x + p.w + 12 && prevB <= p.y + 0.5 && r.y + 20 >= p.y) {
      r.y = p.y - 20; r.vy = 0;
      return;
    }
  }
}
function phys(r, dt, maxVx) {
  r.vy += GRAV * dt;
  r.flapT -= dt; r.flapPh += dt * 14;
  const prevB = r.y + 20;
  r.x += r.vx * dt; r.y += r.vy * dt;
  if (r.x < 16) { r.x = 16; r.vx = Math.abs(r.vx); r.face = 1; }
  if (r.x > W - 16) { r.x = W - 16; r.vx = -Math.abs(r.vx); r.face = -1; }
  r.vx = A.clamp(r.vx, -maxVx, maxVx);
  r.vy = Math.min(r.vy, 640);
  landOnPlats(r, prevB);
}
function flap(r) {
  if (r.flapT <= 0) {
    r.vy = FLAP_V; r.flapT = 0.22;
    particles.burst(r.x - r.face * 8, r.y + 6, { n: 3, colors: ['#ffffff'], speed: 60, life: 0.3, size: 2 });
  }
}
function killEnemy(e, byPlayer) {
  e.dead = true;
  const i = enemies.indexOf(e);
  if (i >= 0) enemies.splice(i, 1);
  eggs.push({ x: e.x, y: e.y, vx: A.rand(-60, 60), vy: -120, tier: e.tier, hatchT: 6, rest: false, bob: A.rand(0, 6) });
  particles.burst(e.x, e.y, { n: 26, colors: [e.c, '#ffffff', '#ffd700'], speed: 260, life: 0.7, size: 4 });
  if (byPlayer) { addScore(e.pts, e.x, e.y - 24); A.sfx.explode(); }
}
function die() {
  if (player.dead || state !== 'playing') return;
  player.dead = true; lives--;
  shake.add(0.55); A.sfx.lose();
  particles.burst(player.x, player.y, { n: 40, colors: ['#00f0ff', '#ff3355', '#ffffff'], speed: 320, life: 0.9, size: 5 });
  paintScore();
  if (lives <= 0) { endGame(); return; }
  respawnT = 1.4;
}
function endGame() {
  state = 'over';
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title lost">GAME OVER</div>' +
      '<div class="go-score">' + score + ' PTS · WAVE ' + wave + '</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="joustRetry">JOUST AGAIN</button>');
    document.getElementById('joustRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}

/* ---------- update ---------- */
function update(dt) {
  if (state !== 'playing') return;
  waveT += dt;
  if (waveMsgT > 0) waveMsgT -= dt;

  // player
  const p = player;
  if (!p.dead) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) { p.vx += dir * 950 * dt; p.face = dir; }
    else p.vx *= (1 - 2.6 * dt);
    if (input.flap) flap(p);
    phys(p, dt, 270);
    if (p.y > LAVA_Y) die();
  } else if (respawnT > 0) {
    respawnT -= dt;
    if (respawnT <= 0 && lives > 0) {
      player = mkRider(W / 2, 245, 1); // atop the center platform, safe
      floaters.add(W / 2, 220, 'READY', '#00f0ff', 20);
      A.sfx.power();
    }
  }

  // enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    let tx = e.y, mvx = 0;
    if (e.ai === 'wander') {
      tx = 200 + Math.sin(waveT * 0.7 + i * 2.1) * 120;
      mvx = e.face * e.sp;
    } else {
      tx = p.dead ? e.y : player.y + (e.ai === 'hunt2' ? -6 : A.rand(-30, 30));
      const dx = p.dead ? 0 : player.x - e.x;
      mvx = A.clamp(dx * 2.2, -e.sp, e.sp);
      if (Math.abs(dx) > 4) e.face = dx > 0 ? 1 : -1;
    }
    if (e.y > tx + 14) flap(e);
    e.vx += A.clamp(mvx - e.vx, -700 * dt, 700 * dt);
    phys(e, dt, e.sp * 1.25);
    if (e.y > LAVA_Y) { // lava eats buzzards, no egg
      enemies.splice(i, 1);
      particles.burst(e.x, LAVA_Y, { n: 14, colors: ['#ff7b00', '#ff2fd6'], speed: 200, life: 0.6, size: 4 });
      continue;
    }
    // joust resolution
    if (!p.dead) {
      const dx = p.x - e.x, dy = p.y - e.y;
      if (Math.hypot(dx, dy) < 36) {
        if (dy < -12) { killEnemy(e, true); }
        else if (dy > 12) { die(); }
        else { // equal height: bounce apart
          const s = dx >= 0 ? 1 : -1;
          p.vx = 220 * s; e.vx = -220 * s; p.vy = -160; e.vy = -160;
          A.sfx.hit(); shake.add(0.2);
          particles.burst((p.x + e.x) / 2, (p.y + e.y) / 2, { n: 10, colors: ['#ffffff', '#ffd700'], speed: 180, life: 0.4, size: 3 });
        }
      }
    }
  }

  // eggs
  for (let i = eggs.length - 1; i >= 0; i--) {
    const g = eggs[i];
    g.bob += dt * 4;
    if (!g.rest) {
      g.vy += GRAV * 0.7 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
      for (const pl of PLATS) {
        if (g.x > pl.x && g.x < pl.x + pl.w && g.y >= pl.y - 4 && g.y <= pl.y + 14 && g.vy > 0) {
          g.y = pl.y - 6; g.rest = true; g.vy = 0;
        }
      }
      if (g.y > LAVA_Y) { eggs.splice(i, 1); continue; }
    } else {
      g.hatchT -= dt;
      if (g.hatchT <= 0) {
        eggs.splice(i, 1);
        const ne = spawnEnemy(g.tier, g.x, g.y - 30, 1.15);
        floaters.add(g.x, g.y - 20, 'HATCHED!', '#ff6b6b', 15);
        A.sfx.bad();
        continue;
      }
    }
    if (!p.dead && Math.hypot(p.x - g.x, p.y - g.y) < 30) {
      eggs.splice(i, 1);
      addScore(250, g.x, g.y - 16); A.sfx.eat();
      particles.burst(g.x, g.y, { n: 12, colors: ['#ffd700', '#ffffff'], speed: 160, life: 0.5, size: 3 });
    }
  }

  // pterodactyl: appears if the wave drags on
  if (!ptero && !pteroDone && waveT > 40) {
    ptero = { x: -40, y: 100, t: 0, life: 18 };
    pteroDone = true;
    floaters.add(W / 2, 90, '⚠ PTERODACTYL ⚠', '#ff3355', 22);
    A.sfx.bad();
  }
  if (ptero) {
    const pt = ptero; pt.t += dt; pt.life -= dt;
    const dx = (p.dead ? W / 2 : player.x) - pt.x, dy = (p.dead ? 240 : player.y) - pt.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    pt.x += (dx / d * 330 + Math.cos(pt.t * 3) * 60) * dt;
    pt.y += (dy / d * 330 + Math.sin(pt.t * 4) * 50) * dt;
    pt.y = A.clamp(pt.y, 40, LAVA_Y - 40);
    if (!p.dead && Math.hypot(p.x - pt.x, p.y - pt.y) < 32) die();
    if (pt.life <= 0 || pt.x > W + 60) ptero = null;
  }

  // wave clear
  if (enemies.length === 0 && !player.dead) {
    spawnT -= dt;
    if (spawnT <= 0 && waveT > 2) {
      const bonus = 500 * wave;
      addScore(bonus, W / 2, H / 2 - 40);
      floaters.add(W / 2, H / 2 - 70, 'WAVE CLEAR', '#a6ff00', 24);
      A.sfx.win();
      wave++; waveT = 0; pteroDone = false; spawnT = 1.6;
      paintScore();
      spawnWave();
    }
  } else spawnT = 0.6;

  particles.update(dt); floaters.update(dt); shake.update(dt);
}

/* ---------- render ---------- */
function drawRider(r, birdC, rideC, big) {
  const s = big || 1, f = r.face;
  ctx.save(); ctx.translate(r.x, r.y); ctx.scale(f * s, s);
  A.neonOn(ctx, birdC, 10); ctx.fillStyle = birdC;
  ctx.beginPath(); ctx.ellipse(0, 4, 16, 9, 0, 0, A.TAU); ctx.fill();
  const w = Math.sin(r.flapPh) * 9;
  ctx.beginPath(); ctx.ellipse(-2, 2 + w * 0.4, 11, 5, -0.5 + w * 0.03, 0, A.TAU); ctx.fill();
  ctx.strokeStyle = birdC; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(20, -12); ctx.stroke();
  ctx.beginPath(); ctx.arc(22, -13, 4, 0, A.TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(26, -14); ctx.lineTo(33, -11); ctx.lineTo(26, -8); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = birdC; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(-4, 20); ctx.moveTo(6, 12); ctx.lineTo(6, 20); ctx.stroke();
  A.neonOn(ctx, rideC, 10); ctx.fillStyle = rideC;
  ctx.fillRect(-6, -17, 12, 14);
  ctx.beginPath(); ctx.arc(0, -22, 5, 0, A.TAU); ctx.fill();
  ctx.strokeStyle = rideC; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(42, -10); ctx.stroke();
  A.neonOff(ctx); ctx.restore();
}
function render() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050518'); g.addColorStop(0.75, '#0a0a26'); g.addColorStop(1, '#1a0a12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.save();
  shake.apply(ctx);
  A.drawStarfield(stars, ctx, W, H);

  // platforms
  for (const pl of PLATS) {
    ctx.fillStyle = 'rgba(8,10,24,.9)';
    A.rr(ctx, pl.x, pl.y, pl.w, 14, 5); ctx.fill();
    A.neonOn(ctx, '#00f0ff', 12); ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pl.x + 4, pl.y + 2); ctx.lineTo(pl.x + pl.w - 4, pl.y + 2); ctx.stroke();
    A.neonOff(ctx);
  }
  // lava
  const lt = 0.6 + 0.4 * Math.sin(Date.now() / 300);
  A.neonOn(ctx, '#ff4d00', 22 * lt);
  const lg = ctx.createLinearGradient(0, LAVA_Y, 0, H);
  lg.addColorStop(0, '#ff7b00'); lg.addColorStop(1, '#a31200');
  ctx.fillStyle = lg; ctx.fillRect(0, LAVA_Y, W, H - LAVA_Y);
  A.neonOff(ctx);
  ctx.fillStyle = 'rgba(255,220,120,' + (0.25 + 0.2 * lt).toFixed(2) + ')';
  for (let x = 0; x < W; x += 46) {
    const bx = x + 20 * Math.sin(Date.now() / 700 + x);
    ctx.beginPath(); ctx.arc(bx, LAVA_Y + 12 + 4 * Math.sin(Date.now() / 500 + x * 2), 7, 0, A.TAU); ctx.fill();
  }

  // eggs
  for (const e of eggs) {
    const bob = e.rest ? 0 : Math.sin(e.bob) * 2;
    const urg = e.rest && e.hatchT < 2;
    A.neonOn(ctx, urg ? '#ff3355' : '#ffd700', urg ? 16 : 10);
    ctx.fillStyle = urg ? '#ff9d9d' : '#ffe9a8';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + bob, 9, 12, 0, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
  }
  // enemies
  for (const e of enemies) drawRider(e, e.c, '#1a0a12');
  // pterodactyl
  if (ptero) {
    ctx.save(); ctx.translate(ptero.x, ptero.y);
    const w = Math.sin(ptero.t * 10) * 14;
    A.neonOn(ctx, '#ff3355', 18); ctx.fillStyle = '#ff3355';
    ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, A.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-8, -6 - w * 0.4, 22, 7, -0.5, 0, A.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, -4 + w * 0.3, 16, 6, 0.5, 0, A.TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(16, -3, 3, 0, A.TAU); ctx.fill();
    A.neonOff(ctx); ctx.restore();
  }
  // player
  if (!player.dead) drawRider(player, '#a6ff00', '#00f0ff');

  particles.draw(ctx);
  floaters.draw(ctx);
  ctx.restore();

  if (waveMsgT > 0) A.glowText(ctx, waveMsg, W / 2, H / 2 - 60, '900 40px Orbitron, sans-serif', '#ffd700');
  if (state === 'paused') {
    ctx.save(); ctx.fillStyle = 'rgba(2,4,12,.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff'); ctx.restore();
  }
}

const loop = A.createLoop(update, render);

/* ---------- touch buttons ---------- */
(function buildTouch() {
  const B = id => document.getElementById(id);
  A.bindHold(B('joustLeft'), () => { input.left = true; }, () => { input.left = false; });
  A.bindHold(B('joustRight'), () => { input.right = true; }, () => { input.right = false; });
  A.bindHold(B('joustFlap'), () => { input.flap = true; }, () => { input.flap = false; });
})();

/* ---------- input ---------- */
document.addEventListener('keydown', (e) => {
  if (modalEl.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.left = true;
  else if (k === 'arrowright' || k === 'd') input.right = true;
  else if (k === 'arrowup' || k === ' ' || k === 'z') input.flap = true;
  else if (k === 'p') togglePause();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') input.left = false;
  else if (k === 'arrowright' || k === 'd') input.right = false;
  else if (k === 'arrowup' || k === ' ' || k === 'z') input.flap = false;
});
function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
}
pauseBtn.addEventListener('click', togglePause);

A.registerModalGame('joustModal', {
  onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">JOUST</div><div class="go-sub">flap higher · lance wins · grab the eggs</div>'); loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(modalEl);
reset(); render();

window.__joust = {
  start: startGame, update, render, flap: () => flap(player),
  spawnEnemy, killAll() { enemies.slice().forEach(e => killEnemy(e, true)); },
  setFlap(b) { input.flap = b; }, setMove(d) { input.left = d < 0; input.right = d > 0; },
  setWaveT(t) { waveT = t; },
  get state() { return state; }, get score() { return score; },
  get lives() { return lives; }, get wave() { return wave; },
  get player() { return player; }, get enemies() { return enemies; },
  get eggs() { return eggs; }, get ptero() { return ptero; }
};
})();
