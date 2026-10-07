/* Minesweeper — neon grid. First tap always safe, flood-fill clears,
 * flags, three difficulties, best-time records. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('mineCanvas');
const ctx = canvas.getContext('2d');
const modalEl = document.getElementById('mineModal');
const scoreEl = document.getElementById('mineScore');
const hiEl = document.getElementById('mineHi');
const bestEl = document.getElementById('mineBest');
const pauseBtn = document.getElementById('minePause');
const diffEl = document.getElementById('mineDiff');

const TS = 32, STRIP = 56;
const DIFFS = [
  { id: 'beg', n: 'Beginner', cols: 9, rows: 9, mines: 10, k: '1' },
  { id: 'int', n: 'Intermediate', cols: 16, rows: 16, mines: 40, k: '2' },
  { id: 'exp', n: 'Expert', cols: 24, rows: 20, mines: 99, k: '3' }
];
const NUMC = ['', '#4d7cff', '#39d353', '#ff3355', '#b26bff', '#ff8c1a', '#2dd4bf', '#ff2fd6', '#8b93b8'];
const DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

let diff, W, H, cols, rows, mineCount;
let mine, rev, flag, adj, placed, flagMode, flagCount, revCount;
let state, elapsed, newBest, best;
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();

const startOverlay = A.wireStartOverlay('mineModal', startGame);
const overOverlay = A.gameOverOverlay('mineModal');

const inB = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
const idx = (x, y) => y * cols + x;

function fmtT(s) {
  const m = (s / 60) | 0, sec = s - m * 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1);
}
function fmtHi(v) { return v > 0 ? fmtT((1e6 - v) / 100) : '—'; }

function reset() {
  diff = diff || DIFFS[1];
  cols = diff.cols; rows = diff.rows; mineCount = diff.mines;
  W = cols * TS; H = rows * TS + STRIP;
  A.fitCanvas(canvas, W, H);
  const n = cols * rows;
  mine = new Uint8Array(n); rev = new Uint8Array(n); flag = new Uint8Array(n); adj = new Uint8Array(n);
  placed = false; flagMode = false; flagCount = 0; revCount = 0;
  state = 'ready'; elapsed = 0; newBest = false;
  best = A.getHi('mines');
  hiEl.textContent = fmtHi(best);
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  particles.clear(); floaters.clear();
  buildDiff(); paintScore();
}
function startGame() {
  reset();
  A.bumpPlays('mines');
  state = 'playing';
  loop.start();
  A.sfx.power();
}
function newGame() { overOverlay.hide(); startOverlay.hide(); startGame(); }

function paintScore() {
  scoreEl.textContent = '🚩 ' + (mineCount - flagCount) + ' · ⏱ ' + fmtT(elapsed);
}

function placeMines(sx, sy) {
  const banned = {};
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    if (inB(sx + dx, sy + dy)) banned[idx(sx + dx, sy + dy)] = 1;
  let p = 0, guard = 0;
  while (p < mineCount && guard++ < 20000) {
    const i = (Math.random() * cols * rows) | 0;
    if (!mine[i] && !banned[i]) { mine[i] = 1; p++; }
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    let c = 0;
    for (let d = 0; d < 8; d++) {
      const nx = x + DIRS[d][0], ny = y + DIRS[d][1];
      if (inB(nx, ny) && mine[idx(nx, ny)]) c++;
    }
    adj[idx(x, y)] = c;
  }
  placed = true;
}

function reveal(x, y) {
  if (state !== 'playing' || !inB(x, y)) return;
  const i = idx(x, y);
  if (rev[i] || flag[i]) return;
  if (!placed) placeMines(x, y);
  if (mine[i]) return lose(x, y);
  // flood fill from zeros
  const stack = [[x, y]];
  let chain = 0;
  while (stack.length) {
    const c = stack.pop(), cx = c[0], cy = c[1], ci = idx(cx, cy);
    if (!inB(cx, cy) || rev[ci] || flag[ci] || mine[ci]) continue;
    rev[ci] = 1; revCount++; chain++;
    if (adj[ci] === 0)
      for (let d = 0; d < 8; d++) stack.push([cx + DIRS[d][0], cy + DIRS[d][1]]);
  }
  if (chain > 1) {
    particles.burst(x * TS + TS / 2, STRIP + y * TS + TS / 2,
      { n: Math.min(24, chain * 2), colors: ['#00f0ff', '#ffffff'], speed: 180, life: 0.4, size: 3 });
    A.sfx.pop();
  } else A.sfx.place();
  paintScore();
  if (revCount === cols * rows - mineCount) win();
}

function toggleFlag(x, y) {
  if (state !== 'playing' || !inB(x, y)) return;
  const i = idx(x, y);
  if (rev[i]) return;
  if (flag[i]) { flag[i] = 0; flagCount--; A.sfx.tick(); }
  else {
    if (flagCount >= mineCount) { A.sfx.bad(); return; }
    flag[i] = 1; flagCount++; A.sfx.place();
    floaters.add(x * TS + TS / 2, STRIP + y * TS - 6, '🚩', '#ff2fd6', 15);
  }
  paintScore();
}

function checkHi() {
  const cs = Math.round(elapsed * 100);
  if (A.setHi('mines', 1e6 - cs)) {
    newBest = true; best = 1e6 - cs;
    hiEl.textContent = fmtT(elapsed);
    bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
  }
}

function win() {
  state = 'over'; checkHi(); A.sfx.win();
  for (let k = 0; k < 5; k++)
    particles.burst(A.rand(0, W), A.rand(STRIP, H),
      { n: 30, colors: ['#a6ff00', '#00f0ff', '#ffd700', '#ffffff'], speed: 380, life: 1, size: 5 });
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title">CLEARED!</div>' +
      '<div class="go-score">' + diff.n.toUpperCase() + ' · ' + fmtT(elapsed) + '</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="mineRetry">PLAY AGAIN</button>');
    document.getElementById('mineRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}

function lose(hx, hy) {
  state = 'over'; A.sfx.lose(); shake.add(0.7);
  for (let i = 0; i < cols * rows; i++) if (mine[i]) rev[i] = 1;
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title lost">BOOM</div>' +
      '<div class="go-score">' + diff.n.toUpperCase() + ' · ' + fmtT(elapsed) + '</div>' +
      '<button class="go-btn" id="mineRetry">TRY AGAIN</button>');
    document.getElementById('mineRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 900);
}

/* ---------- toolbar ---------- */
function buildDiff() {
  diffEl.innerHTML = '';
  const mk = (label, fn, on) => {
    const b = document.createElement('button'); b.textContent = label;
    b.style.cssText = 'font:600 11px Rajdhani,sans-serif;margin:2px;padding:6px 10px;border-radius:8px;border:1px solid rgba(0,240,255,.35);background:' +
      (on ? 'rgba(0,240,255,.28)' : 'rgba(0,240,255,.07)') + ';color:#e8ecff;cursor:pointer';
    b.onclick = fn; diffEl.appendChild(b); return b;
  };
  DIFFS.forEach(d => mk('[' + d.k + '] ' + d.n, () => { diff = d; A.sfx.click(); newGame(); }, d === diff));
  const fm = mk((flagMode ? '🚩 FLAG ON' : '🚩 FLAG OFF') + ' [f]', () => { setFlagMode(!flagMode); }, flagMode);
  fm.id = 'mineFlagBtn';
}
function setFlagMode(v) {
  flagMode = v; A.sfx.tick();
  const b = document.getElementById('mineFlagBtn');
  if (b) {
    b.textContent = (flagMode ? '🚩 FLAG ON' : '🚩 FLAG OFF') + ' [f]';
    b.style.background = flagMode ? 'rgba(255,47,214,.28)' : 'rgba(0,240,255,.07)';
  }
}

