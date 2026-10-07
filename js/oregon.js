/* The Oregon Trail (1985) clone — neon prairie edition. Lead 5 settlers
 * 2040 miles to Oregon City: hunt, ford rivers, dodge cholera. */
(function () {
'use strict';
const A = window.Arcade;
const canvas = document.getElementById('oregCanvas');
const ctx = canvas.getContext('2d');
const modalEl = document.getElementById('oregModal');
const scoreEl = document.getElementById('oregScore');
const hiEl = document.getElementById('oregHi');
const bestEl = document.getElementById('oregBest');
const pauseBtn = document.getElementById('oregPause');
const toolsEl = document.getElementById('oregChoices');
const W = 480, H = 640, SCN = 380;
A.fitCanvas(canvas, W, H);
const particles = new A.Particles();
const floaters = new A.Floaters();
const shake = new A.Shake();
const stars = A.makeStars(70, W, SCN);

const LM = [
 {n:'Independence',m:0},{n:'Kansas River',m:102,river:{d:3}},
 {n:'Big Blue River',m:185,river:{d:3}},{n:'Fort Kearny',m:304,fort:1},
 {n:'Chimney Rock',m:554},{n:'Fort Laramie',m:640,fort:1},
 {n:'Independence Rock',m:830},{n:'South Pass',m:950},
 {n:'Green River',m:1040,river:{d:5}},{n:'Fort Bridger',m:1080,fort:1},
 {n:'Soda Springs',m:1230},{n:'Fort Hall',m:1300,fort:1},
 {n:'Snake River',m:1470,river:{d:5}},{n:'Fort Boise',m:1590,fort:1},
 {n:'Blue Mountains',m:1720},{n:'Fort Walla Walla',m:1820,fort:1},
 {n:'The Dalles',m:1930,dalles:1},{n:'Oregon City',m:2040,end:1}];
const PROFS = [{n:'Banker',c:1600,m:1},{n:'Carpenter',c:800,m:2},{n:'Farmer',c:400,m:3}];
const MI = [12,18,24], LB = [3,2,1], PN = ['Steady','Strenuous','Grueling'], RN = ['Filling','Meager','Bare'];
const MO = ['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov'], ML = [31,30,31,30,31,31,30,31,30];
const NAMES = ['You','Skye','Addy','Jed','Mary'];

let phase,cash,oxen,food,ammo,clothes,parts,mult,party,miles,day,mo,dd;
let pace,rat,lmIdx,msg,banner,bannerT,weather,state,best,newBest,wagonT,wheelA;
let evOpts,curRiver,hunt,score;

const startOverlay = A.wireStartOverlay('oregModal', startGame);
const overOverlay = A.gameOverOverlay('oregModal');

/* ---------- ui ---------- */
function mk(l, fn, dis) {
  const b = document.createElement('button'); b.textContent = l;
  b.style.cssText = 'font:600 13px Rajdhani,sans-serif;margin:3px;padding:9px 12px;border-radius:10px;border:1px solid rgba(0,240,255,.35);background:rgba(0,240,255,.07);color:#e8ecff;cursor:pointer';
  if (dis) { b.style.opacity = .4; b.disabled = true; }
  else b.onclick = () => { A.sfx.click(); fn(); };
  toolsEl.appendChild(b); return b;
}
function info(t) {
  const d = document.createElement('div');
  d.style.cssText = 'font:600 12px Rajdhani,sans-serif;color:#8b93b8;margin:2px 4px 6px;text-align:center';
  d.textContent = t; toolsEl.appendChild(d);
}
function setPhase(p) { phase = p; buildChoices(); }
function buildChoices() {
  toolsEl.innerHTML = '';
  if (phase === 'prof') {
    info('Choose your profession');
    PROFS.forEach((p, i) => mk(p.n + ' · $' + p.c + ' · x' + p.m, () => pickProf(i)));
  } else if (phase === 'store') {
    info('$' + cash + ' · 🐂' + oxen + ' · 🍞' + food + 'lb · 🔫' + ammo + ' · 👕' + clothes + ' · ⚙️' + parts);
    mk('+Ox $80', () => buy('ox')); mk('+100 Food $20', () => buy('food'));
    mk('+20 Ammo $2', () => buy('ammo')); mk('+Clothes $10', () => buy('cloth'));
    mk('+Part $10', () => buy('part')); mk('DEPART →', depart);
    if (msg) info(msg);
  } else if (phase === 'travel') {
    info('Pace: ' + PN[pace] + ' (' + MI[pace] + 'mi) · Rations: ' + RN[rat]);
    mk('Continue →', cont); mk('Pace: ' + PN[pace], () => { pace = (pace + 1) % 3; buildChoices(); });
    mk('Rations: ' + RN[rat], () => { rat = (rat + 1) % 3; buildChoices(); });
    mk('Rest 3 days', rest); mk('🦬 Hunt', goHunt);
  } else if (phase === 'event') {
    evOpts.forEach(o => mk(o[0], o[1]));
  } else if (phase === 'river') {
    info(curRiver.n + ' · depth ' + curRiver.river.d + 'ft');
    mk('Ford it', () => cross('ford'));
    mk('Caulk & float (1 part)', () => cross('caulk'), parts < 1);
    mk('Ferry $10', () => cross('ferry'), cash < 10);
  } else if (phase === 'dalles') {
    info('$' + cash);
    mk('Barlow Road $10', () => dallesGo('road'), cash < 10);
    mk('Raft the Columbia', () => dallesGo('raft'));
  } else if (phase === 'hunt') {
    info('🦬=80lb 🐇=5lb · Ammo: ' + ammo + ' · ' + Math.ceil(hunt.t) + 's — tap animals to shoot');
    mk('END HUNT', endHunt);
  }
}

/* ---------- setup ---------- */
function reset() {
  cash = 0; oxen = 0; food = 0; ammo = 0; clothes = 0; parts = 0; mult = 1;
  party = NAMES.map(n => ({ n, hp: 100, alive: true }));
  miles = 0; day = 0; mo = 0; dd = 1; pace = 0; rat = 0; lmIdx = 1;
  msg = 'The trail west awaits.'; banner = ''; bannerT = 0; weather = 0;
  state = 'ready'; newBest = false; wagonT = 0; wheelA = 0;
  evOpts = []; curRiver = null; hunt = null; score = 0;
  best = A.getHi('oreg'); hiEl.textContent = best;
  bestEl.textContent = ''; bestEl.classList.add('hidden');
  particles.clear(); floaters.clear();
  setPhase('prof'); paintScore();
}
function startGame() {
  reset();
  A.bumpPlays('oreg');
  state = 'playing';
  loop.start();
  A.sfx.power();
}
function paintScore() { scoreEl.textContent = '$' + cash + ' · ' + Math.floor(miles) + ' MI'; }
function checkHi() {
  if (A.setHi('oreg', score)) { newBest = true; hiEl.textContent = score;
    bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden'); }
}
function pickProf(i) { cash = PROFS[i].c; mult = PROFS[i].m; msg = 'You are a ' + PROFS[i].n + '. Stock up!'; setPhase('store'); }
function buy(k) {
  if (k === 'ox' && cash >= 80) { cash -= 80; oxen++; }
  else if (k === 'food' && cash >= 20) { cash -= 20; food += 100; }
  else if (k === 'ammo' && cash >= 2) { cash -= 2; ammo += 20; }
  else if (k === 'cloth' && cash >= 10) { cash -= 10; clothes++; }
  else if (k === 'part' && cash >= 10) { cash -= 10; parts++; }
  else { A.sfx.bad(); return; }
  A.sfx.place(); buildChoices();
}
function depart() {
  if (oxen < 2) { msg = 'You need at least 2 oxen!'; A.sfx.bad(); buildChoices(); return; }
  msg = 'You leave Independence.'; setPhase('travel');
}

/* ---------- trail ---------- */
function dateStr() { return MO[mo] + ' ' + dd; }
function aliveN() { return party.filter(p => p.alive).length; }
function dead() { return aliveN() === 0; }
function kill(p, cause) { p.alive = false; p.hp = 0; return p.n + ' died of ' + cause + '.'; }
function maybeDead() { if (dead()) { gameOver(); return true; } return false; }
function hurtParty(n) {
  let d = '';
  party.forEach(p => { if (!p.alive) return; p.hp = A.clamp(p.hp - n, 0, 100);
    if (p.hp <= 0) d += ' ' + kill(p, n > 0 ? 'the trail' : 'mystery'); });
  if (d) { msg = (msg || '') + d; A.sfx.lose(); }
}
function eatDay(heal) {
  day++; dd++; if (dd > ML[mo]) { dd = 1; mo = Math.min(8, mo + 1); }
  food -= LB[rat] * aliveN();
  if (food < 0) { food = 0; hurtParty(10); }
  hurtParty(heal ? -15 : pace + (rat === 2 ? 4 : rat === 1 ? 2 : 0) + (weather === 3 ? 3 : 0));
}
function advRest(n) { for (let i = 0; i < n && !dead(); i++) eatDay(true); }
function cont() { if (!advDay()) { msg = 'Day ' + day + ' on the trail.'; setPhase('travel'); } paintScore(); }
function rest() { advRest(3); if (maybeDead()) return; msg = 'You rest 3 days.'; setPhase('travel'); paintScore(); }
function advDay() {
  eatDay(false);
  if (maybeDead()) return true;
  miles += MI[pace] + A.randi(-2, 2) - (weather >= 2 ? 2 : 0);
  weather = A.randi(0, 3);
  if (checkLM()) return true;
  if (Math.random() < 0.25) { pickEvent(); return true; }
  return false;
}
function checkLM() {
  while (lmIdx < LM.length && miles >= LM[lmIdx].m) {
    const L = LM[lmIdx];
    if (L.end) { victory(); return true; }
    banner = L.n; bannerT = 4;
    if (L.dalles) { msg = 'You reach The Dalles. River or road?'; setPhase('dalles'); return true; }
    if (L.river) { curRiver = L; msg = L.n + ': the water runs ' + (L.river.d > 3 ? 'deep' : 'shallow') + '.'; setPhase('river'); return true; }
    msg = 'You reach ' + L.n + '.'; lmIdx++;
  }
  return false;
}

/* ---------- events ---------- */
function ev(m, opts) { msg = m; evOpts = opts; A.sfx.bad(); setPhase('event'); }
function pickEvent() { A.choice(EVS)(); }
const EVS = [
 () => ev('Cholera sweeps the camp!', [['Rest 3 days', () => { advRest(3); if (maybeDead()) return; msg += ' The sick recover.'; setPhase('travel'); }], ['Press on', () => { hurtParty(18); if (maybeDead()) return; msg += ' You press on, weaker.'; setPhase('travel'); }]]),
 () => ev('Dysentery hits the party.', [['Rest 2 days', () => { advRest(2); if (maybeDead()) return; msg += ' Recovery.'; setPhase('travel'); }], ['Press on', () => { hurtParty(10); if (maybeDead()) return; msg += ' You press on.'; setPhase('travel'); }]]),
 () => ev('A broken leg!', [['Rest 3 days', () => { advRest(3); if (maybeDead()) return; msg += ' It mends.'; setPhase('travel'); }], ['Press on', () => { hurtParty(12); if (maybeDead()) return; msg += ' You hobble on.'; setPhase('travel'); }]]),
 () => ev('A wagon ' + A.choice(['wheel', 'axle', 'tongue']) + ' breaks!', parts > 0 ? [['Use a spare part', () => { parts--; msg = 'Part replaced. Rolling again.'; A.sfx.good(); setPhase('travel'); }]] : [['Wait 3 days for repairs', () => { advRest(3); if (maybeDead()) return; msg = 'Repaired with green wood.'; setPhase('travel'); }]]),
 () => { const l = A.randi(10, 30); food = Math.max(0, food - l); ammo = Math.max(0, ammo - 20); ev('Thieves in the night! (-' + l + 'lb food, -20 ammo)', [['Damn them', () => setPhase('travel')]]); },
 () => ev('Lost the trail in the dust.', [['Backtrack (lose a day)', () => { eatDay(false); if (maybeDead()) return; msg = 'Back on the trail.'; setPhase('travel'); }]]),
 () => ev('Bad water at the creek.', [['Boil it (rest a day)', () => { advRest(1); if (maybeDead()) return; msg = 'Safe water.'; setPhase('travel'); }], ['Drink anyway', () => { hurtParty(8); if (maybeDead()) return; msg += ' Stomachs churn.'; setPhase('travel'); }]]),
 () => { food += 40; ev('Wild fruit by the trail! (+40lb food)', [['Gather it up', () => { A.sfx.good(); setPhase('travel'); }]]); },
 () => { food += 30; parts++; ev('An abandoned wagon! (+30lb food, +1 part)', [['Salvage it', () => { A.sfx.good(); setPhase('travel'); }]]); },
 () => { clothes = Math.max(0, clothes - 2); hurtParty(5); ev('Prairie fire! (-2 clothing)', dead() ? [] : [['Beat it out', () => setPhase('travel')]]); },
];

/* ---------- rivers & dalles ---------- */
function cross(k) {
  const d = curRiver.river.d; let ok = false;
  if (k === 'ferry') { if (cash < 10) { A.sfx.bad(); return; } cash -= 10; ok = true; }
  else if (k === 'caulk') { if (parts < 1) { A.sfx.bad(); return; } parts--; ok = Math.random() < 0.9; if (!ok) food = Math.max(0, food - 30); }
  else { ok = Math.random() < (d > 3 ? 0.4 : 0.75);
    if (!ok) { food = Math.max(0, food - 40);
      if (Math.random() < 0.2) { const a = party.filter(p => p.alive); if (a.length) msg += ' ' + kill(A.choice(a), 'drowning'); } } }
  if (ok) { lmIdx++; msg = 'You cross the ' + curRiver.n + '.'; A.sfx.good();
    particles.burst(W / 2, 200, { n: 30, colors: ['#00bfff', '#ffffff'], speed: 300, life: 0.8, size: 4 }); }
  else { msg += dead() ? '' : ' You limp on.'; A.sfx.bad(); shake.add(0.5); }
  if (maybeDead()) return;
  setPhase('travel'); paintScore();
}
function dallesGo(k) {
  if (k === 'road') { if (cash < 10) { A.sfx.bad(); return; } cash -= 10; lmIdx++; msg = 'You take the Barlow Road around the rapids.'; }
  else if (Math.random() < 0.7) { lmIdx++; msg = 'You raft the Columbia and survive!'; A.sfx.good(); }
  else { food = Math.max(0, food - 50); parts = Math.max(0, parts - 1);
    msg = 'The raft smashes apart! Supplies lost.';
    if (Math.random() < 0.25) { const a = party.filter(p => p.alive); if (a.length) msg += ' ' + kill(A.choice(a), 'drowning'); }
    A.sfx.bad(); shake.add(0.5); }
  if (maybeDead()) return;
  setPhase('travel'); paintScore();
}

/* ---------- hunting ---------- */
function goHunt() { hunt = { t: 25, an: [], sp: 0, gained: 0 }; setPhase('hunt'); A.sfx.shoot(); }
function spawnHunt() {
  const b = Math.random() < 0.3, dir = Math.random() < 0.5 ? 1 : -1;
  hunt.an.push({ x: dir > 0 ? -40 : W + 40, y: A.rand(140, 300), vx: dir * A.rand(60, 130), k: b ? 'b' : 'r' });
}
function huntShoot(x, y) {
  if (!hunt || phase !== 'hunt') return;
  if (ammo <= 0) { floaters.add(x, y, 'NO AMMO', '#ff6b6b', 14); A.sfx.bad(); return; }
  ammo--; A.sfx.shoot();
  particles.burst(x, y, { n: 6, colors: ['#ffd700', '#ffffff'], speed: 200, life: 0.3, size: 2 });
  for (let i = hunt.an.length - 1; i >= 0; i--) { const a = hunt.an[i];
    if (Math.hypot(a.x - x, a.y - y) < 36) {
      const v = a.k === 'b' ? 80 : 5; food += v; hunt.gained += v;
      floaters.add(a.x, a.y, '+' + v + ' lb', '#a6ff00', 16);
      particles.burst(a.x, a.y, { n: 16, colors: ['#ff6b6b', '#ffffff'], speed: 260, life: 0.6, size: 4 });
      A.sfx.hit(); hunt.an.splice(i, 1); return;
    } }
}
function endHunt() {
  if (!hunt) return;
  msg = 'Hunt over: +' + hunt.gained + ' lb meat.'; hunt = null;
  eatDay(false);
  if (maybeDead()) return;
  setPhase('travel'); paintScore();
}

/* ---------- scoring / endings ---------- */
function calcScore() {
  return Math.round((miles + aliveN() * 200 + food + oxen * 40 + ammo * 0.5 + parts * 10 + clothes * 10) * mult);
}
function gameOver() {
  state = 'over'; score = calcScore(); checkHi(); A.sfx.lose(); shake.add(0.6);
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title lost">THE TRAIL CLAIMS YOU</div>' +
      '<div class="go-score">' + Math.floor(miles) + ' MI · DAY ' + day + ' · SCORE ' + score + '</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="oregRetry">TRY AGAIN</button>');
    document.getElementById('oregRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}
function victory() {
  state = 'over'; score = calcScore(); checkHi(); A.sfx.win();
  particles.burst(W / 2, H / 2, { n: 80, colors: ['#ffd700', '#a6ff00', '#00f0ff', '#ffffff'], speed: 400, life: 1, size: 5 });
  setTimeout(() => {
    overOverlay.show(
      '<div class="go-title">★ OREGON CITY ★</div>' +
      '<div class="go-sub">' + aliveN() + '/5 settlers · ' + dateStr() + '</div>' +
      '<div class="go-score">SCORE ' + score + '</div>' +
      (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
      '<button class="go-btn" id="oregRetry">PLAY AGAIN</button>');
    document.getElementById('oregRetry').onclick = () => { overOverlay.hide(); startGame(); };
    loop.stop();
  }, 700);
}

/* ---------- update ---------- */
const loop = A.createLoop(update, render);
function update(dt) {
  if (state !== 'playing') return;
  if (phase === 'travel') { wagonT += dt; wheelA += dt * 6; }
  bannerT -= dt;
  if (phase === 'hunt' && hunt) {
    hunt.t -= dt; hunt.sp -= dt;
    if (hunt.sp <= 0) { hunt.sp = A.rand(0.7, 1.4); spawnHunt(); }
    for (const a of hunt.an) a.x += a.vx * dt;
    hunt.an = hunt.an.filter(a => a.x > -60 && a.x < W + 60);
    if (hunt.t <= 0) endHunt();
  }
  particles.update(dt); floaters.update(dt); shake.update(dt);
}

/* ---------- render ---------- */
function mountains(off, base, amp, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
  for (let x = -40; x <= W + 40; x += 40) {
    const px = x - (off % 80);
    const py = base - Math.abs(Math.sin((x + off) * 0.05)) * amp;
    x === -40 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.stroke();
}
function render() {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, SCN);
  g.addColorStop(0, '#060818'); g.addColorStop(1, '#101a3a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, SCN);
  shake.apply(ctx);
  A.drawStarfield(stars, ctx, W, SCN, phase === 'travel' && state === 'playing' ? 2 : 0.2);
  A.neonOn(ctx, '#8b93b8', 6);
  mountains(wagonT * 12, 250, 60, 'rgba(139,147,184,.5)');
  A.neonOn(ctx, '#00f0ff', 6);
  mountains(wagonT * 30, 290, 40, 'rgba(0,240,255,.35)');
  A.neonOff(ctx);
  // ground
  ctx.fillStyle = '#0a0f16'; ctx.fillRect(0, 300, W, 80);
  ctx.strokeStyle = 'rgba(255,179,0,.4)'; ctx.lineWidth = 3; ctx.setLineDash([16, 14]);
  ctx.beginPath(); ctx.moveTo(0, 340); ctx.lineTo(W, 340); ctx.stroke(); ctx.setLineDash([]);
  if (phase === 'hunt') {
    ctx.fillStyle = '#0c1410'; ctx.fillRect(0, 100, W, 240);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const a of hunt ? hunt.an : []) {
      ctx.font = (a.k === 'b' ? 34 : 24) + 'px serif';
      ctx.fillText(a.k === 'b' ? '🦬' : '🐇', a.x, a.y);
    }
    ctx.fillStyle = 'rgba(255,107,107,.9)'; ctx.fillRect(20, 112, (W - 40) * Math.max(0, hunt ? hunt.t / 25 : 0), 6);
  } else {
    // oxen + wagon
    const bob = phase === 'travel' && state === 'playing' ? Math.sin(wagonT * 8) * 3 : 0;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '34px serif';
    ctx.fillText('🐂', W / 2 - 96, 318 + bob); ctx.fillText('🐂', W / 2 - 58, 318 - bob);
    A.neonOn(ctx, '#ffb300', 10); ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2 - 46, 322); ctx.lineTo(W / 2 - 6, 322); ctx.stroke(); A.neonOff(ctx);
    ctx.fillStyle = '#2a1f14'; A.rr(ctx, W / 2 - 10, 286 + bob, 100, 40, 6); ctx.fill();
    A.neonOn(ctx, '#e8ecff', 8); ctx.strokeStyle = '#e8ecff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W / 2 + 40, 288 + bob, 26, Math.PI, 0); ctx.stroke(); A.neonOff(ctx);
    ctx.strokeStyle = '#8b93b8'; ctx.lineWidth = 4;
    [[18, 332], [72, 332]].forEach(wp => {
      ctx.beginPath(); ctx.arc(W / 2 - 10 + wp[0], wp[1] + bob, 13, 0, A.TAU); ctx.stroke();
      ctx.beginPath();
      for (let s = 0; s < 4; s++) { const a = wheelA + s * Math.PI / 2;
        ctx.moveTo(W / 2 - 10 + wp[0], wp[1] + bob);
        ctx.lineTo(W / 2 - 10 + wp[0] + Math.cos(a) * 13, wp[1] + bob + Math.sin(a) * 13); }
      ctx.stroke();
    });
  }
  // weather
  if (weather >= 2 && state === 'playing') {
    ctx.fillStyle = 'rgba(0,80,160,.12)'; ctx.fillRect(0, 0, W, SCN);
    ctx.strokeStyle = 'rgba(174,226,255,.5)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i < 40; i++) { const x = (i * 47 + wagonT * 300) % W, y = (i * 89 + wagonT * 900) % SCN;
      ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); }
    ctx.stroke();
  }
  if (bannerT > 0) A.glowText(ctx, banner, W / 2, 66, '900 26px Orbitron, sans-serif', '#ffd700');
  // message
  const words = String(msg || '').split(' '); const lines = []; let ln = '';
  for (const w of words) { if ((ln + ' ' + w).length > 44) { lines.push(ln); ln = w; } else ln = ln ? ln + ' ' + w : w; }
  lines.push(ln);
  ctx.font = '600 13px Rajdhani, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8ecff';
  lines.slice(-2).forEach((l, i) => ctx.fillText(l, W / 2, SCN - 44 + i * 17));
  particles.draw(ctx); floaters.draw(ctx);
  // status panel
  ctx.fillStyle = '#04050c'; ctx.fillRect(0, SCN, W, H - SCN);
  ctx.strokeStyle = 'rgba(0,240,255,.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, SCN); ctx.lineTo(W, SCN); ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = '700 15px Orbitron, sans-serif'; ctx.fillStyle = '#00f0ff';
  ctx.fillText(dateStr() + ' · DAY ' + day, 14, SCN + 22);
  ctx.fillStyle = '#ffd700'; ctx.fillText(Math.floor(miles) + ' / 2040 MI', 250, SCN + 22);
  ctx.font = '600 13px Rajdhani, sans-serif'; ctx.fillStyle = '#e8ecff';
  ctx.fillText('🍞' + Math.floor(food) + 'lb  $' + cash + '  🐂' + oxen + '  🔫' + ammo + '  ⚙️' + parts + '  👕' + clothes, 14, SCN + 48);
  party.forEach((p, i) => {
    const y = SCN + 78 + i * 30;
    ctx.fillStyle = p.alive ? '#e8ecff' : '#4a4f66';
    ctx.font = '600 13px Rajdhani, sans-serif';
    ctx.fillText(p.n + (p.alive ? '' : ' ✝'), 14, y);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(90, y - 6, 150, 12);
    ctx.fillStyle = !p.alive ? '#333' : p.hp > 50 ? '#a6ff00' : p.hp > 25 ? '#ffb300' : '#ff3355';
    ctx.fillRect(90, y - 6, 150 * p.hp / 100, 12);
  });
  ctx.fillStyle = '#8b93b8'; ctx.font = '600 12px Rajdhani, sans-serif';
  ctx.fillText('Pace: ' + PN[pace] + ' · Rations: ' + RN[rat], 280, SCN + 78);
  const nx = LM[lmIdx] ? LM[lmIdx].n : '—';
  ctx.fillText('Next: ' + nx, 280, SCN + 108);
  ctx.restore();
  if (state === 'paused') {
    ctx.save(); ctx.fillStyle = 'rgba(2,4,12,.6)'; ctx.fillRect(0, 0, W, H);
    A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff'); ctx.restore();
  }
}

/* ---------- input ---------- */
function evXY(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
}
canvas.addEventListener('mousedown', e => { const p = evXY(e); huntShoot(p[0], p[1]); });
canvas.addEventListener('touchstart', e => {
  const t = e.touches[0], r = canvas.getBoundingClientRect();
  huntShoot((t.clientX - r.left) / r.width * W, (t.clientY - r.top) / r.height * H);
}, { passive: true });

document.addEventListener('keydown', e => {
  if (modalEl.classList.contains('hidden')) return;
  if (e.key.toLowerCase() === 'p') togglePause();
});
function togglePause() {
  if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
  else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
}
pauseBtn.addEventListener('click', togglePause);

A.registerModalGame('oregModal', {
  onOpen() { reset(); overOverlay.hide(); startOverlay.show('<div class="go-title">THE OREGON TRAIL</div><div class="go-sub">2040 miles · 5 settlers · click to start</div>'); loop.stop(); state = 'ready'; render(); },
  onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
});
A.trapGameKeys(modalEl);
reset(); render();

window.__oreg = {
  start: startGame, prof: pickProf, buy, depart, cont, rest,
  pace: () => { pace = (pace + 1) % 3; }, rat: () => { rat = (rat + 1) % 3; },
  goHunt, endHunt, shoot: huntShoot, cross, dallesGo,
  ev: i => evOpts[i][1](), forceEvent: pickEvent, hurt: n => { hurtParty(n); maybeDead(); },
  setMiles: m => { miles = m; }, setPhase,
  get phase() { return phase; }, get cash() { return cash; }, get miles() { return miles; },
  get food() { return food; }, get ammo() { return ammo; }, get oxen() { return oxen; },
  get parts() { return parts; }, get alive() { return aliveN(); }, get lm() { return lmIdx; },
  get state() { return state; }, get score() { return calcScore(); }, get day() { return day; },
  get huntT() { return hunt ? hunt.t : -1; },
  get huntN() { return hunt ? hunt.an.length : 0; },
  huntPos: i => hunt && hunt.an[i] ? [hunt.an[i].x, hunt.an[i].y] : null
};
})();
