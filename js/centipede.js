/* Centipede (1981) clone — neon garden defense. Shoot the winding
 * centipede, dodge fleas, spiders and scorpions, guard the mushrooms. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('centCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('centScore');
const hiEl = document.getElementById('centHi');
const bestEl = document.getElementById('centBest');
const pauseBtn = document.getElementById('centPause');
const modalEl = document.getElementById('centModal');

const W = 480, H = 640, GS = 16, COLS = 30, ROWS = 40, PZ = 34;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();

const startOverlay = A.wireStartOverlay('centModal', startGame);
const overOverlay = A.gameOverOverlay('centModal');

const key = (x, y) => y * COLS + x;
let mush, peds, shots, player, flea, spider, scorp;
let score, lives, wave, state, best, newBest, invuln, fireT, firing, keys;
let tSpider, tScorp, segSpd;

function addMush(gx, gy, hp) {
  if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
  const k = key(gx, gy), m = mush[k];
  if (m) m.hp = Math.min(4, m.hp + (hp || 1));
  else mush[k] = { hp: hp || 4, pois: false };
}
function seedMush() {
  for (let i = 0; i < 30; i++) addMush(A.randi(0, COLS - 1), A.randi(2, PZ - 2), A.randi(2, 4));
}
function spawnWave() {
  const ped = [];
  const dir = wave % 2 ? 1 : -1;
  const sx = dir > 0 ? 0 : COLS - 1;
  for (let i = 0; i < 12; i++)
    ped.push({ gx: sx - dir * i, gy: 1, px: (sx - dir * i) * GS, py: GS, dir, head: i === 0, dive: false, zdir: 1 });
  peds.push(ped);
  segSpd = 130 + wave * 14;
  floaters.add(W / 2, H / 2, 'WAVE ' + wave, '#00f0ff', 26);
  A.sfx.power();
}
function reset() {
  mush = {}; peds = []; shots = [];
  player = { x: W / 2, y: H - 40, r: 10 };
  flea = null; spider = null; scorp = null;
  score = 0; lives = 3; wave = 1; state = 'ready'; newBest = false;
  invuln = 0; fireT = 0; firing = false; keys = {};
  tSpider = 8; tScorp = 18;
  seedMush(); spawnWave();
  best = A.getHi('cent'); hiEl.textContent = best;
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  particles.clear(); floaters.clear();
  paintScore();
}
function startGame() {
  reset();
  A.bumpPlays('cent');
  state = 'playing';
  loop.start();
  A.sfx.power();
}
function paintScore() { scoreEl.textContent = score + ' PTS'; }
function checkHi() {
  if (A.setHi('cent', score)) {
    newBest = true; hiEl.textContent = score;
    bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
  }
}
function addScore(n, x, y) {
  score += n; paintScore(); checkHi();
  if (x !== undefined) floaters.add(x, y, '+' + n, '#ffd700', 14);
}

/* ---------- centipede movement ---------- */
function segStep(s, dt) {
  if (s.dive) {
    s.py += 360 * dt; s.gy = (s.py / GS) | 0; s.px = s.gx * GS;
    if (s.gy >= PZ) { s.dive = false; s.zdir = 1; s.gy = PZ; s.py = PZ * GS; }
    return;
  }
  s.px += s.dir * segSpd * dt;
  const crossed = s.dir > 0 ? s.px >= (s.gx + 1) * GS : s.px <= s.gx * GS;
  if (!crossed) return;
  s.gx += s.dir; s.px = s.gx * GS;
  const nx = s.gx + s.dir;
  if (nx < 0 || nx >= COLS || mush[key(nx, s.gy)]) {
    s.dir *= -1;
    if (s.gy < PZ) s.gy++;
    else { s.gy += s.zdir; if (s.gy > ROWS - 2) { s.gy = ROWS - 2; s.zdir = -1; } if (s.gy < PZ) { s.gy = PZ; s.zdir = 1; } }
  }
  const m = mush[key(s.gx, s.gy)];
  if (s.head && m && m.pois) { s.dive = true; A.sfx.enemyShoot(); }
  s.py = s.gy * GS;
}
function killSeg(pi, si, x, y) {
  const ped = peds[pi], s = ped[si];
  addMush(s.gx, s.gy, 2);
  addScore(s.head ? 100 : 10, x, y);
  particles.burst(x, y, { n: 16, colors: ['#a6ff00', '#ffffff'], speed: 220, life: 0.5, size: 3 });
  A.sfx.explode();
  const back = ped.slice(si + 1);
  ped.length = si;
  if (back.length) { back[0].head = true; back[0].dive = false; peds.push(back); }
  if (!ped.length) peds.splice(pi, 1);
  if (!peds.length) {
    wave++;
    for (let i = 0; i < 5; i++) addMush(A.randi(0, COLS - 1), A.randi(2, PZ - 2), 3);
    spawnWave();
  }
}

