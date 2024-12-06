document.addEventListener('DOMContentLoaded', () => {
    const ticTacToeBoard = document.getElementById('ticTacToeBoard');
    const board = ['', '', '', '', '', '', '', '', ''];
    let currentPlayer = 'X';

    function setupTicTacToe() {
        ticTacToeBoard.innerHTML = '';
        board.forEach((cell, index) => {
            const cellElement = document.createElement('div');
            cellElement.className = 'tic-tac-toe-cell';
            cellElement.dataset.index = index;
            cellElement.addEventListener('click', onCellClick);
            ticTacToeBoard.appendChild(cellElement);
        });
    }

    function onCellClick(event) {
        const cellElement = event.currentTarget;
        const index = cellElement.dataset.index;
        if (board[index] === '') {
            board[index] = currentPlayer;
            cellElement.textContent = currentPlayer;
            if (checkWin()) {
                setTimeout(() => alert(`${currentPlayer} wins!`), 10);
                resetTicTacToe();
            } else if (board.every(cell => cell !== '')) {
                setTimeout(() => alert('Draw!'), 10);
                resetTicTacToe();
            } else {
                currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            }
        }
    }

    function checkWin() {
        const winningCombinations = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        return winningCombinations.some(combination => {
            return combination.every(index => {
                return board[index] === currentPlayer;
            });
        });
    }

    function resetTicTacToe() {
        board.fill('');
        currentPlayer = 'X';
        setupTicTacToe();
    }

    setupTicTacToe();
});
