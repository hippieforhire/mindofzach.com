/* ============================================================
 * bubble.js — "Bubble Pop": Puzzle Bobble (1994) clone.
 *
 * Hex-grid bubble shooter: aim the cannon, match 3+ connected
 * bubbles to pop them, drop orphaned clusters for bonus, and beat
 * the descending ceiling. No assets: all art is canvas vector neon.
 * ============================================================ */
(function () {
  'use strict';
  const A = window.Arcade;

  const canvas = document.getElementById('bubbleCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('bubbleScore');
  const hiEl = document.getElementById('bubbleHi');
  const bestEl = document.getElementById('bubbleBest');
  const pauseBtn = document.getElementById('bubblePause');
  const modalEl = document.getElementById('bubbleModal');

  const W = 480, H = 640;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  const COLS = 8, R = 28;
  const ROW_H = R * 1.7320508;
  const TOP_Y = 72;
  const CANNON_X = W / 2, CANNON_Y = H - 88;
  const LINE_Y = CANNON_Y - 72;
  const SHOT_SPEED = 780;
  const MAX_AIM = 1.32; // ~75 degrees each way
  const ROT_SPEED = 1.8;

  const PALETTE = ['#ff2fd6', '#00f0ff', '#a6ff00', '#ffd700', '#ff6b6b', '#b388ff'];

  let grid, level, score, best, newBest, state;
  let aim, keys, current, next, flying, falling;
  let dropCount, dropEvery, clearT, ncolors;

  const startOverlay = A.wireStartOverlay('bubbleModal', startGame);
  const overOverlay = A.gameOverOverlay('bubbleModal');

  function cellXY(r, c) {
    return { x: R + 2 * R * c + (r % 2 ? R : 0), y: TOP_Y + r * ROW_H };
  }

  // odd-r offset hex neighborhood
  function neighbors(r, c) {
    if (r % 2 === 0) return [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c + 1], [r + 1, c - 1], [r + 1, c]];
    return [[r - 1, c], [r - 1, c + 1], [r, c - 1], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
  }

  function floodSame(r, c) {
    const color = grid[r][c];
    if (color == null) return [];
    const seen = new Set([r * 64 + c]);
    const out = [[r, c]];
    const q = [[r, c]];
    while (q.length) {
      const cell = q.pop();
      const cr = cell[0], cc = cell[1];
      const ns = neighbors(cr, cc);
      for (let i = 0; i < ns.length; i++) {
        const nr = ns[i][0], nc = ns[i][1];
        const key = nr * 64 + nc;
        if (nr < 0 || nr >= grid.length || nc < 0 || nc >= COLS) continue;
        if (grid[nr][nc] !== color || seen.has(key)) continue;
        seen.add(key); q.push([nr, nc]); out.push([nr, nc]);
      }
    }
    return out;
  }

  function reset() {
    grid = []; falling = []; flying = null;
    score = 0; level = 0; newBest = false;
    aim = 0; keys = { left: false, right: false };
    dropCount = 0; dropEvery = 5; clearT = 0; ncolors = 4;
    best = A.getHi('bubble');
    hiEl.textContent = best;
    bestEl.textContent = ''; bestEl.classList.add('hidden');
    scoreEl.textContent = '0';
    state = 'ready';
    particles.clear(); floaters.clear(); shake.trauma = 0;
  }

  function startGame() {
    reset();
    A.bumpPlays('bubble');
    setupLevel(1);
    state = 'playing';
    loop.start();
  }

  function paintScore() {
    scoreEl.textContent = String(score);
    if (A.setHi('bubble', score)) {
      newBest = true;
      hiEl.textContent = score;
      bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
    }
  }

  function presentColors() {
    const s = new Set();
    for (const row of grid) for (const v of row) if (v != null) s.add(v);
    return Array.from(s);
  }

  function pickColor() {
    const p = presentColors();
    if (!p.length) return (Math.random() * ncolors) | 0;
    return p[(Math.random() * p.length) | 0];
  }

  function setupLevel(n) {
    level = n;
    ncolors = Math.min(PALETTE.length, 3 + n);
    const rows = Math.min(7, 3 + n);
    dropEvery = Math.max(3, 6 - n);
    dropCount = 0; flying = null; falling = []; aim = 0;
    grid = [];
    for (let r = 0; r < rows; r++) {
      grid.push(new Array(COLS).fill(null));
      for (let c = 0; c < COLS; c++) {
        let color = (Math.random() * ncolors) | 0;
        grid[r][c] = color;
        for (let tries = 0; tries < 8 && floodSame(r, c).length >= 3; tries++) {
          color = (Math.random() * ncolors) | 0;
          grid[r][c] = color;
        }
      }
    }
    current = pickColor();
    next = pickColor();
    floaters.add(W / 2, H / 2 - 20, 'LEVEL ' + n, '#ffd700', 36);
    A.sfx.power();
  }

  function fire() {
    if (state !== 'playing' || flying) return;
    const mx = CANNON_X + Math.sin(aim) * 44;
    const my = CANNON_Y - Math.cos(aim) * 44;
    flying = {
      x: mx, y: my,
      vx: Math.sin(aim) * SHOT_SPEED, vy: -Math.cos(aim) * SHOT_SPEED,
      color: current
    };
    current = next;
    next = pickColor();
    dropCount++;
    A.sfx.shoot();
  }

  function touchesGrid(x, y) {
    const rr = 2 * R - 6;
    for (let r = 0; r < grid.length; r++) {
      const cy = TOP_Y + r * ROW_H;
      if (cy > y + rr) break;
      if (cy < y - rr) continue;
      const row = grid[r];
      const off = R + (r % 2 ? R : 0);
      const c0 = Math.max(0, Math.floor((x - rr - off) / (2 * R)));
      const c1 = Math.min(COLS - 1, Math.ceil((x + rr - off) / (2 * R)));
      for (let c = c0; c <= c1; c++) {
        if (row[c] == null) continue;
        const cx = off + 2 * R * c;
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < rr * rr) return true;
      }
    }
    return false;
  }

  function stepFlying(dt) {
    const f = flying;
    const steps = 3; // substeps to avoid tunneling
    for (let s = 0; s < steps; s++) {
      f.x += f.vx * dt / steps;
      f.y += f.vy * dt / steps;
      if (f.x < R) { f.x = R; f.vx = Math.abs(f.vx); A.sfx.tick(); }
      if (f.x > W - R) { f.x = W - R; f.vx = -Math.abs(f.vx); A.sfx.tick(); }
      if (f.y <= TOP_Y) { landFlying(); return; }
      if (touchesGrid(f.x, f.y)) { landFlying(); return; }
    }
  }

  function nearestEmpty(x, y) {
    const want = Math.max(0, Math.round((y - TOP_Y) / ROW_H));
    while (grid.length <= want) grid.push(new Array(COLS).fill(null));
    let bestCell = null, bestD = Infinity;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] != null) continue;
        const p = cellXY(r, c);
        const dx = x - p.x, dy = y - p.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestCell = [r, c]; }
      }
    }
    if (!bestCell) { grid.push(new Array(COLS).fill(null)); return [grid.length - 1, 0]; }
    return bestCell;
  }

  function resolveBoard(r, c) {
    const cluster = floodSame(r, c);
    if (cluster.length < 3) return;
    const color = PALETTE[grid[r][c]];
    for (const cell of cluster) {
      const p = cellXY(cell[0], cell[1]);
      particles.burst(p.x, p.y, { n: 10, colors: [color, '#ffffff'], speed: 220, life: 0.6, size: 4 });
      grid[cell[0]][cell[1]] = null;
    }
    const pts = 10 * cluster.length * cluster.length;
    score += pts;
    const pc = cellXY(r, c);
    floaters.add(pc.x, pc.y - 10, '+' + pts, color, 18);
    if (cluster.length >= 5) floaters.add(W / 2, H / 2 - 60, 'COMBO x' + cluster.length, '#ffd700', 26);
    A.sfx.pop();

    // orphans: anything not connected to the ceiling (topmost occupied row)
    let r0 = -1;
    for (let rr = 0; rr < grid.length && r0 < 0; rr++) {
      for (let cc = 0; cc < COLS; cc++) if (grid[rr][cc] != null) { r0 = rr; break; }
    }
    const anchored = new Set();
    if (r0 >= 0) {
      for (let cc = 0; cc < COLS; cc++) {
        if (grid[r0][cc] == null || anchored.has(r0 * 64 + cc)) continue;
        const cells = floodSame(r0, cc);
        for (const cell of cells) anchored.add(cell[0] * 64 + cell[1]);
      }
    }
    let dropped = 0;
    for (let rr = 0; rr < grid.length; rr++) {
      for (let cc = 0; cc < COLS; cc++) {
        if (grid[rr][cc] != null && !anchored.has(rr * 64 + cc)) {
          const p = cellXY(rr, cc);
          falling.push({ x: p.x, y: p.y, color: grid[rr][cc], vy: -80, age: 0 });
          grid[rr][cc] = null;
          dropped++;
        }
      }
    }
    if (dropped > 0) {
      const bonus = 20 * dropped;
      score += bonus;
      floaters.add(W / 2, H / 2, 'DROP +' + bonus, '#00f0ff', 22);
      A.sfx.good();
    }
    paintScore();
  }

  function landFlying() {
    const f = flying;
    flying = null;
    const cell = nearestEmpty(f.x, f.y);
    grid[cell[0]][cell[1]] = f.color;
    const p = cellXY(cell[0], cell[1]);
    particles.burst(p.x, p.y, { n: 8, colors: [PALETTE[f.color], '#ffffff'], speed: 140, life: 0.35, size: 3 });
    A.sfx.place();
    resolveBoard(cell[0], cell[1]);
    if (gridEmpty()) { levelClear(); return; }
    if (dropCount >= dropEvery) { descend(); dropCount = 0; }
    checkLose();
  }

  function gridEmpty() {
    for (const row of grid) for (const v of row) if (v != null) return false;
    return true;
  }

  function descend() {
    grid.unshift(new Array(COLS).fill(null));
    A.sfx.bad();
    shake.add(0.18);
    floaters.add(W / 2, LINE_Y - 40, 'CEILING DROPS', '#ff6b6b', 20);
  }

  function checkLose() {
    for (let r = 0; r < grid.length; r++) {
      if (TOP_Y + r * ROW_H < LINE_Y - R) continue;
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c] != null) { endGame(); return; }
      }
    }
  }

  function levelClear() {
    const bonus = level * 250;
    score += bonus;
    paintScore();
    state = 'clear';
    clearT = 2.2;
    floaters.add(W / 2, H / 2, 'LEVEL CLEAR  +' + bonus, '#a6ff00', 26);
    A.sfx.win();
    particles.burst(W / 2, H / 2, { n: 60, colors: PALETTE, speed: 380, life: 1, size: 5 });
  }

  function endGame() {
    state = 'over';
    A.sfx.lose();
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        '<div class="go-score">' + score + '</div>' +
        '<div class="go-sub">LEVEL ' + level + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="bubbleRetry">PLAY AGAIN</button>'
      );
      document.getElementById('bubbleRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 700);
  }

  function update(dt) {
    if (state === 'paused' || state === 'ready' || state === 'over') return;
    if (state === 'clear') {
      clearT -= dt;
      particles.update(dt); floaters.update(dt);
      if (clearT <= 0) { setupLevel(level + 1); state = 'playing'; }
      return;
    }

    if (keys.left) aim -= ROT_SPEED * dt;
    if (keys.right) aim += ROT_SPEED * dt;
    aim = A.clamp(aim, -MAX_AIM, MAX_AIM);

    if (flying) stepFlying(dt);

    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy += 1400 * dt;
      f.y += f.vy * dt;
      f.age += dt;
      if (f.y > H + 50) falling.splice(i, 1);
    }

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  /* ---------------- drawing ---------------- */

  function drawBubble(x, y, r, color) {
    A.neonOn(ctx, color, 14);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    ctx.fillStyle = 'rgba(2,3,10,0.6)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, A.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.34, r * 0.2, 0, A.TAU); ctx.fill();
  }

  function aimDots() {
    let x = CANNON_X + Math.sin(aim) * 48;
    let y = CANNON_Y - Math.cos(aim) * 48;
    let dx = Math.sin(aim), dy = -Math.cos(aim);
    const pts = [];
    for (let i = 0; i < 600 && pts.length < 18; i++) {
      x += dx * 12; y += dy * 12;
      if (x < R) { x = R; dx = Math.abs(dx); }
      else if (x > W - R) { x = W - R; dx = -Math.abs(dx); }
      if (i % 3 === 0) pts.push({ x, y });
      if (y <= TOP_Y + 4 || touchesGrid(x, y)) break;
    }
    return pts;
  }

  function lowestBubbleY() {
    let y = -Infinity;
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] != null) y = Math.max(y, TOP_Y + r * ROW_H);
    return y;
  }

  function render() {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, '#0a0a24'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    shake.apply(ctx);

    // ceiling bar
    A.neonOn(ctx, '#8a7bff', 10);
    ctx.fillStyle = '#8a7bff';
    ctx.fillRect(0, TOP_Y - R - 8, W, 6);
    A.neonOff(ctx);

    // grid bubbles
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = grid[r][c];
        if (v == null) continue;
        const p = cellXY(r, c);
        drawBubble(p.x, p.y, R - 3, PALETTE[v]);
      }
    }

    // lose line with danger pulse
    const lowY = lowestBubbleY();
    const danger = lowY < 0 ? 0 : A.clamp(1 - (LINE_Y - lowY) / (ROW_H * 2.5), 0, 1);
    ctx.save();
    const pulse = state === 'playing' && danger > 0
      ? 0.3 + 0.5 * danger * (0.5 + 0.5 * Math.sin(Date.now() / 180))
      : 0.18;
    ctx.strokeStyle = 'rgba(255,70,90,' + pulse.toFixed(3) + ')';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(8, LINE_Y); ctx.lineTo(W - 8, LINE_Y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // aim guide
    if (state === 'playing' && !flying) {
      ctx.save();
      ctx.fillStyle = 'rgba(160,240,255,0.55)';
      const dots = aimDots();
      for (const d of dots) { ctx.beginPath(); ctx.arc(d.x, d.y, 3, 0, A.TAU); ctx.fill(); }
      ctx.restore();
    }

    // cannon
    ctx.save();
    ctx.translate(CANNON_X, CANNON_Y);
    A.neonOn(ctx, '#00f0ff', 16);
    ctx.fillStyle = '#0a1a2e';
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 36, Math.PI, 0); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.rotate(aim);
    ctx.fillStyle = '#0e2f4a';
    A.rr(ctx, -10, -72, 20, 44, 6); ctx.fill();
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2;
    A.rr(ctx, -10, -72, 20, 44, 6); ctx.stroke();
    A.neonOff(ctx);
    if (!flying && state === 'playing') drawBubble(0, -44, R - 5, PALETTE[current]);
    ctx.restore();
    A.neonOff(ctx);
    ctx.restore();

    // next-bubble preview
    ctx.save();
    ctx.font = '700 12px Orbitron, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8a93b8';
    ctx.fillText('NEXT', CANNON_X - 84, CANNON_Y - 36);
    if (state === 'playing' || state === 'paused') drawBubble(CANNON_X - 84, CANNON_Y, 15, PALETTE[next]);
    ctx.restore();

    // flying bubble
    if (flying) drawBubble(flying.x, flying.y, R - 4, PALETTE[flying.color]);

    // falling orphans
    for (const f of falling) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.age / 1.2);
      drawBubble(f.x, f.y, R - 4, PALETTE[f.color]);
      ctx.restore();
    }

    particles.draw(ctx);
    floaters.draw(ctx);

    // HUD
    ctx.save();
    ctx.font = '700 14px Orbitron, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#8a93b8';
    if (level > 0) {
      ctx.textAlign = 'left';
      ctx.fillText('LEVEL ' + level, 14, 22);
      ctx.textAlign = 'right';
      ctx.fillText('DROP IN ' + Math.max(0, dropEvery - dropCount), W - 14, 22);
    }
    ctx.restore();

    ctx.restore();

    if (state === 'ready') {
      A.glowText(ctx, 'BUBBLE POP', W / 2, H / 2 - 30, '900 44px Orbitron, sans-serif', '#ff2fd6');
    } else if (state === 'clear') {
      A.glowText(ctx, 'LEVEL CLEAR', W / 2, H / 2, '900 40px Orbitron, sans-serif', '#a6ff00');
    } else if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  /* ---------------- wiring ---------------- */

  const loop = A.createLoop(update, render);

  document.addEventListener('keydown', (e) => {
    if (modalEl.classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = true;
    else if (k === 'arrowright' || k === 'd') keys.right = true;
    else if ((k === ' ' || k === 'z') && !e.repeat) fire();
    else if (k === 'p') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') keys.left = false;
    else if (k === 'arrowright' || k === 'd') keys.right = false;
  });

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  A.bindHold(document.getElementById('bubbleLeft'), () => { keys.left = true; }, () => { keys.left = false; });
  A.bindHold(document.getElementById('bubbleRight'), () => { keys.right = true; }, () => { keys.right = false; });
  A.bindTap(document.getElementById('bubbleFire'), () => { fire(); });
  canvas.addEventListener('click', () => { fire(); });

  A.registerModalGame('bubbleModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show(); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(modalEl);

  /* Test hooks (used by the node logic test; inert in production). */
  window.__bubble = {
    get state() { return state; },
    get score() { return score; },
    get level() { return level; },
    get flying() { return !!flying; },
    get aim() { return aim; },
    gridCount() {
      let n = 0;
      for (const row of grid) for (const v of row) if (v != null) n++;
      return n;
    },
    grid() { return grid.map(r => r.slice()); },
    setAim(a) { aim = A.clamp(a, -MAX_AIM, MAX_AIM); },
    fire,
    landTest(r, c, color) {
      if (state !== 'playing') return;
      while (grid.length <= r) grid.push(new Array(COLS).fill(null));
      grid[r][c] = color;
      resolveBoard(r, c);
      if (state !== 'playing') return;
      if (gridEmpty()) levelClear();
    },
    forceDescend() { descend(); checkLose(); }
  };

  reset(); render();
})();