/* ---------- enemies ---------- */
function spawnFlea() {
  flea = { x: A.rand(40, W - 40), y: -20, hp: 2, drop: 0 };
  A.sfx.enemyShoot();
}
function spawnSpider() {
  const d = Math.random() < 0.5 ? 1 : -1;
  spider = { x: d > 0 ? -20 : W + 20, y: A.rand(PZ * GS, H - 60), vx: 200 * d, vy: A.choice([-140, 140]), t: 0 };
}
function spawnScorp() {
  const d = Math.random() < 0.5 ? 1 : -1;
  scorp = { x: d > 0 ? -30 : W + 30, y: A.randi(4, PZ - 6) * GS, dir: d };
  A.sfx.enemyShoot();
}
function hurtPlayer() {
  if (invuln > 0 || state !== 'playing') return;
  lives--; invuln = 2.2; shake.add(0.6);
  particles.burst(player.x, player.y, { n: 30, colors: ['#ff3355', '#ffffff'], speed: 300, life: 0.7, size: 4 });
  A.sfx.lose();
  if (lives < 0) return endGame();
  player.x = W / 2; player.y = H - 40;
  floaters.add(W / 2, H / 2, lives + (lives === 1 ? ' LIFE' : ' LIVES') + ' LEFT', '#ff6b6b', 22);
}
function endGame() {
  state = 'over';
  A.sfx.lose();
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title lost">GAME OVER</div>' +
      '<div class="go-score">' + score + ' PTS · WAVE ' + wave + '</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="centRetry">PLAY AGAIN</button>');
    document.getElementById('centRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}
function fireShot() {
  if (shots.length >= 4) return;
  shots.push({ x: player.x, y: player.y - 14 });
  A.sfx.shoot();
}

/* ---------- update ---------- */
function update(dt) {
  if (state !== 'playing') return;
  if (invuln > 0) invuln -= dt;

  // player
  const sp = 340;
  if (keys.left) player.x -= sp * dt;
  if (keys.right) player.x += sp * dt;
  if (keys.up) player.y -= sp * dt;
  if (keys.down) player.y += sp * dt;
  player.x = A.clamp(player.x, 16, W - 16);
  player.y = A.clamp(player.y, PZ * GS + 8, H - 16);
  fireT -= dt;
  if ((firing || keys.fire) && fireT <= 0) { fireShot(); fireT = 0.22; }

  // centipede
  for (const ped of peds) for (const s of ped) segStep(s, dt);

  // shots
  for (let i = shots.length - 1; i >= 0; i--) {
    const sh = shots[i];
    sh.y -= 540 * dt;
    if (sh.y < -10) { shots.splice(i, 1); continue; }
    let hit = false;
    // vs segments
    for (let pi = peds.length - 1; pi >= 0 && !hit; pi--) {
      const ped = peds[pi];
      for (let si = ped.length - 1; si >= 0; si--) {
        const s = ped[si], cx = s.px + GS / 2, cy = s.py + GS / 2;
        if (Math.abs(sh.x - cx) < 13 && Math.abs(sh.y - cy) < 13) {
          killSeg(pi, si, cx, cy); hit = true; break;
        }
      }
    }
    // vs flea
    if (!hit && flea && Math.abs(sh.x - flea.x) < 12 && Math.abs(sh.y - flea.y) < 14) {
      flea.hp--; hit = true;
      particles.burst(sh.x, sh.y, { n: 10, colors: ['#ff6b6b', '#fff'], speed: 180, life: 0.4, size: 3 });
      if (flea.hp <= 0) { addScore(200, flea.x, flea.y); A.sfx.explode(); flea = null; } else A.sfx.hit();
    }
    // vs spider
    if (!hit && spider && Math.abs(sh.x - spider.x) < 14 && Math.abs(sh.y - spider.y) < 14) {
      const d = Math.hypot(player.x - spider.x, player.y - spider.y);
      addScore(d < 70 ? 900 : d < 150 ? 600 : 300, spider.x, spider.y);
      particles.burst(spider.x, spider.y, { n: 18, colors: ['#c26bff', '#fff'], speed: 220, life: 0.5, size: 3 });
      A.sfx.explode(); spider = null; hit = true;
    }
    // vs scorpion
    if (!hit && scorp && Math.abs(sh.x - scorp.x) < 16 && Math.abs(sh.y - scorp.y) < 12) {
      addScore(1000, scorp.x, scorp.y);
      particles.burst(scorp.x, scorp.y, { n: 20, colors: ['#ff7b00', '#fff'], speed: 240, life: 0.5, size: 3 });
      A.sfx.explode(); scorp = null; hit = true;
    }
    // vs mushroom
    if (!hit) {
      const gx = (sh.x / GS) | 0, gy = (sh.y / GS) | 0, m = mush[key(gx, gy)];
      if (m && gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
        m.hp--; hit = true; A.sfx.tick();
        if (m.hp <= 0) { delete mush[key(gx, gy)]; addScore(1, gx * GS + 8, gy * GS + 8); }
      }
    }
    if (hit) shots.splice(i, 1);
  }

  // flea
  if (!flea) {
    let pz = 0;
    for (const k in mush) if ((k / COLS | 0) >= PZ) pz++;
    if (pz < 5 && Math.random() < dt * 0.6) spawnFlea();
  } else {
    flea.y += 260 * dt; flea.drop += 260 * dt;
    if (flea.drop > 32) { flea.drop = 0; addMush((flea.x / GS) | 0, (flea.y / GS) | 0, 2); }
    if (flea.y > H + 20) flea = null;
    else if (Math.abs(flea.x - player.x) < 14 && Math.abs(flea.y - player.y) < 16) { flea = null; hurtPlayer(); }
  }
  // spider
  tSpider -= dt;
  if (tSpider <= 0) { tSpider = A.rand(9, 16); if (!spider) spawnSpider(); }
  if (spider) {
    spider.t += dt;
    spider.x += spider.vx * dt; spider.y += spider.vy * dt;
    if (spider.y < PZ * GS + 10 || spider.y > H - 30) spider.vy *= -1;
    if (spider.x < -30 || spider.x > W + 30) spider = null;
    else {
      const gx = (spider.x / GS) | 0, gy = (spider.y / GS) | 0;
      if (mush[key(gx, gy)]) delete mush[key(gx, gy)]; // eats mushrooms
      if (Math.abs(spider.x - player.x) < 16 && Math.abs(spider.y - player.y) < 16) { spider = null; hurtPlayer(); }
    }
  }
  // scorpion
  tScorp -= dt;
  if (tScorp <= 0) { tScorp = A.rand(18, 30); if (!scorp) spawnScorp(); }
  if (scorp) {
    scorp.x += scorp.dir * 170 * dt;
    const gx = (scorp.x / GS) | 0, gy = (scorp.y / GS) | 0, m = mush[key(gx, gy)];
    if (m) m.pois = true;
    if (scorp.x < -40 || scorp.x > W + 40) scorp = null;
  }

  // player vs centipede
  if (invuln <= 0) {
    outer: for (const ped of peds) for (const s of ped) {
      if (Math.abs(player.x - (s.px + 8)) < 14 && Math.abs(player.y - (s.py + 8)) < 15) { hurtPlayer(); break outer; }
    }
  }

  particles.update(dt); floaters.update(dt); shake.update(dt);
  paintScore();
}

/* ---------- render ---------- */
function drawMush(gx, gy, m) {
  const x = gx * GS, y = gy * GS, c = m.pois ? '#ff2fd6' : '#39d353';
  A.neonOn(ctx, c, 6);
  ctx.fillStyle = c;
  ctx.fillRect(x + 6, y + 8, 4, 7); // stem
  ctx.beginPath(); ctx.arc(x + 8, y + 8, 6, Math.PI, 0); ctx.fill(); // cap
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  const dmg = 4 - m.hp;
  if (dmg > 0) ctx.fillRect(x + 3, y + 3, 10, dmg * 2.5); // damage ticks
  A.neonOff(ctx);
}
function render() {
  ctx.save();
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
  shake.apply(ctx);
  // player zone line
  ctx.strokeStyle = 'rgba(0,240,255,.18)'; ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(0, PZ * GS); ctx.lineTo(W, PZ * GS); ctx.stroke();
  ctx.setLineDash([]);

  for (const k in mush) drawMush(k % COLS, (k / COLS) | 0, mush[k]);

  // centipede
  for (const ped of peds) for (const s of ped) {
    const cx = s.px + 8, cy = s.py + 8;
    const col = s.dive ? '#ff2fd6' : '#a6ff00';
    A.neonOn(ctx, col, 10);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    if (s.head) { // eyes
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.arc(cx - 3, cy - 2, 1.6, 0, A.TAU); ctx.arc(cx + 3, cy - 2, 1.6, 0, A.TAU); ctx.fill();
    }
  }
  // shots
  A.neonOn(ctx, '#9df3ff', 8);
  ctx.fillStyle = '#d8fbff';
  for (const sh of shots) ctx.fillRect(sh.x - 1.5, sh.y - 8, 3, 12);
  A.neonOff(ctx);
  // flea
  if (flea) {
    A.neonOn(ctx, '#ff6b6b', 10); ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.arc(flea.x, flea.y, 7, 0, A.TAU); ctx.fill(); A.neonOff(ctx);
  }
  // spider
  if (spider) {
    A.neonOn(ctx, '#c26bff', 10); ctx.fillStyle = '#c26bff';
    ctx.beginPath(); ctx.arc(spider.x, spider.y, 9, 0, A.TAU); ctx.fill();
    ctx.strokeStyle = '#c26bff'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = spider.t * 6 + i * 1.6;
      ctx.beginPath(); ctx.moveTo(spider.x, spider.y);
      ctx.lineTo(spider.x + Math.cos(a) * 15, spider.y + Math.sin(a) * 15); ctx.stroke();
    }
    A.neonOff(ctx);
  }
  // scorpion
  if (scorp) {
    A.neonOn(ctx, '#ff7b00', 10); ctx.fillStyle = '#ff7b00';
    ctx.beginPath(); ctx.ellipse(scorp.x, scorp.y, 14, 6, 0, 0, A.TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(scorp.x + scorp.dir * 14, scorp.y);
    ctx.quadraticCurveTo(scorp.x + scorp.dir * 24, scorp.y - 12, scorp.x + scorp.dir * 18, scorp.y - 14); ctx.stroke();
    A.neonOff(ctx);
  }
  // player
  if (!(invuln > 0 && ((invuln * 10) | 0) % 2)) {
    const x = player.x, y = player.y;
    A.neonOn(ctx, '#00f0ff', 14);
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 12); ctx.lineTo(x - 10, y + 8); ctx.lineTo(x + 10, y + 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y - 2, 3.5, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
  }
  // lives
  ctx.fillStyle = '#00f0ff'; ctx.font = '700 15px Orbitron, sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let lx = 10;
  for (let i = 0; i <= lives; i++) { ctx.fillText('▲', lx, 18); lx += 20; }
  ctx.textAlign = 'right'; ctx.fillStyle = '#8b93b8';
  ctx.fillText('WAVE ' + wave, W - 10, 18);

  particles.draw(ctx);
  floaters.draw(ctx);
  ctx.restore();
  if (state === 'paused') {
    ctx.save();
    ctx.fillStyle = 'rgba(2,4,12,.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
    ctx.restore();
  }
}

const loop = A.createLoop(update, render);

document.addEventListener('keydown', (e) => {
  if (modalEl.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') keys.left = true;
  else if (k === 'arrowright' || k === 'd') keys.right = true;
  else if (k === 'arrowup' || k === 'w') keys.up = true;
  else if (k === 'arrowdown' || k === 's') keys.down = true;
  else if (k === ' ') keys.fire = true;
  else if (k === 'p') togglePause();
});
document.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') keys.left = false;
  else if (k === 'arrowright' || k === 'd') keys.right = false;
  else if (k === 'arrowup' || k === 'w') keys.up = false;
  else if (k === 'arrowdown' || k === 's') keys.down = false;
  else if (k === ' ') keys.fire = false;
});
function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
}
pauseBtn.addEventListener('click', togglePause);

