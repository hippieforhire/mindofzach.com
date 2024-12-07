// Select the Tic Tac Toe board container
const boardElement = document.getElementById("ticTacToeBoard");
let boardState, currentPlayer;

// Function to initialize the game board and state
function initializeTicTacToe() {
    // Check if the board element exists
    if (!boardElement) {
        console.error("Error: Tic Tac Toe board element not found.");
        return;
    }

    // Reset the game state
    boardState = Array(9).fill(null); // Clear the board state
    currentPlayer = "X"; // Set starting player

    // Clear any previous board UI
    boardElement.innerHTML = "";

    // Create 9 cells for the game board
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.classList.add("tic-tac-toe-cell"); // Add styling class
        cell.dataset.index = i; // Assign cell index
        cell.addEventListener("click", handleCellClick); // Add click event
        boardElement.appendChild(cell); // Add cell to the board
    }
}

// Function to handle clicks on cells
function handleCellClick(event) {
    const cellIndex = event.target.dataset.index; // Get clicked cell index

    // If cell is already filled, do nothing
    if (boardState[cellIndex]) return;

    // Update the board state and UI
    boardState[cellIndex] = currentPlayer;
    event.target.textContent = currentPlayer; // Display current player's mark

    // Check for a win or a draw
    if (checkWin()) {
        alert(`${currentPlayer} wins!`);
        initializeTicTacToe(); // Reset the game
    } else if (boardState.every(cell => cell)) {
        alert("It's a draw!");
        initializeTicTacToe(); // Reset the game
    } else {
        // Switch to the other player
        currentPlayer = currentPlayer === "X" ? "O" : "X";
    }
}

// Function to check for a win
function checkWin() {
    // Define winning combinations
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    // Check if any winning combination is matched
    return winningCombinations.some(combination =>
        combination.every(index => boardState[index] === currentPlayer)
    );
}

// Initialize the game immediately when the page loads (optional)
// initializeTicTacToe();
