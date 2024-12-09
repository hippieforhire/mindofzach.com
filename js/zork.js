// zork.js

let outputBox, inputBox;

const gameData = {
    currentRoom: "caveEntrance",
    rooms: {
        caveEntrance: {
            description: "You are standing at the entrance of a dark cave. A faint light inside. Behind you is a dense forest. A sword lies on the ground.",
            items: ["torch", "sword"],
            enemies: [],
            next: { north: "deepCave", south: "forest" },
        },
        deepCave: {
            description: "You are inside a dark cave. The air is damp and you hear distant sounds. A narrow passage leads deeper inside.",
            items: ["rusty key"],
            enemies: [{ name: "goblin", health: 20 }],
            next: { south: "caveEntrance", north: "mysteriousChamber" },
        },
        mysteriousChamber: {
            description: "A mysterious underground chamber lit by glowing mushrooms. A strange pedestal stands in the center. A cloaked figure watches you silently.",
            items: ["strange amulet"],
            enemies: [{ name: "giant spider", health: 30 }],
            next: { south: "deepCave" },
            npc: { name: "cloaked figure", friendly: true, hasQuest: true }
        },
        forest: {
            description: "A lush forest with tall trees. Paths lead east to a riverbank and west up a hillside. A weary traveler sits against a tree.",
            items: ["branch", "berries"],
            enemies: [],
            next: { north: "caveEntrance", east: "riverbank", west: "hillside" },
            npc: { name: "weary traveler", friendly: true, wantsHelp: true }
        },
        riverbank: {
            description: "You stand by a flowing river. The water is cold and clear. To the west is the forest.",
            items: ["fishing rod"],
            enemies: [],
            next: { west: "forest" },
        },
        hillside: {
            description: "You stand on a hillside, overlooking the forest. A trail leads east back to the forest.",
            items: ["rope"],
            enemies: [{ name: "wild boar", health: 15 }],
            next: { east: "forest" },
        },
    },
    synonyms: {
        // (All the synonyms remain exactly as you had them)
        // No changes to synonyms or logic, as requested
        look: [
            "look","examine","inspect","view","peer","see","observe","check","glance","stare","gaze","scrutinize",
            "study","scan","perceive","watch","consider","survey","have a look","take a look","look around",
            "examine surroundings","inspect area","scan room","check place","survey surroundings","examine room",
            "look closely","look carefully","look here","what do i see","describe area","inspect environment",
            "look over","examine carefully","check out","look upon","eye the area","look about","inspect surroundings",
            "look around carefully","look thoroughly","examine in detail","look here closely","i look around","i examine this place"
        ],
        take: [
            "take","grab","pick","take x","take the x","take the","pick up","seize","collect","acquire","obtain",
            "get hold of","snatch","remove","lift","get","claim","retrieve","fetch","steal","pluck","harvest","bag",
            "pocket","add to inventory","take item","get item","yank","pull","hoard","pickup","scoop up","gather",
            "took","i took","i take","have taken","i have taken","grabbed","pick it up","pick that up","snatched",
            "i grabbed","i got","i obtained",
            "i pick it","i pick it up now","take that item","grab that thing","add that to my inventory","acquire that"
        ],
        attack: [
            "attack","fight","hit","strike","punch","stab","slash","swing at","assault","bash","smack","clobber",
            "whack","beat up","engage","pummel","thrash","clout","hammer","lunge at","charge at","go after","kick",
            "headbutt","wrestle","duel","clash with","swing sword","swing weapon","use weapon","smite","jab",
            "cut","slice","bash skull","try to kill",
            "i attack","i hit","i strike","i fight","go on the offensive","launch an attack","throw a punch",
            "slash at","stab at","hack at",
            "i swing at the enemy","i try to harm it","i assault it","i attempt to kill this enemy","i try to strike"
        ],
        north: [
            "north","go north","move north","head north","proceed north","travel north","northward","to north",
            "venture north","walk north","step north","head up","go upwards","north direction",
            "i go north","i head north","move upward","northwards","go toward north",
            "proceed upwards","move in northern direction","advance north"
        ],
        south: [
            "south","go south","move south","head south","proceed south","travel south","southward","to south",
            "venture south","walk south","step south","head down","go downwards","south direction",
            "i go south","i head south","move downward","southwards","go toward south",
            "move in southern direction","proceed southwards","advance south"
        ],
        east: [
            "east","go east","move east","head east","proceed east","travel east","eastward","to east",
            "venture east","walk east","step east","east direction","go right way",
            "i go east","i head east","eastwards","move right","go towards east",
            "move in eastern direction","proceed eastwards","advance east"
        ],
        west: [
            "west","go west","move west","head west","proceed west","travel west","westward","to west",
            "venture west","walk west","step west","west direction","go left way",
            "i go west","i head west","westwards","move left","go towards west",
            "move in western direction","proceed westwards","advance west"
        ],
        up: [
            "up","go up","move up","climb up","head up","ascend","upward","go upward","go upstairs","go upward path",
            "i go up","i ascend","move upwards","head upwards","ascend upward",
            "climb upwards","advance upwards","go higher"
        ],
        down: [
            "down","go down","move down","climb down","descend","downward","go downward","go downstairs","go downward path",
            "i go down","i descend","move downwards","head downwards",
            "move lower","go beneath","descend lower"
        ],
        left: [
            "left","go left","move left","step left","head left","turn left","veer left","to the left",
            "i go left","i move left","move to the left side","head to the left",
            "proceed left","advance left","go in left direction"
        ],
        right: [
            "right","go right","move right","step right","head right","turn right","veer right","to the right",
            "i go right","i move right","move to the right side","head to the right",
            "proceed right","advance right","go in right direction"
        ],
        back: [
            "back","go back","move back","head back","return","go backward","go backwards","go behind","retreat",
            "i go back","i return","move backwards","head backward","retreat back",
            "go back where I came from","step back","move backward"
        ],
        forward: [
            "forward","go forward","move forward","head forward","proceed forward","advance","go forth","go straight",
            "i go forward","i move forward","i advance","move straight ahead","go straight ahead",
            "go straight on","proceed ahead","continue forward"
        ],
        run: [
            "run","sprint","dash","bolt","hurry","rush","flee","escape","leg it","make a run for it","race",
            "charge away","hightail","scurry","scuttle","beat it","clear out","jog","run away","run off","run forward",
            "i run","i dash","i sprint","take off running","run quickly","run fast",
            "i flee","i hurry away","i scurry off","i sprint away","i move fast"
        ],
        jump: [
            "jump","leap","hop","bounce","spring","vault","bound","skip",
            "i jump","i leap","i hop","i bounce","i spring",
            "i vault","i bound","i skip around","i try jumping"
        ],
        climb: [
            "climb","scaling","go climbing","scramble up","clamber","ascend using hands","climb upwards",
            "i climb","i scramble","i clamber up","i scale","attempt to climb",
            "i try to climb up","i try scaling","i climb carefully","climb higher"
        ],
        crawl: [
            "crawl","creep","go on all fours","slither","move low","crawl around","crawl slowly",
            "i crawl","i creep","move lowly","go crawling","i slither",
            "i crawl around","i creep along","i slink","i move on hands and knees"
        ],
        duck: [
            "duck","crouch","bend down","lower yourself","kneel","stoop","hunch down",
            "i duck","i crouch","i kneel","i lower myself","bend low",
            "i stoop down","i hunch down","i get low","i duck low"
        ],
        dance: [
            "dance","boogie","groove","shake it","jig","twirl","waltz","tap dance","breakdance",
            "i dance","i boogie","i groove","i shake it","start dancing","dance around",
            "i do a jig","i waltz","i breakdance","i dance happily"
        ],
        pickNose: [
            "pick nose","pick your nose","dig nose","nose pick","clean nostril","dig in nostril","extract booger",
            "i pick my nose","i dig my nose","i clean my nostril","nose digging",
            "i pick my nostril","i remove booger","i do something gross","i pick at my nose"
        ],
        sing: [
            "sing","croon","hum a tune","belt out a song","serenade","chant","warble","carol",
            "i sing","i hum","i croon","i belt out a song","start singing",
            "i serenade","i chant","i warble","i sing loudly","i try singing"
        ],
        yell: [
            "yell","shout","scream","call out","holler","bellow","cry out","roar",
            "i yell","i shout","i scream","i holler","i roar","yell loudly","shout out loud",
            "i bellow","i call out loudly","i cry out","i make noise","i scream loudly"
        ],
        inventory: [
            "inventory","inv","show inventory","what do i have","check bag","check pouch","items on me","my stuff",
            "my items","open inventory","open bag","examine inventory","list items","what am i carrying",
            "i check my stuff","check my items","show me what i have","my inventory","show my inventory","look in my bag",
            "what am i holding","what is in my inventory","view my items","display my stuff","check what i got"
        ],
        help: [
            "help","instructions","what can i do","commands","assist","how to play","guide","explain","show help",
            "help me","what are my options","i need help",
            "i need instructions","give me help","tell me what i can do","how do i play","help please",
            "show commands","give guidance","explain controls","need assistance","what are my choices"
        ],
        use: [
            "use","utilize","apply","wield","equip","put on","activate","operate","make use of","handle",
            "use item","use weapon","use tool","employ",
            "i use","i equip","i apply","i wield","try using","try equipping","attempt to use","attempt to equip",
            "i try to use","i try to equip","i operate this","i make use of it","i attempt to handle"
        ],
        equip: [
            "equip","arm","wield","hold weapon","ready weapon","prepare sword","draw weapon","put weapon in hand",
            "i equip","i arm myself","i wield it","i hold my weapon","i ready my weapon","i draw my blade","i prepare my sword",
            "i get my weapon ready","i arm up","i equip my gear","i hold my sword tightly"
        ],
        talk: [
            "talk","speak","converse","chat","address","greet","say hello","ask","question","communicate","engage in dialogue",
            "i talk","i speak","i converse","talk to npc","speak to npc","talk with them","speak with them","have a conversation",
            "i say something","i try to talk","i greet them","i attempt to communicate","i ask them something"
        ],
        trade: [
            "trade","barter","exchange","offer","negotiate","deal","swap",
            "i trade","i barter","i exchange","make a deal","attempt to trade","attempt to barter",
            "i try to trade","i offer an exchange","i negotiate","i attempt a deal"
        ],
        give: [
            "give","offer item","hand over","present","deliver","donate","contribute",
            "i give","i offer","i hand over","i present","i deliver","i donate","i contribute","try giving","try offering",
            "i give them something","i hand something over","i offer this item","i provide this object"
        ],
        eat: [
            "eat","consume","devour","bite","taste","chew","ingest",
            "i eat","i consume","i devour","i bite","i taste","i chew","i ingest","try eating","start eating",
            "i try to eat","i nibble","i munch","i swallow","i take a bite"
        ],
        drink: [
            "drink","sip","gulp","quench","swallow","imbibe",
            "i drink","i sip","i gulp","i swallow","try drinking","start drinking","drink some",
            "i take a sip","i try to drink","i swallow some","i imbibe","i quench thirst"
        ],
        goto: [
            "go to","approach","move to","walk to","head to","approach the","go towards","move towards",
            "i go to","i approach","i move to","i walk to","i head to","i go towards","move closer","approach that",
            "i move closer to it","i try approaching","i head toward it","i attempt to approach","go near it"
        ]
    },
    inventory: [],
    player: {
        attackPower: 10,
        weapon: null
    },
};

