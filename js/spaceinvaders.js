/* Space Invaders — neon overhaul. Pixel-sprite invaders, destructible
 * shields, particle explosions, bosses with health bars, powerups. */
(function () {
  'use strict';
  const A = Arcade;
  const canvas = document.getElementById('spaceGameCanvas');
  const ctx = canvas.getContext('2d');
  const startBtn = document.getElementById('startSpaceGame');
  const nextBtn = document.getElementById('nextLevelButton');
  const resetBtn = document.getElementById('resetGameButton');
  const leftBtn = document.getElementById('leftButton');
  const rightBtn = document.getElementById('rightButton');
  const shootBtn = document.getElementById('shootButton');

  const W = 800, H = 480;
  canvas.width = W; canvas.height = H;

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();
  let stars = A.makeStars(110, W, H);

  /* ----- classic invader sprites (2 frames each) ----- */
  const SPRITES = {
    squid: [
      ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '..X..X..', '.XX.XX..', 'XX.XX.XX'],
      ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.XX.XX..', '..X..X..', '.XX.XX..']
    ],
    crab: [
      ['..X...X..', '...X.X...', '..XXXXX..', '.XX.X.XX.', 'XXXXXXXXX', 'X.XXXXX.X', 'X.X...X.X', '...X.X...'],
      ['..X...X..', 'X..X.X..X', 'X.XXXXX.X', 'XXX.X.XXX', 'XXXXXXXXX', '.XXXXX.X.', '..X...X..', '.X.....X.']
    ],
    octo: [
      ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XXXXXXXX..', 'XX..XXXX..XX'],
      ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '..XXXXXXXX..', '.XX..XX..XX.', '..XX....XX..']
    ]
  };
  const PX = 3; // pixel scale

  let player, bullets, ebullets, enemies, shields, powerups;
  let score, hi, wave, lives, state, enemyDir, enemyTimer, shootTimer, banner, bannerT;
  let moveL, moveR;

  const startOverlay = {
    show(html) {
      let o = document.getElementById('siStartOverlay');
      if (!o) {
        o = document.createElement('div');
        o.id = 'siStartOverlay';
        o.className = 'game-start-overlay';
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.appendChild(o);
      }
      o.innerHTML = html || '<div class="go-title">SPACE INVADERS</div><div class="go-sub">click to defend earth</div>';
      o.classList.remove('hidden');
      o.onclick = () => { o.classList.add('hidden'); startGame(); };
    },
    hide() { const o = document.getElementById('siStartOverlay'); if (o) o.classList.add('hidden'); }
  };

  function reset() {
    score = 0; wave = 1; lives = 3;
    hi = A.getHi('invaders');
    state = 'ready';
    bullets = []; ebullets = []; powerups = [];
    particles.clear(); floaters.clear();
    player = { x: W / 2 - 21, y: H - 56, w: 42, h: 26, speed: 340, cd: 0, weapon: 1, weaponT: 0, shieldT: 0 };
    buildShields();
    spawnWave(1);
    startBtn.style.display = '';
    nextBtn.style.display = 'none';
    resetBtn.style.display = 'none';
  }

  function startGame() {
    reset();
    A.bumpPlays('invaders');
    state = 'playing';
    startOverlay.hide();
    startBtn.style.display = 'none';
    resetBtn.style.display = '';
    loop.start();
  }

  function buildShields() {
    shields = [];
    const sw = 74, sh = 52, y = H - 130;
    [0.14, 0.38, 0.62, 0.86].forEach(fx => {
      const sx = W * fx - sw / 2;
      const cells = [];
      const cw = 6, chh = 6;
      for (let gy = 0; gy < sh / chh; gy++) for (let gx = 0; gx < sw / cw; gx++) {
        // arch shape: skip bottom-middle notch
        const nx = gx / (sw / cw), ny = gy / (sh / chh);
        if (ny > 0.62 && nx > 0.3 && nx < 0.7) continue;
        if (ny < 0.12 && (nx < 0.12 || nx > 0.88)) continue;
        cells.push({ x: sx + gx * cw, y: y + gy * chh, w: cw, h: chh, hp: 2 });
      }
      shields.push({ cells });
    });
  }

  function spawnWave(n) {
    enemies = [];
    enemyDir = 1; enemyTimer = 0; shootTimer = 1.2;
    banner = 'WAVE ' + n; bannerT = 2.2;
    if (n % 3 === 0) {
      // boss wave
      const hp = 14 + n * 2;
      enemies.push({ boss: true, x: W / 2 - 70, y: 60, w: 140, h: 64, hp, maxHp: hp, alive: true, score: 500, t: 0 });
    } else {
      const rows = Math.min(5, 3 + ((n / 2) | 0));
      const cols = 8;
      const tw = 11 * PX, th = 8 * PX;
      const gapX = 26, gapY = 22;
      const totalW = cols * (tw + gapX) - gapX;
      const x0 = (W - totalW) / 2, y0 = 70;
      const types = ['squid', 'crab', 'crab', 'octo', 'octo'];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        enemies.push({
          x: x0 + c * (tw + gapX), y: y0 + r * (th + gapY),
          w: tw, h: th, type: types[r % types.length],
          row: r, col: c, alive: true, score: [30, 20, 10][Math.min(2, (r / 2) | 0)],
          frame: 0, ft: Math.random() * 0.5
        });
      }
    }
  }

  function playerShoot() {
    if (player.cd > 0 || state !== 'playing') return;
    player.cd = player.weapon > 1 ? 0.22 : 0.3;
    const bx = player.x + player.w / 2;
    if (player.weapon === 1) bullets.push({ x: bx - 2, y: player.y - 12, w: 4, h: 14, vy: -560 });
    else if (player.weapon === 2) { bullets.push({ x: bx - 10, y: player.y - 12, w: 4, h: 14, vy: -560 }); bullets.push({ x: bx + 6, y: player.y - 12, w: 4, h: 14, vy: -560 }); }
    else { bullets.push({ x: bx - 2, y: player.y - 12, w: 4, h: 14, vy: -560 }); bullets.push({ x: bx - 12, y: player.y - 6, w: 4, h: 12, vy: -560, vx: -120 }); bullets.push({ x: bx + 8, y: player.y - 6, w: 4, h: 12, vy: -560, vx: 120 }); }
    A.sfx.shoot();
    particles.burst(bx, player.y, { n: 4, colors: ['#00f0ff'], speed: 90, life: 0.25, size: 3, dir: -Math.PI / 2, spread: 0.8 });
  }

  function enemyShoot() {
    const shooters = enemies.filter(e => e.alive && !e.boss);
    if (!shooters.length && !enemies.some(e => e.alive && e.boss)) return;
    const boss = enemies.find(e => e.alive && e.boss);
    if (boss) {
      const n = wave >= 6 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        ebullets.push({ x: boss.x + boss.w * (0.25 + 0.5 * Math.random()), y: boss.y + boss.h, w: 5, h: 16, vy: 200 + wave * 12, vx: A.rand(-60, 60) });
      }
      A.sfx.enemyShoot();
      return;
    }
    // pick shooters from the lowest alive in random columns
    const byCol = {};
    shooters.forEach(e => { if (!byCol[e.col] || byCol[e.col].y < e.y) byCol[e.col] = e; });
    const cols = Object.values(byCol);
    const count = Math.min(cols.length, 1 + ((wave / 2) | 0));
    for (let i = 0; i < count; i++) {
      const s = A.choice(cols);
      ebullets.push({ x: s.x + s.w / 2 - 2, y: s.y + s.h, w: 5, h: 16, vy: 170 + wave * 14, vx: 0 });
    }
    A.sfx.enemyShoot();
  }

  function explode(x, y, colors, n, speed) {
    particles.burst(x, y, { n: n || 22, colors: colors || ['#ff2fd6', '#ff9f1c', '#ffffff'], speed: speed || 260, life: 0.7, size: 4 });
  }

  function killEnemy(e) {
    e.alive = false;
    score += e.score;
    floaters.add(e.x + e.w / 2, e.y, '+' + e.score, '#ffd700', 15);
    explode(e.x + e.w / 2, e.y + e.h / 2, ['#a6ff00', '#00f0ff', '#ffffff'], 20, 240);
    A.sfx.explode();
    if (A.setHi('invaders', score)) hi = score;
    // powerup drop chance
    if (!e.boss && Math.random() < 0.07) {
      powerups.push({ x: e.x + e.w / 2, y: e.y, vy: 130, kind: A.choice(['spread', 'rapid', 'shield']), t: 0 });
    }
    if (e.boss) {
      shake.add(0.6);
      explode(e.x + e.w / 2, e.y + e.h / 2, ['#ff2fd6', '#ffffff', '#ffd700'], 60, 420);
      floaters.add(W / 2, H / 2 - 60, 'BOSS DOWN +' + e.score, '#ff2fd6', 30);
    }
  }

  function hitPlayer() {
    if (player.shieldT > 0) { A.sfx.tick(); return; }
    lives--;
    shake.add(0.5);
    explode(player.x + player.w / 2, player.y + player.h / 2, ['#00f0ff', '#ffffff', '#ff2fd6'], 40, 340);
    A.sfx.hit();
    player.weapon = 1; player.weaponT = 0;
    if (lives <= 0) {
      state = 'over';
      A.sfx.lose();
      setTimeout(() => {
        startOverlay.show(
          '<div class="go-title lost">GAME OVER</div>' +
          '<div class="go-score">SCORE ' + score + '</div>' +
          '<div class="go-sub">WAVE ' + wave + '</div>' +
          '<div class="go-best">BEST ' + hi + '</div>' +
          '<button class="go-btn" onclick="document.getElementById(\'siStartOverlay\').classList.add(\'hidden\')">RETRY</button>'
        );
        document.querySelector('#siStartOverlay .go-btn').onclick = () => { startOverlay.hide(); startGame(); };
        loop.stop();
        startBtn.style.display = 'none';
      }, 800);
    } else {
      player.x = W / 2 - 21;
      player.shieldT = 2;
      floaters.add(W / 2, H - 120, lives + (lives === 1 ? ' LIFE' : ' LIVES') + ' LEFT', '#ff6b6b', 22);
    }
  }

  function shieldHit(x, y) {
    for (const s of shields) {
      for (let i = s.cells.length - 1; i >= 0; i--) {
        const c = s.cells[i];
        if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) {
          c.hp--;
          particles.burst(x, y, { n: 6, colors: ['#37d957', '#a6ff00'], speed: 140, life: 0.4, size: 3 });
          if (c.hp <= 0) s.cells.splice(i, 1);
          return true;
        }
      }
    }
    return false;
  }

  function update(dt) {
    if (state !== 'playing') { particles.update(dt); floaters.update(dt); return; }

    if (bannerT > 0) bannerT -= dt;

    // player
    player.cd -= dt;
    if (player.weaponT > 0) { player.weaponT -= dt; if (player.weaponT <= 0) player.weapon = 1; }
    if (player.shieldT > 0) player.shieldT -= dt;
    let dx = 0;
    if (moveL) dx -= 1;
    if (moveR) dx += 1;
    player.x = A.clamp(player.x + dx * player.speed * dt, 0, W - player.w);
    // engine flame
    if (dx !== 0 && Math.random() < 0.6) particles.trail(player.x + player.w / 2 - dx * 10, player.y + player.h, '#ff9f1c', 4);

    // enemies march
    const speed = (26 + wave * 7) * (enemies.some(e => e.boss && e.alive) ? 1.4 : 1);
    let hitEdge = false;
    enemies.forEach(e => {
      if (!e.alive) return;
      e.t = (e.t || 0) + dt;
      if (e.boss) {
        e.x += Math.sin(e.t * 0.9) * 130 * dt;
        e.x = A.clamp(e.x, 20, W - e.w - 20);
      } else {
        e.x += enemyDir * speed * dt;
        e.ft += dt;
        if (e.ft > 0.45 - Math.min(0.3, wave * 0.02)) { e.ft = 0; e.frame ^= 1; }
        if (e.x <= 4 || e.x + e.w >= W - 4) hitEdge = true;
      }
    });
    if (hitEdge) {
      enemyDir *= -1;
      enemies.forEach(e => { if (e.alive && !e.boss) e.y += 16; });
    }
    // enemies reaching the shields = game over pressure
    enemies.forEach(e => {
      if (e.alive && !e.boss && e.y + e.h > H - 150) { hitPlayer(); e.alive = false; explode(e.x, e.y, ['#ff3355'], 20, 200); }
    });

    // enemy shooting
    shootTimer -= dt;
    if (shootTimer <= 0) { enemyShoot(); shootTimer = Math.max(0.5, 1.7 - wave * 0.12); }

    // bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y += b.vy * dt;
      if (b.vx) b.x += b.vx * dt;
      if (b.y < -20) { bullets.splice(i, 1); continue; }
      let consumed = shieldHit(b.x + b.w / 2, b.y);
      if (!consumed) {
        for (const e of enemies) {
          if (!e.alive) continue;
          if (b.x < e.x + e.w && b.x + b.w > e.x && b.y < e.y + e.h && b.y + b.h > e.y) {
            consumed = true;
            if (e.boss) {
              e.hp--;
              explode(b.x, b.y, ['#ff2fd6', '#ffffff'], 8, 160);
              A.sfx.tick();
              if (e.hp <= 0) killEnemy(e);
            } else killEnemy(e);
            break;
          }
        }
      }
      if (consumed) bullets.splice(i, 1);
    }

    // enemy bullets
    for (let i = ebullets.length - 1; i >= 0; i--) {
      const b = ebullets[i];
      b.y += b.vy * dt; b.x += (b.vx || 0) * dt;
      if (b.y > H + 20) { ebullets.splice(i, 1); continue; }
      let consumed = shieldHit(b.x + b.w / 2, b.y + b.h);
      if (!consumed && b.x < player.x + player.w && b.x + b.w > player.x && b.y < player.y + player.h && b.y + b.h > player.y) {
        consumed = true;
        hitPlayer();
      }
      if (consumed) ebullets.splice(i, 1);
    }

    // powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt; p.t += dt;
      if (p.y > H) { powerups.splice(i, 1); continue; }
      if (p.x > player.x - 14 && p.x < player.x + player.w + 14 && p.y > player.y - 14 && p.y < player.y + player.h + 14) {
        powerups.splice(i, 1);
        A.sfx.power();
        if (p.kind === 'spread') { player.weapon = 3; player.weaponT = 14; floaters.add(player.x + 21, player.y - 20, 'SPREAD SHOT', '#00f0ff', 18); }
        else if (p.kind === 'rapid') { player.weapon = 2; player.weaponT = 14; floaters.add(player.x + 21, player.y - 20, 'RAPID FIRE', '#a6ff00', 18); }
        else { player.shieldT = 8; floaters.add(player.x + 21, player.y - 20, 'SHIELD', '#ffd700', 18); }
      }
    }

    // wave clear
    if (enemies.every(e => !e.alive)) {
      state = 'between';
      A.sfx.win();
      const bonus = 100 * wave;
      score += bonus;
      floaters.add(W / 2, H / 2, 'WAVE CLEAR +' + bonus, '#a6ff00', 26);
      if (A.setHi('invaders', score)) hi = score;
      setTimeout(() => {
        if (state !== 'between') return;
        wave++;
        spawnWave(wave);
        buildShields();
        state = 'playing';
      }, 1800);
    }

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  /* ----- rendering ----- */
  function drawSprite(type, frame, x, y, color) {
    const rows = SPRITES[type][frame];
    A.neonOn(ctx, color, 10);
    ctx.fillStyle = color;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] === 'X') ctx.fillRect(x + rx * PX, y + ry * PX, PX, PX);
      }
    });
    A.neonOff(ctx);
  }

  function drawPlayerShip() {
    const { x, y, w, h } = player;
    if (player.shieldT > 0 && Math.floor(performance.now() / 120) % 2 === 0) return; // blink while invulnerable
    // engine flame
    const fl = 10 + Math.random() * 12;
    A.neonOn(ctx, '#ff9f1c', 14);
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 7, y + h);
    ctx.lineTo(x + w / 2 + 7, y + h);
    ctx.lineTo(x + w / 2, y + h + fl);
    ctx.closePath(); ctx.fill();
    A.neonOff(ctx);
    // hull
    A.neonOn(ctx, '#00f0ff', 14);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#a5f3fc'); g.addColorStop(0.5, '#00c8e0'); g.addColorStop(1, '#0077aa');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w - 4, y + h - 6);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + 4, y + h - 6);
    ctx.closePath(); ctx.fill();
    A.neonOff(ctx);
    // cockpit
    ctx.fillStyle = '#e0faff';
    ctx.beginPath(); ctx.arc(x + w / 2, y + 11, 4.5, 0, A.TAU); ctx.fill();
    // shield bubble
    if (player.shieldT > 0 && player.shieldT < 90) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      A.neonOn(ctx, '#ffd700', 16);
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 30, 0, A.TAU); ctx.stroke();
      ctx.restore();
    }
  }

  function render() {
    ctx.save();
    ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
    A.drawStarfield(stars, ctx, W, H, 0.5);
    shake.apply(ctx);

    // shields
    shields.forEach(s => s.cells.forEach(c => {
      ctx.fillStyle = c.hp === 2 ? '#2fbf4f' : '#1d7a2f';
      A.neonOn(ctx, '#37d957', 5);
      ctx.fillRect(c.x, c.y, c.w, c.h);
      A.neonOff(ctx);
    }));

    // enemies
    const typeColor = { squid: '#ff2fd6', crab: '#a6ff00', octo: '#00f0ff' };
    enemies.forEach(e => {
      if (!e.alive) return;
      if (e.boss) {
        const pulse = 1 + Math.sin(e.t * 6) * 0.03;
        const bw = e.w * pulse, bh = e.h * pulse;
        const bx = e.x + (e.w - bw) / 2, by = e.y + (e.h - bh) / 2;
        A.neonOn(ctx, '#ff2fd6', 24);
        const g = ctx.createLinearGradient(bx, by, bx, by + bh);
        g.addColorStop(0, '#ff2fd6'); g.addColorStop(1, '#7a0050');
        ctx.fillStyle = g;
        A.rr(ctx, bx, by, bw, bh, 14); ctx.fill();
        A.neonOff(ctx);
        // angry eyes
        ctx.fillStyle = '#fff';
        ctx.fillRect(bx + bw * 0.28, by + bh * 0.3, bw * 0.14, bh * 0.22);
        ctx.fillRect(bx + bw * 0.58, by + bh * 0.3, bw * 0.14, bh * 0.22);
        ctx.fillStyle = '#ff0044';
        ctx.fillRect(bx + bw * 0.31, by + bh * 0.34, bw * 0.08, bh * 0.14);
        ctx.fillRect(bx + bw * 0.61, by + bh * 0.34, bw * 0.08, bh * 0.14);
        // health bar
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(bx, by - 14, bw, 8);
        const hpp = e.hp / e.maxHp;
        ctx.fillStyle = hpp > 0.5 ? '#a6ff00' : hpp > 0.25 ? '#ffb300' : '#ff3355';
        A.neonOn(ctx, ctx.fillStyle, 8);
        ctx.fillRect(bx, by - 14, bw * hpp, 8);
        A.neonOff(ctx);
      } else {
        drawSprite(e.type, e.frame, e.x, e.y, typeColor[e.type]);
      }
    });

    // bullets
    bullets.forEach(b => {
      A.neonOn(ctx, '#00f0ff', 12);
      ctx.fillStyle = '#d8fbff';
      A.rr(ctx, b.x, b.y, b.w, b.h, 2); ctx.fill();
      A.neonOff(ctx);
    });
    ebullets.forEach(b => {
      A.neonOn(ctx, '#ff2fd6', 12);
      ctx.fillStyle = '#ff9ff0';
      A.rr(ctx, b.x, b.y, b.w, b.h, 2); ctx.fill();
      A.neonOff(ctx);
    });

    // powerups
    powerups.forEach(p => {
      const bob = Math.sin(p.t * 5) * 4;
      const col = p.kind === 'spread' ? '#00f0ff' : p.kind === 'rapid' ? '#a6ff00' : '#ffd700';
      A.neonOn(ctx, col, 14);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 10, 0, A.TAU); ctx.fill();
      ctx.fillStyle = '#04121a';
      ctx.font = 'bold 11px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.kind === 'spread' ? 'S' : p.kind === 'rapid' ? 'R' : '◈', p.x, p.y + bob + 1);
      A.neonOff(ctx);
    });

    if (state !== 'over') drawPlayerShip();

    particles.draw(ctx);
    floaters.draw(ctx);

    // HUD
    ctx.save();
    ctx.font = '700 17px Orbitron, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    A.neonOn(ctx, '#00f0ff', 8);
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('SCORE ' + score, 14, 12);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd700';
    A.neonOn(ctx, '#ffd700', 8);
    ctx.fillText('BEST ' + hi, W - 14, 12);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff2fd6';
    A.neonOn(ctx, '#ff2fd6', 8);
    ctx.fillText('WAVE ' + wave, W / 2, 12);
    // lives
    ctx.textAlign = 'left';
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(14 + i * 26, 38, 18, 10);
    }
    ctx.restore();

    if (bannerT > 0 && state === 'playing') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, bannerT);
      A.glowText(ctx, banner, W / 2, H / 2 - 40, '900 54px Orbitron, sans-serif', '#ff2fd6');
      ctx.restore();
    }

    ctx.restore();
  }

  const loop = A.createLoop(update, render);

  /* ----- input ----- */
  const keys = {};
  document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    moveL = keys['ArrowLeft'] || keys['a'] || keys['A'] || moveL;
    moveR = keys['ArrowRight'] || keys['d'] || keys['D'] || moveR;
    if (['ArrowLeft', 'ArrowRight', ' '].indexOf(e.key) >= 0) e.preventDefault();
    if (e.key === ' ') playerShoot();
  });
  document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
    moveL = keys['ArrowLeft'] || keys['a'] || keys['A'];
    moveR = keys['ArrowRight'] || keys['d'] || keys['D'];
  });
  A.bindHold(leftBtn, () => { moveL = true; }, () => { moveL = false; });
  A.bindHold(rightBtn, () => { moveR = true; }, () => { moveR = false; });
  A.bindTap(shootBtn, playerShoot);
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); playerShoot(); }, { passive: false });

  startBtn.addEventListener('click', () => { A.sfx.unlock(); startGame(); });
  resetBtn.addEventListener('click', () => { loop.stop(); reset(); startOverlay.show(); render(); });

  reset();
  startOverlay.show();
  render();
})();
