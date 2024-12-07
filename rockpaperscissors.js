function playRockPaperScissors() {
    const choices = ["Rock", "Paper", "Scissors"];
    const userChoice = prompt("Enter Rock, Paper, or Scissors:");
    const computerChoice = choices[Math.floor(Math.random() * choices.length)];
    let result = "";

    if (userChoice === computerChoice) {
        result = "It's a draw!";
    } else if (
        (userChoice === "Rock" && computerChoice === "Scissors") ||
        (userChoice === "Paper" && computerChoice === "Rock") ||
        (userChoice === "Scissors" && computerChoice === "Paper")
    ) {
        result = "You win!";
    } else {
        result = "You lose!";
    }

    alert(`You chose ${userChoice}, computer chose ${computerChoice}. ${result}`);
}

// Add a button to play Rock, Paper, Scissors
document.body.innerHTML += '<button onclick="playRockPaperScissors()">Play Rock, Paper, Scissors</button>';