function openZorkModal() {
    const modal = document.getElementById("zorkModal");
    modal.classList.remove("hidden");
    startZorkGame();
}

function closeZorkModal() {
    const modal = document.getElementById("zorkModal");
    modal.classList.add("hidden");
}

function startZorkGame() {
    outputBox = document.getElementById("output");
    inputBox = document.getElementById("input");

    outputBox.textContent = "";
    inputBox.value = "";

    if (!gameData.currentRoom || !gameData.rooms[gameData.currentRoom]) {
        addOutput("Error: Starting room not found!");
        return;
    }

    addOutput(gameData.rooms[gameData.currentRoom].description);
    inputBox.focus();

    inputBox.removeEventListener("keyup", handleZorkInput);
    inputBox.addEventListener("keyup", handleZorkInput);
}

function addOutput(text) {
    const newParagraph = document.createElement("p");
    newParagraph.textContent = text;
    outputBox.appendChild(newParagraph);
    outputBox.scrollTop = outputBox.scrollHeight;
}

function handleZorkInput(event) {
    if (event.key === "Enter") {
        const command = inputBox.value.trim().toLowerCase();
        inputBox.value = "";
        processCommand(command);
    }
}

function matchesSynonym(input, synonym) {
    const spacedInput = " " + input + " ";
    const spacedSynonym = " " + synonym + " ";
    return spacedInput.includes(spacedSynonym);
}

