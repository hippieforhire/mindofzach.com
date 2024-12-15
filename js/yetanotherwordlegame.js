// yetanotherwordlegame.js
document.addEventListener('DOMContentLoaded', () => {
  const wordleBoard = document.getElementById('wordleBoard');
  const wordleInput = document.getElementById('wordleInput');
  const wordleMessage = document.getElementById('wordleMessage');
  const startWordleButton = document.getElementById('startWordleButton');
  const powerUpButton = document.getElementById('powerUpButton');
  const wordleKeyboard = document.getElementById('wordleKeyboard');
  const currentThemeSpan = document.getElementById('currentTheme');
  const roundIndicator = document.getElementById('roundIndicator');
  const correctGuessMessage = document.getElementById('correctGuessMessage');
  const confettiContainer = document.getElementById('confetti');
  const progressBar = document.getElementById('progressBar');
  const resetButton = document.getElementById('resetButton');
  const rulesButton = document.getElementById('rulesButton');

  const dailyGames = {
    "2024-12-09": {
      theme: "Famous Movies",
      words: ["alien", "psycho", "titanic"],
      anagram: "cinema"
    },
    "2024-12-10": {
      theme: "Famous Bands",
      words: ["queen", "weezer", "nirvana"],
      anagram: "winter"
    },
    "2024-12-11": {
      theme: "Country or State Capitals",
      words: ["texas", "berlin", "jakarta"],
      anagram: "county"
    },
    "2024-12-12": {
      theme: "Common Cat Names",
      words: ["salem", "oliver", "smokey"],
      anagram: "cocoa"
    },
    "2024-12-13": {
      theme: "Car Types/Models",
      words: ["civic", "accord", "mustang"],
      anagram: "civic"
    },
    "2024-12-14": {
      theme: "Common Dog Names",
      words: ["buddy", "bailey", "charlie"],
      anagram: "buddy"
    },
    "2024-12-15": {
      theme: "American Cuisine",
      words: ["cajun", "burger", "hotdogs"],
      anagram: "bunch"
    }
  };

  function getCurrentDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const centralTime = new Date(utc - (3600000 * 6));
    const year = centralTime.getFullYear();
    let month = centralTime.getMonth() + 1;
    let day = centralTime.getDate();
    month = month < 10 ? '0' + month : month;
    day = day < 10 ? '0' + day : day;
    return `${year}-${month}-${day}`;
  }

  let currentDate = getCurrentDate();
  let gameData = dailyGames[currentDate];

  if (!gameData) {
    const dates = Object.keys(dailyGames);
    const firstDate = dates[0];
    gameData = dailyGames[firstDate];
    currentDate = firstDate;
  }

  let { theme, words, anagram } = gameData;
  let currentRound = 0;
  const totalRounds = words.length; 
  let usedPowerUp = false;
  let secretWord = words[currentRound].toLowerCase();
  let wordLength = secretWord.length;
  let maxGuesses = 6;
  let guesses = [];
  let currentGuess = '';
  let gameOver = false;
  let anagramGuess = '';
  let anagramFound = false;

  function initializeWordleGame() {
    currentRound = 0;
    usedPowerUp = false;
    anagramFound = false;
    secretWord = words[currentRound].toLowerCase();
    wordLength = secretWord.length;
    maxGuesses = 6;
    guesses = [];
    currentGuess = '';
    anagramGuess = '';
    gameOver = false;
    wordleMessage.textContent = `Theme: ${theme}`;
    displayClickableTheme();
    createBoard();
    createKeyboard();
    wordleInput.disabled = false;
    wordleInput.value = '';
    wordleInput.focus();
    powerUpButton.disabled = false;
    powerUpButton.textContent = "Use Power-Up";
    updateKeyboard();
    showRoundIndicator();
    updateProgressBar();
  }

  function createBoard() {
    wordleBoard.innerHTML = '';
    for (let i = 0; i < maxGuesses; i++) {
      const row = document.createElement('div');
      row.classList.add('wordle-row');
      row.style.gridTemplateColumns = `repeat(${wordLength}, 50px)`;
      for (let j = 0; j < wordLength; j++) {
        const cell = document.createElement('div');
        cell.classList.add('wordle-cell');
        row.appendChild(cell);
      }
      wordleBoard.appendChild(row);
    }
  }

  function createKeyboard() {
    const keys = 'QWERTYUIOPASDFGHJKLEntZXCVBNMBCK'.split('');
    wordleKeyboard.innerHTML = '';

    const firstRowKeys = keys.slice(0,10);
    const secondRowKeys = keys.slice(10,19);
    const thirdRowKeys = keys.slice(19);

    const firstRow = document.createElement('div');
    firstRow.classList.add('flex', 'justify-center', 'mb-2');
    firstRowKeys.forEach(key => {
      const btn = createKeyButton(key);
      firstRow.appendChild(btn);
    });
    wordleKeyboard.appendChild(firstRow);

    const secondRow = document.createElement('div');
    secondRow.classList.add('flex', 'justify-center', 'mb-2');
    secondRowKeys.forEach(key => {
      const btn = createKeyButton(key);
      secondRow.appendChild(btn);
    });
    wordleKeyboard.appendChild(secondRow);

    const thirdRow = document.createElement('div');
    thirdRow.classList.add('flex', 'justify-center');
    thirdRowKeys.forEach(key => {
      const btn = createKeyButton(key);
      thirdRow.appendChild(btn);
    });
    wordleKeyboard.appendChild(thirdRow);
  }

  function createKeyButton(key) {
    const keyButton = document.createElement('div');
    keyButton.classList.add('wordle-key');
    keyButton.textContent = key === 'Ent' ? 'Ent' : (key === 'BCK' ? '←' : key);
    keyButton.addEventListener('click', () => handleKeyPress(key));
    return keyButton;
  }

  function updateKeyboard() {
    guesses.forEach(guessObj => {
      const { guess, feedback } = guessObj;
      guess.split('').forEach((letter, index) => {
        const key = letter.toUpperCase();
        const keyButton = Array.from(wordleKeyboard.querySelectorAll('.wordle-key')).find(btn => btn.textContent === key || (btn.textContent === '←' && key==='BCK'));
        if (keyButton) {
          if (feedback[index] === 'correct') {
            keyButton.classList.remove('present', 'absent');
            keyButton.classList.add('correct', 'animate-press');
            setTimeout(() => keyButton.classList.remove('animate-press'), 600);
          } else if (feedback[index] === 'present') {
            if (!keyButton.classList.contains('correct')) {
              keyButton.classList.remove('absent');
              keyButton.classList.add('present', 'animate-press');
              setTimeout(() => keyButton.classList.remove('animate-press'), 600);
            }
          } else {
            if (!keyButton.classList.contains('correct') && !keyButton.classList.contains('present')) {
              keyButton.classList.add('absent', 'animate-press');
              setTimeout(() => keyButton.classList.remove('animate-press'), 600);
            }
          }
        }
      });
    });
  }

  wordleInput.addEventListener('keydown', (e) => {
    if (gameOver) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      submitGuess();
    } else if (e.key === 'Backspace') {
      currentGuess = currentGuess.slice(0, -1);
      updateBoardUI();
    } else if (/^[a-zA-Z]$/.test(e.key) && currentGuess.length < wordLength) {
      currentGuess += e.key.toUpperCase();
      updateBoardUI();
    }
  });

  function handleKeyPress(key) {
    if (gameOver) return;
    if (key === 'Ent') {
      submitGuess();
    } else if (key === 'BCK') {
      currentGuess = currentGuess.slice(0, -1);
      updateBoardUI();
    } else if (/^[A-Z]$/.test(key) && currentGuess.length < wordLength) {
      currentGuess += key;
      updateBoardUI();
    }
  }

  function updateBoardUI() {
    const currentRow = wordleBoard.children[guesses.length];
    Array.from(currentRow.children).forEach((cell, i) => {
      cell.textContent = currentGuess[i] || '';
    });
  }

  function submitGuess() {
    if (gameOver) return;
    if (currentGuess.length !== wordLength) {
      wordleMessage.textContent = `Please enter a ${wordLength}-letter word.`;
      return;
    }

    const feedback = getFeedback(currentGuess.toLowerCase());
    guesses.push({ guess: currentGuess.toLowerCase(), feedback });
    updateBoardColors(feedback);
    updateKeyboard();
    currentGuess = '';
    updateBoardUI();
    wordleMessage.textContent = '';

    updateProgressBar();

    if (guesses[guesses.length - 1].guess === secretWord) {
      wordleMessage.textContent = "Congratulations! You've guessed the word!";
      wordleInput.disabled = true;
      powerUpButton.disabled = true;
      displayCorrectGuess();
      triggerConfetti();
      proceedToNextRound(true);
      saveGameState(true);
      return;
    }

    if (guesses.length === maxGuesses) {
      wordleMessage.textContent = `Out of guesses! The word was "${secretWord.toUpperCase()}".`;
      wordleInput.disabled = true;
      powerUpButton.disabled = true;
      proceedToNextRound(false);
      saveGameState(false);
      return;
    }
  }

  function getFeedback(guess) {
    const feedback = Array(wordLength).fill('absent');
    const secretArr = secretWord.split('');

    for (let i = 0; i < wordLength; i++) {
      if (guess[i] === secretArr[i]) {
        feedback[i] = 'correct';
        secretArr[i] = null;
      }
    }

    for (let i = 0; i < wordLength; i++) {
      if (feedback[i] === 'correct') continue;
      const index = secretArr.indexOf(guess[i]);
      if (index !== -1) {
        feedback[i] = 'present';
        secretArr[index] = null;
      }
    }

    return feedback;
  }

  function updateBoardColors(feedback) {
    const currentRow = wordleBoard.children[guesses.length - 1];
    Array.from(currentRow.children).forEach((cell, i) => {
      cell.classList.remove('animate-flip', 'bounce');
      void cell.offsetWidth;
      cell.classList.add(feedback[i], 'animate-flip', 'bounce');
      setTimeout(() => {
        cell.classList.remove('animate-flip', 'bounce');
      }, 1000);
    });
  }

  powerUpButton.addEventListener('click', () => {
    if (usedPowerUp) {
      wordleMessage.textContent = "Power-Up already used.";
      return;
    }
    const powerUpChoice = prompt("Choose a Power-Up:\n1. Reveal a Letter\n2. Get an Extra Guess");
    if (powerUpChoice === '1') {
      revealLetterFunction();
      usedPowerUp = true;
    } else if (powerUpChoice === '2') {
      getExtraGuessFunction();
      usedPowerUp = true;
    } else {
      wordleMessage.textContent = "Invalid Power-Up choice.";
    }
  });

  function revealLetterFunction() {
    for (let i = 0; i < wordLength; i++) {
      const cell = wordleBoard.children[guesses.length].children[i];
      if (cell.textContent === '') {
        cell.classList.remove('correct','present','absent','animate-flip','bounce');
        void cell.offsetWidth;
        cell.textContent = secretWord[i].toUpperCase();
        cell.classList.add('correct','animate-flip','bounce');
        setTimeout(() => cell.classList.remove('animate-flip','bounce'), 1000);

        const key = secretWord[i].toUpperCase();
        const keyButton = Array.from(wordleKeyboard.querySelectorAll('.wordle-key')).find(btn => btn.textContent === key);
        if (keyButton) {
          keyButton.classList.remove('present','absent','animate-press');
          void keyButton.offsetWidth;
          keyButton.classList.add('correct','animate-press');
          setTimeout(() => keyButton.classList.remove('animate-press'), 600);
        }
        break;
      }
    }
  }

  function getExtraGuessFunction() {
    maxGuesses += 1;
    const row = document.createElement('div');
    row.classList.add('wordle-row');
    row.style.gridTemplateColumns = `repeat(${wordLength}, 50px)`;
    for (let j = 0; j < wordLength; j++) {
      const cell = document.createElement('div');
      cell.classList.add('wordle-cell');
      row.appendChild(cell);
    }
    wordleBoard.appendChild(row);
    wordleMessage.textContent = "An extra guess added!";
    updateProgressBar();
  }

  function proceedToNextRound(won) {
    if (won && currentRound < totalRounds - 1) {
      currentRound++;
      secretWord = words[currentRound].toLowerCase();
      wordLength = secretWord.length;
      maxGuesses = 6;
      guesses = [];
      currentGuess = '';
      anagramGuess = '';
      gameOver = false;
      anagramFound = false;
      wordleMessage.textContent = `Round ${currentRound + 1}: ${theme}`;
      resetThemeDisplay();
      adjustBoardForNewRound();
      createKeyboard();
      wordleInput.disabled = false;
      wordleInput.value = '';
      wordleInput.focus();
      powerUpButton.disabled = false;
      powerUpButton.textContent = "Use Power-Up";
      updateKeyboard();
      showRoundIndicator();
      updateProgressBar();
    } else {
      wordleMessage.textContent += " Game Over.";
      gameOver = true;
    }
  }

  function saveGameState(won) {
    const today = getCurrentDate();
    localStorage.setItem('wordle_last_played', today);
    localStorage.setItem('wordle_won', won);
  }

  function hasPlayedToday() {
    const lastPlayed = localStorage.getItem('wordle_last_played');
    const today = getCurrentDate();
    return lastPlayed === today;
  }

  startWordleButton.addEventListener('click', () => {
    if (hasPlayedToday()) {
      wordleMessage.textContent = "Already played today's game.";
      wordleInput.disabled = true;
      powerUpButton.disabled = true;
      return;
    }
    initializeWordleGame();
  });

  rulesButton.addEventListener('click', () => {
    const rulesModal = document.getElementById('rulesModal');
    rulesModal.classList.remove('hidden');
    rulesModal.classList.add('active');
    rulesModal.style.zIndex = '100';
  });

  resetButton.addEventListener('click', () => {
    initializeWordleGame();
    wordleMessage.textContent = "Game has been reset.";
  });

  function showRoundIndicator() {
    const roundText = `Round ${currentRound + 1}`;
    roundIndicator.textContent = roundText;
    roundIndicator.classList.remove('animate-fade-out');
    roundIndicator.classList.add('animate-fade-in');

    setTimeout(() => {
      roundIndicator.classList.remove('animate-fade-in');
      roundIndicator.classList.add('animate-fade-out');
    }, 2500);
  }

  function displayCorrectGuess() {
    correctGuessMessage.textContent = "Correct Guess!";
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
      }, 1000);
    }, 3000);
  }

  function triggerConfetti() {
    const confettiCount = 100;
    const colors = ['#FFC700', '#FF0000', '#2E3192', '#41BBC7'];
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.classList.add('confetti-piece');
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDelay = `${Math.random() * 5}s`;
      confettiContainer.appendChild(confetti);

      confetti.addEventListener('animationend', () => {
        confetti.remove();
      });
    }
  }

  function updateProgressBar() {
    const progress = (guesses.length / maxGuesses) * 100;
    progressBar.style.width = `${progress}%`;
  }

  function displayClickableTheme() {
    currentThemeSpan.innerHTML = '';
    const themeText = theme;
    const letters = themeText.split('');
    letters.forEach(letter => {
      const span = document.createElement('span');
      span.textContent = letter;
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
        wordleMessage.textContent = "Anagram Correct! Extra Power-Up!";
        triggerAnagramSuccessAnimation();
        awardExtraPowerUp();
        anagramFound = true;
      } else {
        wordleMessage.textContent = "Incorrect Anagram. Try again!";
      }
      anagramGuess = '';
      const allLetters = document.querySelectorAll('.theme-letter');
      allLetters.forEach(l => l.classList.remove('selected'));
    }
  }

  function awardExtraPowerUp() {
    if (usedPowerUp) {
      usedPowerUp = false;
      powerUpButton.disabled = false;
      powerUpButton.textContent = "Use Power-Up";
      wordleMessage.textContent += " Another Power-Up available.";
    }
  }

  function resetThemeDisplay() {
    displayClickableTheme();
  }

  function adjustBoardForNewRound() {
    wordleBoard.innerHTML = '';
    for (let i = 0; i < maxGuesses; i++) {
      const row = document.createElement('div');
      row.classList.add('wordle-row');
      row.style.gridTemplateColumns = `repeat(${wordLength}, 50px)`;
      for (let j = 0; j < wordLength; j++) {
        const cell = document.createElement('div');
        cell.classList.add('wordle-cell');
        row.appendChild(cell);
      }
      wordleBoard.appendChild(row);
    }
  }

  function triggerAnagramSuccessAnimation() {
    const allLetters = document.querySelectorAll('.theme-letter');
    allLetters.forEach(letterSpan => {
      const random = Math.random();
      if (random < 0.3) {
        letterSpan.style.transition = 'background-color 0.5s';
        letterSpan.style.backgroundColor = '#9ca3af';
        setTimeout(() => {
          letterSpan.style.backgroundColor = '';
        }, 1000);
      }
    });
  }

  if (hasPlayedToday()) {
    wordleMessage.textContent = "You have already played today's game.";
    wordleInput.disabled = true;
    powerUpButton.disabled = true;
    displayClickableTheme();
    updateProgressBar();
  }
});
