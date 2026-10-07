// Zach's Wordle Game — themed daily wordle with real Wordle rules:
// guesses must fill every box and must be real words (or theme titles).
document.addEventListener('DOMContentLoaded', () => {
  'use strict';
  const A = window.Arcade;
  const wordleBoard = document.getElementById('wordleBoard');
  const wordleInput = document.getElementById('wordleInput');
  const wordleMessage = document.getElementById('wordleMessage');
  const startWordleButton = document.getElementById('startWordleButton');
  const powerUpButton = document.getElementById('powerUpButton');
  const powerUpChooser = document.getElementById('powerUpChooser');
  const puRevealBtn = document.getElementById('puReveal');
  const puGuessBtn = document.getElementById('puGuess');
  const wordleKeyboard = document.getElementById('wordleKeyboard');
  const currentThemeSpan = document.getElementById('currentTheme');
  const roundIndicator = document.getElementById('roundIndicator');
  const correctGuessMessage = document.getElementById('correctGuessMessage');
  const confettiContainer = document.getElementById('confetti');
  const progressBar = document.getElementById('progressBar');
  const resetButton = document.getElementById('resetButton');
  const rulesButton = document.getElementById('rulesButton');

  const THEMES = [
    { theme: "Famous Movies", words: ["alien", "psycho", "titanic"], anagram: "cinema" },
    { theme: "Famous Bands", words: ["queen", "weezer", "nirvana"], anagram: "winter" },
    { theme: "Country or State Capitals", words: ["texas", "berlin", "jakarta"], anagram: "county" },
    { theme: "Common Cat Names", words: ["salem", "oliver", "smokey"], anagram: "cocoa" },
    { theme: "Car Types/Models", words: ["civic", "accord", "mustang"], anagram: "civic" },
    { theme: "Common Dog Names", words: ["buddy", "bailey", "charlie"], anagram: "buddy" },
    { theme: "American Cuisine", words: ["cajun", "burger", "hotdogs"], anagram: "bunch" }
  ];

  // Real daily rotation: theme changes every UTC day.
  function utcDayString() {
    const d = new Date();
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  const dayIndex = Math.floor(Date.now() / 86400000) % THEMES.length;
  const gameData = THEMES[dayIndex];
  const theme = gameData.theme;
  const words = gameData.words;
  const anagram = gameData.anagram;

  let currentRound = 0;
  const totalRounds = words.length;
  let usedPowerUp = false;
  let secretWord = words[currentRound].toLowerCase();
  let wordLength = secretWord.length;
  let maxGuesses = 6;
  let guesses = [];
  let typed = '';          // letters typed into non-revealed slots
  let revealed = {};       // pos -> letter, locked in by the reveal power-up
  let gameOver = false;
  let anagramGuess = '';
  let anagramFound = false;

  function freeSlots() {
    let n = 0;
    for (let i = 0; i < wordLength; i++) if (!(i in revealed)) n++;
    return n;
  }

  function initializeWordleGame() {
    currentRound = 0;
    startRound();
    wordleMessage.textContent = 'Theme: ' + theme;
    displayClickableTheme();
    showRoundIndicator();
  }

  function startRound() {
    usedPowerUp = false;
    anagramFound = false;
    secretWord = words[currentRound].toLowerCase();
    wordLength = secretWord.length;
    maxGuesses = 6;
    guesses = [];
    typed = '';
    revealed = {};
    anagramGuess = '';
    gameOver = false;
    createBoard();
    createKeyboard();
    renderCurrentRow();
    wordleInput.disabled = false;
    wordleInput.value = '';
    if (powerUpChooser) powerUpChooser.classList.add('hidden');
    powerUpButton.disabled = false;
    powerUpButton.textContent = 'POWER-UP';
    updateProgressBar();
  }

  function createBoard() {
    wordleBoard.innerHTML = '';
    for (let i = 0; i < maxGuesses; i++) {
      const row = document.createElement('div');
      row.classList.add('wordle-row');
      row.style.gridTemplateColumns = 'repeat(' + wordLength + ', 1fr)';
      for (let j = 0; j < wordLength; j++) {
        const cell = document.createElement('div');
        cell.classList.add('wordle-cell');
        row.appendChild(cell);
      }
      wordleBoard.appendChild(row);
    }
  }

  function addExtraRow() {
    const row = document.createElement('div');
    row.classList.add('wordle-row');
    row.style.gridTemplateColumns = 'repeat(' + wordLength + ', 1fr)';
    for (let j = 0; j < wordLength; j++) {
      const cell = document.createElement('div');
      cell.classList.add('wordle-cell');
      row.appendChild(cell);
    }
    wordleBoard.appendChild(row);
  }

  function createKeyboard() {
    wordleKeyboard.innerHTML = '';
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    rows.forEach((keys, ri) => {
      const row = document.createElement('div');
      row.className = 'wrow';
      if (ri === 2) {
        const ent = document.createElement('button');
        ent.className = 'wordle-key wide'; ent.textContent = 'ENTER';
        ent.addEventListener('click', () => handleKeyPress('Ent'));
        row.appendChild(ent);
      }
      keys.split('').forEach(k => row.appendChild(createKeyButton(k)));
      if (ri === 2) {
        const bck = document.createElement('button');
        bck.className = 'wordle-key wide'; bck.textContent = '←';
        bck.addEventListener('click', () => handleKeyPress('BCK'));
        row.appendChild(bck);
      }
      wordleKeyboard.appendChild(row);
    });
  }

  function createKeyButton(key) {
    const b = document.createElement('button');
    b.className = 'wordle-key';
    b.textContent = key;
    b.dataset.key = key;
    b.addEventListener('click', () => handleKeyPress(key));
    return b;
  }

  function keyButtonFor(letter) {
    return wordleKeyboard.querySelector('.wordle-key[data-key="' + letter.toUpperCase() + '"]');
  }

  function updateKeyboard() {
    guesses.forEach(guessObj => {
      const guess = guessObj.guess, feedback = guessObj.feedback;
      guess.split('').forEach((letter, index) => {
        const kb = keyButtonFor(letter);
        if (!kb) return;
        if (feedback[index] === 'correct') {
          kb.classList.remove('present', 'absent');
          kb.classList.add('correct');
        } else if (feedback[index] === 'present') {
          if (!kb.classList.contains('correct')) { kb.classList.remove('absent'); kb.classList.add('present'); }
        } else {
          if (!kb.classList.contains('correct') && !kb.classList.contains('present')) kb.classList.add('absent');
        }
      });
    });
  }

  wordleInput.addEventListener('keydown', (e) => {
    if (gameOver) return;
    if (e.key === 'Enter') { e.preventDefault(); submitGuess(); }
    else if (e.key === 'Backspace') { typed = typed.slice(0, -1); renderCurrentRow(); }
    else if (/^[a-zA-Z]$/.test(e.key) && typed.length < freeSlots()) {
      typed += e.key.toUpperCase();
      renderCurrentRow();
      if (A) A.sfx.tick();
    }
  });

  function handleKeyPress(key) {
    if (gameOver) return;
    if (key === 'Ent') submitGuess();
    else if (key === 'BCK') { typed = typed.slice(0, -1); renderCurrentRow(); }
    else if (/^[A-Z]$/.test(key) && typed.length < freeSlots()) {
      typed += key;
      renderCurrentRow();
      if (A) A.sfx.tick();
    }
  }

  // Paint the active row: revealed (locked) letters + typed letters.
  function renderCurrentRow() {
    const row = wordleBoard.children[guesses.length];
    if (!row) return;
    let ti = 0;
    Array.from(row.children).forEach((cell, i) => {
      cell.classList.remove('hint', 'pop');
      if (i in revealed) {
        cell.textContent = revealed[i].toUpperCase();
        cell.classList.add('hint');
      } else {
        cell.textContent = typed[ti] || '';
        if (typed[ti]) { cell.classList.add('pop'); setTimeout(() => cell.classList.remove('pop'), 180); }
        ti++;
      }
    });
  }

  // Compose the full guess from revealed + typed letters, in position order.
  function buildGuess() {
    let ti = 0, out = '';
    for (let i = 0; i < wordLength; i++) {
      if (i in revealed) out += revealed[i];
      else out += (typed[ti++] || '').toLowerCase();
    }
    return out;
  }

  function shakeRow() {
    const row = wordleBoard.children[guesses.length];
    if (!row) return;
    row.classList.remove('row-shake');
    void row.offsetWidth;
    row.classList.add('row-shake');
    setTimeout(() => row.classList.remove('row-shake'), 500);
    if (A) A.sfx.bad();
  }

  function submitGuess() {
    if (gameOver) return;
    const guess = buildGuess();

    if (guess.length !== wordLength) {
      wordleMessage.textContent = 'Not enough letters — fill every box.';
      shakeRow();
      return;
    }
    if (!window.Wordlist || !window.Wordlist.isWord(guess, theme)) {
      wordleMessage.textContent = '"' + guess.toUpperCase() + '" is not in the word list.';
      shakeRow();
      return;
    }

    const feedback = getFeedback(guess);
    guesses.push({ guess, feedback });
    updateBoardColors(feedback);
    updateKeyboard();
    typed = '';
    renderCurrentRow();
    wordleMessage.textContent = '';
    updateProgressBar();
    if (A) A.sfx.pop();

    if (guess === secretWord) {
      wordleMessage.textContent = "Correct! Nice work.";
      wordleInput.disabled = true;
      powerUpButton.disabled = true;
      if (powerUpChooser) powerUpChooser.classList.add('hidden');
      displayCorrectGuess();
      triggerConfetti();
      if (A) A.sfx.win();
      setTimeout(() => proceedToNextRound(true), 1600);
      saveGameState(true);
      return;
    }

    if (guesses.length >= maxGuesses) {
      wordleMessage.textContent = 'Out of guesses! The word was "' + secretWord.toUpperCase() + '".';
      wordleInput.disabled = true;
      powerUpButton.disabled = true;
      if (powerUpChooser) powerUpChooser.classList.add('hidden');
      if (A) A.sfx.lose();
      setTimeout(() => proceedToNextRound(false), 1800);
      saveGameState(false);
      return;
    }
  }

  function getFeedback(guess) {
    const feedback = Array(wordLength).fill('absent');
    const secretArr = secretWord.split('');
    for (let i = 0; i < wordLength; i++) {
      if (guess[i] === secretArr[i]) { feedback[i] = 'correct'; secretArr[i] = null; }
    }
    for (let i = 0; i < wordLength; i++) {
      if (feedback[i] === 'correct') continue;
      const idx = secretArr.indexOf(guess[i]);
      if (idx !== -1) { feedback[i] = 'present'; secretArr[idx] = null; }
    }
    return feedback;
  }

  function updateBoardColors(feedback) {
    const row = wordleBoard.children[guesses.length - 1];
    Array.from(row.children).forEach((cell, i) => {
      cell.classList.remove('hint');
      void cell.offsetWidth;
      cell.classList.add(feedback[i], 'flip');
      setTimeout(() => cell.classList.remove('flip'), 650);
    });
  }

  /* ---------- power-ups (no prompt dialogs) ---------- */
  powerUpButton.addEventListener('click', () => {
    if (gameOver || powerUpButton.disabled) return;
    if (usedPowerUp) { wordleMessage.textContent = 'Power-up already used this round.'; return; }
    powerUpChooser.classList.toggle('hidden');
    if (A) A.sfx.click();
  });

  puRevealBtn.addEventListener('click', () => {
    powerUpChooser.classList.add('hidden');
    if (usedPowerUp || gameOver) return;
    const options = [];
    for (let i = 0; i < wordLength; i++) if (!(i in revealed)) options.push(i);
    if (!options.length) return;
    const pos = options[Math.floor(Math.random() * options.length)];
    revealed[pos] = secretWord[pos];
    usedPowerUp = true;
    powerUpButton.disabled = true;
    const kb = keyButtonFor(secretWord[pos]);
    if (kb) { kb.classList.remove('present', 'absent'); kb.classList.add('correct'); }
    wordleMessage.textContent = 'Revealed: "' + secretWord[pos].toUpperCase() + '" is locked in.';
    renderCurrentRow();
    if (A) A.sfx.power();
  });

  puGuessBtn.addEventListener('click', () => {
    powerUpChooser.classList.add('hidden');
    if (usedPowerUp || gameOver) return;
    usedPowerUp = true;
    powerUpButton.disabled = true;
    maxGuesses += 1;
    addExtraRow();
    wordleMessage.textContent = 'Extra guess added!';
    updateProgressBar();
    if (A) A.sfx.power();
  });

  function proceedToNextRound(won) {
    if (won && currentRound < totalRounds - 1) {
      currentRound++;
      startRound();
      wordleMessage.textContent = 'Round ' + (currentRound + 1) + ': ' + theme;
      displayClickableTheme();
      showRoundIndicator();
      wordleInput.focus();
    } else {
      wordleMessage.textContent += won ? ' You cleared every round!' : ' Game over.';
      gameOver = true;
    }
  }

  function saveGameState(won) {
    try {
      localStorage.setItem('wordle_last_played', utcDayString());
      localStorage.setItem('wordle_won', won ? '1' : '0');
    } catch (e) {}
  }

  function hasPlayedToday() {
    try { return localStorage.getItem('wordle_last_played') === utcDayString(); }
    catch (e) { return false; }
  }

  startWordleButton.addEventListener('click', () => {
    if (hasPlayedToday()) {
      wordleMessage.textContent = "Already played today's game — come back tomorrow.";
      wordleInput.disabled = true;
      powerUpButton.disabled = true;
      return;
    }
    if (A) A.sfx.click();
    initializeWordleGame();
    wordleInput.focus();
  });

  rulesButton.addEventListener('click', () => {
    const rulesModal = document.getElementById('rulesModal');
    rulesModal.classList.remove('hidden');
  });

  resetButton.addEventListener('click', () => {
    try { localStorage.removeItem('wordle_last_played'); } catch (e) {}
    initializeWordleGame();
    wordleMessage.textContent = 'Fresh game — daily lock cleared.';
    wordleInput.focus();
  });

  function showRoundIndicator() {
    roundIndicator.textContent = 'Round ' + (currentRound + 1) + ' of ' + totalRounds;
    roundIndicator.classList.remove('animate-fade-out');
    roundIndicator.classList.add('animate-fade-in');
    setTimeout(() => {
      roundIndicator.classList.remove('animate-fade-in');
      roundIndicator.classList.add('animate-fade-out');
    }, 2500);
  }

  function displayCorrectGuess() {
    correctGuessMessage.textContent = 'Correct!';
    correctGuessMessage.style.display = 'flex';
    correctGuessMessage.classList.remove('hidden');
    correctGuessMessage.classList.add('animate-fade-in');
    setTimeout(() => {
      correctGuessMessage.classList.remove('animate-fade-in');
      correctGuessMessage.classList.add('animate-fade-out');
      setTimeout(() => {
        correctGuessMessage.classList.add('hidden');
        correctGuessMessage.classList.remove('animate-fade-out');
        correctGuessMessage.textContent = '';
      }, 900);
    }, 2200);
  }

  function triggerConfetti() {
    const colors = ['#FFC700', '#00f0ff', '#ff2fd6', '#a6ff00'];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement('div');
      c.classList.add('confetti-piece');
      c.style.left = (Math.random() * 100) + '%';
      c.style.backgroundColor = colors[(Math.random() * colors.length) | 0];
      c.style.animationDelay = (Math.random() * 1.2) + 's';
      confettiContainer.appendChild(c);
      c.addEventListener('animationend', () => c.remove());
    }
  }

  function updateProgressBar() {
    progressBar.style.width = ((guesses.length / maxGuesses) * 100) + '%';
  }

  function displayClickableTheme() {
    currentThemeSpan.innerHTML = '';
    theme.split('').forEach(ch => {
      const span = document.createElement('span');
      span.textContent = ch;
      span.classList.add('theme-letter');
      span.addEventListener('click', handleThemeLetterClick);
      currentThemeSpan.appendChild(span);
    });
  }

  function handleThemeLetterClick(e) {
    if (gameOver || anagramFound) return;
    const cell = e.target;
    const letter = cell.textContent.toLowerCase();
    if (cell.classList.contains('selected')) {
      cell.classList.remove('selected');
      anagramGuess = anagramGuess.slice(0, -1);
    } else {
      cell.classList.add('selected');
      anagramGuess += letter;
    }
    if (anagramGuess.length === anagram.length) {
      if (anagramGuess === anagram.toLowerCase()) {
        wordleMessage.textContent = 'Anagram solved! Bonus power-up earned.';
        anagramFound = true;
        awardExtraPowerUp();
        if (A) A.sfx.win();
      } else {
        wordleMessage.textContent = 'Not quite — try another arrangement.';
        if (A) A.sfx.tick();
      }
      anagramGuess = '';
      currentThemeSpan.querySelectorAll('.theme-letter').forEach(l => l.classList.remove('selected'));
    }
  }

  function awardExtraPowerUp() {
    if (usedPowerUp) {
      usedPowerUp = false;
      powerUpButton.disabled = false;
      powerUpButton.textContent = 'POWER-UP';
      wordleMessage.textContent += ' Power-up recharged!';
    }
  }

  // init state (before first game)
  displayClickableTheme();
  updateProgressBar();
  if (hasPlayedToday()) {
    wordleMessage.textContent = "You've already played today's game — come back tomorrow.";
    wordleInput.disabled = true;
    powerUpButton.disabled = true;
  } else {
    wordleMessage.textContent = 'Press START to play today\'s theme: ' + theme;
  }
});
