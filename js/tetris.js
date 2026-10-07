/* Tetris — neon overhaul. 7-bag, ghost piece, hold queue, combos,
 * back-to-back bonus, lock delay, particle line clears. */
(function () {
  'use strict';
  const A = Arcade;
  const canvas = document.getElementById('tetrisCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('tetrisScore');
  const hiEl = document.getElementById('tetrisHi');
  const bestEl = document.getElementById('tetrisBest');
  const pauseBtn = document.getElementById('tetrisPause');

  const COLS = 10, ROWS = 20, CELL = 26;
  const BOARD_X = 96, BOARD_W = COLS * CELL, BOARD_H = ROWS * CELL;
  const W = BOARD_X + BOARD_W + 88, H = BOARD_H;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  const COLORS = {
    T: ['#c026d3', '#f0abfc'], J: ['#2563eb', '#93c5fd'], L: ['#ea580c', '#fdba74'],
    O: ['#ca8a04', '#fde047'], S: ['#16a34a', '#86efac'], Z: ['#dc2626', '#fca5a5'],
    I: ['#0891b2', '#a5f3fc']
  };
  const SHAPES = {
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    J: [[2, 0, 0], [2, 2, 2], [0, 0, 0]],
    L: [[0, 0, 3], [3, 3, 3], [0, 0, 0]],
    O: [[4, 4], [4, 4]],
    S: [[0, 5, 5], [5, 5, 0], [0, 0, 0]],
    Z: [[6, 6, 0], [0, 6, 6], [0, 0, 0]],
    I: [[0, 0, 0, 0], [7, 7, 7, 7], [0, 0, 0, 0], [0, 0, 0, 0]]
  };
  const ORDER = ['T', 'J', 'L', 'O', 'S', 'Z', 'I'];
  const LINE_SCORE = [0, 100, 300, 500, 800];
  const GRAVITY = [0.8, 0.72, 0.63, 0.55, 0.47, 0.38, 0.3, 0.22, 0.15, 0.1, 0.08, 0.06, 0.05, 0.04, 0.03];

  let arena, bag, queue, hold, canHold;
  let cur; // {type, matrix, x, y}
  let score, level, lines, combo, b2b, best, newBest;
  let dropAcc, lockAcc, state;
  let clearAnim; // {rows:[], t}
  let dasDir, dasAcc, arrAcc; // auto-shift

  const startOverlay = A.wireStartOverlay('tetrisModal', startGame);
  const overOverlay = A.gameOverOverlay('tetrisModal');

  function reset() {
    arena = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
    bag = []; queue = [];
    refillQueue();
    hold = null; canHold = true;
    score = 0; level = 1; lines = 0; combo = -1; b2b = false; newBest = false;
    best = A.getHi('tetris'); hiEl.textContent = best;
    dropAcc = 0; lockAcc = 0; clearAnim = null;
    dasDir = 0; dasAcc = 0; arrAcc = 0;
    particles.clear(); floaters.clear();
    state = 'ready';
    spawnPiece();
    paintScore();
    bestEl.classList.add('hidden');
  }

  function startGame() {
    reset();
    A.bumpPlays('tetris');
    state = 'playing';
    loop.start();
  }

  function refillQueue() {
    while (queue.length < 5) {
      if (!bag.length) { bag = ORDER.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; } }
      queue.push(bag.pop());
    }
  }

  function spawnPiece(forcedType) {
    const type = forcedType || queue.shift();
    refillQueue();
    cur = { type, matrix: SHAPES[type].map(r => r.slice()), x: 3, y: 0 };
    if (type === 'O') cur.x = 4;
    canHold = true;
    dropAcc = 0; lockAcc = 0;
    if (collide(cur.matrix, cur.x, cur.y)) die();
  }

  function collide(m, px, py) {
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue;
      const ax = px + x, ay = py + y;
      if (ax < 0 || ax >= COLS || ay >= ROWS) return true;
      if (ay >= 0 && arena[ay][ax]) return true;
    }
    return false;
  }

  function rotateM(m, dir) {
    const n = m.length;
    const r = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[y][x] = dir > 0 ? m[n - 1 - x][y] : m[x][n - 1 - y];
    return r;
  }

  function tryRotate(dir) {
    if (state !== 'playing' || !cur) return;
    const kicks = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];
    const rm = rotateM(cur.matrix, dir);
    for (const [kx, ky] of kicks) {
      if (!collide(rm, cur.x + kx, cur.y + ky)) {
        cur.matrix = rm; cur.x += kx; cur.y += ky;
        lockAcc = 0; A.sfx.tick(); return;
      }
    }
  }

  function tryMove(dx) {
    if (state !== 'playing' || !cur) return;
    if (!collide(cur.matrix, cur.x + dx, cur.y)) { cur.x += dx; lockAcc = 0; }
  }

  function softDrop() {
    if (state !== 'playing' || !cur) return;
    if (!collide(cur.matrix, cur.x, cur.y + 1)) { cur.y++; score += 1; paintScore(); dropAcc = 0; }
    else lockPiece();
  }

  function hardDrop() {
    if (state !== 'playing' || !cur) return;
    let d = 0;
    while (!collide(cur.matrix, cur.x, cur.y + 1)) { cur.y++; d++; }
    score += d * 2;
    lockPiece();
    A.sfx.place();
  }

  function holdPiece() {
    if (state !== 'playing' || !cur || !canHold) return;
    A.sfx.pop();
    const t = cur.type;
    if (hold) spawnPiece(hold); else spawnPiece();
    hold = t; canHold = false;
  }

  function lockPiece() {
    const m = cur.matrix;
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] && cur.y + y >= 0) arena[cur.y + y][cur.x + x] = cur.type;
    }
    sweep();
    spawnPiece();
  }

  function sweep() {
    const rows = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (arena[y].every(c => c)) rows.push(y);
    }
    if (!rows.length) { combo = -1; return; }
    const n = rows.length;
    combo++;
    const isTetris = n === 4;
    let pts = LINE_SCORE[n] * level;
    if (isTetris && b2b) pts = (pts * 1.5) | 0;
    if (combo > 0) pts += 50 * combo * level;
    b2b = isTetris ? true : (n > 0 ? false : b2b);
    score += pts;
    lines += n;
    const newLevel = ((lines / 10) | 0) + 1;
    if (newLevel !== level) {
      level = newLevel;
      floaters.add(BOARD_X + BOARD_W / 2, 120, 'LEVEL ' + level, '#ffd700', 26);
      A.sfx.power();
    }
    // juice
    rows.forEach(y => {
      for (let x = 0; x < COLS; x++) {
        const t = arena[y][x];
        particles.burst(BOARD_X + x * CELL + CELL / 2, y * CELL + CELL / 2,
          { n: 4, colors: [COLORS[t][0], COLORS[t][1], '#ffffff'], speed: 200, life: 0.6, size: 3 });
      }
    });
    clearAnim = { rows, t: 0 };
    if (n === 4) { shake.add(0.35); floaters.add(BOARD_X + BOARD_W / 2, 200, b2b ? 'B2B TETRIS!' : 'TETRIS!', '#00f0ff', 28); }
    else floaters.add(BOARD_X + BOARD_W / 2, 200, '+' + pts, '#a6ff00', 20);
    if (n >= 2) A.sfx.clear(); else A.sfx.good();
    // remove rows after flash (handled in update via clearAnim)
    if (A.setHi('tetris', score)) { newBest = true; bestEl.classList.remove('hidden'); hiEl.textContent = score; }
    paintScore();
  }

  function finishSweep() {
    if (!clearAnim) return;
    clearAnim.rows.sort((a, b) => a - b).forEach(y => {
      arena.splice(y, 1);
      arena.unshift(new Array(COLS).fill(null));
    });
    clearAnim = null;
  }

  function die() {
    state = 'over';
    A.sfx.lose();
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">TOP OUT</div>' +
        '<div class="go-score">SCORE ' + score + '</div>' +
        '<div class="go-sub">LEVEL ' + level + ' · LINES ' + lines + '</div>' +
        '<div class="go-best">BEST ' + Math.max(best, score) + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="tetrisRetry">PLAY AGAIN</button>'
      );
      document.getElementById('tetrisRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 600);
  }

  function paintScore() {
    scoreEl.innerHTML = 'SCORE ' + score + ' <span style="color:var(--muted)">· LV ' + level + ' · LINES ' + lines + '</span>';
  }

  function ghostY() {
    let gy = cur.y;
    while (!collide(cur.matrix, cur.x, gy + 1)) gy++;
    return gy;
  }

  function update(dt) {
    if (state !== 'playing') { particles.update(dt); floaters.update(dt); return; }

    // line-clear flash animation
    if (clearAnim) {
      clearAnim.t += dt;
      if (clearAnim.t > 0.22) finishSweep();
    }

    // DAS auto-shift
    if (dasDir !== 0 && cur) {
      dasAcc += dt;
      if (dasAcc > 0.15) {
        arrAcc += dt;
        while (arrAcc > 0.033) { tryMove(dasDir); arrAcc -= 0.033; }
      }
    }

    // gravity
    const interval = GRAVITY[Math.min(level - 1, GRAVITY.length - 1)];
    dropAcc += dt;
    if (dropAcc >= interval && cur) {
      dropAcc = 0;
      if (!collide(cur.matrix, cur.x, cur.y + 1)) { cur.y++; lockAcc = 0; }
      else {
        lockAcc += interval;
        if (lockAcc > 0.5) lockPiece();
      }
    }

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  /* ----- rendering ----- */
  function drawBlock(px, py, type, alpha, ghost) {
    const x = BOARD_X + px * CELL, y = py * CELL;
    const [c1, c2] = COLORS[type];
    ctx.save();
    if (alpha != null) ctx.globalAlpha = alpha;
    if (!ghost) {
      A.neonOn(ctx, c1, 8);
      const g = ctx.createLinearGradient(x, y, x, y + CELL);
      g.addColorStop(0, c2); g.addColorStop(0.5, c1); g.addColorStop(1, c1);
      ctx.fillStyle = g;
      A.rr(ctx, x + 1, y + 1, CELL - 2, CELL - 2, 5); ctx.fill();
      A.neonOff(ctx);
      // bevel highlight
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 4, y + 4, CELL - 8, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 4, y + CELL - 7, CELL - 8, 3);
    } else {
      ctx.strokeStyle = c1; ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;
      A.rr(ctx, x + 2, y + 2, CELL - 4, CELL - 4, 5); ctx.stroke();
    }
    ctx.restore();
  }

  function drawMini(matrix, type, ox, oy, cell) {
    // center the piece in its box
    let minX = 9, maxX = -1, minY = 9, maxY = -1;
    matrix.forEach((row, y) => row.forEach((v, x) => { if (v) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }));
    const w = (maxX - minX + 1) * cell, h = (maxY - minY + 1) * cell;
    const [c1, c2] = COLORS[type];
    matrix.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const px = ox + (x - minX) * cell + (52 - w) / 2;
      const py = oy + (y - minY) * cell + (52 - h) / 2;
      A.neonOn(ctx, c1, 6);
      const g = ctx.createLinearGradient(px, py, px, py + cell);
      g.addColorStop(0, c2); g.addColorStop(1, c1);
      ctx.fillStyle = g;
      A.rr(ctx, px + 1, py + 1, cell - 2, cell - 2, 4); ctx.fill();
      A.neonOff(ctx);
    }));
  }

  function panelLabel(text, x, y) {
    ctx.save();
    ctx.font = '700 11px Orbitron, sans-serif';
    ctx.textAlign = 'center'; ctx.fillStyle = '#8b93b8';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function render() {
    ctx.save();
    ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
    shake.apply(ctx);

    // board backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070b22'); bg.addColorStop(1, '#040614');
    ctx.fillStyle = bg; ctx.fillRect(BOARD_X, 0, BOARD_W, BOARD_H);
    ctx.strokeStyle = 'rgba(0,240,255,0.3)'; ctx.lineWidth = 2;
    ctx.strokeRect(BOARD_X, 0, BOARD_W, BOARD_H);

    // arena
    const flashing = clearAnim ? (Math.sin(clearAnim.t * 60) > 0) : false;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = arena[y][x];
      if (!t) continue;
      if (clearAnim && clearAnim.rows.indexOf(y) >= 0 && flashing) continue;
      drawBlock(x, y, t);
    }

    // ghost + current
    if (cur && state !== 'over') {
      const gy = ghostY();
      if (gy !== cur.y) {
        cur.matrix.forEach((row, y) => row.forEach((v, x) => { if (v) drawBlock(cur.x + x, gy + y, cur.type, null, true); }));
      }
      cur.matrix.forEach((row, y) => row.forEach((v, x) => { if (v) drawBlock(cur.x + x, cur.y + y, cur.type); }));
    }

    // side panels
    panelLabel('HOLD', 44, 20);
    ctx.strokeStyle = 'rgba(139,147,184,0.3)';
    ctx.strokeRect(8, 30, 72, 72);
    if (hold) drawMini(SHAPES[hold], hold, 8, 30, 13);
    else { ctx.save(); ctx.fillStyle = '#3a4060'; ctx.font = '11px Rajdhani'; ctx.textAlign = 'center'; ctx.fillText('empty', 44, 72); ctx.restore(); }

    panelLabel('NEXT', W - 44, 20);
    for (let i = 0; i < 3; i++) {
      const t = queue[i];
      ctx.strokeStyle = 'rgba(139,147,184,0.3)';
      ctx.strokeRect(W - 80, 30 + i * 84, 72, 72);
      if (t) drawMini(SHAPES[t], t, W - 80, 30 + i * 84, i === 0 ? 14 : 11);
    }

    particles.draw(ctx);
    floaters.draw(ctx);
    ctx.restore();

    if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 40px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  const loop = A.createLoop(update, render);

  /* ----- input ----- */
  const keyState = {};
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('tetrisModal').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowdown', 'arrowup', ' '].indexOf(k) >= 0) e.preventDefault();
    if (e.repeat) return;
    if (k === 'arrowleft') { tryMove(-1); dasDir = -1; dasAcc = 0; arrAcc = 0; }
    else if (k === 'arrowright') { tryMove(1); dasDir = 1; dasAcc = 0; arrAcc = 0; }
    else if (k === 'arrowdown') softDrop();
    else if (k === 'arrowup' || k === 'x') tryRotate(1);
    else if (k === 'z') tryRotate(-1);
    else if (k === ' ') hardDrop();
    else if (k === 'c' || k === 'shift') holdPiece();
    else if (k === 'p') togglePause();
    keyState[k] = true;
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    keyState[k] = false;
    if ((k === 'arrowleft' && dasDir === -1) || (k === 'arrowright' && dasDir === 1)) dasDir = 0;
  });
  // allow holding down-arrow for soft drop
  setInterval(() => {
    if (state === 'playing' && !document.getElementById('tetrisModal').classList.contains('hidden') && keyState['arrowdown']) softDrop();
  }, 40);

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  A.bindHold(document.getElementById('tetrisLeft'), () => { tryMove(-1); dasDir = -1; dasAcc = 0; arrAcc = 0; }, () => { if (dasDir === -1) dasDir = 0; });
  A.bindHold(document.getElementById('tetrisRight'), () => { tryMove(1); dasDir = 1; dasAcc = 0; arrAcc = 0; }, () => { if (dasDir === 1) dasDir = 0; });
  A.bindTap(document.getElementById('tetrisRotate'), () => tryRotate(1));
  A.bindHold(document.getElementById('tetrisDown'), softDrop);
  A.bindTap(document.getElementById('tetrisDrop'), hardDrop);
  A.bindTap(document.getElementById('tetrisHold'), holdPiece);

  A.registerModalGame('tetrisModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">TETRIS</div><div class="go-sub">arrows move · up/z/x rotate · space drops · c holds</div>'); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(document.getElementById('tetrisModal'));
  reset(); render();
})();