function processCommand(input) {
    let commandRecognized = false;
    for (let action in gameData.synonyms) {
        for (let synonym of gameData.synonyms[action]) {
            if (matchesSynonym(input, synonym)) {
                executeCommand(action, input, gameData.rooms[gameData.currentRoom]);
                commandRecognized = true;
                return;
            }
        }
    }
    if (!commandRecognized) {
        addOutput("I don't understand that command. Try something else.");
    }
}

function executeCommand(action, input, currentRoom) {

    function showRoomDetails() {
        addOutput(currentRoom.description);
        if (currentRoom.items && currentRoom.items.length > 0) addOutput(`You see: ${currentRoom.items.join(", ")}`);
        if (currentRoom.enemies && currentRoom.enemies.length > 0) addOutput(`Enemies present: ${currentRoom.enemies.map(e => e.name).join(", ")}`);
        const exits = currentRoom.next ? Object.keys(currentRoom.next) : [];
        if (exits.length > 0) {
            addOutput(`Exits: ${exits.join(", ")}`);
        }
        if (currentRoom.npc) {
            addOutput(`You notice a ${currentRoom.npc.name} here.`);
        }
    }

    function getWeaponBonus() {
        if (gameData.player.weapon === "sword") {
            return 10;
        }
        return 0;
    }

    function attackEnemy(enemy) {
        const damage = gameData.player.attackPower + getWeaponBonus();
        enemy.health -= damage;
        addOutput(`You strike the ${enemy.name} for ${damage} damage! Its health is now ${enemy.health}.`);
        if (enemy.health <= 0) {
            addOutput(`You have vanquished the ${enemy.name}!`);
            currentRoom.enemies = [];
        } else {
            addOutput(`The ${enemy.name} snarls and prepares to retaliate. Be careful!`);
        }
    }

    function talkToNPC(npc) {
        if (!npc) {
            addOutput("There's no one here to talk to.");
            return;
        }
        if (npc.name === "weary traveler" && npc.wantsHelp) {
            addOutput("The weary traveler looks up and says: 'I'm injured. If you give me some berries to eat, I can heal. Will you help me?'");
            addOutput("You can CHOOSE: give berries (if you have them) or refuse. Your choice may have consequences...");
        } else if (npc.name === "cloaked figure" && npc.hasQuest) {
            addOutput(`The cloaked figure whispers: 'I seek the strange amulet. Bring it to me and I shall reward you. Will you help or betray me?'`);
        } else {
            addOutput(`You talk to the ${npc.name}. It doesn't have much to say.`);
        }
    }

    function giveItemToNPC(npc, item) {
        if (!npc) {
            addOutput("There's no one to give items to here.");
            return;
        }
        const itemIndex = gameData.inventory.indexOf(item);
        if (itemIndex === -1) {
            addOutput(`You don't have a ${item}.`);
            return;
        }
        if (npc.name === "weary traveler" && item === "berries") {
            gameData.inventory.splice(itemIndex, 1);
            addOutput("You give the berries to the weary traveler. He thanks you and hands you a healing potion!");
            gameData.inventory.push("healing potion");
            npc.wantsHelp = false;
        } else {
            addOutput(`You give the ${item} to the ${npc.name}. They nod quietly.`);
            gameData.inventory.splice(itemIndex, 1);
        }
    }

    if (action === "take") {
        const item = currentRoom.items ? currentRoom.items.find(i => input.includes(i)) : null;
        if (item) {
            gameData.inventory.push(item);
            currentRoom.items = currentRoom.items.filter(i => i !== item);
            addOutput(`You take the ${item}.`);
        } else {
            addOutput("There's nothing here to take.");
        }

    } else if (action === "look") {
        showRoomDetails();

    } else if (["north","south","east","west","up","down","left","right","back","forward"].includes(action)) {
        const directionMap = {
            north: "north", south: "south", east: "east", west: "west",
            up: "north", down: "south",
            left: "west", right: "east",
            back: "south", forward: "north"
        };
        const dir = directionMap[action];
        if (dir && currentRoom.next && currentRoom.next[dir]) {
            gameData.currentRoom = currentRoom.next[dir];
            addOutput(gameData.rooms[gameData.currentRoom].description);
        } else {
            addOutput("You can't go that way.");
        }

    } else if (action === "attack") {
        if (currentRoom.enemies && currentRoom.enemies.length > 0) {
            const enemy = currentRoom.enemies[0];
            attackEnemy(enemy);
        } else {
            addOutput("There's nothing here to attack.");
        }

    } else if (action === "run") {
        addOutput("You try to run, but end up where you started. Perhaps choose a direction instead.");

    } else if (action === "jump") {
        addOutput("You jump around. It doesn't accomplish much.");

    } else if (action === "climb") {
        addOutput("You try to climb but find nothing suitable to scale.");

    } else if (action === "crawl") {
        addOutput("You crawl on the floor. It's cold and uncomfortable.");

    } else if (action === "duck") {
        addOutput("You duck down. Nothing passes overhead.");

    } else if (action === "dance") {
        addOutput("You dance merrily. It lightens your mood but changes little else.");

    } else if (action === "pickNose") {
        addOutput("You pick your nose, feeling a bit silly. No one saw that, right?");

    } else if (action === "sing") {
        addOutput("You sing a tune, your voice echoing in the surroundings.");

    } else if (action === "yell") {
        addOutput("You yell loudly. The echo returns, mocking your outburst.");

    } else if (action === "inventory") {
        if (gameData.inventory.length === 0) {
            addOutput("Your inventory is empty.");
        } else {
            addOutput("You are carrying: " + gameData.inventory.join(", "));
        }

    } else if (action === "help") {
        addOutput("You can look, take items, attack enemies, move in directions, check inventory, run, jump, climb, dance, sing, yell, use or equip items, talk to NPCs, trade, give items, and more. Experiment and see what happens!");
        addOutput("You might find swords to increase your attack power, potions to heal, and NPCs offering quests or moral dilemmas.");

    } else if (action === "use" || action === "equip") {
        if (input.includes("sword") && gameData.inventory.includes("sword")) {
            gameData.player.weapon = "sword";
            addOutput("You equip the sword, feeling its weight. Your attack power grows!");
        } else if (input.includes("potion") && gameData.inventory.includes("healing potion")) {
            addOutput("You drink the healing potion. You feel invigorated! (For now, this just makes you feel good.)");
            const potIndex = gameData.inventory.indexOf("healing potion");
            if (potIndex !== -1) {
                gameData.inventory.splice(potIndex, 1);
            }
        } else {
            addOutput("You try to use or equip that, but nothing happens.");
        }

    } else if (action === "talk") {
        if (currentRoom.npc) {
            talkToNPC(currentRoom.npc);
        } else {
            addOutput("There's no one here to talk to.");
        }

    } else if (action === "trade" || action === "give") {
        const words = input.split(" ");
        const possibleItem = words[words.length-1];
        if (currentRoom.npc) {
            giveItemToNPC(currentRoom.npc, possibleItem);
        } else {
            addOutput("There's no one here to trade with.");
        }

    } else if (action === "eat") {
        if (input.includes("berries") && gameData.inventory.includes("berries")) {
            addOutput("You eat the berries. They taste sweet and give you a slight boost of energy.");
            const berryIndex = gameData.inventory.indexOf("berries");
            if (berryIndex !== -1) {
                gameData.inventory.splice(berryIndex, 1);
            }
        } else {
            addOutput("You have nothing edible or you're not sure what to eat.");
        }

    } else if (action === "drink") {
        addOutput("You don't have anything suitable to drink right now.");

    } else if (action === "goto") {
        let recognizedTarget = false;
        if (currentRoom.items) {
            for (let i of currentRoom.items) {
                if (input.includes(i)) {
                    addOutput(`You move closer to the ${i}. It's right here at your feet.`);
                    recognizedTarget = true;
                    break;
                }
            }
        }

        if (!recognizedTarget && currentRoom.npc && input.includes(currentRoom.npc.name)) {
            addOutput(`You approach the ${currentRoom.npc.name}. They acknowledge your presence.`);
            recognizedTarget = true;
        }

        if (!recognizedTarget) {
            addOutput("Good try, but you can't do that.");
        }

    } else {
        addOutput("You can't do that here.");
    }
}
