/* Tic Tac Toe — vs an AI (chill / unbeatable) or a friend.
 * Score tally, neon marks, win-line highlight. */
(function () {
  'use strict';
  const A = Arcade;
  const boardEl = document.getElementById('ticTacToeBoard');
  const xEl = document.getElementById('tttX');
  const oEl = document.getElementById('tttO');
  const dEl = document.getElementById('tttD');

  const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

  let board, turn, mode, over, winLine;
  let tally;

  function reset(keepTally) {
    board = new Array(9).fill('');
    turn = 'X'; over = false; winLine = null;
    if (!keepTally) tally = A.store.get('tttTally', { X: 0, O: 0, D: 0 });
    paintTally();
    render();
  }

  function render() {
    boardEl.innerHTML = '';
    board.forEach((v, i) => {
      const c = document.createElement('div');
      c.className = 'ttt-cell' + (v === 'X' ? ' x' : v === 'O' ? ' o' : '') + (winLine && winLine.indexOf(i) >= 0 ? ' win' : '');
      c.textContent = v;
      c.addEventListener('click', () => play(i));
      boardEl.appendChild(c);
    });
  }

  function play(i) {
    if (over || board[i]) return;
    place(i, turn);
    if (over) return;
    if (mode === '2p') { turn = turn === 'X' ? 'O' : 'X'; return; }
    // AI is O
    turn = 'O';
    render();
    setTimeout(() => {
      if (over) return;
      const mv = mode === 'hard' ? bestMove() : chillMove();
      place(mv, 'O');
      turn = 'X';
      render();
    }, 380);
  }

  function place(i, p) {
    board[i] = p;
    A.sfx.click();
    const w = winner(board);
    render();
    if (w) {
      over = true; winLine = w.line;
      tally[w.player]++; A.store.set('tttTally', tally); paintTally();
      render();
      if (w.player === 'X') A.sfx.win(); else A.sfx.lose();
    } else if (board.every(c => c)) {
      over = true;
      tally.D++; A.store.set('tttTally', tally); paintTally();
      A.sfx.tick();
    }
  }

  function winner(b) {
    for (const line of WINS) {
      const [a, c, d] = line;
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return { player: b[a], line };
    }
    return null;
  }

  function bestMove() {
    // minimax, AI = O (maximizer)
    let bestScore = -Infinity, move = -1;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = 'O';
      const s = minimax(board, 0, false);
      board[i] = '';
      if (s > bestScore) { bestScore = s; move = i; }
    }
    return move;
  }

  function minimax(b, depth, isMax) {
    const w = winner(b);
    if (w) return w.player === 'O' ? 10 - depth : depth - 10;
    if (b.every(c => c)) return 0;
    let best = isMax ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = isMax ? 'O' : 'X';
      const s = minimax(b, depth + 1, !isMax);
      b[i] = '';
      best = isMax ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  }

  function chillMove() {
    // picks a decent move 60% of the time, random otherwise
    const empt = board.map((c, i) => c ? -1 : i).filter(i => i >= 0);
    if (Math.random() < 0.6) {
      // take win if available
      for (const i of empt) { board[i] = 'O'; if (winner(board) && winner(board).player === 'O') { board[i] = ''; return i; } board[i] = ''; }
      // block X's win
      for (const i of empt) { board[i] = 'X'; if (winner(board) && winner(board).player === 'X') { board[i] = ''; return i; } board[i] = ''; }
    }
    return A.choice(empt);
  }

  function paintTally() {
    xEl.textContent = tally.X; oEl.textContent = tally.O; dEl.textContent = tally.D;
  }

  document.getElementById('tttDiff').addEventListener('click', (e) => {
    const b = e.target.closest('.diff-btn');
    if (!b) return;
    document.querySelectorAll('#tttDiff .diff-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    mode = b.dataset.d;
    A.sfx.click();
    reset(true);
  });
  document.getElementById('tttReset').addEventListener('click', () => { A.sfx.click(); reset(true); });

  mode = 'hard';
  A.registerModalGame('ticTacToeModal', {
    onOpen() { reset(false); },
    onClose() {}
  });
  reset(false);
})();
