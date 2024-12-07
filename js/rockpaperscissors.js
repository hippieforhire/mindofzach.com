function playRockPaperScissors() {
    const choices = ["Rock", "Paper", "Scissors"];
    const userChoice = prompt("Enter Rock, Paper, or Scissors:");
    const computerChoice = choices[Math.floor(Math.random() * choices.length)];
    let result = "";

    if (userChoice === computerChoice) {
        result = "Wow you tied with a computer. Thats pretty lame";
    } else if (
        (userChoice === "Rock" && computerChoice === "Scissors") ||
        (userChoice === "Paper" && computerChoice === "Rock") ||
        (userChoice === "Scissors" && computerChoice === "Paper")
    ) {
        result = "Okay, you won. Now go find something else to play.";
    } else {
        result = "Okay so that's embarassing...you lose";
    }

    alert(`You chose ${userChoice}, computer chose ${computerChoice}. ${result}`);
}
