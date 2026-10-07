/* Rock Paper Scissors — animated showdown UI, best-of tracking,
 * a CPU with a mild pattern memory. */
(function () {
  'use strict';
  const A = Arcade;
  const youEl = document.getElementById('rpsYou');
  const cpuEl = document.getElementById('rpsCpu');
  const msgEl = document.getElementById('rpsMsg');
  const youScoreEl = document.getElementById('rpsYouScore');
  const cpuScoreEl = document.getElementById('rpsCpuScore');

  const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
  const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

  let you, cpu, history;

  function reset() {
    you = 0; cpu = 0; history = [];
    youEl.textContent = '❔'; cpuEl.textContent = '❔';
    msgEl.textContent = 'Pick your weapon.';
    msgEl.style.color = '#e8ecff';
    paint();
  }

  function paint() {
    youScoreEl.textContent = you;
    cpuScoreEl.textContent = cpu;
  }

  function cpuPick() {
    // mild pattern exploitation: if the player repeats, counter their last move
    if (history.length >= 2 && history[history.length - 1] === history[history.length - 2] && Math.random() < 0.55) {
      const last = history[history.length - 1];
      return Object.keys(BEATS).find(k => BEATS[k] === last); // the thing that beats their repeat... actually counter it
    }
    return A.choice(['rock', 'paper', 'scissors']);
  }

  function throwRound(playerChoice) {
    const cpuChoice = cpuPick();
    history.push(playerChoice);

    // shake animation
    [youEl, cpuEl].forEach(el => { el.classList.remove('shake-anim'); void el.offsetWidth; el.classList.add('shake-anim'); });
    youEl.textContent = '✊'; cpuEl.textContent = '✊';
    msgEl.textContent = '…';
    A.sfx.tick();

    setTimeout(() => {
      youEl.textContent = EMOJI[playerChoice];
      cpuEl.textContent = EMOJI[cpuChoice];
      let msg, color;
      if (playerChoice === cpuChoice) {
        msg = 'Tie. The machine respects that.'; color = '#8b93b8';
        A.sfx.tick();
      } else if (BEATS[playerChoice] === cpuChoice) {
        you++;
        const lines = ['Crushed it.', 'The machine is rattled.', 'Flawless victory (this round).', 'It never saw it coming.'];
        msg = A.choice(lines); color = '#a6ff00';
        A.sfx.good();
      } else {
        cpu++;
        const lines = ['The machine prevails.', 'It read you like a book.', 'Ouch. Regroup.', 'The CPU sends its regards.'];
        msg = A.choice(lines); color = '#ff6b6b';
        A.sfx.bad();
      }
      msgEl.textContent = msg;
      msgEl.style.color = color;
      paint();
      if (you === 3 || cpu === 3) {
        setTimeout(() => {
          msgEl.textContent = you === 3 ? '🏆 You take the series!' : '🤖 CPU takes the series. Rematch?';
          msgEl.style.color = you === 3 ? '#ffd700' : '#ff6b6b';
          if (you === 3) A.sfx.win(); else A.sfx.lose();
          you = 0; cpu = 0;
          setTimeout(paint, 100);
        }, 900);
      }
    }, 520);
  }

  document.querySelectorAll('[data-rps]').forEach(btn => {
    btn.addEventListener('click', () => { A.sfx.unlock(); throwRound(btn.dataset.rps); });
  });
  document.getElementById('rpsReset').addEventListener('click', reset);

  A.registerModalGame('rpsModal', { onOpen() { reset(); }, onClose() {} });
  reset();
})();
