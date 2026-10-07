/* Number Guess — 1 to 100, 7 tries, hotter/colder hints,
 * guess history with temperature chips. */
(function () {
  'use strict';
  const A = Arcade;
  const input = document.getElementById('ngInput');
  const goBtn = document.getElementById('ngGo');
  const newBtn = document.getElementById('ngNew');
  const msgEl = document.getElementById('ngMsg');
  const histEl = document.getElementById('ngHistory');

  const MAX_TRIES = 7;
  let target, tries, over, wins, played;

  function reset() {
    target = A.randi(1, 100);
    tries = 0; over = false;
    wins = A.store.get('ngWins', 0);
    histEl.innerHTML = '';
    input.value = '';
    msgEl.style.color = '#00f0ff';
    msgEl.textContent = 'Make your first guess.' + (wins > 0 ? ' (Wins: ' + wins + ')' : '');
    input.focus();
  }

  function tempChip(diff) {
    if (diff <= 3) return 'hot';
    if (diff <= 10) return 'warm';
    return 'cold';
  }

  function tempWord(diff) {
    if (diff <= 3) return 'SCORCHING';
    if (diff <= 10) return 'WARM';
    if (diff <= 25) return 'COOL';
    return 'ICE COLD';
  }

  function guess() {
    if (over) return;
    const v = parseInt(input.value, 10);
    if (!v || v < 1 || v > 100) {
      msgEl.style.color = '#ff6b6b';
      msgEl.textContent = 'Enter a number from 1 to 100.';
      A.sfx.bad();
      return;
    }
    tries++;
    const diff = Math.abs(v - target);
    const chip = document.createElement('span');
    chip.className = 'ng-chip ' + tempChip(diff);
    chip.textContent = v + (v === target ? ' ✓' : v < target ? ' ↑' : ' ↓');
    histEl.appendChild(chip);

    if (v === target) {
      over = true;
      wins++;
      A.store.set('ngWins', wins);
      msgEl.style.color = '#a6ff00';
      msgEl.textContent = '🎯 Nailed it in ' + tries + (tries === 1 ? ' try!' : ' tries!') + ' Total wins: ' + wins;
      A.sfx.win();
      return;
    }
    if (tries >= MAX_TRIES) {
      over = true;
      msgEl.style.color = '#ff6b6b';
      msgEl.textContent = 'Out of tries — it was ' + target + '. Hit NEW GAME.';
      A.sfx.lose();
      return;
    }
    const dir = v < target ? 'Higher' : 'Lower';
    msgEl.style.color = diff <= 10 ? '#ffb300' : '#00f0ff';
    msgEl.textContent = dir + '… ' + tempWord(diff) + '. ' + (MAX_TRIES - tries) + ' left.';
    A.sfx.tick();
    input.value = '';
    input.focus();
  }

  goBtn.addEventListener('click', () => { A.sfx.unlock(); guess(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') guess(); });
  newBtn.addEventListener('click', () => { A.sfx.click(); reset(); });

  A.registerModalGame('ngModal', { onOpen() { reset(); }, onClose() {} });
  reset();
})();
