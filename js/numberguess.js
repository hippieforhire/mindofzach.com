// Number Guessing Game
function playNumberGuess() {
    const randomNumber = Math.floor(Math.random() * 10) + 1;
    const guess = prompt("Guess a number between 1 and 10:");
    const output = document.getElementById("guessOutput");
    if (parseInt(guess) === randomNumber) {
        output.textContent = `You guessed right! The number was ${randomNumber}.`;
    } else {
        output.textContent = `Sorry, you guessed ${guess}. The correct number was ${randomNumber}.`;
    }
}