// touch: drag to move, auto-fire while touching
let dragging = false;
function dragTo(e) {
  const r = canvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  player.x = A.clamp(cx / r.width * W, 16, W - 16);
  player.y = A.clamp(cy / r.height * H, PZ * GS + 8, H - 16);
}
canvas.addEventListener('mousedown', (e) => { dragging = true; firing = true; dragTo(e); });
canvas.addEventListener('mousemove', (e) => { if (dragging) dragTo(e); });
window.addEventListener('mouseup', () => { dragging = false; firing = false; });
canvas.addEventListener('touchstart', (e) => { dragging = true; firing = true; dragTo(e); }, { passive: true });
canvas.addEventListener('touchmove', (e) => { if (dragging) { e.preventDefault(); dragTo(e); } }, { passive: false });
canvas.addEventListener('touchend', () => { dragging = false; firing = false; });

A.registerModalGame('centModal', {
  onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">CENTIPEDE</div><div class="go-sub">drag to move · auto-fire · click to start</div>'); loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(modalEl);
reset(); render();

window.__cent = {
  start: startGame, update, fireShot, segStep, killSeg, hurtPlayer, spawnWave, addMush,
  spawnFlea, spawnSpider, spawnScorp,
  setKeys(o) { keys = o; }, setFiring(v) { firing = v; },
  get state() { return state; }, get score() { return score; },
  get lives() { return lives; }, get wave() { return wave; },
  get peds() { return peds; }, get mush() { return mush; },
  get player() { return player; }, get shots() { return shots; },
  get flea() { return flea; }, get spider() { return spider; }, get scorp() { return scorp; }
};
})();
