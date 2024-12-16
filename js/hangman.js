// Hangman game
// On-screen keyboard of letters. Click letters to guess.
// Press "Start" to load a new word. The canvas draws the hangman as you make wrong guesses.

(function(){
  const canvas = document.getElementById('hangmanCanvas');
  const ctx = canvas.getContext('2d');
  const wordEl = document.getElementById('hangmanWord');
  const msgEl = document.getElementById('hangmanMessage');
  const kbContainer = document.getElementById('hangmanKeyboard');
  const startBtn = document.getElementById('startHangmanButton');

  const words = ["javascript","canvas","website","adventure","zach","puzzle","hangman","mystery","challenge","rainbow","galaxy","tetris","snake","pong","wordle"];
  let chosenWord = "";
  let guessed = [];
  let wrongGuesses = 0;

  // Draw hangman step by step
  function drawHangmanStep(step) {
    ctx.strokeStyle='#000';
    ctx.lineWidth=2;
    // steps: 0-gallow,1-head,2-body,3-arm1,4-arm2,5-leg1,6-leg2 (game over)
    if (step===0) {
      // base
      ctx.beginPath();
      ctx.moveTo(10,290);
      ctx.lineTo(290,290);
      ctx.stroke();
      // pole
      ctx.beginPath();
      ctx.moveTo(50,290);
      ctx.lineTo(50,50);
      ctx.lineTo(150,50);
      ctx.lineTo(150,80);
      ctx.stroke();
    } else if (step===1) {
      // head
      ctx.beginPath();
      ctx.arc(150,100,20,0,Math.PI*2);
      ctx.stroke();
    } else if (step===2) {
      // body
      ctx.beginPath();
      ctx.moveTo(150,120);
      ctx.lineTo(150,180);
      ctx.stroke();
    } else if (step===3) {
      // arm1
      ctx.beginPath();
      ctx.moveTo(150,130);
      ctx.lineTo(120,160);
      ctx.stroke();
    } else if (step===4) {
      // arm2
      ctx.beginPath();
      ctx.moveTo(150,130);
      ctx.lineTo(180,160);
      ctx.stroke();
    } else if (step===5) {
      // leg1
      ctx.beginPath();
      ctx.moveTo(150,180);
      ctx.lineTo(130,220);
      ctx.stroke();
    } else if (step===6) {
      // leg2
      ctx.beginPath();
      ctx.moveTo(150,180);
      ctx.lineTo(170,220);
      ctx.stroke();
    }
  }

  function updateDisplay() {
    let display = "";
    for (let letter of chosenWord) {
      display += guessed.includes(letter)?letter:"_";
      display += " ";
    }
    wordEl.textContent = display.trim();
  }

  function checkWinLoss() {
    // Win
    if (chosenWord.split('').every(l=>guessed.includes(l))) {
      msgEl.textContent = "You Won!";
      disableKeyboard();
    }
    // Lose
    if (wrongGuesses>=7) {
      msgEl.textContent = "You Lost! The word was: "+chosenWord;
      disableKeyboard();
    }
  }

  function guessLetter(letter) {
    if (guessed.includes(letter) || wrongGuesses>=7 || chosenWord==="") return;
    guessed.push(letter);
    if (!chosenWord.includes(letter)) {
      wrongGuesses++;
      drawHangmanStep(wrongGuesses);
    }
    updateDisplay();
    checkWinLoss();
  }

  function createKeyboard() {
    kbContainer.innerHTML="";
    const letters = "abcdefghijklmnopqrstuvwxyz".split('');
    letters.forEach(letter=>{
      const btn = document.createElement('button');
      btn.textContent = letter.toUpperCase();
      btn.className="wordle-key"; // reuse wordle key style
      btn.style.width='35px';
      btn.addEventListener('click', ()=>guessLetter(letter));
      kbContainer.appendChild(btn);
    });
  }

  function disableKeyboard() {
    Array.from(kbContainer.querySelectorAll('button')).forEach(b=>b.disabled=true);
  }

  function startGame() {
    chosenWord = words[Math.floor(Math.random()*words.length)];
    guessed = [];
    wrongGuesses = 0;
    msgEl.textContent = "";
    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawHangmanStep(0); // draw gallow
    updateDisplay();
    createKeyboard();
  }

  startBtn.addEventListener('click', startGame);
})();
