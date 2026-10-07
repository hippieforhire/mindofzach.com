/* Klondike Solitaire — neon edition. Tap-tap controls, full rules,
 * auto-complete, scoring, timer. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('soliCanvas');
const ctx = canvas.getContext('2d');
const modalEl = document.getElementById('soliModal');
const scoreEl = document.getElementById('soliScore');
const hiEl = document.getElementById('soliHi');
const bestEl = document.getElementById('soliBest');
const pauseBtn = document.getElementById('soliPause');
const toolsEl = document.getElementById('soliTools');

const W = 480, H = 700;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();

const CW = 59, CH = 83, GAP = 8, TOP = 16, TABY = 132;
const DNOFF = 10, UPOFF = 26;
const colX = i => GAP + i * (CW + GAP);
const stockX = GAP, wasteX = GAP + CW + GAP;
const foundX = f => W - GAP - (4 * CW + 3 * GAP) + f * (CW + GAP);
const SUITS = ['\u2660', '\u2665', '\u2666', '\u2663'];
const RANK = r => r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r);

let stock, waste, found, tab;
let score, state, elapsed, drawN, best, newBest;
let sel, lastTap, auto, autoT, drawBtn, autoBtn;

const startOverlay = A.wireStartOverlay('soliModal', startGame);
const overOverlay = A.gameOverOverlay('soliModal');

const red = c => c.s === 1 || c.s === 2;
const top = p => p[p.length - 1];
const mkCard = (s, r, up) => ({ s, r, up: !!up });

function reset() {
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push(mkCard(s, r, false));
  for (let i = deck.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
  tab = [[], [], [], [], [], [], []];
  for (let r = 0; r < 7; r++) for (let c = r; c < 7; c++) { const k = deck.pop(); k.up = (r === c); tab[c].push(k); }
  stock = deck; waste = []; found = [[], [], [], []];
  score = 0; elapsed = 0; state = 'ready';
  sel = null; lastTap = { id: -1, t: 0 }; auto = false; autoT = 0; newBest = false;
  best = A.getHi('soli'); hiEl.textContent = best;
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  particles.clear(); floaters.clear();
  if (autoBtn) autoBtn.style.display = 'none';
  paintScore();
}
function startGame() {
  reset();
  A.bumpPlays('soli');
  state = 'playing';
  loop.start();
  A.sfx.power();
}
function paintScore() {
  const m = (elapsed / 60) | 0, s = (elapsed | 0) % 60;
  scoreEl.textContent = score + ' PTS \u00B7 ' + m + ':' + (s < 10 ? '0' : '') + s;
}
function addScore(n, x, y) {
  score = Math.max(0, score + n);
  if (n !== 0) floaters.add(x, y, (n > 0 ? '+' : '') + n, n > 0 ? '#a6ff00' : '#ff6b6b', 15);
  paintScore();
}
function checkHi() {
  if (A.setHi('soli', score)) { newBest = true; hiEl.textContent = score;
    bestEl.textContent = '\u2605 NEW BEST \u2605'; bestEl.classList.remove('hidden'); }
}

/* ---------- rules ---------- */
function canTab(c, col) {
  const t = tab[col];
  if (!t.length) return c.r === 13;
  const u = top(t);
  return u.up && red(u) !== red(c) && u.r === c.r + 1;
}
function canFound(c) {
  const f = found[c.s];
  if (!f.length) return c.r === 1;
  return top(f).r === c.r - 1;
}
function cardY(col, idx) {
  let y = TABY; const t = tab[col];
  for (let i = 0; i < idx; i++) y += t[i].up ? UPOFF : DNOFF;
  return y;
}
function flipTop(col) {
  const t = tab[col], u = top(t);
  if (u && !u.up) { u.up = true; addScore(5, colX(col) + CW / 2, cardY(col, t.length - 1)); A.sfx.tick(); }
}
function afterMove() {
  if (found.every(f => f.length === 13)) endGame(true);
}
function draw() {
  if (!stock.length) {
    while (waste.length) { const c = waste.pop(); c.up = false; stock.push(c); }
    A.sfx.tick();
  } else {
    for (let i = 0; i < drawN && stock.length; i++) { const c = stock.pop(); c.up = true; waste.push(c); }
    A.sfx.place();
  }
  sel = null; paintScore();
}
function doFoundMove(c) {
  const fx = foundX(c.s) + CW / 2;
  if (sel.zone === 'waste') { waste.pop(); addScore(10, fx, TOP + CH / 2); }
  else if (sel.zone === 'tab') { tab[sel.col].pop(); addScore(10, fx, TOP + CH / 2); flipTop(sel.col); }
  else return;
  found[c.s].push(c);
  particles.burst(fx, TOP + CH / 2, { n: 14, colors: ['#a6ff00', '#ffffff'], speed: 180, life: 0.5, size: 3 });
  A.sfx.good();
  sel = null; afterMove(); paintScore();
}
function bad() { sel = null; A.sfx.bad(); }
function selCards() {
  if (!sel) return [];
  if (sel.zone === 'waste') return waste.length ? [top(waste)] : [];
  if (sel.zone === 'found') return found[sel.col].length ? [top(found[sel.col])] : [];
  return tab[sel.col].slice(sel.idx);
}
function tryDest(h) {
  if (!h) { sel = null; return true; }
  const cards = selCards();
  if (!cards.length || !cards[0]) { sel = null; return true; }
  const c0 = cards[0];
  if (h.zone === 'found') {
    if (cards.length > 1 || sel.zone === 'found' || !canFound(c0)) { bad(); return true; }
    doFoundMove(c0); return true;
  }
  if (h.zone === 'tab') {
    if (sel.zone === 'tab' && sel.col === h.col) { sel = null; return true; }
    if (!canTab(c0, h.col)) { bad(); return true; }
    const dx = colX(h.col) + CW / 2;
    if (sel.zone === 'waste') { waste.pop(); addScore(5, dx, TABY); }
    else if (sel.zone === 'found') { found[sel.col].pop(); addScore(-15, dx, TABY); }
    else { tab[sel.col].length = sel.idx; flipTop(sel.col); }
    tab[h.col].push(...cards);
    particles.burst(dx, TABY + 20, { n: 8, colors: ['#00f0ff', '#ffffff'], speed: 140, life: 0.4, size: 3 });
    A.sfx.place();
    sel = null; afterMove(); paintScore(); return true;
  }
  return false;
}
function autoFound(h) {
  const c = hitCard(h);
  if (!c || !c.up || h.zone === 'found' || !canFound(c)) { A.sfx.bad(); return; }
  if (h.zone === 'tab' && tab[h.col].length - 1 !== h.idx) { A.sfx.bad(); return; }
  sel = { zone: h.zone, col: h.col, idx: h.zone === 'tab' ? h.idx : 0 };
  doFoundMove(c);
}
function hitCard(h) {
  if (h.zone === 'waste') return top(waste);
  if (h.zone === 'found') return top(found[h.col]);
  return tab[h.col][h.idx];
}
function hitTab(x, y) {
  for (let c = 0; c < 7; c++) {
    const x0 = colX(c);
    if (x < x0 || x > x0 + CW) continue;
    const t = tab[c];
    if (!t.length) { if (y >= TABY && y <= TABY + CH) return { zone: 'tab', col: c, idx: -1 }; continue; }
    for (let i = t.length - 1; i >= 0; i--) {
      const y0 = cardY(c, i);
      if (y >= y0 && y <= y0 + CH) return { zone: 'tab', col: c, idx: i };
    }
    if (y > cardY(c, t.length - 1) + CH) return { zone: 'tab', col: c, idx: -1 };
  }
  return null;
}
function tap(x, y) {
  if (state !== 'playing') return;
  if (x >= stockX && x <= stockX + CW && y >= TOP && y <= TOP + CH) { auto = false; draw(); return; }
  let h = null;
  if (waste.length && x >= wasteX && x <= wasteX + CW && y >= TOP && y <= TOP + CH) h = { zone: 'waste', col: 0, idx: 0 };
  if (!h) for (let f = 0; f < 4; f++) {
    const x0 = foundX(f);
    if (x >= x0 && x <= x0 + CW && y >= TOP && y <= TOP + CH) { h = { zone: 'found', col: f, idx: 0 }; break; }
  }
  if (!h) h = hitTab(x, y);
  if (h && h.idx !== -1) {
    const c = hitCard(h), now = performance.now();
    if (c && c.up && lastTap.id === c.s * 13 + c.r && now - lastTap.t < 350) {
      lastTap = { id: -1, t: 0 }; autoFound(h); return;
    }
    lastTap = (c && c.up) ? { id: c.s * 13 + c.r, t: now } : { id: -1, t: 0 };
  }
  if (sel) {
    if (h && h.zone === sel.zone && h.col === sel.col) { sel = null; A.sfx.click(); return; }
    if (tryDest(h)) return;
  }
  sel = null;
  if (h && h.idx !== -1) {
    const c = hitCard(h);
    if (c && c.up) { sel = { zone: h.zone, col: h.col, idx: h.zone === 'tab' ? h.idx : 0 }; A.sfx.click(); }
  }
  render();
}

