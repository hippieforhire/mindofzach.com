/* Snake — neon overhaul. Smooth interpolated movement, particle
 * feasts, golden bonus fruit, speed ramp, persistent best score. */
(function () {
  'use strict';
  const A = Arcade;
  const canvas = document.getElementById('snakeCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('snakeScore');
  const hiEl = document.getElementById('snakeHi');
  const bestEl = document.getElementById('snakeBest');
  const pauseBtn = document.getElementById('snakePause');

  const W = 480, H = 480, CELL = 20, COLS = W / CELL, ROWS = H / CELL;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  let snake, dir, nextDir, food, bonus, score, best, speed, acc, stepMs;
  let state; // 'ready' | 'playing' | 'paused' | 'over'
  let newBest;

  const startOverlay = A.wireStartOverlay('snakeModal', startGame);
  const overOverlay = A.gameOverOverlay('snakeModal');

  function reset() {
    snake = [{ x: 12, y: 12 }];
    dir = { x: 1, y: 0 }; nextDir = dir;
    score = 0; newBest = false;
    best = A.getHi('snake');
    hiEl.textContent = best;
    speed = 8; stepMs = 1000 / speed; acc = 0;
    bonus = null;
    placeFood();
    particles.clear(); floaters.clear();
    state = 'ready';
    paintScore();
    bestEl.classList.add('hidden');
  }

  function startGame() {
    reset();
    A.bumpPlays('snake');
    state = 'playing';
    loop.start();
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!snake.some(s => s.x === x && s.y === y) && !(bonus && bonus.x === x && bonus.y === y)) free.push({ x, y });
    }
    if (!free.length) return win();
    food = Object.assign(A.choice(free), { pulse: 0 });
    // 25% chance to also spawn a golden bonus fruit
    if (!bonus && Math.random() < 0.25 && free.length > 4) {
      const b = A.choice(free);
      bonus = { x: b.x, y: b.y, ttl: 9, age: 0 };
    }
  }

  function step() {
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    // walls kill
    if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return die();
    // self kills (allow moving into the tail cell that will vacate)
    for (let i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) return die();
    }
    snake.unshift(head);
    let ate = false;
    if (head.x === food.x && head.y === food.y) {
      ate = true;
      score += 1;
      burstAt(head, ['#ff2fd6', '#ff7ae2', '#ffffff']);
      floaters.add(head.x * CELL + CELL / 2, head.y * CELL, '+1', '#ff7ae2', 18);
      A.sfx.eat();
      placeFood();
    } else if (bonus && head.x === bonus.x && head.y === bonus.y) {
      ate = true;
      score += 5;
      burstAt(head, ['#ffd700', '#fff3a0', '#ffb300']);
      floaters.add(head.x * CELL + CELL / 2, head.y * CELL, '+5', '#ffd700', 22);
      A.sfx.power();
      bonus = null;
    }
    if (!ate) snake.pop();
    else {
      // speed ramp every 4 points
      const target = 8 + Math.min(10, (score / 4) | 0);
      if (target !== speed) { speed = target; stepMs = 1000 / speed; }
    }
    if (bonus) { bonus.age += stepMs / 1000; if (bonus.age > bonus.ttl) bonus = null; }
    food.pulse += stepMs / 1000;
    if (A.setHi('snake', score)) { newBest = true; bestEl.classList.remove('hidden'); hiEl.textContent = score; }
    paintScore();
  }

  function burstAt(cell, colors) {
    particles.burst(cell.x * CELL + CELL / 2, cell.y * CELL + CELL / 2,
      { n: 26, colors, speed: 260, life: 0.7, size: 4 });
  }

  function die() {
    state = 'over';
    A.sfx.hit();
    shake.add(0.55);
    particles.burst(snake[0].x * CELL + CELL / 2, snake[0].y * CELL + CELL / 2,
      { n: 40, colors: ['#a6ff00', '#5dff9d', '#ffffff'], speed: 320, life: 0.9, size: 5 });
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        '<div class="go-score">SCORE ' + score + '</div>' +
        '<div class="go-best">BEST ' + Math.max(best, score) + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="snakeRetry">PLAY AGAIN</button>'
      );
      document.getElementById('snakeRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 650);
  }

  function win() { // filled the whole board — legendary
    state = 'over';
    A.sfx.win();
    overOverlay.show('<div class="go-title">FLAWLESS</div><div class="go-sub">YOU FILLED THE BOARD</div><button class="go-btn" id="snakeRetry">PLAY AGAIN</button>');
    document.getElementById('snakeRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }

  function paintScore() { scoreEl.textContent = 'SCORE ' + score + '  ·  SPEED ' + speed; }

  /* ----- smooth rendering: interpolate between grid steps ----- */
  function update(dt) {
    if (state !== 'playing') return;
    acc += dt * 1000;
    while (acc >= stepMs && state === 'playing') { step(); acc -= stepMs; }
    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  function cellPos(i, frac) {
    const c = snake[Math.min(i, snake.length - 1)];
    const p = snake[Math.min(i + 1, snake.length - 1)] || c;
    return { x: A.lerp(p.x, c.x, frac) * CELL, y: A.lerp(p.y, c.y, frac) * CELL };
  }

  function render() {
    ctx.save();
    // backdrop
    const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, '#0a1024'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // faint grid
    ctx.strokeStyle = 'rgba(0,240,255,0.05)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += CELL) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    shake.apply(ctx);

    const frac = state === 'playing' ? Math.min(1, acc / stepMs) : 1;

    // food
    if (food) {
      const fx = food.x * CELL + CELL / 2, fy = food.y * CELL + CELL / 2;
      const r = CELL * 0.32 * (1 + 0.12 * Math.sin(food.pulse * 6));
      A.neonOn(ctx, '#ff2fd6', 18);
      ctx.fillStyle = '#ff2fd6';
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, A.TAU); ctx.fill();
      ctx.fillStyle = '#ffd7f5';
      ctx.beginPath(); ctx.arc(fx - r * 0.25, fy - r * 0.25, r * 0.4, 0, A.TAU); ctx.fill();
      A.neonOff(ctx);
    }
    // golden bonus
    if (bonus) {
      const bx = bonus.x * CELL + CELL / 2, by = bonus.y * CELL + CELL / 2;
      const left = 1 - bonus.age / bonus.ttl;
      ctx.globalAlpha = 0.45 + 0.55 * left;
      A.neonOn(ctx, '#ffd700', 22);
      ctx.fillStyle = '#ffd700';
      const r = CELL * 0.34 * (1 + 0.15 * Math.sin(bonus.age * 10));
      ctx.beginPath(); ctx.arc(bx, by, r, 0, A.TAU); ctx.fill();
      A.neonOff(ctx); ctx.globalAlpha = 1;
    }

    // snake body — gradient from head to tail
    const n = snake.length;
    for (let i = n - 1; i >= 0; i--) {
      const p = cellPos(i, frac);
      const t = n <= 1 ? 0 : i / (n - 1);
      const hue = 95 - t * 55; // lime -> teal
      const size = CELL * (i === 0 ? 0.92 : 0.86 - t * 0.18);
      A.neonOn(ctx, 'hsl(' + hue + ',100%,55%)', 12);
      ctx.fillStyle = 'hsl(' + hue + ',100%,' + (i === 0 ? 62 : 50 - t * 12) + '%)';
      A.rr(ctx, p.x + (CELL - size) / 2, p.y + (CELL - size) / 2, size, size, size * 0.35);
      ctx.fill();
    }
    A.neonOff(ctx);
    // head eyes
    const hp = cellPos(0, frac);
    const cx = hp.x + CELL / 2, cy = hp.y + CELL / 2;
    const ex = dir.x * 4, ey = dir.y * 4;
    const px = -dir.y * 5, py = dir.x * 5;
    ctx.fillStyle = '#04140a';
    ctx.beginPath(); ctx.arc(cx + px + ex, cy + py + ey, 2.6, 0, A.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - px + ex, cy - py + ey, 2.6, 0, A.TAU); ctx.fill();

    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 42px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  const loop = A.createLoop(update, render);

  function setDir(x, y) {
    if (state !== 'playing') return;
    if (x === -nextDir.x && y === -nextDir.y && snake.length > 1) return; // no 180s
    nextDir = { x, y };
  }

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('snakeModal').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') setDir(0, -1);
    else if (k === 'arrowdown' || k === 's') setDir(0, 1);
    else if (k === 'arrowleft' || k === 'a') setDir(-1, 0);
    else if (k === 'arrowright' || k === 'd') setDir(1, 0);
    else if (k === 'p' || k === ' ') togglePause();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
  });

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  A.bindHold(document.getElementById('snakeUp'), () => setDir(0, -1));
  A.bindHold(document.getElementById('snakeDown'), () => setDir(0, 1));
  A.bindHold(document.getElementById('snakeLeft'), () => setDir(-1, 0));
  A.bindHold(document.getElementById('snakeRight'), () => setDir(1, 0));

  // swipe on canvas
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => { touchStart = [e.touches[0].clientX, e.touches[0].clientY]; }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!touchStart) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - touchStart[0], dy = e.touches[0].clientY - touchStart[1];
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(dx > 0 ? 1 : -1, 0); else setDir(0, dy > 0 ? 1 : -1);
    touchStart = [e.touches[0].clientX, e.touches[0].clientY];
  }, { passive: false });

  A.registerModalGame('snakeModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show(); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(document.getElementById('snakeModal'));
  reset(); render();
})();
