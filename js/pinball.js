/* Pinball — original neon table. Flippers, pop bumpers, P-I-N-K rollover
 * lanes, spinner, 3-ball multiball. Real fixed-substep physics. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('pinCanvas');
const ctx = canvas.getContext('2d');
const modalEl = document.getElementById('pinModal');
const scoreEl = document.getElementById('pinScore');
const hiEl = document.getElementById('pinHi');
const bestEl = document.getElementById('pinBest');
const pauseBtn = document.getElementById('pinPause');
const plungerBtn = document.getElementById('pinPlunger');

const W = 420, H = 760, GRAV = 1150, BR = 8, MAXV = 1500;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();

// Table geometry ------------------------------------------------------------
const ARC = { x: 210, y: 216, r: 198 };          // top arc: ball stays inside
const WALLS = [                                  // [x1,y1,x2,y2,restitution]
  [14, 230, 14, 600, 0.55],                      // left wall
  [406, 230, 406, 700, 0.55],                    // right outer wall
  [366, 700, 406, 700, 0.4],                     // plunger lane floor
  [366, 130, 366, 700, 0.55],                    // plunger lane wall
  [404, 128, 366, 72, 0.7],                      // lane top deflector (kicks left)
  [52, 600, 112, 692, 0.5],                      // left inlane guide
  [14, 600, 104, 688, 0.5],                      // left orbit curve (feeds flipper)
  [16, 300, 140, 420, 0.55],                      // left orbit guide (feeds bumpers)
  [64, 648, 64, 700, 0.4],                       // left outlane divider
  [328, 600, 268, 692, 0.5]                      // right inlane guide
];
const GATE = [366, 124, 406, 124];               // one-way: blocks vy>0 only if ball.top
const BUMPERS = [
  { x: 140, y: 300, r: 20, flash: 0, cool: 0 },
  { x: 210, y: 258, r: 20, flash: 0, cool: 0 },
  { x: 280, y: 300, r: 20, flash: 0, cool: 0 }
];
const SLINGS = [
  { x: 100, y: 615, r: 15, flash: 0, cool: 0 },
  { x: 280, y: 615, r: 15, flash: 0, cool: 0 }
];
const LANES = [110, 170, 230, 290].map(x => ({ x, y: 180, w: 26, h: 64 }));
const SPIN = { x: 210, y: 430, w: 30, h: 62 };
const FLEN = 56, D2R = Math.PI / 180;
const flippers = [
  { px: 120, py: 700, rest: 30 * D2R, act: -32 * D2R, ang: 30 * D2R, up: false, cool: 0 },
  { px: 260, py: 700, rest: 150 * D2R, act: 212 * D2R, ang: 150 * D2R, up: false, cool: 0 }
];

// State ----------------------------------------------------------------------
let balls, score, ballsLeft, letters, multiball, mbTimer, state;
let charge, charging, drainT, newBest, best, spinA, spinV, spinCool, stuckT;

const startOverlay = A.wireStartOverlay('pinModal', startGame);
const overOverlay = A.gameOverOverlay('pinModal');

function newBall(x, y, vx, vy) {
  return { x, y, vx: vx || 0, vy: vy || 0, r: BR, top: false, dead: false, trail: [] };
}
function reset() {
  balls = []; score = 0; ballsLeft = 3; letters = [false, false, false, false];
  multiball = false; mbTimer = 0; charge = 0; charging = false; drainT = 0;
  newBest = false; spinA = 0; spinV = 0; spinCool = 0; stuckT = 0;
  flippers[0].ang = flippers[0].rest; flippers[1].ang = flippers[1].rest;
  flippers[0].up = flippers[1].up = false;
  BUMPERS.forEach(b => { b.flash = 0; b.cool = 0; });
  SLINGS.forEach(s => { s.flash = 0; s.cool = 0; });
  best = A.getHi('pin'); hiEl.textContent = best;
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  particles.clear(); floaters.clear();
  state = 'ready';
  paintScore();
}
function startGame() {
  reset();
  A.bumpPlays('pin');
  serveBall();
  loop.start();
  A.sfx.power();
}
function serveBall() {
  balls = [newBall(386, 688, 0, 0)];
  letters = [false, false, false, false];
  multiball = false; mbTimer = 0; charge = 0; charging = false;
  state = 'serve';
}
function launchBall() {
  const b = balls[0];
  if (!b || state !== 'serve') return;
  b.vy = -(650 + 950 * charge);
  b.vx = A.rand(-30, 30);
  state = 'playing';
  charging = false; charge = 0;
  A.sfx.shoot();
  particles.burst(b.x, b.y, { n: 12, colors: ['#00f0ff', '#ffffff'], speed: 180, life: 0.4, size: 3 });
}
function paintScore() { scoreEl.textContent = score.toLocaleString(); }
function checkHi() {
  if (A.setHi('pin', score)) {
    newBest = true; hiEl.textContent = score;
    bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
  }
}
function addScore(n, x, y, label) {
  score += n;
  floaters.add(x, y, (label || '+') + n, n >= 500 ? '#ffd700' : '#a6ff00', n >= 500 ? 20 : 15);
  paintScore(); checkHi();
}
function startMultiball() {
  multiball = true; mbTimer = 12;
  addScore(2500, 210, 180, 'P-I-N-K ');
  floaters.add(210, 330, 'MULTIBALL!', '#ffd700', 30);
  balls.push(newBall(210, 120, Math.random() < 0.5 ? -220 : 220, 60));
  particles.burst(210, 200, { n: 50, colors: ['#ffd700', '#ff2fd6', '#00f0ff', '#ffffff'], speed: 380, life: 1, size: 5 });
  A.sfx.win();
}
function drainBall(b) {
  b.dead = true;
  particles.burst(b.x, 740, { n: 14, colors: ['#ff3355', '#ffffff'], speed: 200, life: 0.5, size: 3 });
}
function endGame() {
  state = 'over';
  A.sfx.lose();
  checkHi();
  particles.burst(210, 380, { n: 60, colors: ['#ff3355', '#ff2fd6', '#ffffff'], speed: 380, life: 1, size: 5 });
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title lost">GAME OVER</div>' +
      '<div class="go-score">' + score.toLocaleString() + ' PTS</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="pinRetry">PLAY AGAIN</button>');
    document.getElementById('pinRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}

// Physics --------------------------------------------------------------------
function segClosest(x1, y1, x2, y2, px, py) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = A.clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
  return { x: x1 + dx * t, y: y1 + dy * t, t };
}
function collideSeg(b, x1, y1, x2, y2, rest) {
  const c = segClosest(x1, y1, x2, y2, b.x, b.y);
  let nx = b.x - c.x, ny = b.y - c.y;
  const d = Math.hypot(nx, ny);
  if (d >= b.r || d === 0) return false;
  nx /= d; ny /= d;
  b.x = c.x + nx * b.r; b.y = c.y + ny * b.r;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + rest) * vn * nx;
    b.vy -= (1 + rest) * vn * ny;
    if (vn < -160) A.sfx.tick();
  }
  return true;
}
function kickCircle(b, c, minSpd, pts, colors, snd) {
  const dx = b.x - c.x, dy = b.y - c.y;
  const d = Math.hypot(dx, dy) || 0.001;
  if (d >= b.r + c.r) return false;
  const nx = dx / d, ny = dy / d;
  b.x = c.x + nx * (b.r + c.r + 0.5); b.y = c.y + ny * (b.r + c.r + 0.5);
  const sp = Math.max(minSpd, Math.hypot(b.vx, b.vy) * 1.04);
  b.vx = nx * sp; b.vy = ny * sp;
  c.flash = 0.14;
  particles.burst(c.x, c.y, { n: 12, colors, speed: 260, life: 0.4, size: 3 });
  addScore(pts, c.x, c.y - 26);
  snd();
  return true;
}
function flipperTip(f) {
  return { x: f.px + Math.cos(f.ang) * FLEN, y: f.py + Math.sin(f.ang) * FLEN };
}
function collideFlipper(b, f) {
  const tip = flipperTip(f);
  const c = segClosest(f.px, f.py, tip.x, tip.y, b.x, b.y);
  let nx = b.x - c.x, ny = b.y - c.y;
  const d = Math.hypot(nx, ny), hitD = b.r + 6;
  if (d >= hitD) return;
  if (d > 0.001) { nx /= d; ny /= d; } else { nx = Math.sin(f.ang); ny = -Math.cos(f.ang); }
  b.x = c.x + nx * hitD; b.y = c.y + ny * hitD;
  if (f.up && f.cool <= 0) {
    // active hit: fire along the flipper's up-normal with a boost
    const ux = Math.sin(f.ang), uy = -Math.cos(f.ang);
    b.vx = ux * 700 + (c.t - 0.5) * 600 + A.rand(-40, 40);
    b.vy = Math.min(uy * 700 - 200, -520);
    f.cool = 0.12;
    b.x += ux * 5; b.y += uy * 5; // separation so the swing-through can't reverse it
    particles.burst(b.x, b.y, { n: 10, colors: ['#00f0ff', '#ffffff'], speed: 220, life: 0.35, size: 3 });
    A.sfx.click();
  } else if (f.cool <= 0) {
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) { b.vx -= 1.35 * vn * nx; b.vy -= 1.35 * vn * ny; }
  }
}
function inRect(b, x, y, w, h) {
  return b.x > x - w / 2 && b.x < x + w / 2 && b.y > y - h / 2 && b.y < y + h / 2;
}
function stepBall(b, dt) {
  b.vy += GRAV * dt;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > MAXV) { b.vx *= MAXV / sp; b.vy *= MAXV / sp; }
  const n = A.clamp(Math.ceil(sp * dt / 7), 1, 5), sdt = dt / n;
  for (let i = 0; i < n; i++) {
    b.x += b.vx * sdt; b.y += b.vy * sdt;
    // top arc (stay inside) — only above arc center and left of the lane
    if (b.y < ARC.y && b.x < 366) {
      let dx = b.x - ARC.x, dy = b.y - ARC.y;
      const dd = Math.hypot(dx, dy), maxD = ARC.r - b.r;
      if (dd > maxD) {
        dx /= dd; dy /= dd;
        b.x = ARC.x + dx * maxD; b.y = ARC.y + dy * maxD;
        const vn = b.vx * dx + b.vy * dy;
        if (vn > 0) { b.vx -= 1.55 * vn * dx; b.vy -= 1.55 * vn * dy; }
      }
    }
    for (let w = 0; w < WALLS.length; w++) {
      const s = WALLS[w];
      collideSeg(b, s[0], s[1], s[2], s[3], s[4]);
    }
    // one-way gate
    if (b.vy > 0 && b.top) collideSeg(b, GATE[0], GATE[1], GATE[2], GATE[3], 0.6);
    for (let k = 0; k < BUMPERS.length; k++) {
      const c = BUMPERS[k];
      if (c.cool <= 0 && kickCircle(b, c, 560, multiball ? 500 : 100,
        multiball ? ['#ffd700', '#ffffff'] : ['#ff2fd6', '#ffffff'], () => A.sfx.pop())) c.cool = 0.06;
    }
    for (let k = 0; k < SLINGS.length; k++) {
      const c = SLINGS[k];
      if (c.cool <= 0 && kickCircle(b, c, 430, 25, ['#ffb300', '#ffffff'], () => A.sfx.tick())) c.cool = 0.08;
    }
    collideFlipper(b, flippers[0]);
    collideFlipper(b, flippers[1]);
  }
  if (b.y < 110 && b.x > 360) b.top = true;
  // ball resting on the one-way gate tips back into play
  if (b.top && b.x > 364 && b.x < 408 && b.y < 150 && Math.abs(b.vy) < 80) b.vx -= 320 * dt;
  // rollover lanes
  for (let k = 0; k < LANES.length; k++) {
    const L = LANES[k];
    if (!letters[k] && inRect(b, L.x, L.y, L.w, L.h)) {
      letters[k] = true;
      addScore(250, L.x, L.y - 40, '');
      floaters.add(L.x, L.y - 58, 'PINK'[k], '#ffd700', 18);
      A.sfx.good();
      if (letters.every(Boolean) && !multiball && balls.length < 2) startMultiball();
    }
  }
  // spinner
  spinCool -= dt;
  if (spinCool <= 0 && inRect(b, SPIN.x, SPIN.y, SPIN.w, SPIN.h)) {
    spinCool = 0.25; spinV = 14;
    addScore(50, SPIN.x, SPIN.y - 44);
    A.sfx.click();
  }
  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 10) b.trail.shift();
  // outlanes + drain
  const inROut = b.x > 328 && b.x < 366 && b.y > 595;
  const inLOut = b.x > 14 && b.x < 64 && b.y > 648;
  if (inROut || inLOut) drainBall(b);
  else if (b.y > 752) drainBall(b);
  // failsafe: never leave the table
  b.x = A.clamp(b.x, 6, 414);
  if (b.y > 758 && !b.dead) drainBall(b);
  // anti-stall nudge
  if (state === 'playing' && Math.hypot(b.vx, b.vy) < 8 && b.y < 700) {
    stuckT += dt;
    if (stuckT > 4) { b.vx = Math.random() < 0.5 ? -160 : 160; stuckT = 0; }
  } else stuckT = 0;
}
function ballBall() {
  if (balls.length < 2) return;
  const a = balls[0], c = balls[1];
  if (a.dead || c.dead) return;
  const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
  if (d === 0 || d >= BR * 2) return;
  const nx = dx / d, ny = dy / d;
  const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
  if (rel > 0) {
    a.vx -= rel * nx; a.vy -= rel * ny;
    c.vx += rel * nx; c.vy += rel * ny;
    A.sfx.tick();
  }
}

function update(dt) {
  // flipper animation
  for (let k = 0; k < 2; k++) {
    const f = flippers[k];
    const tgt = f.up ? f.act : f.rest;
    const rate = (f.up ? 1250 : 320) * D2R;
    const d = tgt - f.ang;
    f.ang += A.clamp(d, -rate * dt, rate * dt);
    if (f.cool > 0) f.cool -= dt;
  }
  for (let k = 0; k < BUMPERS.length; k++) {
    if (BUMPERS[k].flash > 0) BUMPERS[k].flash -= dt;
    if (BUMPERS[k].cool > 0) BUMPERS[k].cool -= dt;
  }
  for (let k = 0; k < SLINGS.length; k++) {
    if (SLINGS[k].flash > 0) SLINGS[k].flash -= dt;
    if (SLINGS[k].cool > 0) SLINGS[k].cool -= dt;
  }
  spinA += spinV * dt; spinV *= (1 - 2.2 * dt);
  // plunger charge
  if (charging && state === 'serve') {
    charge = Math.min(1, charge + dt / 1.1);
    if (Math.random() < dt * 8) A.sfx.tick();
  }
  if (state === 'playing') {
    for (let i = 0; i < balls.length; i++) if (!balls[i].dead) stepBall(balls[i], dt);
    ballBall();
    balls = balls.filter(b => !b.dead);
    if (multiball) {
      mbTimer -= dt;
      if (mbTimer <= 0 || balls.length < 2) { multiball = false; }
    }
    if (!balls.length) {
      ballsLeft--;
      A.sfx.bad(); shake.add(0.35);
      if (ballsLeft <= 0) { endGame(); return; }
      state = 'drain'; drainT = 1.0;
    }
    // weak plunge fell back: re-serve (only when falling back down the lane,
    // never on the way up right after launch)
    if (state === 'playing' && balls.length === 1 && !multiball) {
      const rb = balls[0];
      if (rb.x > 366 && rb.y > 655 && !rb.top && rb.vy > 0) serveBall();
    }
  } else if (state === 'serve') {
    const b = balls[0];
    if (b) { b.x = 386; b.y = 688; b.vx = b.vy = 0; }
  } else if (state === 'drain') {
    drainT -= dt;
    if (drainT <= 0) serveBall();
  }
  particles.update(dt); floaters.update(dt); shake.update(dt);
}

// Render -----------------------------------------------------------------------
function render() {
  ctx.save();
  ctx.fillStyle = '#04050e'; ctx.fillRect(0, 0, W, H);
  shake.apply(ctx);

  // playfield backdrop
  ctx.fillStyle = '#070a18'; ctx.fillRect(14, 18, 392, 730);

  // top arc guide
  A.neonOn(ctx, '#00f0ff', 12);
  ctx.strokeStyle = 'rgba(0,240,255,.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(ARC.x, ARC.y, ARC.r, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  A.neonOff(ctx);

  // walls
  ctx.strokeStyle = 'rgba(0,240,255,.55)'; ctx.lineWidth = 4;
  ctx.beginPath();
  for (let w = 0; w < WALLS.length; w++) {
    const s = WALLS[w];
    ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]);
  }
  ctx.stroke();
  // one-way gate (amber dashes)
  ctx.strokeStyle = 'rgba(255,179,0,.8)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo(GATE[0], GATE[1]); ctx.lineTo(GATE[2], GATE[3]); ctx.stroke();
  ctx.setLineDash([]);

  // rollover lanes P-I-N-K
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let k = 0; k < LANES.length; k++) {
    const L = LANES[k], lit = letters[k];
    ctx.fillStyle = lit ? 'rgba(255,215,0,.16)' : 'rgba(255,255,255,.03)';
    ctx.fillRect(L.x - L.w / 2, L.y - L.h / 2, L.w, L.h);
    ctx.strokeStyle = lit ? '#ffd700' : 'rgba(139,147,184,.4)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(L.x - L.w / 2, L.y - L.h / 2, L.w, L.h);
    if (lit) A.neonOn(ctx, '#ffd700', 10);
    ctx.font = '700 20px Orbitron, sans-serif';
    ctx.fillStyle = lit ? '#ffd700' : '#3a4060';
    ctx.fillText('PINK'[k], L.x, L.y);
    A.neonOff(ctx);
  }

  // pop bumpers
  for (let k = 0; k < BUMPERS.length; k++) {
    const c = BUMPERS[k];
    if (c.flash > 0) A.neonOn(ctx, '#ffffff', 26);
    else A.neonOn(ctx, '#ff2fd6', 16);
    ctx.fillStyle = c.flash > 0 ? '#ffffff' : '#5c1140';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    ctx.fillStyle = '#ff9de2';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.45, 0, A.TAU); ctx.fill();
  }
  // slingshots
  for (let k = 0; k < SLINGS.length; k++) {
    const c = SLINGS[k];
    if (c.flash > 0) A.neonOn(ctx, '#ffffff', 20);
    else A.neonOn(ctx, '#ffb300', 12);
    ctx.fillStyle = c.flash > 0 ? '#ffffff' : '#4a3208';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
  }
  // spinner
  ctx.save();
  ctx.translate(SPIN.x, SPIN.y);
  ctx.rotate(spinA);
  A.neonOn(ctx, '#a6ff00', 10);
  ctx.fillStyle = '#a6ff00';
  ctx.fillRect(-2.5, -SPIN.h / 2, 5, SPIN.h);
  A.neonOff(ctx);
  ctx.restore();
  ctx.fillStyle = '#3a4060'; ctx.font = '600 11px Rajdhani, sans-serif';
  ctx.fillText('SPIN', SPIN.x, SPIN.y + SPIN.h / 2 + 12);

  // flippers
  for (let k = 0; k < 2; k++) {
    const f = flippers[k], tip = flipperTip(f);
    A.neonOn(ctx, k ? '#ff2fd6' : '#00f0ff', 14);
    ctx.strokeStyle = k ? '#ff2fd6' : '#00f0ff'; ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(f.px, f.py); ctx.lineTo(tip.x, tip.y); ctx.stroke();
    A.neonOff(ctx);
    ctx.fillStyle = '#0a0d18';
    ctx.beginPath(); ctx.arc(f.px, f.py, 7, 0, A.TAU); ctx.fill();
  }

  // plunger: spring + power meter
  ctx.fillStyle = '#1a2030';
  ctx.fillRect(378, 700, 16, 44);
  A.neonOn(ctx, '#ffb300', 8);
  ctx.fillStyle = '#ffb300';
  const ph = 44 * charge;
  ctx.fillRect(378, 744 - ph, 16, ph);
  A.neonOff(ctx);
  ctx.fillStyle = '#8b93b8'; ctx.font = '600 10px Rajdhani, sans-serif';
  ctx.fillText('HOLD', 386, 758);

  // balls
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    b.trail.forEach((t, j) => {
      ctx.globalAlpha = (j + 1) / b.trail.length * 0.35;
      ctx.fillStyle = '#9df3ff';
      ctx.beginPath(); ctx.arc(t.x, t.y, b.r * 0.7, 0, A.TAU); ctx.fill();
    });
    ctx.restore();
    A.neonOn(ctx, '#ffffff', 18);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
  }

  particles.draw(ctx);
  floaters.draw(ctx);

  // HUD
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 17px Orbitron, sans-serif';
  ctx.fillStyle = '#a6ff00';
  ctx.fillText(score.toLocaleString(), 20, 34);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff2fd6';
  let dots = '';
  for (let i = 0; i < 3; i++) dots += i < ballsLeft ? '●' : '○';
  ctx.fillText(dots, 356, 34);
  if (multiball) {
    ctx.textAlign = 'center';
    A.neonOn(ctx, '#ffd700', 12);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('MULTIBALL ' + Math.ceil(mbTimer) + 's', 210, 60);
    A.neonOff(ctx);
  }
  if (state === 'serve') {
    ctx.textAlign = 'center';
    A.glowText(ctx, 'HOLD PLUNGER', 200, 560, '700 20px Orbitron, sans-serif', '#00f0ff');
  }
  ctx.restore();

  if (state === 'paused') {
    ctx.save();
    ctx.fillStyle = 'rgba(2,4,12,.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
    ctx.restore();
  }
}

const loop = A.createLoop(update, render);

// Input --------------------------------------------------------------------------
function setFlipper(side, up) { flippers[side].up = up; }
const touches = {};
function canvasPos(e, t) {
  const r = canvas.getBoundingClientRect();
  const cx = (t ? t.clientX : e.clientX) - r.left;
  return cx / r.width * W;
}
canvas.addEventListener('mousedown', e => { setFlipper(canvasPos(e) < W / 2 ? 0 : 1, true); });
window.addEventListener('mouseup', () => { setFlipper(0, false); setFlipper(1, false); });
canvas.addEventListener('touchstart', e => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i], side = canvasPos(e, t) < W / 2 ? 0 : 1;
    touches[t.identifier] = side; setFlipper(side, true);
  }
}, { passive: true });
function touchEnd(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const id = e.changedTouches[i].identifier;
    if (id in touches) { setFlipper(touches[id], false); delete touches[id]; }
  }
}
canvas.addEventListener('touchend', touchEnd);
canvas.addEventListener('touchcancel', touchEnd);

document.addEventListener('keydown', e => {
  if (modalEl.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'arrowleft') setFlipper(0, true);
  else if (k === '/' || k === 'arrowright') setFlipper(1, true);
  else if ((k === 'arrowdown' || k === ' ') && !e.repeat) { charging = true; }
  else if (k === 'p') togglePause();
});
document.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'z' || k === 'arrowleft') setFlipper(0, false);
  else if (k === '/' || k === 'arrowright') setFlipper(1, false);
  else if (k === 'arrowdown' || k === ' ') { if (state === 'serve') launchBall(); charging = false; }
});
function togglePause() {
  if (state === 'playing' || state === 'serve') { state = 'paused'; pauseBtn.textContent = '▶'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
}
pauseBtn.addEventListener('click', togglePause);
A.bindHold(plungerBtn, () => { charging = true; }, () => { if (state === 'serve') launchBall(); charging = false; });

A.registerModalGame('pinModal', {
  onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">PINBALL</div><div class="go-sub">light P-I-N-K for multiball · click to start</div>'); loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(modalEl);
reset(); render();

window.__pin = {
  start: startGame, serve: serveBall,
  launch(p) { charge = p == null ? 1 : p; launchBall(); },
  setFlipper, update, render,
  newBall(x, y, vx, vy, top) { const b = newBall(x, y, vx, vy); b.top = !!top; balls.push(b); return b; },
  test(x, y, vx, vy) { balls = [newBall(x, y, vx, vy)]; state = 'playing'; },
  get pos() { return balls.filter(b => !b.dead).map(b => [b.x, b.y]); },
  killBalls() { balls.forEach(b => { b.dead = true; }); },
  get state() { return state; }, get score() { return score; },
  get balls() { return balls.filter(b => !b.dead).length; },
  get ballsLeft() { return ballsLeft; },
  get letters() { return letters.slice(); },
  get multiball() { return multiball; },
  get flippers() { return flippers.map(f => ({ ang: f.ang, up: f.up })); }
};
})();
