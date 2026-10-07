/* ============================================================
 * breakout.js — neon Breakout (1976) clone.
 * 10x8 neon bricks, 3 lives, endless levels, speed ramps,
 * falling powerups: M = multiball (3 max), W = wide paddle
 * (12s), L = auto-fire laser (10s). All juice via Arcade.
 * ============================================================ */
(function () {
  'use strict';
  const A = window.Arcade;

  const canvas = document.getElementById('breakoutCanvas');
  const ctx = canvas.getContext('2d');
  const modalEl = document.getElementById('breakoutModal');
  const scoreEl = document.getElementById('breakoutScore');
  const hiEl = document.getElementById('breakoutHi');
  const bestEl = document.getElementById('breakoutBest');
  const pauseBtn = document.getElementById('breakoutPause');

  const W = 480, H = 640;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  const COLS = 10, ROWS = 8, BRICK_TOP = 64, BRICK_SIDE = 14;
  const BW = (W - BRICK_SIDE * 2) / COLS, BH = 20, GAP = 3;
  const ROW_COLORS = ['#ff2fd6', '#ff7b00', '#ffe14d', '#a6ff00', '#00f0ff', '#00ffd0', '#7b7bff', '#ff6b6b'];
  const ROW_SCORE = [7, 7, 5, 5, 3, 3, 1, 1];
  const PADDLE_Y = H - 48, PADDLE_H = 14, PADDLE_W = 84;
  const MAX_BALLS = 3;

  const POWERUPS = {
    M: { name: 'MULTIBALL', color: '#ff2fd6' },
    W: { name: 'WIDE PADDLE', color: '#00f0ff' },
    L: { name: 'LASER', color: '#ffe14d' }
  };

  let paddle, balls, bricks, bolts, powerups;
  let score, lives, level, state, best, newBest;
  let wideT, laserT, laserCd, speedBase;
  let keyL, keyR, btnL, btnR;
  let dragging, downX, downMoved, pausedFrom;

  const startOverlay = A.wireStartOverlay('breakoutModal', startGame);
  const overOverlay = A.gameOverOverlay('breakoutModal');

  function buildLevel(lv) {
    bricks.length = 0;
    const pat = (lv - 1) % 4;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let alive = true;
        if (pat === 1) alive = (r + c) % 2 === 0;                       // checker
        else if (pat === 2) alive = (r % 2 === 0) || (c % 3 !== 2);      // stripes
        else if (pat === 3) alive = Math.abs(r - 3.5) + Math.abs(c - 4.5) < 5.6; // diamond
        if (!alive) continue;
        bricks.push({
          x: BRICK_SIDE + c * BW + GAP / 2, y: BRICK_TOP + r * (BH + GAP),
          w: BW - GAP, h: BH,
          color: ROW_COLORS[r], pts: ROW_SCORE[r], alive: true
        });
      }
    }
  }

  function reset() {
    paddle = { x: W / 2 - PADDLE_W / 2, w: PADDLE_W };
    balls = []; bricks = []; bolts = []; powerups = [];
    score = 0; lives = 3; level = 1; newBest = false;
    wideT = 0; laserT = 0; laserCd = 0;
    speedBase = 310;
    keyL = keyR = btnL = btnR = false;
    dragging = false;
    best = A.getHi('breakout');
    hiEl.textContent = best;
    bestEl.textContent = ''; bestEl.classList.add('hidden');
    state = 'ready';
    particles.clear(); floaters.clear();
    buildLevel(1);
    serveBall();
    paintScore();
  }

  function serveBall() {
    balls = [{ x: paddle.x + paddle.w / 2, y: PADDLE_Y - 10, vx: 0, vy: 0, r: 8, stuck: true }];
    bolts.length = 0; powerups.length = 0;
  }

  function startGame() {
    reset();
    A.bumpPlays('breakout');
    state = 'serve';
    loop.start();
    A.sfx.power();
  }

  function paintScore() {
    scoreEl.textContent = score;
  }

  function addScore(n, x, y, color) {
    score += n;
    paintScore();
    if (A.setHi('breakout', score)) {
      newBest = true;
      hiEl.textContent = score;
      bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
    }
    if (x != null) floaters.add(x, y, '+' + n, color || '#ffffff', 15);
  }

  function launch() {
    if (state !== 'serve') return;
    for (const b of balls) {
      if (!b.stuck) continue;
      b.stuck = false;
      const ang = A.rand(-0.6, 0.6);
      b.vx = Math.sin(ang) * speedBase;
      b.vy = -Math.cos(ang) * speedBase;
    }
    state = 'playing';
    A.sfx.shoot();
  }

  function spawnPowerup(x, y) {
    if (Math.random() > 0.16) return;
    const type = A.choice(['M', 'W', 'L']);
    if (type === 'M' && balls.length >= MAX_BALLS) return;
    if (type === 'W' && wideT > 0) return;
    if (type === 'L' && laserT > 0) return;
    powerups.push({ x, y, vy: 150, type, color: POWERUPS[type].color });
  }

  function applyPowerup(p) {
    const info = POWERUPS[p.type];
    floaters.add(p.x, p.y, info.name + '!', info.color, 20);
    A.sfx.power();
    particles.burst(p.x, p.y, { n: 22, colors: [info.color, '#ffffff'], speed: 240, life: 0.6, size: 4 });
    if (p.type === 'M') {
      const src = balls.find(b => !b.stuck) || balls[0];
      let added = 0;
      for (let i = 0; i < 2 && balls.length < MAX_BALLS; i++) {
        const sp = Math.hypot(src.vx, src.vy) || speedBase;
        const ang = Math.atan2(src.vy, src.vx) + (i === 0 ? 0.5 : -0.5);
        balls.push({ x: src.x, y: src.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 8, stuck: false });
        added++;
      }
      if (!added) addScore(25);
    } else if (p.type === 'W') {
      wideT = 12;
    } else if (p.type === 'L') {
      laserT = 10; laserCd = 0;
    }
  }

  function brickHit(b, ball) {
    b.alive = false;
    addScore(b.pts, b.x + b.w / 2, b.y, b.color);
    particles.burst(b.x + b.w / 2, b.y + b.h / 2, { n: 16, colors: [b.color, '#ffffff'], speed: 230, life: 0.6, size: 4 });
    A.sfx.pop();
    spawnPowerup(b.x + b.w / 2, b.y + b.h / 2);
    if (ball) {
      const sp = Math.min(680, Math.hypot(ball.vx, ball.vy) * 1.006 + 1.5);
      const cur = Math.hypot(ball.vx, ball.vy) || 1;
      ball.vx = ball.vx / cur * sp; ball.vy = ball.vy / cur * sp;
    }
  }

  function loseLife() {
    lives--;
    shake.add(0.55);
    A.sfx.lose();
    particles.burst(paddle.x + paddle.w / 2, PADDLE_Y, { n: 40, colors: ['#ff3355', '#ff2fd6', '#ffffff'], speed: 320, life: 0.8, size: 5 });
    if (lives <= 0) return gameOver();
    wideT = 0; laserT = 0;
    paddle.w = PADDLE_W;
    paddle.x = A.clamp(paddle.x, 0, W - paddle.w);
    serveBall();
    state = 'serve';
  }

  function nextLevel() {
    level++;
    speedBase = Math.min(560, speedBase + 30);
    floaters.add(W / 2, H / 2, 'LEVEL ' + level, '#ffd700', 34);
    A.sfx.clear();
    wideT = 0; laserT = 0;
    paddle.w = PADDLE_W;
    buildLevel(level);
    serveBall();
    state = 'serve';
  }

  function gameOver() {
    state = 'over';
    A.sfx.lose();
    particles.burst(W / 2, H / 2, { n: 70, colors: ['#ff3355', '#ff2fd6', '#00f0ff', '#ffffff'], speed: 400, life: 1, size: 5 });
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        '<div class="go-score">' + score + ' PTS · LEVEL ' + level + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="breakoutRetry">PLAY AGAIN</button>'
      );
      document.getElementById('breakoutRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 700);
  }

  function paddleBounce(b) {
    const cx = paddle.x + paddle.w / 2;
    const rel = A.clamp((b.x - cx) / (paddle.w / 2), -1, 1);
    const maxAng = Math.PI * 0.38;
    const ang = rel * maxAng;
    const sp = Math.min(680, Math.max(speedBase, Math.hypot(b.vx, b.vy) * 1.01));
    b.vx = Math.sin(ang) * sp;
    b.vy = -Math.cos(ang) * sp;
    b.y = PADDLE_Y - b.r - 1;
    A.sfx.tick();
    particles.burst(b.x, PADDLE_Y, { n: 8, colors: ['#00f0ff', '#ffffff'], speed: 160, life: 0.35, size: 3 });
  }

  function update(dt) {
    if (state === 'paused' || state === 'over' || state === 'ready') return;

    // paddle
    const dir = ((keyR || btnR) ? 1 : 0) - ((keyL || btnL) ? 1 : 0);
    paddle.w = wideT > 0 ? PADDLE_W * 1.6 : PADDLE_W;
    if (dir !== 0 && !dragging) paddle.x += dir * 520 * dt;
    paddle.x = A.clamp(paddle.x, 0, W - paddle.w);

    if (wideT > 0) wideT -= dt;
    if (laserT > 0) {
      laserT -= dt;
      laserCd -= dt;
      if (laserCd <= 0 && state === 'playing') {
        laserCd = 0.35;
        const cx = paddle.x + paddle.w / 2;
        bolts.push({ x: cx - 14, y: PADDLE_Y - 6 }, { x: cx + 14, y: PADDLE_Y - 6 });
        A.sfx.shoot();
      }
    }

    // bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const t = bolts[i];
      t.y -= 760 * dt;
      let hit = false;
      for (const b of bricks) {
        if (!b.alive) continue;
        if (t.x > b.x - 3 && t.x < b.x + b.w + 3 && t.y > b.y - 8 && t.y < b.y + b.h + 4) {
          brickHit(b, null);
          hit = true;
          break;
        }
      }
      if (hit || t.y < 0) bolts.splice(i, 1);
    }

    // balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.stuck) {
        b.x = paddle.x + paddle.w / 2;
        b.y = PADDLE_Y - b.r - 2;
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      particles.trail(b.x, b.y, '#9df3ff', 4);

      // slow global ramp
      const cur = Math.hypot(b.vx, b.vy);
      if (cur < 680) { const ns = Math.min(680, cur + dt * 6); b.vx *= ns / cur; b.vy *= ns / cur; }

      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); A.sfx.tick(); }
      if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); A.sfx.tick(); }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); A.sfx.tick(); }

      // paddle
      if (b.vy > 0 && b.y + b.r >= PADDLE_Y && b.y + b.r <= PADDLE_Y + PADDLE_H + 10 &&
          b.x >= paddle.x - b.r && b.x <= paddle.x + paddle.w + b.r) {
        paddleBounce(b);
      }

      // bricks — circle vs rect, resolve on min-penetration axis
      for (const br of bricks) {
        if (!br.alive) continue;
        const nx = A.clamp(b.x, br.x, br.x + br.w);
        const ny = A.clamp(b.y, br.y, br.y + br.h);
        const dx = b.x - nx, dy = b.y - ny;
        if (dx * dx + dy * dy <= b.r * b.r) {
          const penX = b.r - Math.abs(dx), penY = b.r - Math.abs(dy);
          if (penX < penY) { b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx); b.x += dx > 0 ? penX : -penX; }
          else { b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy); b.y += dy > 0 ? penY : -penY; }
          brickHit(br, b);
          break;
        }
      }

      if (b.y - b.r > H + 20) {
        particles.burst(b.x, H - 10, { n: 14, colors: ['#9df3ff', '#ffffff'], speed: 200, life: 0.5, size: 3 });
        balls.splice(i, 1);
      }
    }

    if (state === 'playing' && balls.length === 0) loseLife();

    // powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;
      if (p.y > PADDLE_Y - 14 && p.y < PADDLE_Y + PADDLE_H + 6 &&
          p.x > paddle.x - 12 && p.x < paddle.x + paddle.w + 12) {
        applyPowerup(p);
        powerups.splice(i, 1);
      } else if (p.y > H + 20) {
        powerups.splice(i, 1);
      }
    }

    // level clear
    if (state === 'playing' && bricks.length && bricks.every(b => !b.alive)) nextLevel();

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  function render() {
    const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, '#0a0a22'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    shake.apply(ctx);

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      A.neonOn(ctx, b.color, 12);
      ctx.fillStyle = b.color;
      A.rr(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill();
      A.neonOff(ctx);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, 4);
    }

    // powerups
    for (const p of powerups) {
      A.neonOn(ctx, p.color, 14);
      ctx.fillStyle = '#0a0a1e';
      A.rr(ctx, p.x - 15, p.y - 13, 30, 26, 8); ctx.fill();
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      A.rr(ctx, p.x - 15, p.y - 13, 30, 26, 8); ctx.stroke();
      A.neonOff(ctx);
      ctx.fillStyle = p.color;
      ctx.font = '900 17px Orbitron, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.type, p.x, p.y + 1);
    }

    // laser bolts
    for (const t of bolts) {
      A.neonOn(ctx, '#ffe14d', 12);
      ctx.fillStyle = '#ffe14d';
      A.rr(ctx, t.x - 3, t.y - 10, 6, 20, 3); ctx.fill();
      A.neonOff(ctx);
    }

    // paddle
    const pw = paddle.w;
    const pcol = wideT > 0 ? '#00ffd0' : '#00f0ff';
    A.neonOn(ctx, pcol, 16);
    ctx.fillStyle = pcol;
    A.rr(ctx, paddle.x, PADDLE_Y, pw, PADDLE_H, 7); ctx.fill();
    A.neonOff(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(paddle.x + 4, PADDLE_Y + 2, pw - 8, 3);

    // balls + glow
    for (const b of balls) {
      A.neonOn(ctx, '#ffffff', 18);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, A.TAU); ctx.fill();
      A.neonOff(ctx);
    }

    // HUD: lives + level
    for (let i = 0; i < lives; i++) {
      A.neonOn(ctx, '#00f0ff', 8);
      ctx.fillStyle = '#00f0ff';
      A.rr(ctx, 16 + i * 34, 18, 28, 8, 4); ctx.fill();
      A.neonOff(ctx);
    }
    ctx.save();
    ctx.font = '900 20px Orbitron, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    A.neonOn(ctx, '#ffd700', 10);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('LV ' + level, W - 16, 24);
    A.neonOff(ctx);
    ctx.restore();

    // active powerup timers
    let ty = 44;
    ctx.save();
    ctx.font = '700 13px Orbitron, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (wideT > 0) {
      ctx.fillStyle = '#00ffd0';
      ctx.fillText('WIDE ' + Math.ceil(wideT) + 's', 16, ty); ty += 18;
    }
    if (laserT > 0) {
      ctx.fillStyle = '#ffe14d';
      ctx.fillText('LASER ' + Math.ceil(laserT) + 's', 16, ty);
    }
    ctx.restore();

    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    if (state === 'serve') {
      A.glowText(ctx, 'TAP / SPACE TO LAUNCH', W / 2, H - 130, '900 20px Orbitron, sans-serif', '#00f0ff');
    }
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
    const k = e.key.toLowerCase();
    if (k === 'arrowleft') keyL = true;
    else if (k === 'arrowright') keyR = true;
    else if (k === ' ') { if (state === 'serve') launch(); else togglePause(); }
    else if (k === 'p') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft') keyL = false;
    else if (k === 'arrowright') keyR = false;
  });

  function togglePause() {
    if (state === 'playing' || state === 'serve') { pausedFrom = state; state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = pausedFrom || 'playing'; pauseBtn.textContent = '⏸'; }
  }
  A.bindTap(pauseBtn, togglePause);

  A.bindHold(document.getElementById('breakoutLeft'), () => { btnL = true; }, () => { btnL = false; });
  A.bindHold(document.getElementById('breakoutRight'), () => { btnR = true; }, () => { btnR = false; });

  // drag paddle on canvas; a tap (no drag) launches the ball
  function pointX(e) {
    const r = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    return (cx - r.left) / r.width * W;
  }
  canvas.addEventListener('mousedown', (e) => { dragging = true; downX = pointX(e); downMoved = false; paddle.x = A.clamp(pointX(e) - paddle.w / 2, 0, W - paddle.w); });
  canvas.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (Math.abs(pointX(e) - downX) > 8) downMoved = true;
    paddle.x = A.clamp(pointX(e) - paddle.w / 2, 0, W - paddle.w);
  });
  window.addEventListener('mouseup', () => { if (dragging && !downMoved) launch(); dragging = false; });
  canvas.addEventListener('touchstart', (e) => { dragging = true; downX = pointX(e); downMoved = false; paddle.x = A.clamp(pointX(e) - paddle.w / 2, 0, W - paddle.w); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    e.preventDefault();
    if (Math.abs(pointX(e) - downX) > 8) downMoved = true;
    paddle.x = A.clamp(pointX(e) - paddle.w / 2, 0, W - paddle.w);
  }, { passive: false });
  canvas.addEventListener('touchend', () => { if (dragging && !downMoved) launch(); dragging = false; });

  A.registerModalGame('breakoutModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">BREAKOUT</div><div class="go-sub">tap / click / space to start</div>'); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(modalEl);
  reset(); render();

  // minimal hook for headless logic tests
  window.__breakout = {
    start: startGame, launch, update,
    get state() { return state; },
    get score() { return score; },
    get lives() { return lives; },
    get bricksLeft() { return bricks.filter(b => b.alive).length; },
    get ballCount() { return balls.length; }
  };
})();
