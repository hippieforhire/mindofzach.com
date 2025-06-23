(function() {
  const canvas = document.getElementById('tetrisCanvas');
  const context = canvas.getContext('2d');
  const scoreElement = document.getElementById('tetrisScore');
  const startButton = document.getElementById('startTetrisButton');

  // Get Tetris control buttons
  const leftBtn = document.getElementById('tetrisLeft');
  const rightBtn = document.getElementById('tetrisRight');
  const rotateBtn = document.getElementById('tetrisRotate');
  const downBtn = document.getElementById('tetrisDown');

  // Define canvas dimensions and block scale
  const BOARD_WIDTH = 12;
  const BOARD_HEIGHT = 20;
  const BLOCK_SIZE = 20; // Each Tetris block will be 20x20 pixels

  // Set canvas dimensions based on block size and board dimensions
  canvas.width = BOARD_WIDTH * BLOCK_SIZE;
  canvas.height = BOARD_HEIGHT * BLOCK_SIZE;

  // Scale the drawing context so that 1 unit in context is BLOCK_SIZE pixels
  context.scale(BLOCK_SIZE, BLOCK_SIZE);

  let arena = []; // The main game board
  let dropCounter = 0;
  let dropInterval = 1000; // Time in ms for piece to drop one unit
  let lastTime = 0;
  let score = 0;
  let level = 1;
  let linesCleared = 0;
  const levelThreshold = 10; // Lines to clear to advance a level
  let animationId = null; // To store the requestAnimationFrame ID

  let player = {
    pos: {x: 0, y: 0},
    matrix: null,
    isPowerUp: false,
  };

  // Tetromino piece definitions
  const pieces = 'TJLOSZI';
  const colors = [
    null,        // 0: Empty
    '#FF0D72',   // 1: T
    '#0DC2FF',   // 2: J
    '#0DFF72',   // 3: L
    '#F538FF',   // 4: O
    '#FF8E0D',   // 5: S
    '#FFE138',   // 6: Z
    '#3877FF',   // 7: I
  ];
  const powerUpColor = '#FFD700'; // Color for power-up blocks

  /**
   * Creates a matrix (2D array) filled with zeros.
   * Represents the game board or a tetromino piece.
   * @param {number} w - Width of the matrix.
   * @param {number} h - Height of the matrix.
   * @returns {Array<Array<number>>} The created matrix.
   */
  function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
      matrix.push(new Array(w).fill(0));
    }
    return matrix;
  }

  /**
   * Creates a Tetromino piece based on its type.
   * @param {string} type - Type of the piece (T, J, L, O, S, Z, I).
   * @param {boolean} isPower - Whether the piece is a power-up.
   * @returns {Array<Array<number>>} The matrix representing the piece.
   */
  function createPiece(type, isPower = false) {
    let piece;
    switch (type) {
      case 'T':
        piece = [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
        break;
      case 'J':
        piece = [[0, 2, 0], [0, 2, 0], [2, 2, 0]];
        break;
      case 'L':
        piece = [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
        break;
      case 'O':
        piece = [[4, 4], [4, 4]];
        break;
      case 'S':
        piece = [[0, 5, 5], [5, 5, 0], [0, 0, 0]];
        break;
      case 'Z':
        piece = [[6, 6, 0], [0, 6, 6], [0, 0, 0]];
        break;
      case 'I':
        piece = [[0, 7, 0, 0], [0, 7, 0, 0], [0, 7, 0, 0], [0, 7, 0, 0]];
        break;
    }
    // If it's a power-up, set all its blocks to the power-up color index (7)
    if (isPower) {
      for (let y = 0; y < piece.length; y++) {
        for (let x = 0; x < piece[y].length; x++) {
          if (piece[y][x] !== 0) piece[y][x] = 8; // Use 8 for power-up color index
        }
      }
    }
    return piece;
  }
  // Add power-up color to the colors array
  colors[8] = powerUpColor;

  /**
   * Checks for collision between the player's piece and the arena.
   * @param {Array<Array<number>>} arena - The game board matrix.
   * @param {object} player - The player object with matrix and position.
   * @returns {boolean} True if collision, false otherwise.
   */
  function collide(arena, player) {
    const m = player.matrix;
    const o = player.pos;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        // Check if block exists in player matrix, and if corresponding arena cell is occupied or out of bounds
        if (m[y][x] !== 0 &&
           (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Merges the player's piece into the arena.
   * @param {Array<Array<number>>} arena - The game board matrix.
   * @param {object} player - The player object with matrix and position.
   */
  function merge(arena, player) {
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          arena[y + player.pos.y][x + player.pos.x] = value;
        }
      });
    });
  }

  /**
   * Clears full lines from the arena and updates score.
   */
  function arenaSweep() {
    let rowCount = 0; // Number of lines cleared in this sweep
    outer: for (let y = arena.length - 1; y >= 0; --y) {
      for (let x = 0; x < arena[y].length; ++x) {
        if (arena[y][x] === 0) {
          continue outer; // Not a full row, move to next row
        }
      }

      // If a full row is found, remove it and add a new empty row at the top
      const row = arena.splice(y, 1)[0].fill(0);
      arena.unshift(row);
      ++y; // Adjust y because we removed a row and added one at the top
      rowCount++;
    }

    if (rowCount > 0) {
      // Scoring based on number of lines cleared
      const scoreMultiplier = [0, 100, 300, 500, 800]; // Score for 0, 1, 2, 3, 4 lines
      score += scoreMultiplier[rowCount] * level; // Score increases with level
      linesCleared += rowCount;

      // Increase level if enough lines are cleared
      if (linesCleared >= level * levelThreshold) {
        level++;
        dropInterval = Math.max(100, dropInterval - 50); // Decrease drop interval, min 100ms
      }
      updateScore();
    }
  }

  /**
   * Resets the player's piece to a new random one at the top.
   * Checks for game over condition.
   */
  function playerReset() {
    const pieceType = pieces[(pieces.length * Math.random()) | 0];
    const isPower = Math.random() < 0.1; // 10% chance for a power-up
    player.matrix = createPiece(pieceType, isPower);
    player.isPowerUp = isPower;
    player.pos.y = 0;
    // Center the new piece horizontally
    player.pos.x = (BOARD_WIDTH / 2 | 0) - (player.matrix[0].length / 2 | 0);

    // Game over condition: new piece immediately collides
    if (collide(arena, player)) {
      gameOver();
    }
  }

  /**
   * Rotates the player's piece.
   * @param {number} dir - Direction of rotation (1 for clockwise, -1 for counter-clockwise).
   */
  function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir); // Perform rotation
    // Wall kick: if collision after rotation, try to shift horizontally
    while (collide(arena, player)) {
      player.pos.x += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > player.matrix[0].length + 1 || offset < -(player.matrix[0].length + 1)) {
        rotate(player.matrix, -dir); // Revert rotation if no valid position found
        player.pos.x = pos; // Revert horizontal position
        return;
      }
    }
  }

  /**
   * Rotates a matrix.
   * @param {Array<Array<number>>} matrix - The matrix to rotate.
   * @param {number} dir - Direction of rotation (1 for clockwise, -1 for counter-clockwise).
   */
  function rotate(matrix, dir) {
    // Transpose matrix
    for (let y = 0; y < matrix.length; y++) {
      for (let x = 0; x < y; x++) {
        [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
      }
    }
    // Reverse rows or columns based on direction
    if (dir > 0) {
      matrix.forEach(row => row.reverse()); // Clockwise
    } else {
      matrix.reverse(); // Counter-clockwise
    }
  }

  /**
   * Moves the player's piece horizontally.
   * @param {number} dir - Direction of movement (-1 for left, 1 for right).
   */
  function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
      player.pos.x -= dir; // Revert if collision
    }
  }

  /**
   * Drops the player's piece one step down.
   * If collision, merges piece and resets for a new one.
   */
  function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
      player.pos.y--; // Move back up one step
      merge(arena, player);
      arenaSweep(); // Check and clear lines
      updateScore(); // Update score display
      playerReset(); // Get a new piece
    }
    dropCounter = 0; // Reset drop counter after a manual or automatic drop
  }

  /**
   * Draws a matrix onto the canvas. Used for both arena and player piece.
   * @param {Array<Array<number>>} matrix - The matrix to draw.
   * @param {object} offset - X and Y offset for drawing.
   */
  function drawMatrix(matrix, offset) {
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          context.fillStyle = colors[value]; // Use color from colors array
          context.fillRect(x + offset.x, y + offset.y, 1, 1); // Draw a single block
          // Add a subtle border to blocks for better visual separation
          context.strokeStyle = '#222';
          context.lineWidth = 0.05;
          context.strokeRect(x + offset.x, y + offset.y, 1, 1);
        }
      });
    });
  }

  /**
   * Main draw function, clears canvas and draws arena and player piece.
   */
  function draw() {
    // Clear the entire canvas with the background color
    context.fillStyle = '#000'; // Black background for the game area
    context.fillRect(0, 0, canvas.width / BLOCK_SIZE, canvas.height / BLOCK_SIZE);

    drawMatrix(arena, {x: 0, y: 0}); // Draw the settled blocks in the arena
    drawMatrix(player.matrix, player.pos); // Draw the current falling piece
  }

  /**
   * Game loop update function. Handles piece dropping and rendering.
   * @param {number} time - Current timestamp from requestAnimationFrame.
   */
  function update(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }

    draw(); // Redraw everything
    animationId = requestAnimationFrame(update); // Continue the loop
  }

  /**
   * Updates the score and level display.
   */
  function updateScore() {
    scoreElement.textContent = `Score: ${score} | Level: ${level} | Lines: ${linesCleared}`;
  }

  /**
   * Resets game state to initial values.
   */
  function resetGame() {
    arena = createMatrix(BOARD_WIDTH, BOARD_HEIGHT);
    score = 0;
    linesCleared = 0;
    level = 1;
    dropInterval = 1000;
    updateScore();
    playerReset();
  }

  /**
   * Ends the game, stops the animation, and shows a game over message.
   */
  function gameOver() {
    cancelAnimationFrame(animationId);
    alert(`Game Over! Your final score: ${score}`);
    resetGame(); // Reset game state for a new game
  }

  /**
   * Initializes the Tetris game when the modal opens.
   * This function is exposed globally via the IIFE.
   */
  window.initializeTetris = function() {
    if (animationId) {
      cancelAnimationFrame(animationId); // Stop any existing game loop
    }
    resetGame(); // Reset game state
    lastTime = 0; // Reset lastTime for fresh animation start
    dropCounter = 0; // Reset drop counter
    update(); // Start the game loop
  };

  /**
   * Stops the Tetris game loop when the modal closes.
   * This function is exposed globally via the IIFE.
   */
  window.stopTetrisGame = function() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  };


  // --- Event Listeners ---

  // Keyboard controls
  document.addEventListener('keydown', e => {
    // Only respond to key presses if the Tetris modal is visible
    if (document.getElementById("tetrisModal").classList.contains("hidden")) {
      return;
    }
    if (e.key === 'ArrowLeft') {
      playerMove(-1);
    } else if (e.key === 'ArrowRight') {
      playerMove(1);
    } else if (e.key === 'ArrowDown') {
      playerDrop();
      e.preventDefault(); // Prevent page scrolling
    } else if (e.key === 'ArrowUp' || e.key === ' ') { // ArrowUp or Space for rotation
      playerRotate(1);
      e.preventDefault(); // Prevent page scrolling
    }
  });

  // Touch/Click controls for on-screen buttons
  // Using both 'touchstart' for immediate mobile response and 'click' for broader compatibility
  if (leftBtn) {
    leftBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playerMove(-1); }, { passive: false });
    leftBtn.addEventListener('click', () => playerMove(-1));
  }
  if (rightBtn) {
    rightBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playerMove(1); }, { passive: false });
    rightBtn.addEventListener('click', () => playerMove(1));
  }
  if (rotateBtn) {
    rotateBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playerRotate(1); }, { passive: false });
    rotateBtn.addEventListener('click', () => playerRotate(1));
  }
  if (downBtn) {
    downBtn.addEventListener('touchstart', (e) => { e.preventDefault(); playerDrop(); }, { passive: false });
    downBtn.addEventListener('click', () => playerDrop());
  }

  // Start button event listener
  if (startButton) {
    startButton.addEventListener('click', () => {
      initializeTetris(); // Call the initialization function to start a new game
    });
  }

  // Initial setup when the script loads (before any modals are opened)
  // This ensures the canvas dimensions are set correctly even before the modal is first opened.
  // No need to call resetGame() or update() here as they are called by initializeTetris()
  // which will be triggered when the modal is opened via openTetrisModal().
})();