/* ---------- update / render ---------- */
function update(dt) {
  if (state !== 'playing') return;
  elapsed += dt;
  particles.update(dt); floaters.update(dt); shake.update(dt);
  paintScore();
}

function tileXY(x, y) { return [x * TS, STRIP + y * TS]; }

function render() {
  ctx.save();
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
  shake.apply(ctx);
  // HUD strip
  ctx.fillStyle = 'rgba(2,4,12,.85)'; ctx.fillRect(0, 0, W, STRIP);
  ctx.font = '700 17px Orbitron, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff2fd6'; ctx.fillText('🚩 ' + (mineCount - flagCount), 12, STRIP / 2);
  ctx.textAlign = 'right'; ctx.fillStyle = '#00f0ff';
  ctx.fillText('⏱ ' + fmtT(elapsed), W - 12, STRIP / 2);
  ctx.textAlign = 'center'; ctx.fillStyle = '#8b93b8';
  ctx.font = '600 12px Rajdhani, sans-serif';
  ctx.fillText(diff.n.toUpperCase() + (flagMode ? ' · FLAG MODE' : ''), W / 2, STRIP / 2);
  // tiles
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = idx(x, y), px = x * TS, py = STRIP + y * TS;
    if (rev[i]) {
      ctx.fillStyle = (x + y) % 2 ? '#0a0d18' : '#0c1020';
      ctx.fillRect(px, py, TS, TS);
      if (mine[i]) {
        ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('💣', px + TS / 2, py + TS / 2 + 1);
      } else if (adj[i] > 0) {
        const c = NUMC[adj[i]];
        A.neonOn(ctx, c, 8);
        ctx.font = '700 19px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = c; ctx.fillText(adj[i], px + TS / 2, py + TS / 2 + 1);
        A.neonOff(ctx);
      }
    } else {
      const s = ((x * 7 + y * 13) % 5) - 2;
      ctx.fillStyle = 'rgb(' + (26 + s) + ',' + (32 + s) + ',' + (52 + s) + ')';
      ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = 'rgba(255,255,255,.09)';
      ctx.fillRect(px, py, TS, 3); ctx.fillRect(px, 3, 3, TS);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(px, py + TS - 3, TS, 3); ctx.fillRect(px + TS - 3, py, 3, TS - 3);
      if (flag[i]) {
        ctx.font = '19px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🚩', px + TS / 2, py + TS / 2 + 1);
      }
    }
  }
  ctx.strokeStyle = 'rgba(0,240,255,.25)'; ctx.lineWidth = 2;
  ctx.strokeRect(1, STRIP + 1, W - 2, H - STRIP - 2);
  particles.draw(ctx); floaters.draw(ctx);
  ctx.restore();
  if (state === 'paused') {
    ctx.save(); ctx.fillStyle = 'rgba(2,4,12,.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff'); ctx.restore();
  }
}

