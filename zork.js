// Zork Game Logic with Lunr.js Fully Indexed
const gameData = {
    currentRoom: "entrance",
    inventory: [],
    equippedWeapon: null,
    player: {
        health: 100,
        baseAttackPower: 10,
        get attackPower() {
            return this.baseAttackPower + (gameData.equippedWeapon?.power || 0);
        },
        defensePower: 5
    },
    synonyms: {
        take: ["take", "grab", "pick up", "nab", "get", "snatch", "retrieve", "acquire"],
        look: ["look", "examine", "inspect", "observe", "check out", "peer"],
        use: ["use", "apply", "utilize", "activate"],
        equip: ["equip", "wield", "use weapon", "arm", "prepare"],
        attack: ["attack", "hit", "strike", "fight", "punch", "stab", "shoot"],
        block: ["block", "defend", "shield", "parry"],
        north: ["north", "forward", "go north", "move forward", "proceed north"],
        south: ["south", "back", "go south", "retreat", "move back"],
        east: ["east", "right", "go east", "move east"],
        west: ["west", "left", "go west", "move west"]
    },
    weapons: {
        sword: { name: "sword", power: 15 },
        bow: { name: "bow", power: 10 },
        magicStaff: { name: "magic staff", power: 20 }
    },
    rooms: {
        entrance: {
            description: "You are at the entrance of a dark cave. There is a torch on the wall.",
            items: ["torch", "sword"],
            enemies: [],
            next: { north: "darkRoom" }
        },
        darkRoom: {
            description: "You are in a pitch-dark room. A faint growl echoes in the darkness.",
            items: [],
            enemies: [
                {
                    name: "Goblin",
                    health: 30,
                    attackPower: 8,
                    behavior: "basic"
                }
            ],
            next: { north: "treasureRoom", south: "entrance" }
        },
        treasureRoom: {
            description: "You enter a room glittering with treasure! But a dragon guards it!",
            items: ["gold", "magicStaff"],
            enemies: [
                {
                    name: "Dragon",
                    health: 100,
                    attackPower: 20,
                    behavior: "defensive"
                }
            ],
            next: { south: "darkRoom" }
        },
        ambushRoom: {
            description: "You are ambushed by a shadowy figure!",
            items: [],
            enemies: [
                {
                    name: "Shadow Assassin",
                    health: 50,
                    attackPower: 15,
                    behavior: "ambush"
                }
            ],
            next: { east: "darkRoom" }
        }
    }
};

let outputBox, inputBox, lunrIndex;

// Initialize Lunr.js Index
function initializeLunr() {
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
                enemies: room.enemies.map(e => e.name).join(" ")
            });
        });
    });
}

// Start the Game
function startZorkGame() {
    outputBox = document.getElementById("output");
    inputBox = document.getElementById("input");

    outputBox.textContent = "";
    addOutput(gameData.rooms[gameData.currentRoom].description);
    inputBox.focus();

    inputBox.addEventListener("keyup", handleZorkInput);
    initializeLunr(); // Initialize the Lunr index
}

function handleZorkInput(event) {
    if (event.key === "Enter") {
        const command = inputBox.value.trim().toLowerCase();
        inputBox.value = "";
        processCommand(command);
    }
}

function processCommand(input) {
    // Search command in Lunr index
    const results = lunrIndex.search(input);

    if (results.length > 0) {
        const bestMatch = results[0];
        const matchedRoom = gameData.rooms[bestMatch.ref];
        const currentRoom = gameData.rooms[gameData.currentRoom];

        for (let action in gameData.synonyms) {
            if (gameData.synonyms[action].some(word => input.includes(word))) {
                executeCommand(action, input, matchedRoom);
                return;
            }
        }
    }

    addOutput("I don't understand that command. Try something else.");
}

function executeCommand(action, input, matchedRoom) {
    const currentRoom = gameData.rooms[gameData.currentRoom];

    if (action === "take") {
        const item = currentRoom.items.find(i => input.includes(i)) || currentRoom.items.pop();
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
    } else if (action === "equip") {
        const weapon = Object.keys(gameData.weapons).find(w => input.includes(w));
        if (weapon && gameData.inventory.includes(weapon)) {
            gameData.equippedWeapon = gameData.weapons[weapon];
            addOutput(`You equip the ${weapon}. Your attack power increases.`);
        } else {
            addOutput("You don't have that weapon to equip.");
        }
    } else if (action === "attack") {
        if (currentRoom.enemies.length > 0) {
            const enemy = currentRoom.enemies[0];
            enemy.health -= gameData.player.attackPower;
            addOutput(`You attack the ${enemy.name} for ${gameData.player.attackPower} damage.`);
            if (enemy.health <= 0) {
                addOutput(`You have defeated the ${enemy.name}!`);
                currentRoom.enemies.shift();
            }
        } else {
            addOutput("There's nothing to attack here.");
        }
    } else {
        addOutput("You can't do that here.");
    }
}

function addOutput(text) {
    const newParagraph = document.createElement("p");
    newParagraph.textContent = text;
    outputBox.appendChild(newParagraph);
    outputBox.scrollTop = outputBox.scrollHeight;
}
