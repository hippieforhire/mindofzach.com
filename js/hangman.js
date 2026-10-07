/* Hangman — fixed + reskinned. Themed word packs, animated figure,
 * streak scoring, keyboard + on-screen keys. */
(function () {
  'use strict';
  const A = Arcade;
  const canvas = document.getElementById('hangmanCanvas');
  const ctx = canvas.getContext('2d');
  const wordEl = document.getElementById('hangmanWord');
  const msgEl = document.getElementById('hangmanMessage');
  const kbEl = document.getElementById('hangmanKeyboard');
  const startBtn = document.getElementById('startHangmanButton');

  const W = 480, H = 300;
  A.fitCanvas(canvas, W, H);

  const PACKS = {
    'HORROR FLICKS': ['psycho', 'alien', 'jaws', 'scream', 'halloween', 'candyman', 'poltergeist', 'insidious', 'hereditary', 'nosferatu'],
    'ARCADE CLASSICS': ['pacman', 'tetris', 'frogger', 'galaga', 'digdug', 'qbert', 'asteroids', 'defender', 'joust', 'centipede'],
    'SPACE': ['galaxy', 'nebula', 'quasar', 'eclipse', 'comet', 'astronaut', 'satellite', 'supernova', 'wormhole', 'telescope'],
    'EVERYDAY': ['javascript', 'puzzle', 'mystery', 'rainbow', 'guitar', 'volcano', 'thunder', 'lantern', 'meadow', 'rocket']
  };
  const MAX_WRONG = 6;

  let word, pack, guessed, wrong, state, streak, drawStep, drawAnim;

  const startOverlay = A.wireStartOverlay('hangmanModal', startGame);

  function reset() {
    state = 'ready'; word = ''; pack = '';
    guessed = []; wrong = 0; drawStep = 0; drawAnim = 0;
    streak = A.store.get('hangmanStreak', 0);
    kbEl.innerHTML = ''; wordEl.textContent = ''; msgEl.textContent = '';
    render();
  }

  function startGame() {
    const names = Object.keys(PACKS);
    pack = A.choice(names);
    word = A.choice(PACKS[pack]);
    guessed = []; wrong = 0; drawStep = 0; drawAnim = 0;
    state = 'playing';
    msgEl.textContent = 'Category: ' + pack;
    msgEl.style.color = '#8b93b8';
    buildKeyboard();
    updateWord();
    render();
    A.sfx.click();
  }

  function buildKeyboard() {
    kbEl.innerHTML = '';
    'abcdefghijklmnopqrstuvwxyz'.split('').forEach(L => {
      const b = document.createElement('button');
      b.className = 'kb-key'; b.textContent = L.toUpperCase();
      b.addEventListener('click', () => guess(L, b));
      kbEl.appendChild(b);
    });
  }

  function guess(L, btn) {
    if (state !== 'playing' || guessed.indexOf(L) >= 0) return;
    guessed.push(L);
    const good = word.indexOf(L) >= 0;
    if (btn) { btn.disabled = true; btn.classList.add(good ? 'right' : 'wrong'); }
    if (good) {
      A.sfx.good();
      // reveal pop
      wordEl.style.transform = 'scale(1.06)';
      setTimeout(() => { wordEl.style.transform = ''; }, 130);
    } else {
      wrong++;
      drawAnim = 0;
      A.sfx.bad();
      shakeGallows();
    }
    updateWord();
    checkEnd();
    render();
  }

  function shakeGallows() {
    canvas.style.transform = 'translateX(0)';
    canvas.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
      { duration: 220 }
    );
  }

  function updateWord() {
    wordEl.textContent = word.split('').map(L => (guessed.indexOf(L) >= 0 ? L : '_')).join(' ');
  }

  function checkEnd() {
    if (word.split('').every(L => guessed.indexOf(L) >= 0)) {
      state = 'over';
      streak++;
      A.store.set('hangmanStreak', streak);
      A.sfx.win();
      msgEl.style.color = '#a6ff00';
      msgEl.textContent = 'You got it! The word was "' + word.toUpperCase() + '". Streak: ' + streak;
      celebrate();
    } else if (wrong >= MAX_WRONG) {
      state = 'over';
      drawAnim = 1; // ensure the final segment is fully drawn
      streak = 0;
      A.store.set('hangmanStreak', streak);
      A.sfx.lose();
      msgEl.style.color = '#ff6b6b';
      msgEl.textContent = 'Out of guesses — the word was "' + word.toUpperCase() + '".';
      updateWord();
      // reveal the word
      wordEl.textContent = word.split('').join(' ');
    }
  }

  function celebrate() {
    let n = 0;
    const iv = setInterval(() => {
      if (n++ > 5 || state !== 'over') { clearInterval(iv); return; }
      confettiBurst();
    }, 280);
  }

  function confettiBurst() {
    for (let i = 0; i < 24; i++) {
      const x = Math.random() * W;
      setTimeout(() => {
        ctx.save();
        ctx.fillStyle = A.choice(['#00f0ff', '#ff2fd6', '#a6ff00', '#ffd700']);
        ctx.fillRect(x, -10, 7, 7);
        ctx.restore();
      }, 0);
    }
  }

  /* ----- gallows rendering (neon, animated draw-in) ----- */
  function render() {
    ctx.clearRect(0, 0, W, H);
    // backdrop
    const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.6);
    g.addColorStop(0, '#0b0f24'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    A.neonOn(ctx, '#00f0ff', 12);

    const bx = 110, base = 268, top = 36, armX = 300;
    // draw progressively with a quick draw-in animation
    drawAnim = Math.min(1, drawAnim + 0.06);
    const segs = [
      () => { line(bx - 70, base, bx + 70, base); },                       // base
      () => { line(bx, base, bx, top); },                                   // pole
      () => { line(bx, top, armX, top); line(armX, top, armX, top + 34); },  // arm + rope
      () => { ctx.beginPath(); ctx.arc(armX, top + 62, 26, 0, A.TAU); ctx.stroke(); }, // head
      () => { line(armX, top + 88, armX, top + 168); },                      // body
      () => { line(armX, top + 108, armX - 40, top + 140); line(armX, top + 108, armX + 40, top + 140); }, // arms
      () => { line(armX, top + 168, armX - 36, top + 224); line(armX, top + 168, armX + 36, top + 224); }   // legs
    ];
    const showUpTo = Math.min(wrong, MAX_WRONG);
    for (let i = 0; i < showUpTo; i++) {
      if (i === showUpTo - 1) {
        // animate the newest segment drawing in
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65 * drawAnim;
        segs[i]();
        ctx.restore();
      } else segs[i]();
    }
    function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }

    // X eyes on death
    if (state === 'over' && wrong >= MAX_WRONG) {
      ctx.strokeStyle = '#ff3355';
      A.neonOn(ctx, '#ff3355', 10);
      const ex = armX, ey = top + 62;
      ctx.beginPath();
      ctx.moveTo(ex - 9, ey - 7); ctx.lineTo(ex - 1, ey + 1);
      ctx.moveTo(ex - 1, ey - 7); ctx.lineTo(ex - 9, ey + 1);
      ctx.moveTo(ex + 1, ey - 7); ctx.lineTo(ex + 9, ey + 1);
      ctx.moveTo(ex + 9, ey - 7); ctx.lineTo(ex + 1, ey + 1);
      ctx.stroke();
    }
    A.neonOff(ctx);
    ctx.restore();

    // wrong-guess pips
    ctx.save();
    for (let i = 0; i < MAX_WRONG; i++) {
      ctx.fillStyle = i < wrong ? '#ff3355' : 'rgba(255,255,255,0.12)';
      if (i < wrong) A.neonOn(ctx, '#ff3355', 8); else A.neonOff(ctx);
      ctx.beginPath(); ctx.arc(30 + i * 26, 26, 8, 0, A.TAU); ctx.fill();
    }
    A.neonOff(ctx);
    ctx.restore();

    // streak
    if (streak > 0) {
      ctx.save();
      ctx.font = '700 15px Orbitron, sans-serif'; ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd700';
      A.neonOn(ctx, '#ffd700', 8);
      ctx.fillText('STREAK ' + streak, W - 16, 30);
      ctx.restore();
    }

    if (state === 'playing') requestAnimationFrame(render);
  }

  startBtn.addEventListener('click', () => { startOverlay.hide(); startGame(); });

  document.addEventListener('keydown', (e) => {
    if (document.getElementById('hangmanModal').classList.contains('hidden')) return;
    const k = e.key.toLowerCase();
    if (/^[a-z]$/.test(k)) {
      const btns = kbEl.querySelectorAll('.kb-key');
      const btn = btns['abcdefghijklmnopqrstuvwxyz'.indexOf(k)];
      if (btn && !btn.disabled) guess(k, btn);
    } else if (k === 'enter' && state !== 'playing') { startOverlay.hide(); startGame(); }
  });

  A.registerModalGame('hangmanModal', {
    onOpen() { reset(); startOverlay.show('<div class="go-title">HANGMAN</div><div class="go-sub">click to pick a word pack</div>'); },
    onClose() { startOverlay.hide(); state = 'ready'; }
  });
  reset();
})();
