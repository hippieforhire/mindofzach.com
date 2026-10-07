/* Pong — neon overhaul. Spin physics, adaptive AI, ball trails,
 * particle hits, first to 7. */
(function () {
  'use strict';
  const A = Arcade;
  const canvas = document.getElementById('pongCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('pongScore');
  const hiEl = document.getElementById('pongHi');
  const pauseBtn = document.getElementById('pongPause');

  const W = 720, H = 420;
  A.fitCanvas(canvas, W, H);

  const particles = new A.Particles();
  const floaters = new A.Floaters();
  const shake = new A.Shake();

  const WIN_SCORE = 7;
  const PADDLE_W = 12, PADDLE_H = 84;

  let player, cpu, ball, playerScore, cpuScore, state, rally, best, newBest;
  let aiSkill; // 0..1, ramps as player scores

  const startOverlay = A.wireStartOverlay('pongModal', startGame);
  const overOverlay = A.gameOverOverlay('pongModal');

  function resetPositions(serveDir) {
    player.y = H / 2 - PADDLE_H / 2;
    cpu.y = H / 2 - PADDLE_H / 2;
    ball.x = W / 2; ball.y = H / 2;
    const ang = A.rand(-0.5, 0.5) + (serveDir < 0 ? Math.PI : 0);
    const sp = 340;
    ball.vx = Math.cos(ang) * sp * (serveDir < 0 ? -1 : 1);
    ball.vy = Math.sin(ang) * sp;
    ball.trail.length = 0;
    rally = 0;
  }

  function reset() {
    player = { x: 18, y: H / 2 - PADDLE_H / 2, dy: 0 };
    cpu = { x: W - 18 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
    ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 9, trail: [] };
    playerScore = 0; cpuScore = 0; rally = 0; newBest = false;
    aiSkill = 0.45;
    best = A.getHi('pong');
    hiEl.textContent = best;
    state = 'ready';
    particles.clear(); floaters.clear();
    paintScore();
  }

  function startGame() {
    reset();
    A.bumpPlays('pong');
    resetPositions(Math.random() < 0.5 ? -1 : 1);
    state = 'playing';
    loop.start();
  }

  function paintScore() {
    scoreEl.innerHTML = 'YOU ' + playerScore + ' : ' + cpuScore + ' CPU';
  }

  function paddleBounce(p, isPlayer) {
    const rel = A.clamp((ball.y - (p.y + PADDLE_H / 2)) / (PADDLE_H / 2), -1, 1);
    const maxAng = Math.PI * 0.42;
    const ang = rel * maxAng;
    const speed = Math.min(760, Math.hypot(ball.vx, ball.vy) * 1.045 + 8);
    const dir = isPlayer ? 1 : -1;
    ball.vx = Math.cos(ang) * speed * dir;
    ball.vy = Math.sin(ang) * speed;
    ball.x = isPlayer ? p.x + PADDLE_W + ball.r + 1 : p.x - ball.r - 1;
    rally++;
    particles.burst(ball.x, ball.y, { n: 10, colors: [isPlayer ? '#00f0ff' : '#ff2fd6', '#ffffff'], speed: 200, life: 0.4, size: 3 });
    floaters.add(ball.x, ball.y - 18, 'x' + rally, isPlayer ? '#00f0ff' : '#ff2fd6', 14);
    if (rally % 10 === 0) { A.sfx.power(); floaters.add(W / 2, H / 2 - 40, 'RALLY x' + rally, '#ffd700', 22); }
    else A.sfx.pop();
  }

  function point(winner) {
    if (winner === 'player') {
      playerScore++;
      A.sfx.good();
      aiSkill = Math.min(0.92, aiSkill + 0.04);
      floaters.add(W / 2, H / 2, '+1', '#a6ff00', 26);
    } else {
      cpuScore++;
      A.sfx.bad();
      shake.add(0.3);
      floaters.add(W / 2, H / 2, 'CPU +1', '#ff6b6b', 26);
    }
    if (A.setHi('pong', playerScore)) { newBest = true; hiEl.textContent = playerScore; }
    paintScore();
    if (playerScore >= WIN_SCORE) return endGame(true);
    if (cpuScore >= WIN_SCORE) return endGame(false);
    resetPositions(winner === 'player' ? 1 : -1);
  }

  function endGame(won) {
    state = 'over';
    if (won) A.sfx.win(); else A.sfx.lose();
    particles.burst(W / 2, H / 2, { n: 60, colors: won ? ['#a6ff00', '#00f0ff', '#ffffff'] : ['#ff3355', '#ff2fd6', '#ffffff'], speed: 380, life: 1, size: 5 });
    setTimeout(() => {
      overOverlay.show(
        '<div class="go-title' + (won ? '' : ' lost') + '">' + (won ? 'YOU WIN' : 'CPU WINS') + '</div>' +
        '<div class="go-score">' + playerScore + ' — ' + cpuScore + '</div>' +
        (newBest && won ? '<div class="go-best">★ NEW BEST ★</div>' : '') +
        '<button class="go-btn" id="pongRetry">PLAY AGAIN</button>'
      );
      document.getElementById('pongRetry').onclick = () => { overOverlay.hide(); startGame(); };
      loop.stop();
    }, 700);
  }

  function update(dt) {
    if (state !== 'playing') return;

    // player
    player.y += player.dy * dt;
    player.y = A.clamp(player.y, 0, H - PADDLE_H);

    // cpu AI — tracks ball with skill-based error and reaction lag
    const target = ball.y - PADDLE_H / 2;
    const err = (1 - aiSkill) * 70;
    const aimY = target + Math.sin(performance.now() / 700) * err * 0.4;
    const diff = aimY - cpu.y;
    const cpuSpeed = 200 + aiSkill * 260;
    cpu.y += A.clamp(diff, -cpuSpeed * dt, cpuSpeed * dt);
    cpu.y = A.clamp(cpu.y, 0, H - PADDLE_H);

    // ball
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 14) ball.trail.shift();

    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = -ball.vy; A.sfx.tick(); }
    if (ball.y + ball.r > H) { ball.y = H - ball.r; ball.vy = -ball.vy; A.sfx.tick(); }

    // paddle collisions
    if (ball.vx < 0 && ball.x - ball.r < player.x + PADDLE_W && ball.x > player.x &&
        ball.y > player.y - 4 && ball.y < player.y + PADDLE_H + 4) paddleBounce(player, true);
    if (ball.vx > 0 && ball.x + ball.r > cpu.x && ball.x < cpu.x + PADDLE_W &&
        ball.y > cpu.y - 4 && ball.y < cpu.y + PADDLE_H + 4) paddleBounce(cpu, false);

    // scoring
    if (ball.x < -30) point('cpu');
    else if (ball.x > W + 30) point('player');

    particles.update(dt); floaters.update(dt); shake.update(dt);
  }

  function render() {
    ctx.save();
    const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, '#0a0a20'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    shake.apply(ctx);

    // center line
    ctx.strokeStyle = 'rgba(0,240,255,0.25)'; ctx.lineWidth = 3; ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(W / 2, 10); ctx.lineTo(W / 2, H - 10); ctx.stroke();
    ctx.setLineDash([]);

    // paddles
    A.neonOn(ctx, '#00f0ff', 16);
    ctx.fillStyle = '#00f0ff';
    A.rr(ctx, player.x, player.y, PADDLE_W, PADDLE_H, 6); ctx.fill();
    A.neonOn(ctx, '#ff2fd6', 16);
    ctx.fillStyle = '#ff2fd6';
    A.rr(ctx, cpu.x, cpu.y, PADDLE_W, PADDLE_H, 6); ctx.fill();
    A.neonOff(ctx);

    // ball trail
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ball.trail.forEach((t, i) => {
      const a = (i + 1) / ball.trail.length;
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = '#9df3ff';
      ctx.beginPath(); ctx.arc(t.x, t.y, ball.r * a * 0.9, 0, A.TAU); ctx.fill();
    });
    ctx.restore();

    // ball
    A.neonOn(ctx, '#ffffff', 20);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, A.TAU); ctx.fill();
    A.neonOff(ctx);

    particles.draw(ctx);
    floaters.draw(ctx);

    // big score
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.font = '900 120px Orbitron, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(playerScore, W / 2 - 90, 110);
    ctx.fillText(cpuScore, W / 2 + 90, 110);
    ctx.restore();

    ctx.restore();

    if (state === 'paused') {
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,12,0.6)'; ctx.fillRect(0, 0, W, H);
      A.glowText(ctx, 'PAUSED', W / 2, H / 2, '900 44px Orbitron, sans-serif', '#00f0ff');
      ctx.restore();
    }
  }

  const loop = A.createLoop(update, render);

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('pongModal').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') player.dy = -420;
    else if (k === 's' || k === 'arrowdown') player.dy = 420;
    else if (k === 'p' || k === ' ') togglePause();
  });
  document.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (['w', 's', 'arrowup', 'arrowdown'].indexOf(k) >= 0) player.dy = 0;
  });

  function togglePause() {
    if (state === 'playing') { state = 'paused'; pauseBtn.textContent = '▶'; }
    else if (state === 'paused') { state = 'playing'; pauseBtn.textContent = '⏸'; }
  }
  pauseBtn.addEventListener('click', togglePause);

  A.bindHold(document.getElementById('pongUp'), () => { player.dy = -420; }, () => { player.dy = 0; });
  A.bindHold(document.getElementById('pongDown'), () => { player.dy = 420; }, () => { player.dy = 0; });

  // drag paddle directly on canvas
  let dragging = false;
  function dragTo(e) {
    const r = canvas.getBoundingClientRect();
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
    player.y = A.clamp(y / r.height * H - PADDLE_H / 2, 0, H - PADDLE_H);
  }
  canvas.addEventListener('mousedown', (e) => { dragging = true; dragTo(e); });
  canvas.addEventListener('mousemove', (e) => { if (dragging) dragTo(e); });
  window.addEventListener('mouseup', () => { dragging = false; });
  canvas.addEventListener('touchstart', (e) => { dragging = true; dragTo(e); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (dragging) { e.preventDefault(); dragTo(e); } }, { passive: false });
  canvas.addEventListener('touchend', () => { dragging = false; });

  A.registerModalGame('pongModal', {
    onOpen() { reset(); overOverlay.hide(); startOverlay.show(); loop.stop(); state = 'ready'; render(); },
    onClose() { loop.stop(); startOverlay.hide(); overOverlay.hide(); }
  });
  A.trapGameKeys(document.getElementById('pongModal'));
  reset(); render();
})();
