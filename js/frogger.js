/* ============================================================
 * frogger.js — neon Frogger (1981) clone.
 * 13x15 grid: 5 home bays, 2 turtle + 3 log river lanes,
 * median, 5 neon road lanes, safe banks. Hop with d-pad,
 * arrows or WASD. 45s per attempt, 5 attempts, fill all 5
 * homes to clear the round. +10 per forward hop, +50/home
 * plus time bonus, +200 per round.
 * ============================================================ */
(function () {
  'use strict';
  const A = window.Arcade;

  const canvas = document.getElementById('froggerCanvas');
  const ctx = canvas.getContext('2d');
  const modalEl = document.getElementById('froggerModal');
  const scoreEl = document.getElementById('froggerScore');
  const hiEl = document.getElementById('froggerHi');
  const bestEl = document.getElementById('froggerBest');
  const pauseBtn = document.getElementById('froggerPause');

  const W = 520, H = 600;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  const COLS = 13, ROWS = 15, CW = W / COLS, CH = H / ROWS;
  const HOME_ROW = 0, RIVER_TOP = 1, RIVER_BOT = 5, MEDIAN = 6;
  const ROAD_TOP = 7, ROAD_BOT = 11, START_ROW = 13, START_COL = 6;
  const BAYS = [0, 3, 6, 9, 12];
  const ATTEMPT_TIME = 45;

  const CAR_COLORS = ['#ff2fd6', '#00f0ff', '#ffe14d', '#ff7b00', '#7b7bff', '#00ffd0', '#ff6b6b'];

  const ROAD_DEF = [
    { row: 11, dir: -1, speed: 115, count: 3, len: 1.8 },
    { row: 10, dir: 1, speed: 150, count: 2, len: 2.2 },
    { row: 9, dir: -1, speed: 90, count: 3, len: 1.6 },
    { row: 8, dir: 1, speed: 135, count: 3, len: 2.0 },
    { row: 7, dir: -1, speed: 170, count: 2, len: 2.4 }
  ];
  const RIVER_DEF = [
    { row: 5, kind: 'log', dir: 1, speed: 85, count: 3, len: 3 },
    { row: 4, kind: 'log', dir: -1, speed: 115, count: 4, len: 2 },
    { row: 3, kind: 'log', dir: 1, speed: 65, count: 2, len: 4 },
    { row: 2, kind: 'turtle', dir: -1, speed: 95, count: 4, len: 2 },
    { row: 1, kind: 'turtle', dir: 1, speed: 75, count: 3, len: 3 }
  ];

  let lanes, frog, homes, score, attempts, round, state;
  let timeLeft, best, newBest, deathT, deathCause, bestRow, time, speedMul, lastTickSec;

  const startOverlay = A.wireStartOverlay('froggerModal', startGame);
  const overOverlay = A.gameOverOverlay('froggerModal');

  function buildLanes() {
    lanes = [];
    for (const d of ROAD_DEF) {
      lanes.push(makeLane('car', d, speedMul));
    }
    for (const d of RIVER_DEF) {
      lanes.push(makeLane(d.kind, d, speedMul));
    }
  }

  function makeLane(kind, d, mul) {
    const lenPx = d.len * CW;
    const span = W + 140;
    const segs = [];
    for (let i = 0; i < d.count; i++) {
      segs.push({
        x: (i * span) / d.count - 70,
        len: lenPx,
        phase: A.rand(0, 9),
        color: kind === 'car' ? A.choice(CAR_COLORS) : null
      });
    }
    return { kind, row: d.row, dir: d.dir, speed: d.speed * mul, segs };
  }

  function reset() {
    lanes = []; homes = [false, false, false, false, false];
    score = 0; attempts = 5; round = 1; speedMul = 1;
    newBest = false; time = 0; deathT = 0;
    best = A.getHi('frogger');
    hiEl.textContent = best;
    bestEl.textContent = ''; bestEl.classList.add('hidden');
    scoreEl.textContent = '0';
    state = 'ready';
    particles.clear(); floaters.clear();
    buildLanes();
    respawn();
  }

  function respawn() {
    frog = { col: START_COL, row: START_ROW, x: START_COL * CW + CW / 2, hopT: 0, squash: 0 };
    timeLeft = ATTEMPT_TIME;
    bestRow = START_ROW;
    lastTickSec = Math.ceil(ATTEMPT_TIME);
    deathT = 0; deathCause = '';
  }

  function startGame() {
    reset();
    A.bumpPlays('frogger');
    state = 'playing';
    loop.start();
    A.sfx.power();
  }

  function addScore(n, x, y, color) {
    score += n;
    scoreEl.textContent = score;
    if (A.setHi('frogger', score)) {
      newBest = true;
      hiEl.textContent = score;
      bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
    }
    if (x != null) floaters.add(x, y, '+' + n, color || '#ffffff', 16);
  }

  function frogY() { return frog.row * CH + CH / 2; }

  function hop(dx, dy) {
    if (state !== 'playing' || deathT > 0) return;
    const nc = A.clamp(frog.col + dx, 0, COLS - 1);
    const nr = A.clamp(frog.row + dy, 0, ROWS - 1);
    if (nc === frog.col && nr === frog.row) return;
    frog.col = nc; frog.row = nr;
    frog.x = nc * CW + CW / 2;
    frog.hopT = 0.14;
    A.sfx.jump();
    if (nr < bestRow) {
      addScore((bestRow - nr) * 10);
      bestRow = nr;
    }
    if (nr === HOME_ROW) landHome();
  }

  function landHome() {
    const bi = BAYS.indexOf(frog.col);
    if (bi < 0 || homes[bi]) { die('wall'); return; }
    homes[bi] = true;
    const bonus = 50 + Math.ceil(timeLeft) * 2;
    addScore(bonus, frog.x, CH / 2, '#a6ff00');
    floaters.add(frog.x, CH, 'HOME!', '#a6ff00', 20);
    A.sfx.good();
    particles.burst(frog.x, CH / 2, { n: 24, colors: ['#a6ff00', '#ffffff'], speed: 200, life: 0.6, size: 4 });
    if (homes.every(h => h)) return roundClear();
    respawn();
  }

  function roundClear() {
    addScore(200, W / 2, H / 2 - 60, '#ffd700');
    floaters.add(W / 2, H / 2, 'ROUND CLEAR!', '#ffd700', 30);
    A.sfx.win();
    particles.burst(W / 2, H / 2, { n: 60, colors: ['#ffd700', '#a6ff00', '#00f0ff', '#ffffff'], speed: 360, life: 1, size: 5 });
    round++;
    speedMul *= 1.07;
    homes = [false, false, false, false, false];
    buildLanes();
    respawn();
  }

  function die(cause) {
    if (deathT > 0 || state !== 'playing') return;
    attempts--;
    deathT = 0.9; deathCause = cause;
    shake.add(0.45);
    frog.squash = 1;
    const fx = frog.x, fy = frogY();
    if (cause === 'car') {
      A.sfx.hit();
      particles.burst(fx, fy, { n: 30, colors: ['#a6ff00', '#ff3355', '#ffffff'], speed: 300, life: 0.7, size: 4 });
    } else if (cause === 'time' || cause === 'wall') {
      A.sfx.bad();
      particles.burst(fx, fy, { n: 18, colors: ['#a6ff00', '#ffffff'], speed: 200, life: 0.5, size: 4 });
    } else { // drown / swept
      A.sfx.noise({ t: 0.35, v: 0.22, f: 900, fEnd: 140 });
      A.sfx.bad();
      particles.burst(fx, fy, { n: 34, colors: ['#00bfff', '#9df3ff', '#ffffff'], speed: 260, life: 0.7, size: 4, gravity: 300 });
    }
    floaters.add(fx, fy - 30, cause === 'time' ? 'TIME UP!' : cause === 'wall' ? 'OUCH!' : cause === 'swept' ? 'SWEPT AWAY!' : 'SPLAT!', '#ff6b6b', 20);
  }

  function afterDeath() {
    if (attempts <= 0) return gameOver();
    respawn();
  }

  function gameOver() {
    state = 'over';
    A.sfx.lose();
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        '<div class="go-score">' + score + ' PTS · ROUND ' + round + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="froggerRetry">PLAY AGAIN</button>'
      );
      document.getElementById('froggerRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 700);
  }

  function platformUnder(x, row) {
    for (const l of lanes) {
      if (l.row !== row || (l.kind !== 'log' && l.kind !== 'turtle')) continue;
      for (const s of l.segs) {
        if (x >= s.x - 6 && x <= s.x + s.len + 6) return { lane: l, seg: s };
      }
    }
    return null;
  }

  function turtleSubmerged(seg) {
    const cyc = (time + seg.phase) % 9;
    return { under: cyc > 7, warn: cyc > 5.5 && cyc <= 7 };
  }

  function update(dt) {
    if (state === 'paused' || state === 'over' || state === 'ready') return;
    time += dt;

    // move lanes
    for (const l of lanes) {
      for (const s of l.segs) {
        s.x += l.dir * l.speed * dt;
        if (l.dir > 0 && s.x > W + 70) s.x -= (W + 140);
        if (l.dir < 0 && s.x + s.len < -70) s.x += (W + 140);
      }
    }

    if (frog.hopT > 0) frog.hopT -= dt;
    if (frog.squash > 0) frog.squash = Math.max(0, frog.squash - dt * 1.4);

    if (deathT > 0) {
      deathT -= dt;
      if (deathT <= 0) afterDeath();
      particles.update(dt); floaters.update(dt); shake.update(dt);
      return;
    }

    // timer
    timeLeft -= dt;
    const sec = Math.ceil(timeLeft);
    if (sec !== lastTickSec) { lastTickSec = sec; if (sec <= 5 && sec > 0) A.sfx.tick(); }
    if (timeLeft <= 0) { die('time'); return; }

    const r = frog.row;

    if (r >= RIVER_TOP && r <= RIVER_BOT) {
      const p = platformUnder(frog.x, r);
      if (!p) { die('drown'); return; }
      if (p.lane.kind === 'turtle' && turtleSubmerged(p.seg).under) { die('drown'); return; }
      frog.x += p.lane.dir * p.lane.speed * dt;
      frog.col = A.clamp(Math.round(frog.x / CW - 0.5), 0, COLS - 1);
      if (frog.x < -10 || frog.x > W + 10) { die('swept'); return; }
    } else if (r >= ROAD_TOP && r <= ROAD_BOT) {
      for (const l of lanes) {
        if (l.row !== r || l.kind !== 'car') continue;
        for (const s of l.segs) {
          if (frog.x + 13 > s.x && frog.x - 13 < s.x + s.len) { die('car'); return; }
        }
      }
    }

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  function drawFrog(x, y, scale, squash) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * (1 + squash * 0.6), scale * (1 - squash * 0.55));
    A.neonOn(ctx, '#a6ff00', 14);
    ctx.fillStyle = '#39d353';
    ctx.beginPath(); ctx.arc(0, 2, 13, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    // eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-6, -9, 5, 0, A.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -9, 5, 0, A.TAU); ctx.fill();
    ctx.fillStyle = '#0a0a10';
    ctx.beginPath(); ctx.arc(-6, -9, 2.4, 0, A.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -9, 2.4, 0, A.TAU); ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);

    // river
    const rg = ctx.createLinearGradient(0, RIVER_TOP * CH, 0, (RIVER_BOT + 1) * CH);
    rg.addColorStop(0, '#041a33'); rg.addColorStop(1, '#03101f');
    ctx.fillStyle = rg;
    ctx.fillRect(0, RIVER_TOP * CH, W, (RIVER_BOT - RIVER_TOP + 1) * CH);
    ctx.strokeStyle = 'rgba(0,190,255,0.16)'; ctx.lineWidth = 1;
    for (let r = RIVER_TOP; r <= RIVER_BOT; r++) {
      const y = r * CH + CH / 2 + Math.sin(time * 1.6 + r) * 3;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x / 40 + time * 2 + r) * 3);
      ctx.stroke();
    }

    // road
    ctx.fillStyle = '#0b0d18';
    ctx.fillRect(0, ROAD_TOP * CH, W, (ROAD_BOT - ROAD_TOP + 1) * CH);
    ctx.strokeStyle = 'rgba(255,214,77,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([16, 14]);
    for (let r = ROAD_TOP; r < ROAD_BOT; r++) {
      const y = (r + 1) * CH;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // safe banks + median: green tint with neon edges
    for (const r of [MEDIAN, 12, START_ROW, 14]) {
      ctx.fillStyle = '#06140c';
      ctx.fillRect(0, r * CH, W, CH);
    }
    ctx.strokeStyle = 'rgba(166,255,0,0.5)'; ctx.lineWidth = 2;
    for (const r of [MEDIAN, 12]) {
      ctx.beginPath(); ctx.moveTo(0, r * CH); ctx.lineTo(W, r * CH); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (r + 1) * CH); ctx.lineTo(W, (r + 1) * CH); ctx.stroke();
    }

    // homes row
    ctx.fillStyle = '#07131c';
    ctx.fillRect(0, 0, W, CH);
    BAYS.forEach((c, i) => {
      const bx = c * CW + 4, bw = CW - 8;
      if (homes[i]) {
        A.neonOn(ctx, '#a6ff00', 12);
        ctx.fillStyle = '#0d2b12';
        A.rr(ctx, bx, 5, bw, CH - 10, 8); ctx.fill();
        A.neonOff(ctx);
        drawFrog(bx + bw / 2, CH / 2 + 2, 0.85, 0);
      } else {
        A.neonOn(ctx, '#00f0ff', 12);
        ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
        A.rr(ctx, bx, 5, bw, CH - 10, 8); ctx.stroke();
        A.neonOff(ctx);
        ctx.fillStyle = 'rgba(0,240,255,0.08)';
        A.rr(ctx, bx, 5, bw, CH - 10, 8); ctx.fill();
      }
    });

    // lanes
    for (const l of lanes) {
      const y = l.row * CH + CH / 2;
      for (const s of l.segs) {
        if (l.kind === 'car') {
          const h = 26;
          A.neonOn(ctx, s.color, 14);
          ctx.fillStyle = s.color;
          A.rr(ctx, s.x + 4, y - h / 2, s.len - 8, h, 7); ctx.fill();
          A.neonOff(ctx);
          ctx.fillStyle = 'rgba(2,3,10,0.75)';
          A.rr(ctx, s.x + s.len * 0.3, y - h / 2 + 5, s.len * 0.32, h - 10, 4); ctx.fill();
          // headlights at the front
          const fx = l.dir > 0 ? s.x + s.len - 6 : s.x + 6;
          A.neonOn(ctx, '#fffbe0', 10);
          ctx.fillStyle = '#fffbe0';
          ctx.beginPath(); ctx.arc(fx, y - 7, 3, 0, A.TAU); ctx.fill();
          ctx.beginPath(); ctx.arc(fx, y + 7, 3, 0, A.TAU); ctx.fill();
          A.neonOff(ctx);
        } else if (l.kind === 'log') {
          const h = 24;
          A.neonOn(ctx, '#ff9b3d', 10);
          ctx.fillStyle = '#4a2c12';
          A.rr(ctx, s.x, y - h / 2, s.len, h, 10); ctx.fill();
          A.neonOff(ctx);
          ctx.strokeStyle = '#ff9b3d'; ctx.lineWidth = 2;
          A.rr(ctx, s.x, y - h / 2, s.len, h, 10); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,155,61,0.4)'; ctx.lineWidth = 1;
          for (let k = 1; k < 4; k++) {
            const lx = s.x + (s.len * k) / 4;
            ctx.beginPath(); ctx.moveTo(lx, y - h / 2 + 4); ctx.lineTo(lx, y + h / 2 - 4); ctx.stroke();
          }
        } else { // turtle
          const sub = turtleSubmerged(s);
          if (sub.under) {
            ctx.strokeStyle = 'rgba(0,190,255,0.35)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(s.x + s.len / 2, y, s.len / 2, 8, 0, 0, A.TAU); ctx.stroke();
            continue;
          }
          const n = Math.max(2, Math.round(s.len / CW));
          const blink = sub.warn && (Math.sin(time * 14) > 0);
          const alpha = blink ? 0.35 : 1;
          for (let k = 0; k < n; k++) {
            const tx = s.x + (k + 0.5) * (s.len / n);
            ctx.save();
            ctx.globalAlpha = alpha;
            A.neonOn(ctx, '#00ffd0', 12);
            ctx.fillStyle = '#0f7a5c';
            ctx.beginPath(); ctx.arc(tx, y, 13, 0, A.TAU); ctx.fill();
            A.neonOff(ctx);
            ctx.strokeStyle = '#00ffd0'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(tx, y, 7, 0, A.TAU); ctx.stroke();
            ctx.restore();
          }
        }
      }
    }

    // frog (skip while dead-anim hides it on car squash)
    if (!(deathT > 0 && deathCause === 'car')) {
      const hopLift = frog.hopT > 0 ? Math.sin((frog.hopT / 0.14) * Math.PI) * -10 : 0;
      drawFrog(frog.x, frogY() + hopLift, 1, frog.squash);
    }

    // timer bar
    const tw = W * A.clamp(timeLeft / ATTEMPT_TIME, 0, 1);
    const tcol = timeLeft > 15 ? '#a6ff00' : timeLeft > 5 ? '#ffe14d' : '#ff3355';
    A.neonOn(ctx, tcol, 10);
    ctx.fillStyle = tcol;
    ctx.fillRect(0, 0, tw, 6);
    A.neonOff(ctx);
    ctx.save();
    ctx.font = '700 13px Orbitron, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = tcol;
    ctx.fillText(Math.ceil(Math.max(0, timeLeft)) + 's', W - 8, 10);
    ctx.restore();

    // attempts as mini frogs, bottom-left
    for (let i = 0; i < attempts; i++) {
      drawFrog(24 + i * 34, H - 22, 0.55, 0);
    }
    // round label, bottom-right
    ctx.save();
    ctx.font = '900 15px Orbitron, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    A.neonOn(ctx, '#ffd700', 8);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('ROUND ' + round, W - 12, H - 22);
    A.neonOff(ctx);
    ctx.restore();

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

  const loop = A.createLoop(update, render);

  document.addEventListener('keydown', (e) => {
    if (modalEl.classList.contains('hidden')) return;
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') hop(0, -1);
    else if (k === 'arrowdown' || k === 's') hop(0, 1);
    else if (k === 'arrowleft' || k === 'a') hop(-1, 0);
    else if (k === 'arrowright' || k === 'd') hop(1, 0);
    else if (k === 'p') togglePause();
  });

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  A.bindTap(pauseBtn, togglePause);

  A.bindTap(document.getElementById('froggerUp'), () => hop(0, -1));
  A.bindTap(document.getElementById('froggerDown'), () => hop(0, 1));
  A.bindTap(document.getElementById('froggerLeft'), () => hop(-1, 0));
  A.bindTap(document.getElementById('froggerRight'), () => hop(1, 0));

  A.registerModalGame('froggerModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">FROGGER</div><div class="go-sub">fill all 5 home bays — tap / arrows / WASD</div>'); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(modalEl);
  reset(); render();

  // minimal hook for headless logic tests
  window.__frogger = {
    start: startGame, hop, update,
    get state() { return state; },
    get score() { return score; },
    get attempts() { return attempts; },
    get homes() { return homes.slice(); },
    get frog() { return { col: frog.col, row: frog.row }; },
    get timeLeft() { return timeLeft; }
  };
})();
