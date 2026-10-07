/* Flappy — neon overhaul. Delta-time physics, parallax city,
 * animated bird, medals, buttery rotation. */
(function () {
  'use strict';
  const A = Arcade;
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const hiEl = document.getElementById('flappyHi');
  const pauseBtn = document.getElementById('flappyPause');

  const W = 640, H = 440;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();

  const GRAV = 1500, LIFT = -460, PIPE_W = 74, BASE_GAP = 165;
  const GROUND_H = 64;

  let bird, pipes, score, best, newBest, state, pipeTimer, bgX, groundX, wing;
  let flash; // white flash on death

  const startOverlay = A.wireStartOverlay('flappyModal', startGame);
  const overOverlay = A.gameOverOverlay('flappyModal');

  function reset() {
    bird = { x: 150, y: H / 2 - 60, vy: 0, rot: 0, r: 17 };
    pipes = [];
    score = 0; newBest = false;
    best = A.getHi('flappy');
    hiEl.textContent = best;
    pipeTimer = 0; bgX = 0; groundX = 0; wing = 0; flash = 0;
    state = 'ready';
    particles.clear(); floaters.clear();
    paintScore();
  }

  function startGame() {
    reset();
    A.bumpPlays('flappy');
    state = 'playing';
    A.sfx.jump();
    loop.start();
  }

  function paintScore() { scoreEl.textContent = 'SCORE ' + score; }

  function flap() {
    if (state === 'ready') { startGame(); return; }
    if (state !== 'playing') return;
    bird.vy = LIFT;
    wing = 0;
    A.sfx.jump();
    particles.burst(bird.x - 14, bird.y + 10, { n: 5, colors: ['#a6ff00', '#ffffff'], speed: 120, life: 0.35, size: 3, dir: Math.PI, spread: 1.2 });
  }

  function spawnPipe() {
    const gap = Math.max(128, BASE_GAP - score * 1.6);
    const margin = 70;
    const cy = A.rand(margin + gap / 2, H - GROUND_H - margin - gap / 2);
    pipes.push({ x: W + 20, gapY: cy, gap, passed: false, wob: Math.random() * A.TAU });
  }

  function medal(s) {
    if (s >= 40) return ['#e8f4ff', 'PLATINUM'];
    if (s >= 30) return ['#ffd700', 'GOLD'];
    if (s >= 20) return ['#c0c0c0', 'SILVER'];
    if (s >= 10) return ['#cd7f32', 'BRONZE'];
    return null;
  }

  function die(hitPipe) {
    state = 'over';
    flash = 1;
    A.sfx.hit();
    particles.burst(bird.x, bird.y, { n: 34, colors: ['#ffd23f', '#ff9f1c', '#ffffff'], speed: 300, life: 0.8, size: 4 });
    const m = medal(score);
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title lost">GAME OVER</div>' +
        (m ? '<div class="go-best">' + m[1] + ' MEDAL</div>' : '') +
        '<div class="go-score">SCORE ' + score + '</div>' +
        '<div class="go-best">BEST ' + Math.max(best, score) + '</div>' +
        (newBest ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="flappyRetry">FLAP AGAIN</button>'
      );
      document.getElementById('flappyRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 700);
  }

  function update(dt) {
    wing += dt * 14;
    if (flash > 0) flash = Math.max(0, flash - dt * 2.2);

    if (state === 'ready') {
      bird.y = H / 2 - 60 + Math.sin(performance.now() / 400) * 10;
      bird.rot = Math.sin(performance.now() / 400) * 0.08;
      bgX -= 30 * dt; groundX -= 60 * dt;
      return;
    }
    if (state !== 'playing') { particles.update(dt); return; }

    bgX -= 60 * dt; groundX -= 200 * dt;

    bird.vy += GRAV * dt;
    bird.vy = Math.min(bird.vy, 900);
    bird.y += bird.vy * dt;
    const targetRot = A.clamp(bird.vy / 900, -1, 1) * 1.25;
    bird.rot += (targetRot - bird.rot) * Math.min(1, dt * 10);

    pipeTimer -= dt;
    const speed = 200 + Math.min(120, score * 3);
    if (pipeTimer <= 0) { spawnPipe(); pipeTimer = 1.55; }

    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= speed * dt;
      p.wob += dt * 3;
      if (!p.passed && p.x + PIPE_W < bird.x) {
        p.passed = true; score++;
        paintScore();
        A.sfx.pop();
        floaters.add(bird.x + 40, bird.y - 30, '+1', '#a6ff00', 20);
        if (A.setHi('flappy', score)) { newBest = true; hiEl.textContent = score; }
      }
      if (p.x + PIPE_W < -40) pipes.splice(i, 1);
    }

    // collisions
    const r = bird.r - 3;
    if (bird.y + r >= H - GROUND_H || bird.y - r <= 0) return die(false);
    for (const p of pipes) {
      if (bird.x + r > p.x && bird.x - r < p.x + PIPE_W) {
        const topB = p.gapY - p.gap / 2, botT = p.gapY + p.gap / 2;
        if (bird.y - r < topB || bird.y + r > botT) return die(true);
      }
    }

    particles.update(dt); floaters.update(dt);
  }

  /* ----- rendering ----- */
  function drawBackground() {
    // night sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070b26'); sky.addColorStop(0.7, '#141b3f'); sky.addColorStop(1, '#1d1440');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // moon
    A.neonOn(ctx, '#fdf6d8', 40);
    ctx.fillStyle = '#fdf6d8';
    ctx.beginPath(); ctx.arc(W - 90, 74, 30, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    // stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 167.3 + bgX * 0.2) % W, sy = (i * 89.7) % (H - GROUND_H - 40);
      ctx.globalAlpha = 0.25 + 0.55 * Math.abs(Math.sin(i * 3.1 + performance.now() / 900));
      ctx.fillRect(sx < 0 ? sx + W : sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
    // far buildings (parallax layer 1)
    drawCity(bgX * 0.35, H - GROUND_H, '#0d1330', 90, 0.55);
    // near buildings (parallax layer 2)
    drawCity(bgX * 0.7, H - GROUND_H, '#111a3d', 120, 0.8);
    // lit windows
    ctx.fillStyle = 'rgba(255,214,100,0.5)';
    for (let i = 0; i < 26; i++) {
      const wx = (i * 211.7 + bgX * 0.7) % W;
      const wy = 60 + (i * 53.3) % (H - GROUND_H - 120);
      ctx.globalAlpha = 0.25 + 0.3 * Math.abs(Math.sin(i * 7.7));
      ctx.fillRect(wx < 0 ? wx + W : wx, wy, 5, 7);
    }
    ctx.globalAlpha = 1;
  }

  function drawCity(off, baseY, color, maxH, alpha) {
    ctx.fillStyle = color; ctx.globalAlpha = alpha;
    const bw = 64;
    for (let x = -bw; x < W + bw; x += bw) {
      const bx = x + (off % bw);
      const h = 60 + ((Math.abs(Math.sin(bx * 12.9898)) * 43758.5453) % 1) * maxH;
      ctx.fillRect(bx, baseY - h, bw - 10, h);
    }
    ctx.globalAlpha = 1;
  }

  function drawGround() {
    const gy = H - GROUND_H;
    const g = ctx.createLinearGradient(0, gy, 0, H);
    g.addColorStop(0, '#1c2b1a'); g.addColorStop(1, '#0a120a');
    ctx.fillStyle = g; ctx.fillRect(0, gy, W, GROUND_H);
    // scrolling stripes
    ctx.fillStyle = 'rgba(166,255,0,0.25)';
    for (let x = -40; x < W + 40; x += 40) {
      const sx = x + (groundX % 40);
      ctx.fillRect(sx, gy, 18, 8);
    }
    ctx.fillStyle = 'rgba(166,255,0,0.5)';
    ctx.fillRect(0, gy, W, 3);
  }

  function drawPipes() {
    pipes.forEach(p => {
      const topB = p.gapY - p.gap / 2, botT = p.gapY + p.gap / 2;
      pipeRect(p.x, 0, PIPE_W, topB - 14, true);
      pipeRect(p.x, botT + 14, PIPE_W, H - GROUND_H - botT - 14, false);
      // caps
      pipeCap(p.x - 5, topB - 30, PIPE_W + 10, 30);
      pipeCap(p.x - 5, botT, PIPE_W + 10, 30);
    });
  }

  function pipeRect(x, y, w, h, isTop) {
    if (h <= 0) return;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#1d7a2f'); g.addColorStop(0.5, '#37d957'); g.addColorStop(1, '#1d7a2f');
    A.neonOn(ctx, '#37d957', 10);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    A.neonOff(ctx);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 8, y + 4, 8, Math.max(0, h - 8));
  }

  function pipeCap(x, y, w, h) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#27a03d'); g.addColorStop(0.5, '#4be86a'); g.addColorStop(1, '#27a03d');
    A.neonOn(ctx, '#4be86a', 12);
    ctx.fillStyle = g;
    A.rr(ctx, x, y, w, h, 6); ctx.fill();
    A.neonOff(ctx);
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rot);
    // body
    A.neonOn(ctx, '#ffd23f', 16);
    const bg = ctx.createLinearGradient(0, -bird.r, 0, bird.r);
    bg.addColorStop(0, '#ffe066'); bg.addColorStop(1, '#ff9f1c');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 0, bird.r + 3, bird.r, 0, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);
    // wing (animated)
    const wa = Math.sin(wing) * 0.9;
    ctx.save();
    ctx.translate(-4, 2); ctx.rotate(-0.4 - wa * 0.5);
    ctx.fillStyle = '#e08900';
    ctx.beginPath(); ctx.ellipse(-6, 0, 11, 6, 0, 0, A.TAU); ctx.fill();
    ctx.restore();
    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(8, -6, 6, 0, A.TAU); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(10, -6, 2.8, 0, A.TAU); ctx.fill();
    // beak
    ctx.fillStyle = '#ff5d3b';
    ctx.beginPath(); ctx.moveTo(17, -2); ctx.lineTo(26, 2); ctx.lineTo(17, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.save();
    drawBackground();
    drawPipes();
    drawGround();
    if (state !== 'over' || flash < 0.9) drawBird();
    particles.draw(ctx);
    floaters.draw(ctx);
    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.7) + ')'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();

    if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  const loop = A.createLoop(update, render);

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('flappyModal').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); flap(); }
    else if (k === 'p') togglePause();
  });
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); flap(); });
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); flap(); }, { passive: false });

  A.registerModalGame('flappyModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show(' <div class="go-title">FLAPPY</div><div class="go-sub">click / tap / space to flap</div>'); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(document.getElementById('flappyModal'));
  reset(); render();
})();