/* ---------- auto-complete ---------- */
function canAuto() {
  return state === 'playing' && !auto && !stock.length && !waste.length &&
    tab.every(t => t.every(c => c.up));
}
function autoStep() {
  for (let c = 0; c < 7; c++) {
    const t = tab[c], u = top(t);
    if (u && canFound(u)) {
      t.pop(); found[u.s].push(u);
      addScore(10, foundX(u.s) + CW / 2, TOP + CH / 2);
      particles.burst(foundX(u.s) + CW / 2, TOP + CH / 2,
        { n: 8, colors: ['#a6ff00', '#ffffff'], speed: 150, life: 0.4, size: 3 });
      A.sfx.tick();
      afterMove(); paintScore();
      return;
    }
  }
  auto = false;
}

/* ---------- win ---------- */
function endGame(won) {
  state = 'won'; auto = false;
  const bonus = Math.max(0, 1200 - (elapsed | 0)) * 2;
  score += bonus;
  checkHi(); paintScore();
  A.sfx.win();
  for (let i = 0; i < 5; i++)
    particles.burst(A.rand(60, W - 60), A.rand(80, H - 200),
      { n: 40, colors: ['#ffd700', '#a6ff00', '#00f0ff', '#ff2fd6', '#ffffff'], speed: 380, life: 1.2, size: 5 });
  setTimeout(() => {
    const m = (elapsed / 60) | 0, s = (elapsed | 0) % 60;
    overOverlay.show(
      '<div class="go-title">YOU WIN!</div>' +
      '<div class="go-score">' + score + ' PTS \u00B7 ' + m + ':' + (s < 10 ? '0' : '') + s + '</div>' +
      '<div class="go-sub">time bonus +' + bonus + '</div>' +
      (newBest ? '<div class="go-best">\u2605 NEW BEST \u2605</div>' : '') +
      '<button class="go-btn" id="soliRetry">DEAL AGAIN</button>');
    document.getElementById('soliRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 900);
}

/* ---------- toolbar ---------- */
function buildTools() {
  toolsEl.innerHTML = '';
  const mk = (label, fn) => {
    const b = document.createElement('button'); b.textContent = label;
    b.style.cssText = 'font:600 12px Rajdhani,sans-serif;margin:2px;padding:8px 12px;border-radius:8px;border:1px solid rgba(0,240,255,.35);background:rgba(0,240,255,.07);color:#e8ecff;cursor:pointer';
    b.onclick = fn; toolsEl.appendChild(b); return b;
  };
  mk('NEW GAME', () => startGame());
  drawN = drawN || 1;
  drawBtn = mk('DRAW ' + drawN, () => { drawN = drawN === 1 ? 3 : 1; drawBtn.textContent = 'DRAW ' + drawN; A.sfx.click(); });
  autoBtn = mk('AUTO-FINISH', () => { if (canAuto()) { auto = true; autoT = 0; A.sfx.power(); } });
  autoBtn.style.display = 'none';
}

/* ---------- update / render ---------- */
function update(dt) {
  if (state === 'playing') {
    elapsed += dt;
    if (auto) { autoT -= dt; if (autoT <= 0) { autoT = 0.07; autoStep(); } }
    if (autoBtn) autoBtn.style.display = canAuto() ? '' : 'none';
    if (((elapsed * 2) | 0) !== (((elapsed - dt) * 2) | 0)) paintScore();
  }
  particles.update(dt); floaters.update(dt);
}
function slot(x, y, ghost) {
  A.rr(ctx, x, y, CW, CH, 8);
  ctx.strokeStyle = 'rgba(0,240,255,.22)'; ctx.lineWidth = 2; ctx.stroke();
  if (ghost) {
    ctx.fillStyle = 'rgba(0,240,255,.14)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '26px serif'; ctx.fillText(ghost, x + CW / 2, y + CH / 2);
  }
}
function drawCard(x, y, c, selected) {
  A.rr(ctx, x, y, CW, CH, 8);
  if (c.up) {
    ctx.fillStyle = '#edf0ff'; ctx.fill();
    ctx.strokeStyle = 'rgba(10,14,30,.4)'; ctx.lineWidth = 1; ctx.stroke();
    const col = red(c) ? '#e0265a' : '#171b30';
    ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = '700 15px Rajdhani, sans-serif';
    ctx.fillText(RANK(c.r), x + 5, y + 4);
    ctx.font = '13px serif'; ctx.fillText(SUITS[c.s], x + 5, y + 22);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '30px serif'; ctx.fillText(SUITS[c.s], x + CW / 2, y + CH / 2 + 8);
  } else {
    ctx.fillStyle = '#12162e'; ctx.fill();
    A.neonOn(ctx, '#00f0ff', 10); ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2; ctx.stroke(); A.neonOff(ctx);
    ctx.save();
    A.rr(ctx, x + 4, y + 4, CW - 8, CH - 8, 5); ctx.clip();
    ctx.strokeStyle = 'rgba(0,240,255,.22)'; ctx.lineWidth = 1;
    for (let d = -CH; d < CW; d += 9) { ctx.beginPath(); ctx.moveTo(x + d, y + CH); ctx.lineTo(x + d + CH, y); ctx.stroke(); }
    ctx.restore();
  }
  if (selected) {
    A.neonOn(ctx, '#ffd700', 16);
    A.rr(ctx, x - 2, y - 2, CW + 4, CH + 4, 10);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke();
    A.neonOff(ctx);
  }
}
function isSel(zone, col, idx) {
  if (!sel || sel.zone !== zone || sel.col !== col) return false;
  if (zone !== 'tab') return true;
  return idx >= sel.idx;
}
function render() {
  ctx.save();
  const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, '#0a0a22'); g.addColorStop(1, '#02030a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stock
  if (stock.length) { drawCard(stockX, TOP, mkCard(0, 1, false), false);
    ctx.fillStyle = '#8b93b8'; ctx.textAlign = 'center'; ctx.font = '700 12px Rajdhani, sans-serif';
    ctx.fillText(stock.length, stockX + CW / 2, TOP + CH + 12);
  } else {
    slot(stockX, TOP, waste.length ? '\u21BB' : '');
  }
  // waste
  if (waste.length) drawCard(wasteX, TOP, top(waste), isSel('waste', 0, 0));
  else slot(wasteX, TOP, '');
  // foundations
  for (let f = 0; f < 4; f++) {
    const x0 = foundX(f), p = found[f];
    if (p.length) drawCard(x0, TOP, top(p), isSel('found', f, 0));
    else slot(x0, TOP, SUITS[f]);
  }
  // tableau
  for (let c = 0; c < 7; c++) {
    slot(colX(c), TABY, '');
    const t = tab[c];
    for (let i = 0; i < t.length; i++) drawCard(colX(c), cardY(c, i), t[i], isSel('tab', c, i));
  }
  particles.draw(ctx);
  floaters.draw(ctx);
  if (auto) A.glowText(ctx, 'AUTO-FINISHING\u2026', W / 2, H - 24, '700 16px Orbitron, sans-serif', '#a6ff00');
  ctx.restore();
  if (state === 'paused') {
    ctx.save(); ctx.fillStyle = 'rgba(2,4,12,.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff'); ctx.restore();
  }
}

const loop = A.createLoop(update, render);

function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '\u25B6'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '\u23F8'; }
}
pauseBtn.addEventListener('click', togglePause);

