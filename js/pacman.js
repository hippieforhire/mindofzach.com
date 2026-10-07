/* Pac-Man (1980) clone — neon arcade edition.
 * Original 19x21 maze, buffered grid movement, four distinct ghost AIs
 * (Blinky chases, Pinky ambushes, Inky flanks, Clyde hangs back),
 * scatter/chase wave timer, frightened mode with eat chains, fruit
 * bonuses, 3 lives, per-level speed ramp. */
(function () {
  'use strict';
  const A = Arcade;
  const canvas = document.getElementById('pacmanCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('pacmanScore');
  const hiEl = document.getElementById('pacmanHi');
  const bestEl = document.getElementById('pacmanBest');
  const pauseBtn = document.getElementById('pacmanPause');

  const TILE = 24, COLS = 19, ROWS = 21;
  const W = COLS * TILE, H = ROWS * TILE; // 456 x 504
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  // Maze legend: # wall · . dot · o power pellet · ' ' path · - ghost door · T tunnel
  // Row 10 is the wrap tunnel; the ghost house sits at rows 9-11, cols 7-11.
  const MAZE = [
    '###################',
    '#o......#.#......o#',
    '#.##.##.#.#.##.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.#.##.##.#.####',
    '####.#.......#.####',
    '####.#.##.##.#.####',
    '#....#.#---#.#....#',
    'T      #   #      T',
    '#....#.#####.#....#',
    '#....#.......#....#',
    '#.##.##.###.##.##.#',
    '#...#.........#...#',
    '##.#.##.#.#.##.#.##',
    '#....#.#...#.#....#',
    '#.####.#.#.#.####.#',
    '#......#...#......#',
    '#o....###.###....o#',
    '###################'
  ];
  const TUNNEL_ROW = 10;
  const DOOR = { x: 9, y: 9 };
  const PLAYER_START = { x: 9, y: 14 };
  const FRUIT_SPOT = { x: 9, y: 12 };
  const WAVE_DUR = [7, 20, 7, 20, 7, 20, 5, 1e9]; // scatter/chase alternating

  function tileAt(x, y) {
    if (y < 0 || y >= ROWS) return '#';
    if (x < 0 || x >= COLS) return y === TUNNEL_ROW ? 'T' : '#';
    return MAZE[y][x];
  }
  function canPlayer(x, y) { const t = tileAt(x, y); return t !== '#' && t !== '-'; }
  function canGhost(x, y, door) { const t = tileAt(x, y); return t !== '#' && (t !== '-' || !!door); }

  /* Pre-render the static maze (walls + ghost door) once. */
  const mazeCanvas = document.createElement('canvas');
  mazeCanvas.width = W; mazeCanvas.height = H;
  (function paintMaze() {
    const m = mazeCanvas.getContext('2d');
    m.fillStyle = '#0a0a24';
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++)
      if (MAZE[y][x] === '#') m.fillRect(x * TILE, y * TILE, TILE, TILE);
    m.strokeStyle = '#2e2eff'; m.lineWidth = 2;
    m.shadowColor = '#2e2eff'; m.shadowBlur = 10;
    m.beginPath();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (MAZE[y][x] !== '#') continue;
      const X = x * TILE, Y = y * TILE;
      if (y > 0 && MAZE[y - 1][x] !== '#') { m.moveTo(X, Y); m.lineTo(X + TILE, Y); }
      if (y < ROWS - 1 && MAZE[y + 1][x] !== '#') { m.moveTo(X, Y + TILE); m.lineTo(X + TILE, Y + TILE); }
      if (x > 0 && MAZE[y][x - 1] !== '#') { m.moveTo(X, Y); m.lineTo(X, Y + TILE); }
      if (x < COLS - 1 && MAZE[y][x + 1] !== '#') { m.moveTo(X + TILE, Y); m.lineTo(X + TILE, Y + TILE); }
    }
    m.stroke();
    m.shadowBlur = 0;
    // ghost house door
    m.strokeStyle = '#ffb8de'; m.shadowColor = '#ff2fd6'; m.shadowBlur = 8;
    m.lineWidth = 4; m.beginPath();
    m.moveTo(8 * TILE + 2, 9 * TILE + TILE / 2);
    m.lineTo(11 * TILE - 2, 9 * TILE + TILE / 2);
    m.stroke(); m.shadowBlur = 0;
  })();

  let dots, pellets, dotsLeft, dotsEaten;
  let player, ghosts, desired;
  let score, lives, level, best, newBest;
  let state, waitT, dieT, dieBurst, clearT;
  let frightT, frightChain, waveT, waveIdx, waveMode;
  let fruit, fruit70, fruit170, wakaHi, animT;

  const startOverlay = A.wireStartOverlay('pacmanModal', startGame);
  const overOverlay = A.gameOverOverlay('pacmanModal');

  function buildLevel() {
    dots = new Set(); pellets = new Set();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = MAZE[y][x];
      if (t === '.') dots.add(x + ',' + y);
      else if (t === 'o') pellets.add(x + ',' + y);
    }
    dots.delete(PLAYER_START.x + ',' + PLAYER_START.y); // spawn tile stays clear
    dots.delete(FRUIT_SPOT.x + ',' + FRUIT_SPOT.y);     // fruit tile stays clear
    dotsLeft = dots.size + pellets.size;
    dotsEaten = 0; fruit70 = false; fruit170 = false; fruit = null;
  }

  function speedMul() { return Math.min(1.3, 1 + (level - 1) * 0.06); }

  function mkGhost(name, color, cx, cy, dir, mode, corner, releaseT) {
    const g = {
      name, color, corner, mode, releaseT,
      cx, cy, x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2,
      dir: { x: dir.x, y: dir.y }
    };
    g.onTile = function () { ghostOnTile(g); };
    return g;
  }

  function resetPositions() {
    player = {
      cx: PLAYER_START.x, cy: PLAYER_START.y,
      x: PLAYER_START.x * TILE + TILE / 2, y: PLAYER_START.y * TILE + TILE / 2,
      dir: { x: -1, y: 0 }, onTile: playerTile
    };
    desired = { x: -1, y: 0 };
    ghosts = [
      mkGhost('blinky', '#ff2b2b', 9, 8, { x: 0, y: -1 }, 'active', { x: 17, y: 1 }, 0),
      mkGhost('pinky', '#ff9de2', 9, 10, { x: -1, y: 0 }, 'house', { x: 1, y: 1 }, 1),
      mkGhost('inky', '#00f0ff', 8, 10, { x: 1, y: 0 }, 'house', { x: 17, y: 19 }, 4),
      mkGhost('clyde', '#ffb347', 10, 10, { x: -1, y: 0 }, 'house', { x: 1, y: 19 }, 8.5)
    ];
    frightT = 0; frightChain = 0;
    waveIdx = 0; waveT = 0; waveMode = 'scatter';
    fruit = null;
  }

  function reset() {
    score = 0; lives = 3; level = 1; newBest = false;
    best = A.getHi('pacman');
    hiEl.textContent = best;
    bestEl.textContent = ''; bestEl.classList.add('hidden');
    buildLevel();
    state = 'ready';
    animT = 0;
    particles.clear(); floaters.clear();
    resetPositions();
    paintScore();
  }

  function startGame() {
    reset();
    A.bumpPlays('pacman');
    state = 'wait'; waitT = 1.6;
    loop.start();
  }

  function paintScore() { scoreEl.textContent = score; }

  function addScore(n) {
    score += n;
    paintScore();
    if (A.setHi('pacman', score)) {
      newBest = true; best = score;
      hiEl.textContent = score;
      bestEl.textContent = '★ NEW BEST ★'; bestEl.classList.remove('hidden');
    }
  }

  /* ---------------- movement ---------------- */

  // Move toward the next tile center; onTile fires on each arrival.
  // Handles the row-10 wrap tunnel.
  function moveActor(a, dt, speed) {
    if (!a.dir.x && !a.dir.y) return;
    let dist = speed * dt, guard = 0;
    while (dist > 0.0001 && guard++ < 8) {
      const nx = a.cx + a.dir.x, ny = a.cy + a.dir.y;
      const txp = nx * TILE + TILE / 2, typ = ny * TILE + TILE / 2;
      const dx = txp - a.x, dy = typ - a.y;
      const d = Math.hypot(dx, dy);
      if (d <= dist) {
        a.x = txp; a.y = typ; dist -= d;
        a.cx = nx; a.cy = ny;
        if (a.cx < 0) { a.cx = COLS - 1; a.x = (COLS - 1) * TILE + TILE / 2; }
        else if (a.cx >= COLS) { a.cx = 0; a.x = TILE / 2; }
        if (a.onTile) a.onTile();
        if (!a.dir.x && !a.dir.y) return;
      } else {
        a.x += dx / d * dist; a.y += dy / d * dist;
        dist = 0;
      }
    }
  }

  // Buffered steering: reversal is instant, turns apply at the next tile.
  function setDesired(x, y) {
    desired = { x, y };
    if (state !== 'playing' && state !== 'wait') return;
    const p = player;
    if ((x || y) && p.dir.x === -x && p.dir.y === -y) p.dir = { x, y };
    else if (!p.dir.x && !p.dir.y && canPlayer(p.cx + x, p.cy + y)) p.dir = { x, y };
  }

  function playerTile() {
    eatAt(player.cx, player.cy);
    const d = desired;
    if ((d.x || d.y) && canPlayer(player.cx + d.x, player.cy + d.y)) {
      player.dir = { x: d.x, y: d.y };
    } else if (!canPlayer(player.cx + player.dir.x, player.cy + player.dir.y)) {
      player.dir = { x: 0, y: 0 };
    }
  }

  /* ---------------- eating / scoring ---------------- */

  function waka() {
    wakaHi = !wakaHi;
    A.sfx.tone({ f: wakaHi ? 560 : 420, t: 0.05, type: 'square', v: 0.05 });
  }

  function eatAt(x, y) {
    const k = x + ',' + y;
    if (dots.has(k)) {
      dots.delete(k); dotsLeft--; dotsEaten++;
      addScore(10); waka();
      checkFruit(); checkClear();
    } else if (pellets.has(k)) {
      pellets.delete(k); dotsLeft--;
      addScore(50);
      startFright();
      checkClear();
    }
  }

  function checkFruit() {
    if (!fruit70 && dotsEaten >= 70) { fruit70 = true; spawnFruit(); }
    else if (!fruit170 && dotsEaten >= 170) { fruit170 = true; spawnFruit(); }
  }

  function spawnFruit() {
    fruit = { x: FRUIT_SPOT.x * TILE + TILE / 2, y: FRUIT_SPOT.y * TILE + TILE / 2, t: 9 };
    A.sfx.pop();
    floaters.add(fruit.x, fruit.y - 14, 'FRUIT!', '#ff5b5b', 15);
  }

  function checkClear() {
    if (dotsLeft <= 0 && state === 'playing') {
      state = 'clearing'; clearT = 0;
      A.sfx.win();
      floaters.add(W / 2, H / 2, 'LEVEL CLEAR', '#a6ff00', 26);
    }
  }

  function startFright() {
    frightT = 6; frightChain = 0;
    reverseGhosts();
    A.sfx.power();
    particles.burst(player.x, player.y, { n: 22, colors: ['#2b2bff', '#ffffff'], speed: 220, life: 0.6, size: 4 });
  }

  function reverseGhosts() {
    for (const g of ghosts) {
      if (g.mode === 'active' && (g.dir.x || g.dir.y)) g.dir = { x: -g.dir.x, y: -g.dir.y };
    }
  }

  function eatGhost(g) {
    const pts = [200, 400, 800, 1600][Math.min(frightChain, 3)];
    frightChain++;
    addScore(pts);
    floaters.add(g.x, g.y - 12, '+' + pts, '#00f0ff', 18);
    particles.burst(g.x, g.y, { n: 24, colors: [g.color, '#ffffff'], speed: 260, life: 0.7, size: 4 });
    A.sfx.eat();
    g.mode = 'eyes';
  }

  /* ---------------- ghost AI ---------------- */

  function ghostTarget(g) {
    const p = player;
    if (g.name === 'blinky') return { x: p.cx, y: p.cy };                    // direct chase
    if (g.name === 'pinky') return { x: p.cx + p.dir.x * 4, y: p.cy + p.dir.y * 4 }; // 4 ahead
    if (g.name === 'inky') {                                                  // flank via blinky
      const b = ghosts[0];
      return { x: 2 * p.cx - b.cx, y: 2 * p.cy - b.cy };
    }
    const d = Math.hypot(g.cx - p.cx, g.cy - p.cy);                           // shy: backs off close up
    return d < 6 ? g.corner : { x: p.cx, y: p.cy };
  }

  const DIRS4 = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

  function ghostDecide(g, target, canDoor, random) {
    const revx = -g.dir.x, revy = -g.dir.y;
    let opts = [];
    for (const d of DIRS4) {
      if (d.x === revx && d.y === revy) continue; // never reverse mid-corridor
      if (canGhost(g.cx + d.x, g.cy + d.y, canDoor)) opts.push(d);
    }
    if (!opts.length) { // dead end: turn around
      if (canGhost(g.cx + revx, g.cy + revy, canDoor)) opts = [{ x: revx, y: revy }];
      else { g.dir = { x: 0, y: 0 }; return; }
    }
    if (random) {
      const d = opts[(Math.random() * opts.length) | 0];
      g.dir = { x: d.x, y: d.y };
    } else {
      let bd = Infinity, bs = opts[0];
      for (const d of opts) {
        const dx = g.cx + d.x - target.x, dy = g.cy + d.y - target.y;
        const dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; bs = d; }
      }
      g.dir = { x: bs.x, y: bs.y };
    }
  }

  function houseStep(g) { // bob side to side inside the house
    if (g.cx <= 8) g.dir = { x: 1, y: 0 };
    else if (g.cx >= 10) g.dir = { x: -1, y: 0 };
  }

  function leaveStep(g) { // file out through the door
    if (g.cx === DOOR.x) {
      if (g.cy === TUNNEL_ROW) g.dir = { x: 0, y: -1 };
      else if (g.cy === DOOR.y) g.dir = { x: 0, y: -1 };
      else if (g.cy === DOOR.y - 1) { g.mode = 'active'; ghostOnTile(g); }
    } else {
      g.dir = { x: g.cx < DOOR.x ? 1 : -1, y: 0 };
    }
  }

  function ghostOnTile(g) {
    if (g.mode === 'house') { houseStep(g); return; }
    if (g.mode === 'leaving') { leaveStep(g); return; }
    if (g.mode === 'eyes') {
      if (g.cx === DOOR.x && g.cy === DOOR.y) { // home: drop in and respawn
        g.mode = 'leaving'; g.dir = { x: 0, y: 1 };
        A.sfx.pop();
        return;
      }
      ghostDecide(g, DOOR, true, false);
      return;
    }
    if (frightT > 0) ghostDecide(g, null, false, true);
    else ghostDecide(g, waveMode === 'scatter' ? g.corner : ghostTarget(g), false, false);
  }

  /* ---------------- death / level flow ---------------- */

  function startDeath() {
    state = 'dying'; dieT = 0; dieBurst = false;
    A.sfx.hit(); shake.add(0.7);
  }

  function gameOver() {
    state = 'over';
    A.sfx.lose();
    particles.burst(W / 2, H / 2, { n: 60, colors: ['#ff3355', '#ff2fd6', '#ffffff'], speed: 380, life: 1, size: 5 });
    setTimeout(() => {
      if (document.getElementById('pacmanModal').classList.contains('hidden')) return;
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        '<div class="go-score">' + score + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="pacmanRetry">PLAY AGAIN</button>'
      );
      document.getElementById('pacmanRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 800);
  }

  /* ---------------- update ---------------- */

  function update(dt) {
    animT += dt;

    if (state === 'wait') {
      waitT -= dt;
      if (waitT <= 0) state = 'playing';
    } else if (state === 'dying') {
      dieT += dt;
      if (dieT > 1.1 && !dieBurst) {
        dieBurst = true;
        particles.burst(player.x, player.y, { n: 30, colors: ['#ffe14d', '#ffffff'], speed: 240, life: 0.8, size: 4 });
      }
      if (dieT > 1.9) {
        lives--;
        if (lives <= 0) gameOver();
        else { resetPositions(); state = 'wait'; waitT = 1.2; }
      }
    } else if (state === 'clearing') {
      clearT += dt;
      if (clearT > 2.2) {
        level++;
        buildLevel();
        resetPositions();
        state = 'wait'; waitT = 1.4;
      }
    } else if (state === 'playing') {
      // scatter / chase waves
      waveT += dt;
      if (waveT >= WAVE_DUR[waveIdx]) {
        waveT = 0; waveIdx = Math.min(waveIdx + 1, WAVE_DUR.length - 1);
        waveMode = (waveIdx % 2 === 0) ? 'scatter' : 'chase';
        reverseGhosts();
        A.sfx.tick();
      }

      if (frightT > 0) { frightT -= dt; if (frightT < 0) frightT = 0; }

      // release ghosts from the house on staggered timers
      for (const g of ghosts) {
        if (g.mode === 'house') {
          g.releaseT -= dt;
          if (g.releaseT <= 0) g.mode = 'leaving';
        }
      }

      moveActor(player, dt, 155 * speedMul());
      if (state === 'playing') {
        for (const g of ghosts) {
          const sp = g.mode === 'eyes' ? 320
            : (g.mode === 'house' || g.mode === 'leaving') ? 110
            : (frightT > 0 ? 88 : 138 * speedMul());
          moveActor(g, dt, sp);
        }

        // fruit pickup
        if (fruit) {
          fruit.t -= dt;
          if (fruit.t <= 0) fruit = null;
          else {
            const dx = player.x - fruit.x, dy = player.y - fruit.y;
            const pr = TILE * 0.75;
            if (dx * dx + dy * dy < pr * pr) {
              const pts = 100 * level;
              addScore(pts);
              floaters.add(fruit.x, fruit.y - 12, '+' + pts, '#ff5b5b', 18);
              particles.burst(fruit.x, fruit.y, { n: 16, colors: ['#ff5b5b', '#ffffff'], speed: 180, life: 0.6, size: 3 });
              A.sfx.good();
              fruit = null;
            }
          }
        }

        // ghost collisions
        const cr = TILE * 0.55, cr2 = cr * cr;
        for (const g of ghosts) {
          if (g.mode !== 'active') continue;
          const dx = g.x - player.x, dy = g.y - player.y;
          if (dx * dx + dy * dy < cr2) {
            if (frightT > 0) eatGhost(g);
            else { startDeath(); break; }
          }
        }
      }
    } else {
      particles.update(dt); floaters.update(dt); shake.update(dt);
      return;
    }

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  /* ---------------- render ---------------- */

  function drawPlayer() {
    const r = TILE * 0.58;
    A.neonOn(ctx, '#ffe14d', 16);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    if (state === 'dying') {
      const p = A.clamp(dieT / 1.5, 0, 1);
      if (p >= 1) { A.neonOff(ctx); return; }
      const m = (0.08 + 0.92 * p) * Math.PI, ang = -Math.PI / 2;
      ctx.arc(player.x, player.y, r, ang + m, ang + A.TAU - m);
    } else {
      let ang = Math.atan2(player.dir.y, player.dir.x);
      if (!player.dir.x && !player.dir.y) ang = 0;
      const m = (0.06 + 0.24 * Math.abs(Math.sin(animT * 10))) * Math.PI;
      ctx.arc(player.x, player.y, r, ang + m, ang + A.TAU - m);
    }
    ctx.closePath(); ctx.fill();
    A.neonOff(ctx);
  }

  function drawGhost(g) {
    const r = TILE * 0.52, x = g.x, y = g.y;
    const isEyes = g.mode === 'eyes';
    const fright = frightT > 0 && g.mode === 'active';
    const flash = fright && frightT < 1.5 && (((animT * 8) | 0) % 2 === 0);

    if (!isEyes) {
      const body = fright ? (flash ? '#f4f6ff' : '#2b2bff') : g.color;
      A.neonOn(ctx, body, 14);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(x - r, y + r * 0.9);
      ctx.lineTo(x - r, y - r * 0.1);
      ctx.arc(x, y - r * 0.1, r, Math.PI, 0);
      ctx.lineTo(x + r, y + r * 0.9);
      const waves = 4, w = 2 * r / waves;
      for (let i = 0; i < waves; i++) {
        const x0 = x + r - i * w;
        ctx.lineTo(x0 - w / 2, y + r * 0.55);
        ctx.lineTo(x0 - w, y + r * 0.9);
      }
      ctx.closePath(); ctx.fill();
      A.neonOff(ctx);
    }

    const ex = r * 0.42, ey = -r * 0.22, er = r * 0.3;
    if (fright) {
      // scared face
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x - ex, y + ey, er * 0.7, 0, A.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + ex, y + ey, er * 0.7, 0, A.TAU); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath();
      const mw = r * 0.7, my = y + r * 0.45;
      ctx.moveTo(x - mw, my);
      for (let i = 0; i < 4; i++) ctx.lineTo(x - mw + (i + 0.5) * (2 * mw / 4), my - 4), ctx.lineTo(x - mw + (i + 1) * (2 * mw / 4), my);
      ctx.stroke();
    } else {
      // eyes look along travel direction
      const px = g.dir.x * 2.5, py = g.dir.y * 2.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(x - ex, y + ey, er, er * 1.15, 0, 0, A.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + ex, y + ey, er, er * 1.15, 0, 0, A.TAU); ctx.fill();
      ctx.fillStyle = isEyes ? '#2b2bff' : '#101028';
      ctx.beginPath(); ctx.arc(x - ex + px, y + ey + py, er * 0.55, 0, A.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + ex + px, y + ey + py, er * 0.55, 0, A.TAU); ctx.fill();
    }
  }

  function drawFruit() {
    const x = fruit.x, y = fruit.y + Math.sin(animT * 5) * 2;
    A.neonOn(ctx, '#ff2b2b', 12);
    ctx.strokeStyle = '#7CFC00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 4);
    ctx.quadraticCurveTo(x + 4, y - 10, x + 9, y - 12); ctx.stroke();
    ctx.fillStyle = '#ff2b2b';
    ctx.beginPath(); ctx.arc(x - 4, y + 2, 5, 0, A.TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 4, y + 4, 5, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
  }

  function render() {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, '#0a0a20'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(mazeCanvas, 0, 0);
    shake.apply(ctx);

    // dots
    A.neonOn(ctx, '#ffb46b', 8);
    ctx.fillStyle = '#ffc98a';
    dots.forEach((k) => {
      const i = k.indexOf(',');
      const x = +k.slice(0, i), y = +k.slice(i + 1);
      ctx.beginPath(); ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, 3, 0, A.TAU); ctx.fill();
    });
    // power pellets (pulsing)
    const pr = 5 + Math.sin(animT * 6) * 1.5;
    pellets.forEach((k) => {
      const i = k.indexOf(',');
      const x = +k.slice(0, i), y = +k.slice(i + 1);
      ctx.beginPath(); ctx.arc(x * TILE + TILE / 2, y * TILE + TILE / 2, pr, 0, A.TAU); ctx.fill();
    });
    A.neonOff(ctx);

    if (fruit) drawFruit();
    for (const gh of ghosts) drawGhost(gh);
    drawPlayer();

    particles.draw(ctx);
    floaters.draw(ctx);

    // HUD strip over the top wall row
    ctx.fillStyle = 'rgba(2,4,14,0.85)';
    ctx.fillRect(0, 0, W, TILE);
    for (let i = 0; i < lives; i++) {
      const x = 16 + i * 26, y = TILE / 2;
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.arc(x, y, 8, 0.3, A.TAU - 0.3); ctx.closePath(); ctx.fill();
    }
    ctx.font = '700 13px Orbitron, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    A.neonOn(ctx, '#00f0ff', 8);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('LEVEL ' + level, W - 12, TILE / 2 + 1);
    A.neonOff(ctx);

    if (state === 'wait') A.glowText(ctx, 'READY!', W / 2, 11 * TILE, '900 30px Orbitron, sans-serif', '#ffe14d');
    if (state === 'clearing') A.glowText(ctx, 'LEVEL CLEAR', W / 2, 11 * TILE, '900 26px Orbitron, sans-serif', '#a6ff00');

    ctx.restore();

    if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  const loop = A.createLoop(update, render);

  /* ---------------- input ---------------- */

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('pacmanModal').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowup' || k === 'w') setDesired(0, -1);
    else if (k === 'arrowdown' || k === 's') setDesired(0, 1);
    else if (k === 'arrowleft' || k === 'a') setDesired(-1, 0);
    else if (k === 'arrowright' || k === 'd') setDesired(1, 0);
    else if (k === 'p' || k === ' ') togglePause();
  });

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  A.bindTap(document.getElementById('pacmanUp'), () => setDesired(0, -1));
  A.bindTap(document.getElementById('pacmanDown'), () => setDesired(0, 1));
  A.bindTap(document.getElementById('pacmanLeft'), () => setDesired(-1, 0));
  A.bindTap(document.getElementById('pacmanRight'), () => setDesired(1, 0));

  // swipe steering on the canvas
  let swX = 0, swY = 0;
  canvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; swX = t.clientX; swY = t.clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - swX, dy = t.clientY - swY;
    if (Math.hypot(dx, dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) setDesired(dx > 0 ? 1 : -1, 0);
    else setDesired(0, dy > 0 ? 1 : -1);
  });

  A.registerModalGame('pacmanModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show(); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(document.getElementById('pacmanModal'));
  reset(); render();
})();
