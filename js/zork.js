let outputBox, inputBox, lunrIndex;

// Example gameData structure (ensure this exists)
const gameData = {
    currentRoom: "caveEntrance",
    rooms: {
        caveEntrance: {
            description: "You are standing at the entrance of a dark cave. There is a faint light inside.",
            items: ["torch"],
            enemies: [],
            next: { north: "deepCave" },
        },
        deepCave: {
            description: "You are inside a dark cave. The air is damp, and you hear distant sounds.",
            items: [],
            enemies: [{ name: "goblin", health: 20 }],
            next: { south: "caveEntrance" },
        },
    },
    synonyms: {
        look: ["look", "examine", "inspect"],
        take: ["take", "grab", "pick"],
        attack: ["attack", "fight", "hit"],
        north: ["north", "go north"],
        south: ["south", "go south"],
    },
    inventory: [],
    player: { attackPower: 10 },
};

// Open Zork Modal
function openZorkModal() {
    const modal = document.getElementById("zorkModal");
    modal.classList.remove("hidden");
    startZorkGame(); // Initialize the game when modal opens
}

// Close Zork Modal
function closeZorkModal() {
    const modal = document.getElementById("zorkModal");
    modal.classList.add("hidden");
}

// Start the Game
function startZorkGame() {
    outputBox = document.getElementById("output");
    inputBox = document.getElementById("input");

    // Ensure output and input are cleared before starting
    outputBox.textContent = "";
    inputBox.value = "";

    if (!gameData.currentRoom || !gameData.rooms[gameData.currentRoom]) {
        addOutput("Error: Starting room not found!");
        return;
    }

    addOutput(gameData.rooms[gameData.currentRoom].description); // Show the current room description
    inputBox.focus();

    inputBox.removeEventListener("keyup", handleZorkInput); // Avoid duplicate event listeners
    inputBox.addEventListener("keyup", handleZorkInput);

    initializeLunr(); // Initialize Lunr index if not already done
}

// Add Text to Output Box
function addOutput(text) {
    const newParagraph = document.createElement("p");
    newParagraph.textContent = text;
    outputBox.appendChild(newParagraph);
    outputBox.scrollTop = outputBox.scrollHeight; // Auto-scroll to the latest message
}

// Handle User Input
function handleZorkInput(event) {
    if (event.key === "Enter") {
        const command = inputBox.value.trim().toLowerCase();
        inputBox.value = ""; // Clear input box after submission
        processCommand(command);
    }
}

// Process Commands
function processCommand(input) {
    const results = lunrIndex.search(input); // Search the command in Lunr index

    if (results.length > 0) {
        const bestMatch = results[0];
        const matchedRoom = gameData.rooms[bestMatch.ref];
        const currentRoom = gameData.rooms[gameData.currentRoom];

        for (let action in gameData.synonyms) {
            if (gameData.synonyms[action].some(word => input.includes(word))) {
                executeCommand(action, input, currentRoom, matchedRoom);
                return;
            }
        }
    }

    addOutput("I don't understand that command. Try something else.");
}

// Execute Commands
function executeCommand(action, input, currentRoom, matchedRoom) {
    if (action === "take") {
        const item = currentRoom.items.find(i => input.includes(i));
        if (item) {
            gameData.inventory.push(item);
            currentRoom.items = currentRoom.items.filter(i => i !== item);
            addOutput(`You take the ${item}.`);
        } else {
            addOutput("There's nothing here to take.");
        }
    } else if (action === "look") {
        addOutput(currentRoom.description);
        if (currentRoom.items.length > 0) addOutput(`You see: ${currentRoom.items.join(", ")}`);
        if (currentRoom.enemies.length > 0) addOutput(`Enemies present: ${currentRoom.enemies.map(e => e.name).join(", ")}`);
    } else if (["north", "south"].includes(action)) {
        const nextRoomKey = currentRoom.next[action];
        if (nextRoomKey) {
            gameData.currentRoom = nextRoomKey;
            addOutput(gameData.rooms[nextRoomKey].description);
        } else {
            addOutput("You can't go that way.");
        }
    } else {
        addOutput("You can't do that here.");
    }
}

// Initialize Lunr.js Index
function initializeLunr() {
    if (lunrIndex) return; // Prevent re-initializing
    lunrIndex = lunr(function () {
        this.field("command");
        this.field("description");
        this.field("items");
        this.field("enemies");
        this.ref("id");

        // Index all rooms and commands
        Object.keys(gameData.rooms).forEach(roomId => {
            const room = gameData.rooms[roomId];
            this.add({
                id: roomId,
                command: Object.values(gameData.synonyms).flat().join(" "),
                description: room.description,
                items: room.items.join(" "),
                enemies: room.enemies.map(e => e.name).join(" "),
            });
        });
    });
}