document.addEventListener('keydown', e => {
  if (modalEl.classList.contains('hidden')) return;
  const k = e.key.toLowerCase();
  if (k === 'n') startGame();
  else if (k === ' ') { if (state === 'playing') { auto = false; draw(); } }
  else if (k === 'a') { if (canAuto()) { auto = true; autoT = 0; A.sfx.power(); } }
  else if (k === 'p') togglePause();
});

function evXY(e) {
  const r = canvas.getBoundingClientRect();
  const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const py = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return [px / r.width * W, py / r.height * H];
}
canvas.addEventListener('mousedown', e => { const p = evXY(e); tap(p[0], p[1]); });
canvas.addEventListener('touchstart', e => { const p = evXY(e); tap(p[0], p[1]); }, { passive: true });

A.registerModalGame('soliModal', {
  onOpen() { reset(); overOverlay.hide();
    startOverlay.show('<div class="go-title">SOLITAIRE</div><div class="go-sub">tap to select, tap to place \u00B7 double-tap sends a card home</div>');
    loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(modalEl);
buildTools();
reset(); render();

window.__soli = {
  start: startGame, newGame: startGame, draw, tap, canTab, canFound, canAuto,
  afterMove, mkCard,
  setDraw(n) { drawN = n; if (drawBtn) drawBtn.textContent = 'DRAW ' + drawN; },
  get state() { return state; }, get score() { return score; },
  get stockN() { return stock.length; }, get wasteN() { return waste.length; },
  get tabN() { return tab.map(t => t.length); },
  get foundN() { return found.map(f => f.length); },
  get piles() { return { stock, waste, found, tab }; },
  get selInfo() { return sel; }
};
})();
