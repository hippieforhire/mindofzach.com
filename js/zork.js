// zork.js

let outputBox, inputBox;

// Remember to fix all story typos:
const gameData = {
    currentRoom: "homeVillage",
    questStates: {
        cloakedFigure: "none" // For hermit quest
    },
    rooms: {
        homeVillage: {
            description: "You stand in the small village square of Addy's home. The houses are quiet. Addy is 12 years old and has just discovered her parents, Zach and Skye, are missing, taken by a mysterious monster. On the ground lies a wooden sword and a lantern.",
            items: ["wooden sword", "lantern"],
            enemies: [],
            next: { north: "forestPath", south: "farmField" },
        },
        forestPath: {
            description: "A narrow forest path stretches ahead, flanked by tall trees. You hear distant howls. On the ground is a cloth scrap that looks like it came from Skye's dress. This path might lead you closer to the monster's lair.",
            items: ["cloth scrap"],
            enemies: [{ name: "wild wolf", health: 20 }],
            next: { south: "homeVillage", north: "oldRuin" },
        },
        oldRuin: {
            description: "Deep in the woods, you find old ruins overgrown with moss and glowing mushrooms. A broken pillar stands at the center. A hermit stands silently nearby. Rumor has it this hermit knows of the monster that took Zach and Skye.",
            items: ["family ring"],
            enemies: [{ name: "giant rat", health: 30 }],
            next: { south: "forestPath" },
            npc: { name: "hermit", friendly: true, hasQuest: true }
        },
        farmField: {
            description: "A quiet farm field with gently swaying crops. To the east, a shallow river crossing glistens. To the west, a rough hillside path leads to a bandit camp. A friendly farmer stands by a fence, perhaps she has seen something?",
            items: ["milk bottle", "apple"],
            enemies: [],
            next: { north: "homeVillage", east: "riverCrossing", west: "banditCamp" },
            npc: { name: "friendly farmer", friendly: true, wantsHelp: true }
        },
        riverCrossing: {
            description: "You stand by a shallow river crossing. The water is icy cold. To the west is the farm field.",
            items: ["fishing net"],
            enemies: [],
            next: { west: "farmField" },
        },
        banditCamp: {
            description: "You see a small bandit camp perched on the hillside. The bandits may know something about the monster. East leads back to the farm field.",
            items: ["rope"],
            enemies: [{ name: "bandit", health: 15 }],
            next: { east: "farmField" },
        },
    },

    synonyms: {
        // Added more synonyms, including direction variations, and more item interaction words.
        look: ["look","examine","inspect","view","peer","see","observe","check","glance","stare","gaze","scrutinize",
               "study","scan","perceive","watch","consider","survey","have a look","take a look","look around",
               "examine surroundings","inspect area","scan room","check place","survey surroundings","examine room",
               "look closely","look carefully","look here","what do i see","describe area","inspect environment",
               "look over","examine carefully","check out","look upon","eye the area","look about","inspect surroundings",
               "look around carefully","look thoroughly","examine in detail","look here closely","i look around","i examine this place",
               "look at","examine the","check the","look around you","examine this place","inspect here","observe the area"],
        take: ["take","grab","pick","pick up","seize","collect","acquire","obtain","get hold of","snatch","remove","lift","get",
               "claim","retrieve","fetch","steal","pluck","harvest","bag","pocket","add to inventory","take item","get item","yank",
               "pull","hoard","pickup","scoop up","gather","take that","grab that","get that","nab","take it","grab it","get it",
               "pick it up","snatch it","i take","i grab","i got","i obtain","i pick up","i scoop up","i gather","take sword",
               "grab sword","take lantern","grab lantern","acquire sword","acquire lantern"],
        attack: ["attack","fight","hit","strike","punch","stab","slash","swing at","assault","bash","smack","clobber","whack",
                 "beat up","engage","pummel","thrash","clout","hammer","lunge at","charge at","go after","kick","headbutt","wrestle",
                 "duel","clash with","swing sword","swing weapon","use weapon","smite","jab","cut","slice","bash skull","try to kill",
                 "i attack","i hit","i strike","i fight","go on the offensive","launch an attack","throw a punch","slash at","stab at",
                 "hack at","i swing at the enemy","i try to harm it","i assault it","i attempt to kill this enemy","i try to strike"],
        // Move includes extensive synonyms, including direct directions and phrases
        move: ["go","move","head","proceed","travel","venture","walk","step","go towards","go to","approach","advance","continue",
               "make my way","go into","enter","go in","move into","walk into","venture into","head into","enter the","go inside",
               "climb into","crawl into","i enter","i go in","i go inside","i go into","i try to enter","i move into","walk north",
               "walk south","walk east","walk west","go north","go south","go east","go west","move north","move south","move east","move west",
               "head north","head south","head east","head west","proceed north","proceed south","proceed east","proceed west",
               "travel north","travel south","travel east","travel west","venture north","venture south","venture east","venture west",
               "go forward","go left","go right","turn north","turn south","turn east","turn west","walk forward","move forward"],
        run: ["run","sprint","dash","bolt","hurry","rush","flee","escape","leg it","make a run for it","race","charge away","hightail",
              "scurry","scuttle","beat it","clear out","jog","run away","run off","run forward","i run","i dash","i sprint","take off running",
              "run quickly","run fast","i flee","i hurry away","i scurry off","i sprint away","i move fast"],
        jump: ["jump","leap","hop","bounce","spring","vault","bound","skip","i jump","i leap","i hop","i bounce","i spring","i vault","i bound","i skip around","i try jumping"],
        climb: ["climb","scaling","go climbing","scramble up","clamber","ascend","climb upwards","climb up","climb down","i climb",
                "i scramble","i clamber up","i scale","attempt to climb","i try to climb up","i try scaling","i climb carefully",
                "climb higher","climb lower","clamber down","scramble down"],
        crawl: ["crawl","creep","go on all fours","slither","move low","crawl around","crawl slowly","i crawl","i creep","move lowly",
                "go crawling","i slither","i crawl around","i creep along","i slink","i move on hands and knees"],
        duck: ["duck","crouch","bend down","lower yourself","kneel","stoop","hunch down","i duck","i crouch","i kneel","i lower myself",
               "bend low","i stoop down","i hunch down","i get low","i duck low"],
        dance: ["dance","boogie","groove","shake it","jig","twirl","waltz","tap dance","breakdance","i dance","i boogie","i groove",
                "i shake it","start dancing","dance around","i do a jig","i waltz","i breakdance","i dance happily"],
        pickNose: ["pick nose","pick your nose","dig nose","nose pick","clean nostril","dig in nostril","extract booger","i pick my nose",
                   "i dig my nose","i clean my nostril","nose digging","i pick my nostril","i remove booger","i do something gross","i pick at my nose"],
        sing: ["sing","croon","hum a tune","belt out a song","serenade","chant","warble","carol","i sing","i hum","i croon","i belt out a song","start singing",
               "i serenade","i chant","i warble","i sing loudly","i try singing"],
        yell: ["yell","shout","scream","call out","holler","bellow","cry out","roar","i yell","i shout","i scream","i holler","i roar",
               "yell loudly","shout out loud","i bellow","i call out loudly","i cry out","i make noise","i scream loudly"],
        inventory: ["inventory","inv","show inventory","what do i have","check bag","check pouch","items on me","my stuff","my items",
                    "open inventory","open bag","examine inventory","list items","what am i carrying","i check my stuff","check my items","show me what i have",
                    "my inventory","show my inventory","look in my bag","what am i holding","what is in my inventory","view my items","display my stuff","check what i got"],
        help: ["help","instructions","what can i do","commands","assist","how to play","guide","explain","show help","help me","what are my options",
               "i need help","i need instructions","give me help","tell me what i can do","how do i play","help please","show commands","give guidance",
               "explain controls","need assistance","what are my choices","help commands","help instructions","need help","what can i say"],
        use: ["use","utilize","apply","wield","equip","put on","activate","operate","make use of","handle","use item","use weapon","use tool",
              "employ","i use","i equip","i apply","i wield","try using","try equipping","attempt to use","attempt to equip","i try to use","i try to equip",
              "i operate this","i make use of it","i attempt to handle","light","ignite","turn on","hold up","shine"], // Added lantern synonyms
        equip: ["equip","arm","wield","hold weapon","ready weapon","prepare sword","draw weapon","put weapon in hand","i equip","i arm myself","i wield it",
                "i hold my weapon","i ready my weapon","i draw my blade","i prepare my sword","i get my weapon ready","i arm up","i equip my gear","i hold my sword tightly"],
        talk: ["talk","speak","converse","chat","address","greet","say hello","ask","question","communicate","engage in dialogue","i talk","i speak","i converse",
               "talk to npc","speak to npc","talk with them","speak with them","have a conversation","i say something","i try to talk","i greet them","i attempt to communicate",
               "i ask them something","talk to","speak to","ask about","ask npc","ask person","ask hermit","ask farmer"],
        trade: ["trade","barter","exchange","offer","negotiate","deal","swap","i trade","i barter","i exchange","make a deal","attempt to trade","attempt to barter",
                "i try to trade","i offer an exchange","i negotiate","i attempt a deal","give item","give something","hand over item","present item"],
        give: ["give","offer item","hand over","present","deliver","donate","contribute","i give","i offer","i hand over","i present","i deliver","i donate","i contribute",
               "try giving","try offering","i give them something","i hand something over","i offer this item","i provide this object","give them","give npc"],
        eat: ["eat","consume","devour","bite","taste","chew","ingest","i eat","i consume","i devour","i bite","i taste","i chew","i ingest","try eating","start eating",
              "i try to eat","i nibble","i munch","i swallow","i take a bite","eat apple","have a snack","eat something"],
        drink: ["drink","sip","gulp","quench","swallow","imbibe","i drink","i sip","i gulp","i swallow","try drinking","start drinking","drink some","i take a sip",
                "i try to drink","i swallow some","i imbibe","i quench thirst"],
        listen: ["listen","hear","i listen","i hear","listen carefully","i try to listen","listen closely","what do i hear","do i hear anything","listen around","focus hearing"],
        smell: ["smell","sniff","i smell","i sniff","what do i smell","scent","inhale","breathe in","sniff around","take a whiff"],
        feel: ["feel","touch","i feel","i touch","what do i feel","feel around","touch around","pat around","grope around","run hands over surroundings","sense by touch"]
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

function matchesSynonym(input, synonyms) {
    const spacedInput = " " + input + " ";
    return synonyms.some(syn => {
        const spacedSyn = " " + syn + " ";
        return spacedInput.includes(spacedSyn);
    });
}

let lastMentionedItem = null; // Track last item mentioned by player to handle "take it" etc.

function processCommand(input) {
    if (input === "") {
        return;
    }
    addOutput("> " + input);

    const currentRoom = gameData.rooms[gameData.currentRoom];

    // Handle hermit quest states
    if (gameData.currentRoom === "oldRuin" && currentRoom.npc && currentRoom.npc.hasQuest) {
        if (gameData.questStates.cloakedFigure === "none" || gameData.questStates.cloakedFigure === "asked") {
            if (input.includes("help") || input.includes("assist") || input.includes("yes") || input.includes("ok") || input.includes("sure")) {
                gameData.questStates.cloakedFigure = "helping";
                addOutput("The hermit nods: 'Find the family ring hidden here. Bring it to me, and I'll guide you to where the monster took your parents.'");
                return;
            } else if (input.includes("betray") || input.includes("no") || input.includes("refuse") || input.includes("never")) {
                gameData.questStates.cloakedFigure = "betraying";
                addOutput("The hermit scowls: 'Then leave, child, and never return!'");
                return;
            }
        }
    }

    let action = null;

    // If user input is a lone direction or includes a direction, we might interpret as move even if no synonyms matched
    const directionWords = ["north","south","east","west","n","s","e","w","up","down","left","right","forward"];
    // Check if input is basically a move command by itself or ended up no synonyms matched
    // We'll first try synonyms. If fail, we attempt direction logic.

    for (let key in gameData.synonyms) {
        if (matchesSynonym(input, gameData.synonyms[key])) {
            action = key;
            break;
        }
    }

    // If no action found and user typed something like "north" or "go north" not matched yet
    if (!action) {
        // Check if input likely means move
        for (let dirWord of directionWords) {
            if (input.includes(dirWord)) {
                action = "move";
                break;
            }
        }
    }

    if (!action) {
        addOutput("I don't understand that command. Try something else.");
        return;
    }

    executeCommand(action, input, currentRoom);
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
        return (gameData.player.weapon === "sword") ? 10 : 0;
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
        if (npc.name === "friendly farmer" && npc.wantsHelp) {
            addOutput("The friendly farmer says: 'Oh, Addy! I've seen strange figures passing by. If you bring me an apple from my field, I can make you a healing potion. Will you help me?'");
        } else if (npc.name === "hermit" && npc.hasQuest) {
            if (gameData.questStates.cloakedFigure === "none") {
                addOutput("The hermit speaks: 'I know who took Zach and Skye. Bring me the family ring you can find here, and I'll help you. Will you help or betray me?'");
                gameData.questStates.cloakedFigure = "asked";
            } else if (gameData.questStates.cloakedFigure === "helping") {
                addOutput("The hermit waits patiently for the family ring.");
            } else if (gameData.questStates.cloakedFigure === "betraying") {
                addOutput("The hermit ignores you, glaring silently.");
            } else {
                addOutput("The hermit stands silently.");
            }
        } else {
            addOutput(`You talk to the ${npc.name}, but they have little to share right now.`);
        }
    }

    function giveItemToNPC(npc, item) {
        if (!npc) {
            addOutput("There's no one to give items to here.");
            return;
        }
        const targetItem = findItemInInventory(item);
        if (!targetItem) {
            addOutput(`You don't have ${item}.`);
            return;
        }

        if (npc.name === "friendly farmer" && targetItem === "apple") {
            removeItemFromInventory("apple");
            addOutput("You give the apple to the friendly farmer. She smiles and hands you a healing potion in return!");
            gameData.inventory.push("healing potion");
            npc.wantsHelp = false;
        } else if (npc.name === "hermit" && targetItem === "family ring" && gameData.questStates.cloakedFigure === "helping") {
            removeItemFromInventory("family ring");
            addOutput("You present the family ring. The hermit nods: 'Excellent. The monster who took Zach and Skye lurks beyond these woods. I bless your weapon.' Your attack power increases!");
            gameData.player.attackPower += 10;
            gameData.questStates.cloakedFigure = "completed";
            addOutput("Now you know where to go next. Seek out hidden paths and defeat that monster to save your parents!");
        } else {
            removeItemFromInventory(targetItem);
            addOutput(`You give the ${targetItem} to the ${npc.name}. They nod quietly.`);
        }
    }

    function removeItemFromInventory(itemName) {
        const idx = gameData.inventory.indexOf(itemName);
        if (idx !== -1) gameData.inventory.splice(idx, 1);
    }

    function findItemInInventory(itemName) {
        // Attempt exact match first
        if (gameData.inventory.includes(itemName)) return itemName;
        // Attempt partial matches: if user typed "sword" and we have "wooden sword"
        let lowered = itemName.toLowerCase();
        for (let invItem of gameData.inventory) {
            if (invItem.toLowerCase().includes(lowered)) {
                return invItem;
            }
        }
        return null;
    }

    function findItemInRoom(input) {
        if (!currentRoom.items) return null;
        if (input.includes("it")) {
            // If user said "take it" and we have a lastMentionedItem or only one item in room
            if (lastMentionedItem && currentRoom.items.includes(lastMentionedItem)) return lastMentionedItem;
            if (currentRoom.items.length === 1) return currentRoom.items[0];
        }

        // Try exact match
        for (let item of currentRoom.items) {
            if (input.includes(item)) {
                lastMentionedItem = item;
                return item;
            }
        }

        // Try partial matches (e.g. user says "grab sword" but item is "wooden sword")
        let words = input.split(" ");
        for (let item of currentRoom.items) {
            // Check if any keyword from the item is in input
            let itemWords = item.toLowerCase().split(" ");
            for (let iw of itemWords) {
                if (iw && iw.length > 2 && input.includes(iw)) {
                    lastMentionedItem = item;
                    return item;
                }
            }
        }

        return null;
    }

    function tryMove(input, currentRoom) {
        // If user just typed "north", "n", "east", etc. handle that
        const dirMap = {
            north: ["north","n","up","forward"],
            south: ["south","s","down","backward"],
            east: ["east","e","right"],
            west: ["west","w","left"]
        };

        let chosenDir = null;

        // First try to find a direction by direct synonyms
        outerDirLoop:
        for (let dir in dirMap) {
            for (let syn of dirMap[dir]) {
                if (input.includes(syn)) {
                    chosenDir = dir;
                    break outerDirLoop;
                }
            }
        }

        // If no chosenDir from direct synonyms, try location-based matching (existing code)
        if (!chosenDir) {
            for (let dir in currentRoom.next) {
                const roomKey = currentRoom.next[dir];
                const roomName = roomKey.toLowerCase();
                if (input.includes(roomName)) {
                    chosenDir = dir;
                    break;
                }
            }
        }

        // If still no direction found, try location keywords
        if (!chosenDir) {
            const locationWords = ["forest","village","farm","river","bandit","ruin"];
            for (let dir in currentRoom.next) {
                const targetRoomKey = currentRoom.next[dir];
                for (let w of locationWords) {
                    if (targetRoomKey.toLowerCase().includes(w) && input.includes(w)) {
                        chosenDir = dir;
                        break;
                    }
                }
                if (chosenDir) break;
            }
        }

        if (chosenDir && currentRoom.next[chosenDir]) {
            gameData.currentRoom = currentRoom.next[chosenDir];
            addOutput(gameData.rooms[gameData.currentRoom].description);
        } else {
            addOutput("You can't go that way or enter that place right now.");
        }
    }

    if (action === "take") {
        const item = findItemInRoom(input);
        if (item) {
            gameData.inventory.push(item);
            currentRoom.items = currentRoom.items.filter(i => i !== item);
            addOutput(`You take the ${item}.`);
        } else {
            // If user said "take" but no item recognized and there's only one item available, take it
            if (currentRoom.items && currentRoom.items.length === 1 && (input === "take" || input === "grab" || input.endsWith("it"))) {
                const singleItem = currentRoom.items[0];
                gameData.inventory.push(singleItem);
                currentRoom.items.splice(0,1);
                addOutput(`You take the ${singleItem}.`);
            } else {
                addOutput("There's nothing here to take.");
            }
        }

    } else if (action === "look") {
        showRoomDetails();

    } else if (action === "attack") {
        if (currentRoom.enemies && currentRoom.enemies.length > 0) {
            const enemy = currentRoom.enemies[0];
            attackEnemy(enemy);
        } else {
            addOutput("There's nothing here to attack.");
        }

    } else if (action === "move") {
        tryMove(input, currentRoom);

    } else if (action === "run") {
        addOutput("You try to run, but end up where you started.");

    } else if (action === "jump") {
        addOutput("You jump around. It doesn't accomplish much.");

    } else if (action === "climb") {
        addOutput("You try to climb, but there's nothing suitable here.");

    } else if (action === "crawl") {
        addOutput("You crawl on the floor. It's cold and uncomfortable.");

    } else if (action === "duck") {
        addOutput("You duck down. Nothing passes overhead.");

    } else if (action === "dance") {
        addOutput("You dance merrily. It changes little, but you feel slightly more cheerful.");

    } else if (action === "pickNose") {
        addOutput("You pick your nose. Hopefully no one noticed.");

    } else if (action === "sing") {
        addOutput("You sing a tune, it echoes softly.");

    } else if (action === "yell") {
        addOutput("You yell loudly, the sound bouncing back.");

    } else if (action === "inventory") {
        if (gameData.inventory.length === 0) {
            addOutput("Your inventory is empty.");
        } else {
            addOutput("You are carrying: " + gameData.inventory.join(", "));
        }

    } else if (action === "help") {
        addOutput("You can move using many phrases: 'go north', 'walk east', 'head west', 'enter ruin', etc.");
        addOutput("Look around, take items, attack enemies, talk to NPCs, use/give items, eat, drink, listen, smell, feel, etc.");
        addOutput("Try natural phrases! Experiment and see what happens!");

    } else if (action === "use" || action === "equip") {
        // Check if user tries to use or equip something
        // Special handling for lantern: if user says "light lantern", "turn on lantern"
        if ((input.includes("lantern")) && gameData.inventory.includes("lantern")) {
            if (input.includes("light") || input.includes("ignite") || input.includes("turn on") || input.includes("shine") || input.includes("hold up")) {
                addOutput("You light the lantern. It glows warmly, helping you see better.");
            } else {
                addOutput("You hold the lantern. It's not lit, but you can try lighting it.");
            }
        } else if ((input.includes("sword") || input.includes("weapon")) && gameData.inventory.some(i => i.includes("sword"))) {
            gameData.player.weapon = "sword";
            addOutput("You equip your sword. Your attack power grows slightly!");
        } else if (input.includes("potion") && gameData.inventory.includes("healing potion")) {
            addOutput("You drink the healing potion. You feel invigorated!");
            removeItemFromInventory("healing potion");
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
        let possibleItem = words[words.length-1];
        // Strip punctuation
        possibleItem = possibleItem.replace(/[^a-z0-9 ]/g,'');

        if (currentRoom.npc) {
            giveItemToNPC(currentRoom.npc, possibleItem);
        } else {
            addOutput("There's no one here to trade with.");
        }

    } else if (action === "eat") {
        if (input.includes("apple") && gameData.inventory.includes("apple")) {
            addOutput("You eat the apple. It's crisp and sweet.");
            removeItemFromInventory("apple");
        } else {
            addOutput("You have nothing edible.");
        }

    } else if (action === "drink") {
        addOutput("You have nothing suitable to drink right now.");

    } else if (action === "listen") {
        addOutput("You pause and listen. Perhaps distant howls in the forest, quiet murmurs of a hermit, or wind through trees.");

    } else if (action === "smell") {
        addOutput("You inhale deeply. You smell damp earth, fresh crops, or musty ruin stones depending on where you are.");

    } else if (action === "feel") {
        addOutput("You feel around. Rough bark, soft moss, worn stone—your surroundings are tangible and real.");

    } else {
        addOutput("You can't do that here.");
    }
}