const loop = A.createLoop(update, render);

/* ---------- input ---------- */
function evTile(e) {
  const r = canvas.getBoundingClientRect();
  const cxp = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cyp = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return [((cxp / r.width * W / TS) | 0), (((cyp / r.height * H - STRIP) / TS) | 0)];
}
let pressT = null, pressTimer = 0, pressDone = false;
function pressStart(e) {
  const t = evTile(e);
  if (t[0] < 0 || t[1] < 0 || t[0] >= cols || t[1] >= rows) { pressT = null; return; }
  pressT = t; pressDone = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    if (pressT && !pressDone) { pressDone = true; toggleFlag(pressT[0], pressT[1]); }
  }, 450);
}
function pressEnd(e) {
  clearTimeout(pressTimer);
  if (!pressT || pressDone) { pressT = null; return; }
  const t = evTile(e);
  if (t[0] === pressT[0] && t[1] === pressT[1]) {
    if (flagMode) toggleFlag(t[0], t[1]); else reveal(t[0], t[1]);
  }
  pressT = null;
}
canvas.addEventListener('mousedown', pressStart);
canvas.addEventListener('mousemove', (e) => {
  if (pressT && !pressDone) {
    const t = evTile(e);
    if (t[0] !== pressT[0] || t[1] !== pressT[1]) { clearTimeout(pressTimer); pressT = null; }
  }
});
window.addEventListener('mouseup', pressEnd);
canvas.addEventListener('touchstart', pressStart, { passive: true });
canvas.addEventListener('touchmove', (e) => {
  if (pressT && !pressDone) {
    const t = evTile(e);
    if (t[0] !== pressT[0] || t[1] !== pressT[1]) { clearTimeout(pressTimer); pressT = null; }
    else e.preventDefault();
  }
}, { passive: false });
canvas.addEventListener('touchend', pressEnd);

document.addEventListener('keydown', (e) => {
  if (modalEl.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (k === 'f') setFlagMode(!flagMode);
  else if (k === 'n') newGame();
  else if (k === 'p') togglePause();
  else { const d = DIFFS.find(d => d.k === k); if (d) { diff = d; A.sfx.click(); newGame(); } }
});
function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
}
pauseBtn.addEventListener('click', togglePause);

A.registerModalGame('mineModal', {
  onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">MINESWEEPER</div><div class="go-sub">clear the grid · first tap is safe · click to start</div>'); loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(modalEl);
reset(); render();

window.__mines = {
  start: startGame, newGame, reveal, toggleFlag, setFlagMode,
  setDiff(id) { diff = DIFFS.find(d => d.id === id) || diff; },
  get state() { return state; }, get elapsed() { return elapsed; },
  get flags() { return flagCount; }, get mines() { return mineCount; },
  get placed() { return placed; }, get revealed() { return revCount; },
  get cols() { return cols; }, get rows() { return rows; },
  isMine(x, y) { return !!mine[idx(x, y)]; },
  isRev(x, y) { return !!rev[idx(x, y)]; },
  isFlag(x, y) { return !!flag[idx(x, y)]; },
  adjAt(x, y) { return adj[idx(x, y)]; }
};
})();
