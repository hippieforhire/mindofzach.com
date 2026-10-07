/* ============================================================
 * HOLLOW CREEK — a folk-horror text adventure
 * Engine: verb/noun parser, inventory, NPCs, quests, puzzles,
 * turn-based combat, moral choices, multiple endings, save/load.
 * UI contract: #zorkOutput (div), #zorkInput (input).
 * Test hook: window.HOLLOW.cmd(str) runs one command; .G is state.
 * ============================================================ */
(function () {
'use strict';

/* ---------------- utils ---------------- */
function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function listJoin(a) {
  if (!a.length) return 'nothing';
  if (a.length === 1) return a[0];
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}

/* ---------------- output ---------------- */
var outBox = null, inBox = null;
var outFn = null; // test hook
function print(t, cls) {
  if (outFn) { outFn(t, cls || ''); return; }
  if (!outBox) return;
  var d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = t;
  outBox.appendChild(d);
  outBox.scrollTop = outBox.scrollHeight;
}
function echoCmd(t) {
  if (!outBox) return;
  var d = document.createElement('div');
  d.className = 'echo';
  d.textContent = '> ' + t;
  outBox.appendChild(d);
  outBox.scrollTop = outBox.scrollHeight;
}
function hr() { print('— — —'); }

/* ---------------- items ---------------- */
var ITEMS = {
  knife:      { name: 'knife', desc: 'A worn drifter\'s knife. Better than fists.', weapon: [4, 7] },
  ticket:     { name: 'bus ticket', desc: 'A Greyhound stub: "HOLLOW CREEK — one way." The bus is gone.' },
  matches:    { name: 'matches', desc: 'A book of paper matches, half used.' },
  lantern:    { name: 'brass lantern', desc: 'An old brass lantern. It needs oil and a flame.' },
  oil:        { name: 'oil can', desc: 'A dented can of lamp oil, still half full.' },
  hatchet:    { name: 'hatchet', desc: 'A sharp hand axe. Good for wood — or worse.', weapon: [6, 11] },
  revolver:   { name: 'revolver', desc: 'A heavy .38 revolver. Six chambers.', weapon: [10, 16] },
  bullets:    { name: 'bullets', desc: 'Loose .38 rounds.', stack: true },
  silverbullets: { name: 'silver bullets', desc: 'Hand-cast silver rounds. Ada says they bite what lead can\'t.', stack: true },
  bread:      { name: 'bread', desc: 'A dense heel of rye bread.', food: 15 },
  bandage:    { name: 'bandage', desc: 'Clean rolled bandage.', heal: 35 },
  rope:       { name: 'rope', desc: 'A coil of hemp rope, frayed but strong.' },
  fuse:       { name: 'fuse', desc: 'A ceramic power fuse, intact.' },
  ironkey:    { name: 'iron key', desc: 'A heavy iron key, green with age.' },
  kerosene:   { name: 'kerosene', desc: 'A tin of kerosene. It sloshes, eager to burn.' },
  charm:      { name: 'river charm', desc: 'A stone carved with a wave. It feels cold, then warm — like a held breath.' },
  ledger:     { name: 'founders\' ledger', desc: 'A water-stained ledger. Names, dates — and a bargain written in something brown.' },
  coins:      { name: 'coins', desc: 'Money.', stack: true },
};

function iname(id) {
  if (id === 'lantern' && G && G.flags.lanternLit) return 'brass lantern (lit)';
  return ITEMS[id] ? ITEMS[id].name : id;
}
function findItem(word) {
  if (!word) return null;
  word = String(word).toLowerCase();
  var ids = Object.keys(ITEMS), i, j;
  for (i = 0; i < ids.length; i++) {
    if (ids[i] === word || ITEMS[ids[i]].name.toLowerCase() === word) return ids[i];
  }
  var parts = word.split(/\s+/), best = null;
  for (i = 0; i < ids.length; i++) {
    var nm = ITEMS[ids[i]].name.toLowerCase(), ok = true;
    for (j = 0; j < parts.length; j++) if (nm.indexOf(parts[j]) < 0) { ok = false; break; }
    if (ok) { if (best) return null; best = ids[i]; }
  }
  return best;
}
function hasItem(id) { return G.inv.indexOf(id) >= 0; }
function takeItem(id) { if (!hasItem(id)) G.inv.push(id); }
function removeItem(id) { var i = G.inv.indexOf(id); if (i >= 0) G.inv.splice(i, 1); }

/* ---------------- game state ---------------- */
var G = null;

var WEAPONS = [
  { id: 'revolver', min: 10, max: 16, needs: 'bullets' },
  { id: 'hatchet', min: 6, max: 11 },
  { id: 'knife', min: 4, max: 7 },
  { id: 'fists', min: 2, max: 4 },
];
function countItem(id) {
  if (ITEMS[id] && ITEMS[id].stack) return G.flags['count_' + id] | 0;
  return hasItem(id) ? 1 : 0;
}
function addStack(id, n) {
  var k = 'count_' + id;
  G.flags[k] = (G.flags[k] | 0) + n;
  if (G.flags[k] > 0 && !hasItem(id)) G.inv.push(id);
  if (G.flags[k] <= 0) { G.flags[k] = 0; removeItem(id); }
}
function bestWeapon() {
  for (var i = 0; i < WEAPONS.length; i++) {
    var w = WEAPONS[i];
    if (w.id === 'fists') return w;
    if (hasItem(w.id) && (!w.needs || countItem(w.needs) > 0)) return w;
  }
  return WEAPONS[WEAPONS.length - 1];
}

var QUESTS = {
  q_tomas:   { name: 'The Missing Brother',
    stages: ['Find Marla\'s brother Tomas.', 'You found Tomas at the mill.', 'Resolved.'] },
  q_lantern: { name: 'Light in the Dark',
    stages: ['Get the lantern burning.', 'The lantern is lit.'] },
  q_pump:    { name: 'Still Waters',
    stages: ['Restore power to the quarry pump.', 'The fuse is in. Pull the lever.', 'The quarry is drained.'] },
  q_witch:   { name: 'The Witch of Hollow Creek',
    stages: ['Decide Ada\'s fate.', 'Resolved.'] },
  q_pact:    { name: 'The Founders\' Pact',
    stages: ['You read the ledger. End the bargain.', 'The pact is broken.'] },
};
function questStage(q) { return (G.quests[q] == null ? -1 : G.quests[q]); }
function setQuest(q, s) { G.quests[q] = s; }

/* ============================================================
 * WORLD — rooms, NPCs, enemies
 * ============================================================ */
var ETYPES = {
  dog:    { name: 'feral dog', hp: 22, dmg: [4, 8], fleesAt: 7, aggro: true,
            desc: 'A rib-thin dog, foam at its jaws, eyes wrong somehow.',
            atk: ['lunges, teeth bared', 'snaps at your legs', 'hurls itself at you'] },
  hollow: { name: 'hollow man', hp: 46, dmg: [8, 14], fleesAt: 0, aggro: true,
            desc: 'It wears a man\'s shape the way a coat wears a hook. Water drips from its cuffs.',
            atk: ['swings a dead arm', 'rakes you with river-cold fingers', 'slams into you'] },
  drowned:{ name: 'the Drowned', hp: 130, dmg: [10, 18], fleesAt: 0, aggro: true, boss: true,
            desc: 'It unfolds from the black water — tall, patient, wearing every face the river ever took.',
            atk: ['lashes out with a drowned limb', 'pulls at you with the current', 'speaks your name in a voice like mud'] },
};

var NPCS = {
  marla:  { name: 'Marla', desc: 'The innkeeper. Flour on her hands, worry in her eyes.' },
  ferris: { name: 'Ferris', desc: 'An old man whittling on the church steps, like he\'s part of them.' },
  cole:   { name: 'Sheriff Cole', desc: 'A big man gone soft, with hard eyes. The tin star is polished; the man isn\'t.' },
  ada:    { name: 'Ada', desc: 'The woman the town calls witch. Her eyes are clear and very tired.' },
  jeb:    { name: 'Jeb', desc: 'A wounded traveler, propped against a stone. His breathing is wet and wrong.' },
  tomas:  { name: 'Tomas', desc: 'Marla\'s brother, pinned under a fallen beam. His leg is wrong. He\'s awake — barely.' },
};

function mkEnemy(type, n) {
  var t = ETYPES[type];
  return { id: type + '_' + (n || rand(1000, 9999)), type: type, name: t.name,
           hp: t.hp, maxHp: t.hp, alive: true };
}

function buildWorld() {
  /* rooms: exits {dir:{to, locked, lockMsg}} — locked can be a function */
  G.rooms = {
    busStop: {
      name: 'Greyhound Stop',
      desc: 'Rain hammers the shelter roof. Behind you, the bus coughs and dies a quarter mile down the road — the driver just kept going. Ahead, past a leaning sign, HOLLOW CREEK hunches against the river mist. The sign\'s paint is peeling. Someone has scratched FIVE GONE under the town name.',
      exits: { n: { to: 'mainStreet' } },
      items: [], npcs: [], enemies: [],
    },
    mainStreet: {
      name: 'Main Street',
      desc: function () {
        var t = 'Hollow Creek\'s main street: shuttered storefronts, a dead traffic light swaying. The RIVER INN glows to the east. The church squats north behind iron fencing. West, a dirt road runs to the old MILL. South is the bus stop.';
        if (!G.flags.metCole && !G.flags.sheriffSeen) t += ' A man with a tin star watches you from the boardwalk.';
        return t;
      },
      exits: { n: { to: 'churchYard' }, s: { to: 'busStop' }, e: { to: 'inn' }, w: { to: 'millRoad' } },
      items: [], npcs: [], enemies: [],
      onEnter: function () {
        if (!G.flags.sheriffSeen) {
          G.flags.sheriffSeen = true;
          print('A big man steps into your path. "Don\'t know you," he says. "Sheriff Cole. We\'ve had trouble — folks going missing by the quarry. You see anything strange, you come to my office, west of the churchyard." He doesn\'t move until you nod.', 'dim');
        }
      },
    },
    inn: {
      name: 'The River Inn',
      desc: 'Warmth and lamplight. Marla polishes glasses behind the bar like she\'s trying to rub the worry out. A chalkboard lists: BANDAGE (3c), BREAD (2c), BULLETS (5c). Stairs go nowhere you need. The door is west.',
      exits: { w: { to: 'mainStreet' } },
      items: [], npcs: ['marla'], enemies: [],
    },
    churchYard: {
      name: 'Churchyard',
      desc: 'A weedy yard before a stone church. Its oak door is shut with a RUSTED PADLOCK. Old Ferris whittles on the steps. The sheriff\'s office is west, the graveyard east.',
      exits: {
        s: { to: 'mainStreet' }, e: { to: 'graveyard' }, w: { to: 'sheriffOffice' },
        n: { to: 'church', locked: function () { return !G.flags.churchOpen; },
             lockMsg: 'The padlock holds. It\'s rusted solid — oil might loosen it, if you had the key.' },
      },
      items: [], npcs: ['ferris'], enemies: [],
    },
    sheriffOffice: {
      name: 'Sheriff\'s Office',
      desc: 'A cramped office smelling of coffee and gun oil. Wanted posters curl on the wall — most of them for missing persons. Sheriff Cole sits behind the desk, cleaning his nails with a knife.',
      exits: { e: { to: 'churchYard' } },
      items: [], npcs: ['cole'], enemies: [],
    },
    graveyard: {
      name: 'Graveyard',
      desc: 'Stones lean like bad teeth. Three grand markers dominate the center: ELIAS CROWE 1811–1849, MARTHA CROWE 1815–1871, JOSIAH REED 1798–1862 — the founders. A stone ANGEL watches over them, one wing broken. The quarry road runs north.',
      exits: { w: { to: 'churchYard' }, n: { to: 'quarryRoad' } },
      items: [], npcs: [], enemies: [],
    },
    church: {
      name: 'Church',
      desc: 'Dust hangs in the stale air. Pews face an altar with a brass LECTERN. A wooden DONATION BOX sits by the door, fitted with a combination lock. Something about this place feels... listened-to.',
      exits: { s: { to: 'churchYard' } },
      items: [], npcs: [], enemies: [],
    },
  };
}

function buildWorld2() {
  var R = G.rooms;
  R.millRoad = {
    name: 'Mill Road',
    desc: 'A dirt road between sagging fences. The mill\'s silhouette looms west, its wheel still. Town is east.',
    exits: { e: { to: 'mainStreet' }, w: { to: 'mill' } },
    items: [], npcs: [], enemies: [],
  };
  R.mill = {
    name: 'Abandoned Mill',
    desc: 'The mill breathes dust. A fallen BEAM pins a man — TOMAS — near the grinding stones. A TOOL RACK hangs on the wall. An office nook holds a dusty SATCHEL. A path runs north into the woods.',
    exits: { e: { to: 'millRoad' },
             n: { to: 'woods', locked: function () { return !G.flags.lanternLit; },
                  lockMsg: 'The path north is pitch black under the trees. You need light.' } },
    items: ['oil', 'hatchet', 'rope'],
    npcs: ['tomas'],
    enemies: [mkEnemy('dog', 1), mkEnemy('dog', 2)],
    onEnter: function () {
      if (!G.flags.tomasFound && !G.flags.tomasGone) {
        G.flags.tomasFound = true; setQuest('q_tomas', 1);
        print('That\'s him. That\'s Marla\'s brother.', 'gold');
      }
      if (!G.flags.millIntro) {
        G.flags.millIntro = true;
        print('Something growls in the dark between the machines. Eyes catch the light — two pairs.', 'red');
      }
    },
  };
  R.woods = {
    name: 'Dark Woods',
    dark: true,
    desc: 'Black trunks, black water underfoot. Every sound is too close. The mill is south. A clearing lies north. A narrow trail runs west.',
    exits: {
      s: { to: 'mill' },
      n: { to: 'clearing', locked: function () { return !G.flags.lanternLit; },
           lockMsg: 'It\'s too dark to go on. You\'d walk straight into the river. You need light.' },
      w: { to: 'witchHut', locked: function () { return !G.flags.lanternLit; },
           lockMsg: 'It\'s too dark to go on. You need light.' },
    },
    items: [], npcs: [], enemies: [mkEnemy('dog', 3)],
  };
  R.clearing = {
    name: 'Clearing',
    desc: function () {
      var t = 'A mossy clearing around a toppled stone. JEB, a traveler, lies propped against it, a wound in his side. His WORN SATCHEL sits beside him. The woods press close to the south.';
      if (G.flags.jebFate === 'robbed' || G.flags.jebFate === 'left') t = 'A mossy clearing around a toppled stone. The ground is dark where Jeb lay. He\'s gone — or buried by the rain. Only flies remain.';
      return t;
    },
    exits: { s: { to: 'woods' } },
    items: [], npcs: ['jeb'], enemies: [],
    onExit: function () {
      if (!G.flags.jebFate && !G.flags.jebHelped) {
        G.flags.jebFate = 'left';
        print('You leave Jeb in the rain. Behind you, his breathing hitches... then steadies... then you can\'t hear it at all.', 'dim');
      }
    },
  };
  R.witchHut = {
    name: 'Ada\'s Hut',
    desc: 'A hut of river-stone and thatch, smoke curling from its chimney despite the rain. Drying herbs hang like a curtain. ADA sits outside, mending a net, watching you the way the river watches.',
    exits: { e: { to: 'woods' } },
    items: [], npcs: ['ada'], enemies: [],
  };
  R.quarryRoad = {
    name: 'Quarry Road',
    desc: 'A rutted track climbing past drowned fences. The quarry pit yawns north, full of black water. Something moves between the fence posts — too tall, too still.',
    exits: { s: { to: 'graveyard' }, n: { to: 'quarry' } },
    items: [], npcs: [], enemies: [mkEnemy('hollow', 4)],
  };
  R.quarry = {
    name: 'Flooded Quarry',
    desc: function () {
      var t = 'A vast pit of black water. A PUMP HOUSE squats at the edge, its door hanging open — the pump is dead, its FUSE missing. A rusted LEVER juts from its side. Five wooden crosses stand in a row on the bank. The road is south.';
      if (G.flags.quarryDrained) t = 'The quarry is drained — a pit of sucking mud and white stones. Stone STEPS spiral down into the dark. The road is south.';
      return t;
    },
    exits: {
      s: { to: 'quarryRoad' },
      d: { to: 'shrine', locked: function () { return !G.flags.quarryDrained; },
           lockMsg: 'Black water fills the pit. You\'d drown before you reached the steps.' },
    },
    items: [], npcs: [], enemies: [mkEnemy('hollow', 5)],
    onEnter: function () {
      if (questStage('q_pump') < 0) { setQuest('q_pump', 0); print('Quest started: STILL WATERS — restore power to the quarry pump.', 'gold'); }
    },
  };
  R.shrine = {
    name: 'The Sunken Shrine',
    desc: 'A drowned chapel of river-stone, older than the town. Water weeps from the walls. On a stone altar lies nothing — and everything. The air is heavy, expectant.',
    exits: { u: { to: 'quarry' } },
    items: [], npcs: [], enemies: [],
    onEnter: function () {
      if (!G.flags.shrineEntered) {
        G.flags.shrineEntered = true;
        print('The water at the far end bulges upward — and THE DROWNED unfolds from it, tall and patient.', 'red');
        hr();
        print('"LITTLE FISH," it says, in a voice like mud. "THE TOWN PAYS. THE TOWN ALWAYS PAYS. UNLESS..."', 'red');
        print('It extends a hand the size of a door. "TAKE MY BARGAIN. GIVE ME THE TOWN\'S DEBT — AND SWIM FREE OF ALL OF IT."', 'red');
        if (G.flags.jebFate === 'helped') {
          print('Then — a shout from the steps! JEB, pale but standing, hurls a rock that cracks against the Drowned\'s skull. "You saved me, drifter. Debts cut both ways!" He scrambles back up, and the Drowned\'s attention falters.', 'lime');
          G.flags.jebAid = true;
        }
        var e = mkEnemy('drowned', 6);
        if (G.flags.jebAid) e.hp = e.maxHp = 100;
        G.rooms.shrine.enemies.push(e);
        if (G.flags.sidedWithAda && hasItem('charm')) {
          print('Your river charm burns cold against your chest. The thing\'s gaze slides off you.', 'cyan');
        }
      }
    },
  };
}

function newGame() {
  G = {
    room: 'busStop', hp: 100, maxHp: 100, coins: 0,
    inv: ['knife', 'ticket', 'matches'],
    flags: {}, quests: {}, rooms: {},
    turn: 0, over: false, ending: null, prevRoom: null,
  };
  addStackSilent('coins', 8);
  buildWorld();
  buildWorld2();
}
/* addStack before G fully ready — used only in newGame */
function addStackSilent(id, n) {
  var k = 'count_' + id;
  G.flags[k] = (G.flags[k] | 0) + n;
  if (G.flags[k] > 0 && G.inv.indexOf(id) < 0) G.inv.push(id);
}

function room() { return G.rooms[G.room]; }
function roomEnemies() { return room().enemies.filter(function (e) { return e.alive; }); }
function roomNpcs() { return room().npcs; }
function npcHere(id) { return roomNpcs().indexOf(id) >= 0; }

/* ============================================================
 * DIALOGUE
 * ============================================================ */
var DIALOGUE = {
  marla: {
    intro: 'Marla wipes the bar. "My brother Tomas went to the old mill two days back, looking for scrap to sell. Hasn\'t come home." Her voice drops. "Please. If you find him... bring him back. Or tell me true." (Quest: THE MISSING BROTHER)',
    topics: {
      'tomas|brother|missing': 'Her hands stop moving. "Tomas never was careful. The mill\'s west on Mill Road. If he\'s hurt, a bandage might save him — I sell them, cheap for you."',
      'rest|sleep|room|inn': '"You look half-drowned, drifter. Rest here — no charge for a friend of Tomas. Just say SLEEP."',
      'buy|shop|price|bandage|bread|bullets': 'She taps the chalkboard. "BANDAGE (3c), BREAD (2c), BULLETS (5c). Say BUY BANDAGE, and so on."',
      'ada|witch': 'Marla\'s face closes. "Ada kept to herself since the mill shut. The sheriff says she\'s behind the disappearances. I don\'t know what to believe anymore."',
      'quarry': '"Five people gone by that black water. They say the quarry\'s haunted. I say it\'s hungry."',
      'sheriff|cole': '"Cole means well. Mostly. He polices what he understands, and he doesn\'t understand much."',
    },
  },
  ferris: {
    intro: 'Ferris doesn\'t look up from his whittling. "Church is locked up tight. Rusted padlock — needs OIL and the IRON KEY, and the key\'s with the founders, in the graveyard. The angel keeps it." He finally glances at you. "You\'ll want light before the woods. Take my LANTERN — but it\'s dry as a bone. Oil\'s at the mill." (Quest: LIGHT IN THE DARK)',
    topics: {
      'lantern|light|oil': '"Oil the lantern, then strike a match to it. Say USE OIL ON LANTERN, then LIGHT LANTERN. The woods eat the unlit."',
      'church|padlock|key': '"Padlock\'s rusted solid. OIL it first, then the IRON KEY. Or smash it — but smashing brings company."',
      'quarry|drowned': 'His knife stills. "The quarry took my boy. Water\'s wrong there. Pump house could drain it, if the pump had a fuse."',
      'founders|graveyard|angel': '"Elias, Martha, Josiah. The eldest holds the key — the angel statue knows. And the donation box in the church? Eldest founder\'s year opens it. Folks never could resist a puzzle."',
      'ada|witch': '"Ada\'s no witch. She\'s the only one who ever tried to PAY the river back instead of taking. Town hates what it can\'t use."',
      'bargain|pact': 'He goes very still. "The founders made a bargain, long ago. Five souls when the water runs low. Ask the ledger in the church — if you can get in."',
    },
  },
  cole: {
    intro: 'Cole leans back. "So. The witch." He slides a tin of KEROSENE across the desk. "Ada\'s hut, west trail past the woods. Burn it. Town\'ll sleep better, and there\'s 20 coin in it for you." (Quest: THE WITCH OF HOLLOW CREEK — take the KEROSENE)',
    topics: {
      'ada|witch|hut|burn': '"She consorts with whatever\'s in that water. Burn the hut, drifter. Don\'t talk to her — she\'ll spin you."',
      'missing|trouble|quarry': '"Five gone. Mill, road, quarry. Whatever\'s doing it ain\'t human, but a burning hut\'s a start."',
      'reward|coin|pay': '"Twenty coin when it\'s done. Ashes don\'t lie."',
      'bargain|pact': 'His jaw tightens. "Old stories. The founders did what they had to. Don\'t go digging, drifter."',
    },
  },
  ada: {
    intro: 'Ada studies you a long moment. "The sheriff sent you to burn me, didn\'t he." It\'s not a question. "Sit. I\'ll tell you what Cole won\'t: the founders FED the river five souls for a rich harvest, and the river\'s come to collect again. I\'ve spent ten years paying it back in herbs and kindness so it wouldn\'t take children. Burn my hut if you must — but the Drowned doesn\'t care about huts."',
    topics: {
      'drowned|river|bargain|pact': '"It was a man, once — the first ferryman. The founders drowned him to seal their bargain, and the river kept him. It doesn\'t hate. It collects."',
      'charm': 'She presses a carved stone into your hand. "A river charm. It won\'t stop it — but it\'ll know you\'re under my protection. Take these too." (You get a RIVER CHARM and 3 SILVER BULLETS)',
      'sheriff|cole|burn|hut': '"Cole\'s afraid. Fear needs a fire to warm its hands. If you came to burn, then burn — but warn me first, and I\'ll be gone. I\'d rather live."',
      'town|founders|ledger': '"The ledger\'s in the church, if the church still stands. Burn it where the bargain was sealed — in the shrine under the quarry — and the debt dies with it."',
      'silver|bullets': '"Cast from my mother\'s spoons. Lead only annoys it. Silver remembers being something else — it bites deeper."',
    },
  },
  jeb: {
    intro: 'Jeb\'s grin is mostly pain. "Bandits? No — worse. Something tall by the quarry road. Got my side." He coughs. "Got some bread and bandages in my satchel, but I can\'t... can\'t quite reach. Funny." His eyes flutter.',
    topics: {
      'wound|hurt|help': '"It burns cold. That\'s the worst part — cold." He tries to laugh.',
      'quarry|tall': '"Saw it standing in the fence line. Wearing my friend\'s face. My friend\'s been dead three years."',
      'satchel': 'His hand twitches toward the worn satchel beside him.',
    },
  },
  tomas: {
    intro: 'Tomas grits his teeth. "Beam slipped when the dogs came. Leg\'s... bad." He nods at his SATCHEL. "There\'s a power FUSE in there — worth real money. Get me out and it\'s yours. I swear it on Marla."',
    topics: {
      'beam|trapped|stuck': '"It\'s pine, rotten through — but heavy. A rope and some leverage might shift it. Or... just take the fuse and go. I wouldn\'t blame you. Marla would, though."',
      'marla|sister': '"Tell her I\'m sorry about the money I owed. Tell her I tried."',
      'fuse|satchel': '"Mill office ordered it before they shut. Ceramic, intact. Somebody\'ll pay." His eyes flick to the satchel, then away.',
      'dogs': '"They came at dusk. I dropped the beam running. Funny — the dogs are scared of something too."',
    },
  },
};
function npcName(id) { return NPCS[id] ? NPCS[id].name : id; }
function findNpc(word) {
  if (!word) return null;
  word = String(word).toLowerCase();
  var ids = Object.keys(NPCS), i;
  for (i = 0; i < ids.length; i++) {
    if (ids[i] === word || NPCS[ids[i]].name.toLowerCase() === word) return ids[i];
  }
  var best = null;
  for (i = 0; i < ids.length; i++) {
    if (NPCS[ids[i]].name.toLowerCase().indexOf(word) >= 0 || word.indexOf(ids[i]) >= 0) {
      if (best) return null; best = ids[i];
    }
  }
  return best;
}
function talkTopic(npc, about) {
  var d = DIALOGUE[npc];
  if (!d || !about) return null;
  about = about.toLowerCase();
  var keys = Object.keys(d.topics);
  for (var i = 0; i < keys.length; i++) {
    var alts = keys[i].split('|');
    for (var j = 0; j < alts.length; j++) {
      if (about.indexOf(alts[j]) >= 0 || alts[j].indexOf(about) >= 0) return d.topics[keys[i]];
    }
  }
  return null;
}

/* ============================================================
 * PARSER
 * ============================================================ */
var DIRS = { n: 'n', north: 'n', s: 's', south: 's', e: 'e', east: 'e',
             w: 'w', west: 'w', u: 'u', up: 'u', d: 'd', down: 'd' };

var VERBS = {
  go: 'go', walk: 'go', run: 'go', head: 'go', move: 'go', enter: 'go', leave: 'go',
  look: 'look', l: 'look', examine: 'examine', x: 'examine', inspect: 'examine', check: 'examine', search: 'examine',
  take: 'take', get: 'take', grab: 'take', pickup: 'take', pick: 'take',
  drop: 'drop', leave2: 'drop',
  inventory: 'inventory', i: 'inventory', inv: 'inventory',
  use: 'use', light: 'light', unlock: 'unlock', lock: 'lock', open: 'open', close: 'close',
  pull: 'pull', push: 'push', lift: 'lift', break: 'break', smash: 'break', force: 'break',
  talk: 'talk', speak: 'talk', greet: 'talk',
  ask: 'ask',
  give: 'give', hand: 'give', offer: 'give',
  attack: 'attack', kill: 'attack', fight: 'attack', hit: 'attack', strike: 'attack', shoot: 'attack', stab: 'attack',
  flee: 'flee', escape: 'flee',
  buy: 'buy', purchase: 'buy',
  eat: 'eat', drink: 'eat', consume: 'eat',
  read: 'read',
  sleep: 'sleep', rest: 'sleep',
  wait: 'wait',
  help: 'help', '?': 'help',
  quests: 'quests', quest: 'quests', journal: 'quests',
  health: 'health', hp: 'health', status: 'health',
  save: 'save', load: 'load', restart: 'restart',
  warn: 'warn',
  burn: 'burn', accept: 'accept', refuse: 'refuse',
};

function tokenize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();
}

function parse(str) {
  var raw = tokenize(str);
  if (!raw) return { verb: null };
  var words = raw.split(' ');
  var v = VERBS[words[0]];
  // direction shortcut: "north", "n"
  if (!v && DIRS[words[0]] && words.length === 1) return { verb: 'go', dir: DIRS[words[0]] };
  if (!v) return { verb: null, raw: str };
  var rest = words.slice(1).join(' ');
  var p = { verb: v, rest: rest };
  if (v === 'go') {
    var d = DIRS[words[1]];
    if (d) p.dir = d;
    else if (/^(to|toward|towards)\s+/.test(rest)) { var d2 = DIRS[rest.replace(/^(to|toward|towards)\s+/, '').split(' ')[0]]; if (d2) p.dir = d2; }
  }
  // split "X on/to/with Y", "X to Y"
  var m = rest.match(/^(.+?)\s+(?:on|onto|to|with|using|at)\s+(.+)$/);
  if (m) { p.obj = m[1].trim(); p.obj2 = m[2].trim(); }
  else p.obj = rest.trim();
  // "ask X about Y"
  if (v === 'ask') {
    var m2 = rest.match(/^(.+?)\s+about\s+(.+)$/);
    if (m2) { p.obj = m2[1].trim(); p.obj2 = m2[2].trim(); }
  }
  return p;
}

/* ============================================================
 * COMMANDS
 * ============================================================ */
function doLook() {
  var r = room();
  print(r.name.toUpperCase(), 'gold');
  var d = (typeof r.desc === 'function') ? r.desc() : r.desc;
  print(d);
  var items = r.items.filter(function (id) { return !isHiddenItem(id); });
  if (items.length) print('You see: ' + listJoin(items.map(iname)) + '.');
  var ens = roomEnemies();
  if (ens.length) {
    var names = ens.map(function (e) { return e.name + ' (' + e.hp + '/' + e.maxHp + ')'; });
    print('DANGER: ' + listJoin(names) + '!', 'red');
  }
  var npcs = r.npcs.filter(function (id) { return !npcGone(id); });
  if (npcs.length) print('Here: ' + listJoin(npcs.map(npcName)) + '.');
  var exits = Object.keys(r.exits);
  print('Exits: ' + exits.join(', ') + '.');
}
function isHiddenItem(id) {
  // items tucked away until discovered
  if (id === 'ironkey' && !G.flags.keyFound) return true;
  return false;
}
function npcGone(id) {
  if (id === 'ada' && G.flags.adaGone) return true;
  if (id === 'tomas' && G.flags.tomasGone) return true;
  if (id === 'jeb' && (G.flags.jebFate === 'robbed' || G.flags.jebFate === 'left' || G.flags.jebFate === 'dead')) return true;
  return false;
}

function doGo(p) {
  var r = room();
  if (!p.dir) { print('Go where? (n, s, e, w, u, d)'); return; }
  var ex = r.exits[p.dir];
  if (!ex) { print('You can\'t go that way.'); return; }
  if (ex.locked && ex.locked()) { print(ex.lockMsg || 'That way is blocked.'); return; }
  if (typeof r.onExit === 'function') r.onExit();
  G.prevRoom = G.room;
  G.room = ex.to;
  var nr = room();
  print(nr.name.toUpperCase(), 'gold');
  var d = (typeof nr.desc === 'function') ? nr.desc() : nr.desc;
  print(d);
  var ens = roomEnemies();
  if (ens.length) print(pick(['Something is already moving toward you.', 'You are not alone here.']), 'red');
  if (typeof nr.onEnter === 'function') nr.onEnter();
}

function doInventory() {
  if (!G.inv.length && countItem('coins') <= 0) { print('You carry nothing.'); return; }
  var parts = G.inv.map(function (id) {
    var n = iname(id);
    if (ITEMS[id] && ITEMS[id].stack) n += ' (' + countItem(id) + ')';
    return n;
  });
  print('You carry: ' + listJoin(parts) + '.');
}

function doHealth() {
  print('Health: ' + G.hp + '/' + G.maxHp + '.');
  var w = bestWeapon();
  print('Best weapon: ' + (w.id === 'fists' ? 'your fists' : ITEMS[w.id].name) +
        ' (' + w.min + '-' + w.max + ' damage)' +
        (w.needs ? ', ' + countItem(w.needs) + ' ' + ITEMS[w.needs].name + ' left' : '') + '.');
}

function doQuests() {
  var ids = Object.keys(G.quests);
  if (!ids.length) { print('No quests yet. Talk to people.'); return; }
  print('QUESTS:', 'gold');
  ids.forEach(function (q) {
    var st = G.quests[q];
    var done = st >= QUESTS[q].stages.length - 1 && /resolved|lit|drained|broken/i.test(QUESTS[q].stages[st]);
    print((done ? '[DONE] ' : '[...] ') + QUESTS[q].name + ' — ' + QUESTS[q].stages[st]);
  });
}

function doHelp() {
  print('COMMANDS:', 'gold');
  print('  n/s/e/w/u/d — move.   look — describe the room.   examine X — inspect.');
  print('  take X / drop X — manage items.   inventory — what you carry.   use X (on Y).');
  print('  talk to X / ask X about Y — converse.   give X to Y.   buy X (at the inn).');
  print('  attack X (with Y) — fight.   flee — run.   eat X — food heals a little.');
  print('  read X.   open/unlock X.   light X.   pull X.   sleep — rest (safe at the inn).');
  print('  quests — your journal.   health — your condition.   save / load.   restart.');
}

function doWait() {
  print('You wait. The rain doesn\'t. Nothing changes, except you feel older.');
}

/* ---------------- examine ---------------- */
function doExamine(word) {
  var r = room();
  // room features
  var feat = examineFeature(word);
  if (feat) { print(feat); return; }
  var id = findItem(word);
  if (id && (hasItem(id) || r.items.indexOf(id) >= 0)) { print(ITEMS[id].desc); return; }
  var npc = findNpc(word);
  if (npc && npcHere(npc) && !npcGone(npc)) { print(NPCS[npc].desc); return; }
  // enemies
  var e = findEnemy(word);
  if (e) { print(ETYPES[e.type].desc + ' (' + e.hp + '/' + e.maxHp + ' health)'); return; }
  if (!word) print('Examine what?');
  else print('You see nothing special about that.');
}

function examineFeature(word) {
  if (!word) return null;
  var w = word.toLowerCase(), r = room(), id = G.room;
  function has(k) { return w.indexOf(k) >= 0; }
  if (id === 'churchYard' && has('padlock')) {
    if (G.flags.churchOpen) return 'The padlock hangs open, defeated.';
    return 'A rusted padlock on the church door.' + (G.flags.padlockOiled ? ' It\'s been oiled — it might take the iron key now.' : ' Rust has fused it solid. Oil would help.');
  }
  if (id === 'churchYard' && (has('door') || has('church'))) return 'Heavy oak, bound in iron. The padlock is the only thing keeping you out.';
  if (id === 'graveyard' && has('angel')) {
    if (!G.flags.keyFound) {
      G.flags.keyFound = true;
      r.items.push('ironkey');
      return 'The angel\'s broken wing... one stone feather is loose. Behind it: an IRON KEY, green with age. (You can TAKE it.)';
    }
    return 'The stone angel keeps its vigil, one feather missing.';
  }
  if (id === 'graveyard' && (has('stone') || has('grave') || has('marker'))) return 'ELIAS CROWE 1811–1849. MARTHA CROWE 1815–1871. JOSIAH REED 1798–1862. The founders, all.';
  if (id === 'mill' && has('beam')) return 'A rotten pine beam across Tomas\'s leg. Heavy — but wood is weak. Rope and leverage might shift it.';
  if (id === 'mill' && (has('rack') || has('tool'))) return 'The tool rack holds a HATCHET and not much else.';
  if (id === 'mill' && has('satchel')) return 'Tomas\'s dusty satchel. Something ceramic clunks inside — a FUSE.';
  if (id === 'mill' && has('stone')) return 'Massive grinding stones, still as tombs.';
  if (id === 'quarry' && has('pump')) {
    return G.flags.fuseIn ? 'The pump hums with power now. The LEVER is waiting.' : 'A dead pump. Its fuse socket is empty — it needs a FUSE.';
  }
  if (id === 'quarry' && has('lever')) return 'A rusted lever on the pump house. It won\'t budge without power.';
  if (id === 'quarry' && (has('cross') || has('crosses'))) return 'Five wooden crosses. Five names, weathered away. Five gone.';
  if (id === 'church' && (has('box') || has('donation'))) {
    if (G.flags.boxOpen) return 'The donation box hangs open and empty.';
    return 'A wooden donation box with a combination lock. Three dials. Someone scratched "THE ELDEST" inside the lid.';
  }
  if (id === 'church' && (has('lectern') || has('altar'))) return 'On the lectern lies the FOUNDERS\' LEDGER, chained but readable.';
  if (id === 'church' && (has('pew'))) return 'Dust an inch thick. Someone sat here recently — the dust is disturbed.';
  if (id === 'clearing' && has('satchel') && !G.flags.jebFate) return 'Jeb\'s worn satchel. You can see bread and bandages inside.';
  if (id === 'sheriffOffice' && (has('desk') || has('drawer'))) {
    if (!G.flags.deskLooted) {
      G.flags.deskLooted = true;
      addStack('bullets', 3);
      return 'You ease the desk drawer open: 3 BULLETS in a tobacco tin. Cole won\'t miss them. Probably.';
    }
    return 'The desk drawer is empty now.';
  }
  if (id === 'sheriffOffice' && has('poster')) return 'MISSING persons posters, curling: the miller\'s boy, a ferryman, two hikers, old Mrs. Abernathy. Five gone.';
  if (has('sign') && id === 'busStop') return '"HOLLOW CREEK." Under it, scratched deep: FIVE GONE.';
  return null;
}

/* ---------------- take / drop ---------------- */
function doTake(word) {
  var r = room();
  if (!word) { print('Take what?'); return; }
  // special: Tomas's fuse
  if (G.room === 'mill' && /fuse/.test(word) && !hasItem('fuse') && !G.flags.tomasGone) {
    if (G.flags.tomasFate === 'freed') { print('Tomas already gave you the fuse.'); return; }
    G.flags.tomasFate = 'robbed';
    takeItem('fuse');
    print('You ease the fuse from Tomas\'s satchel. He grabs your wrist — weakly. "Please," he whispers. "Don\'t leave me." You leave him.', 'red');
    print('Moral weight settles on you like wet clothes. (Tomas\'s fate is sealed.)', 'dim');
    return;
  }
  var id = findItem(word);
  if (!id) { print('You don\'t see that here.'); return; }
  var i = r.items.indexOf(id);
  if (i < 0) {
    if (hasItem(id)) print('You already have it.');
    else print('You don\'t see that here.');
    return;
  }
  if (isHiddenItem(id)) { print('You don\'t see that here.'); return; }
  r.items.splice(i, 1);
  if (ITEMS[id].stack) { addStack(id, id === 'coins' ? 1 : 1); }
  else takeItem(id);
  print('Taken: ' + iname(id) + '.');
}
function doDrop(word) {
  var id = findItem(word);
  if (!id || !hasItem(id)) { print('You don\'t have that.'); return; }
  if (ITEMS[id].stack) { print('Best keep your ' + ITEMS[id].name + ' together.'); return; }
  removeItem(id);
  room().items.push(id);
  print('Dropped: ' + iname(id) + '.');
}

/* ---------------- use / unlock / light / pull ---------------- */
function doUse(obj, obj2) {
  // numeric code: "use 1798 on donation box"
  if (/^\d+$/.test(obj || '')) { doUnlock(obj2 || 'donation box', obj); return; }
  var id = findItem(obj);
  if (!id) {
    // "use kerosene on hut" etc. handled by name matching below
    return doUseNamed(obj, obj2);
  }
  if (!hasItem(id) && countItem(id) <= 0) { print('You don\'t have ' + iname(id) + '.'); return; }

  // oil -> lantern
  if (id === 'oil' && obj2 && /lantern/.test(obj2)) {
    if (!hasItem('lantern')) { print('You don\'t have a lantern.'); return; }
    if (G.flags.lanternLit) { print('The lantern is already lit.'); return; }
    G.flags.oilInLantern = true;
    print('You fill the lantern\'s reservoir with oil.');
    return;
  }
  // oil -> padlock
  if (id === 'oil' && obj2 && /padlock/.test(obj2)) {
    if (G.room !== 'churchYard') { print('There\'s no padlock here.'); return; }
    if (G.flags.churchOpen) { print('The padlock is already open.'); return; }
    G.flags.padlockOiled = true;
    print('You work oil into the padlock. It loosens with a soft click.');
    return;
  }
  // rope -> beam (free Tomas)
  if (id === 'rope' && obj2 && /beam/.test(obj2)) {
    if (G.room !== 'mill' || G.flags.tomasGone) { print('Nothing to lever here.'); return; }
    freeTomas();
    return;
  }
  // fuse -> pump
  if (id === 'fuse' && obj2 && /pump/.test(obj2)) {
    if (G.room !== 'quarry') { print('There\'s no pump here.'); return; }
    if (G.flags.fuseIn) { print('The fuse is already in.'); return; }
    G.flags.fuseIn = true;
    removeItem('fuse');
    setQuest('q_pump', 1);
    print('The fuse seats with a solid thunk. The pump hums faintly, waiting for the lever.', 'gold');
    print('Quest updated: STILL WATERS.', 'gold');
    return;
  }
  // kerosene -> hut
  if (id === 'kerosene' && obj2 && /hut/.test(obj2)) {
    if (G.room !== 'witchHut') { print('There\'s no hut here.'); return; }
    G.flags.hutDoused = true;
    print('You splash kerosene across the thatch and door. The smell is sharp and sweet.', 'red');
    return;
  }
  // bandage -> heal
  if (id === 'bandage') { doHeal('bandage'); return; }
  // matches -> light handled by doLight
  print('Nothing obvious happens.');
}
function doUseNamed(obj, obj2) {
  var w = (obj || '').toLowerCase();
  if (/kerosene/.test(w) && obj2 && /hut/.test(obj2)) {
    if (!hasItem('kerosene')) { print('You don\'t have kerosene.'); return; }
    if (G.room !== 'witchHut') { print('There\'s no hut here.'); return; }
    G.flags.hutDoused = true;
    print('You splash kerosene across the thatch and door.', 'red');
    return;
  }
  print('Use what?');
}

function freeTomas() {
  G.flags.tomasFate = 'freed';
  G.flags.tomasGone = true;
  setQuest('q_tomas', 2);
  takeItem('fuse');
  print('You loop the rope around the beam, brace your feet, and HEAVE. Wood screams — the beam rolls free.', 'lime');
  print('Tomas drags himself clear, laughing and crying at once. He presses the FUSE into your hands. "Marla\'s inn. Tell her... tell her I\'m coming." He limps east, leaning on the wall.', 'lime');
  print('Quest complete: THE MISSING BROTHER. Marla will want to hear this.', 'gold');
}

function doUnlock(word, withWhat) {
  var w = (word || '').toLowerCase();
  // desk drawer (lootable via examine too)
  if (/desk/.test(w) || /drawer/.test(w)) { doExamine('desk'); return; }
  // church padlock
  if (/padlock/.test(w)) {
    if (G.room !== 'churchYard') { print('There\'s no padlock here.'); return; }
    if (G.flags.churchOpen) { print('It\'s already open.'); return; }
    var key = withWhat && findItem(withWhat);
    if (key !== 'ironkey') { print('You need the right key.'); return; }
    if (!hasItem('ironkey')) { print('You don\'t have the iron key.'); return; }
    if (!G.flags.padlockOiled) {
      print('The key won\'t turn — the lock is rusted solid. It needs OIL first.');
      return;
    }
    G.flags.churchOpen = true;
    print('The key turns. The padlock springs open. The church door swings inward on silent hinges.', 'lime');
    return;
  }
  // donation box combination
  if (/box/.test(w) || /donation/.test(w)) {
    if (G.room !== 'church') { print('There\'s no donation box here.'); return; }
    if (G.flags.boxOpen) { print('It\'s already open.'); return; }
    if ((withWhat || '').replace(/\D/g, '') === '1798') {
      G.flags.boxOpen = true;
      addStack('coins', 15);
      takeItem('bandage');
      print('Click-click-click. The box springs open: 15 COINS and a clean BANDAGE.', 'lime');
    } else {
      print('The dials spin. Nothing catches. (The lid says: "THE ELDEST".)');
    }
    return;
  }
  print('Unlock what?');
}

function doLight(word) {
  var w = (word || '').toLowerCase();
  if (/lantern/.test(w)) {
    if (!hasItem('lantern')) { print('You don\'t have the lantern.'); return; }
    if (G.flags.lanternLit) { print('The lantern is already lit.'); return; }
    if (!G.flags.oilInLantern) { print('The lantern is dry. It needs OIL first.'); return; }
    if (!hasItem('matches')) { print('You have nothing to light it with.'); return; }
    G.flags.lanternLit = true;
    setQuest('q_lantern', 1);
    print('The wick catches. Warm light blooms — the dark steps back.', 'lime');
    print('Quest complete: LIGHT IN THE DARK.', 'gold');
    return;
  }
  if (/hut/.test(w)) {
    if (G.room !== 'witchHut') { print('There\'s no hut here.'); return; }
    if (!G.flags.hutDoused) { print('The thatch is damp. You\'d need something flammable — like kerosene.'); return; }
    burnHut();
    return;
  }
  print('Light what?');
}

function burnHut() {
  removeItem('kerosene');
  setQuest('q_witch', 1);
  if (npcHere('ada') && !npcGone('ada') && !G.flags.adaGone) {
    G.flags.burnedHut = 'withAda';
    G.flags.adaGone = true;
    print('The thatch catches with a whoomph. For a moment Ada just stands there — then the smoke takes her, and her screaming takes the night.', 'red');
    print('You did what the sheriff asked. The town will sleep better. You won\'t.', 'dim');
  } else {
    G.flags.burnedHut = 'empty';
    print('The hut burns clean and fast, empty. Somewhere down the trail, you think you hear... nothing. Good.', 'red');
  }
  print('Quest complete: THE WITCH OF HOLLOW CREEK.', 'gold');
}

function doPull(word) {
  var w = (word || '').toLowerCase();
  if (/lever/.test(w)) {
    if (G.room !== 'quarry') { print('There\'s no lever here.'); return; }
    if (G.flags.quarryDrained) { print('The quarry is already drained.'); return; }
    if (!G.flags.fuseIn) { print('The lever doesn\'t budge. The pump is dead — it needs a FUSE.'); return; }
    G.flags.quarryDrained = true;
    setQuest('q_pump', 2);
    print('You haul the lever down. The pump ROARS — black water churns, drops, drops... and keeps dropping. Mud. White stones. And stone STEPS, spiraling down.', 'lime');
    print('Quest complete: STILL WATERS. The way DOWN is open.', 'gold');
    return;
  }
  print('Pull what?');
}

function doBreak(word) {
  var w = (word || '').toLowerCase();
  if (/padlock/.test(w)) {
    if (G.room !== 'churchYard') { print('There\'s no padlock here.'); return; }
    if (G.flags.churchOpen) { print('It\'s already open.'); return; }
    if (!hasItem('hatchet')) { print('You\'d need something heavy — a hatchet, maybe.'); return; }
    G.flags.churchOpen = true;
    G.flags.padlockSmashed = true;
    print('You swing the hatchet. The padlock bursts with a CLANG that rolls across the whole town.', 'red');
    print('Every dog in Hollow Creek starts barking. Something else answers — closer than you\'d like.', 'red');
    var e = mkEnemy('hollow', 99);
    G.rooms.churchYard.enemies.push(e);
    return;
  }
  print('Break what?');
}

/* ---------------- talk / ask / give / buy ---------------- */
function doTalk(word) {
  var id = findNpc(word);
  if (!id) { print('Talk to whom?'); return; }
  if (!npcHere(id) || npcGone(id)) { print('They\'re not here.'); return; }
  var d = DIALOGUE[id];
  G.flags['met_' + id] = true;
  // special intros
  if (id === 'marla' && !G.flags.marlaIntro) {
    G.flags.marlaIntro = true;
    if (questStage('q_tomas') < 0) setQuest('q_tomas', 0);
  }
  if (id === 'ferris' && !G.flags.ferrisIntro) {
    G.flags.ferrisIntro = true;
    if (!hasItem('lantern')) { takeItem('lantern'); print('(You take the BRASS LANTERN.)', 'dim'); }
    if (questStage('q_lantern') < 0) setQuest('q_lantern', 0);
  }
  if (id === 'cole' && !G.flags.coleIntro) {
    G.flags.coleIntro = true;
    takeItem('kerosene');
    if (questStage('q_witch') < 0) setQuest('q_witch', 0);
    print('(You take the tin of KEROSENE.)', 'dim');
  }
  if (id === 'ada' && !G.flags.adaIntro) {
    G.flags.adaIntro = true;
  }
  print(npcName(id).toUpperCase() + ':', 'cyan');
  print(d.intro);
  if (id === 'marla') marlaReward();
  print('(You can ASK ' + npcName(id).toUpperCase() + ' ABOUT things: try ASK ' + npcName(id).toUpperCase() + ' ABOUT TOMAS.)', 'dim');
}

function marlaReward() {
  if (G.flags.tomasFate === 'freed' && !G.flags.marlaPaid) {
    G.flags.marlaPaid = true;
    takeItem('revolver');
    addStack('bullets', 6);
    addStack('coins', 10);
    print('Marla weeps openly. "You brought him home." She presses a REVOLVER into your hands, with 6 BULLETS and 10 COINS. "If whatever\'s out there comes back — you end it."', 'lime');
  } else if (G.flags.tomasFate === 'robbed' && !G.flags.marlaGrief) {
    G.flags.marlaGrief = true;
    print('You tell her what you found. Her face doesn\'t change, exactly — it just stops. "Get out," she says quietly. "Get out of my inn."', 'red');
    print('(Marla will still sell you bread and bandages. She will not sell you bullets. Not ever.)', 'dim');
  }
}

function doAsk(npcWord, about) {
  var id = findNpc(npcWord);
  if (!id) { print('Ask whom?'); return; }
  if (!npcHere(id) || npcGone(id)) { print('They\'re not here.'); return; }
  if (!about) { print('Ask ' + npcName(id) + ' about what?'); return; }
  var t = talkTopic(id, about);
  if (t) {
    // Ada's charm topic grants items once
    if (id === 'ada' && /charm/.test(about.toLowerCase()) && !G.flags.adaCharmGiven) {
      G.flags.adaCharmGiven = true;
      G.flags.sidedWithAda = true;
      takeItem('charm');
      addStack('silverbullets', 3);
      print(t, 'cyan');
      print('(You receive a RIVER CHARM and 3 SILVER BULLETS.)', 'lime');
      return;
    }
    print(t, 'cyan');
  } else {
    print(pick([
      npcName(id) + ' shrugs.',
      '"Can\'t help you with that," says ' + npcName(id) + '.',
      npcName(id) + ' has nothing to say about that.',
    ]), 'cyan');
  }
}

function doGive(obj, toWord) {
  var id = findItem(obj);
  if (!id) { print('Give what?'); return; }
  var npc = findNpc(toWord);
  if (!npc) { print('Give it to whom?'); return; }
  if (!npcHere(npc) || npcGone(npc)) { print('They\'re not here.'); return; }
  if (!hasItem(id) && countItem(id) <= 0) { print('You don\'t have ' + iname(id) + '.'); return; }

  // Jeb — the moral choice
  if (npc === 'jeb') {
    if (id === 'bread' || id === 'bandage') {
      if (ITEMS[id].stack || id === 'bread' || id === 'bandage') {
        if (id === 'bread') { removeItem('bread'); }
        else { removeItem('bandage'); }
      }
      G.flags.jebFate = 'helped';
      G.flags.jebHelped = true;
      addStack('coins', 4);
      print('You press the ' + ITEMS[id].name + ' on him. He eats / binds himself with shaking hands, and some color comes back.', 'lime');
      print('"Debts," Jeb mutters, pressing 4 COINS into your palm. "You ever face that water... I\'ll be there. Debts cut both ways."', 'lime');
      return;
    }
    print('Jeb shakes his head weakly. "Keep it. I\'ll... I\'ll manage."');
    return;
  }
  if (npc === 'marla' && id === 'coins') { print('Marla pushes the coins back. "Your money\'s no good until Tomas is home. Spend it at the board."'); return; }
  print(npcName(npc) + ' doesn\'t want ' + iname(id) + '.');
}

function doRobJeb() {
  if (G.flags.jebFate) { print('There\'s nothing left to take.'); return; }
  G.flags.jebFate = 'robbed';
  addStack('coins', 6);
  addStack('bullets', 2);
  takeItem('bread');
  takeItem('bandage');
  print('You take his satchel — bread, bandages, 6 coins, 2 bullets. His hand finds your sleeve. "Please," he says. You go anyway.', 'red');
  print('Behind you, the rain keeps falling on someone who won\'t feel it much longer.', 'dim');
}

function doBuy(word) {
  if (G.room !== 'inn') { print('There\'s nothing for sale here.'); return; }
  var robbed = G.flags.jebFate === 'robbed';
  var prices = { bandage: robbed ? 6 : 3, bread: robbed ? 4 : 2, bullets: robbed ? 999 : 5 };
  if (!word) {
    print('For sale: BANDAGE (' + prices.bandage + 'c), BREAD (' + prices.bread + 'c)' +
          (robbed ? '' : ', BULLETS (' + prices.bullets + 'c)') + '. You have ' + countItem('coins') + 'c.');
    return;
  }
  var id = findItem(word);
  if (!id || !(id in prices)) { print('Marla doesn\'t sell that.'); return; }
  if (robbed && id === 'bullets') { print('"Not to you," Marla says flatly.'); return; }
  var price = prices[id];
  if (countItem('coins') < price) { print('Not enough coin. You have ' + countItem('coins') + 'c.'); return; }
  addStack('coins', -price);
  if (id === 'bullets') addStack('bullets', 3);
  else takeItem(id);
  print('Bought: ' + iname(id) + ' for ' + price + 'c.');
}

function doEat(word) {
  var id = findItem(word);
  if (id !== 'bread') { print('You can\'t eat that.'); return; }
  if (!hasItem('bread')) { print('You have no bread.'); return; }
  removeItem('bread');
  G.hp = Math.min(G.maxHp, G.hp + 15);
  print('You eat the bread. +15 health. (' + G.hp + '/' + G.maxHp + ')');
}
function doHeal(kind) {
  if (!hasItem('bandage')) { print('You have no bandage.'); return; }
  if (G.hp >= G.maxHp) { print('You\'re already at full health.'); return; }
  removeItem('bandage');
  G.hp = Math.min(G.maxHp, G.hp + 35);
  print('You bind your wounds. +35 health. (' + G.hp + '/' + G.maxHp + ')');
}

function doRead(word) {
  var w = (word || '').toLowerCase();
  if (/ledger/.test(w)) {
    if (G.room !== 'church') { print('The ledger is in the church, on the lectern.'); return; }
    if (!G.flags.churchOpen) { print('You can\'t get in.'); return; }
    print('"...in the year of our Lord 1811, we, the founders of Hollow Creek, do BIND ourselves and our issue to the river\'s keeping. Five souls when the water runs low, that the harvest be rich... Signed, E. Crowe, M. Crowe, J. Reed."', 'gold');
    print('The last page is newer, in a shaking hand: "It isn\'t a harvest anymore. God forgive us."', 'gold');
    if (questStage('q_pact') < 0) { setQuest('q_pact', 0); print('Quest started: THE FOUNDERS\' PACT — burn the ledger where the bargain was sealed.', 'gold'); }
    if (!hasItem('ledger')) { takeItem('ledger'); print('(You take the FOUNDERS\' LEDGER.)', 'dim'); }
    return;
  }
  if (/sign/.test(w) && G.room === 'busStop') { print('"HOLLOW CREEK." Under it: FIVE GONE.'); return; }
  if (/poster/.test(w)) { print('MISSING: the miller\'s boy, a ferryman, two hikers, old Mrs. Abernathy.'); return; }
  print('Read what?');
}

function doSleep() {
  if (G.room === 'inn') {
    G.hp = G.maxHp;
    print('You sleep in a real bed, under a real roof. You wake whole. (' + G.hp + '/' + G.maxHp + ')', 'lime');
  } else {
    G.hp = Math.min(G.maxHp, G.hp + 25);
    print('You doze with one eye open. +25 health. (' + G.hp + '/' + G.maxHp + ')');
  }
}

function doWarn(word) {
  var npc = findNpc(word);
  if (npc === 'ada' && npcHere('ada') && !npcGone('ada')) {
    if (G.flags.adaGone) { print('She\'s already gone.'); return; }
    G.flags.adaGone = true;
    G.flags.warnedAda = true;
    print('You tell her about the kerosene, the sheriff, the plan. She goes very still — then nods once, and is gone into the trees before you blink. Her herbs still swing in the doorway.', 'lime');
    print('(If you burn the hut now, it will be empty.)', 'dim');
    return;
  }
  print('Warn whom?');
}

/* ============================================================
 * COMBAT
 * ============================================================ */
function findEnemy(word) {
  if (!word) return null;
  word = String(word).toLowerCase();
  var ens = roomEnemies(), i;
  for (i = 0; i < ens.length; i++) {
    if (ens[i].type === word || ens[i].name.toLowerCase() === word) return ens[i];
  }
  var best = null;
  for (i = 0; i < ens.length; i++) {
    if (ens[i].name.toLowerCase().indexOf(word) >= 0 || ens[i].type.indexOf(word) >= 0) {
      if (best) return null; best = ens[i];
    }
  }
  return best;
}

function doAttack(obj, withW) {
  var e = findEnemy(obj);
  if (!e) { print('Attack what?'); return 'noturn'; }
  var w = bestWeapon();
  if (withW) {
    var wid = findItem(withW);
    var found = null;
    for (var i = 0; i < WEAPONS.length; i++) {
      if (WEAPONS[i].id === wid) { found = WEAPONS[i]; break; }
    }
    if (!found) { print('That\'s not a weapon.'); return 'noturn'; }
    if (wid !== 'fists' && !hasItem(wid)) { print('You don\'t have ' + iname(wid) + '.'); return 'noturn'; }
    if (found.needs && countItem(found.needs) <= 0 && countItem('silverbullets') <= 0) {
      print('No ammunition.'); return 'noturn';
    }
    w = found;
  }
  var dmg = rand(w.min, w.max), silver = false;
  if (w.id === 'revolver') {
    if (e.type === 'drowned' && countItem('silverbullets') > 0) {
      silver = true; dmg = rand(16, 24); addStack('silverbullets', -1);
    } else if (countItem('bullets') > 0) { addStack('bullets', -1); }
    else if (countItem('silverbullets') > 0) { silver = true; addStack('silverbullets', -1); }
    else { print('Click. Empty chambers.'); return 'noturn'; }
  }
  e.hp -= dmg;
  var wname = w.id === 'fists' ? 'your fists' : 'your ' + ITEMS[w.id].name;
  print('You hit the ' + e.name + (silver ? ' with a SILVER bullet' : '') + ' for ' + dmg +
        ' damage! (' + Math.max(0, e.hp) + '/' + e.maxHp + ')', silver ? 'cyan' : '');
  if (e.hp <= 0) { killEnemy(e); return true; }
  if (e.type === 'drowned' && !G.flags.drownedOffered && e.hp < 40) drownedOffer();
  return true;
}

function killEnemy(e) {
  e.alive = false;
  print('The ' + e.name + ' collapses and does not get up.', 'lime');
  if (e.type === 'hollow') {
    addStack('coins', 4);
    print('In its pockets: 4 coins, and a bus ticket stub. It was someone, once.', 'dim');
  }
  if (e.type === 'drowned') { endingA(); }
}

function drownedOffer() {
  G.flags.drownedOffered = true;
  hr();
  print('"ENOUGH," the river says. The Drowned kneels, water pouring from its mouth like words.', 'red');
  print('"TAKE MY BARGAIN, LITTLE FISH. GIVE ME THE TOWN\'S DEBT — ITS STREETS, ITS SLEEP, ITS CHILDREN\'S CHILDREN — AND YOU SWIM FREE. POWER. YEARS. ALL OF IT."', 'red');
  print('(You can ACCEPT the bargain — or REFUSE and finish it.)', 'gold');
}

function doFlee() {
  var ens = roomEnemies();
  if (!ens.length) { print('There\'s nothing to flee from.'); return 'noturn'; }
  var exits = Object.keys(room().exits).filter(function (d) {
    var ex = room().exits[d];
    return !(ex.locked && ex.locked());
  });
  if (!exits.length) { print('Nowhere to run!'); return true; }
  if (Math.random() < 0.65) {
    var d = G.prevRoom && room().exits[Object.keys(room().exits).filter(function (k) { return room().exits[k].to === G.prevRoom; })[0]]
      ? Object.keys(room().exits).filter(function (k) { return room().exits[k].to === G.prevRoom; })[0]
      : pick(exits);
    print('You break away and run!', 'dim');
    G.prevRoom = G.room;
    G.room = room().exits[d].to;
    doLook();
    var nr = room();
    if (typeof nr.onEnter === 'function') nr.onEnter();
    return 'noturn';
  }
  print('You stumble — it cuts you off!', 'red');
  return true;
}

function enemyTurn() {
  if (G.over) return;
  var ens = roomEnemies();
  for (var i = 0; i < ens.length; i++) {
    var e = ens[i], t = ETYPES[e.type];
    if (t.fleesAt && e.hp <= t.fleesAt && Math.random() < 0.6) {
      e.alive = false; e.fled = true;
      print('The ' + e.name + ' whimpers and bolts into the dark.', 'dim');
      continue;
    }
    if (Math.random() < 0.15) { print(cap(e.name) + ' misses you.'); continue; }
    var dmg = rand(t.dmg[0], t.dmg[1]);
    if (e.type === 'drowned' && hasItem('charm')) dmg = Math.max(1, dmg - 4);
    G.hp -= dmg;
    print(cap(e.name) + ' ' + pick(t.atk) + ' — ' + dmg + ' damage! (' + Math.max(0, G.hp) + '/' + G.maxHp + ')', 'red');
    if (e.type === 'drowned' && e.hp < e.maxHp * 0.6 && Math.random() < 0.25 && !G.flags.stunned) {
      G.flags.stunned = true;
      print('Cold water closes around your legs — you\'re HELD! Your next command will fail.', 'red');
    }
    if (G.hp <= 0) { die(e); return; }
  }
}

function die(e) {
  G.over = true;
  hr();
  print('The ' + e.name + ' finishes it. The rain keeps falling on Hollow Creek, indifferent.', 'red');
  print('', '');
  print('YOU DIED. Type RESTART to try again, or LOAD to return to your last save.', 'gold');
}

/* ---------------- endings ---------------- */
function endingA() {
  G.over = true; G.ending = 'A';
  hr();
  print('The Drowned comes apart like a bad memory — water, mud, and finally just a ferryman\'s coat, empty.', 'lime');
  print('The river goes quiet. Really quiet, for the first time since you got here.', 'lime');
  if (G.flags.sidedWithAda) print('Ada finds you on the bank at dawn. "The debt\'s paid," she says. "Not with souls — with courage. That\'s a new thing."', 'cyan');
  if (G.flags.burnedHut) print('The town celebrates. Nobody mentions the smell of smoke that still clings to you.', 'dim');
  print('', '');
  print('ENDING: STILL WATER — Hollow Creek is free. Type RESTART to play again.', 'gold');
}
function endingB() {
  G.over = true; G.ending = 'B';
  hr();
  print('"WISE," says the river, and the water closes over your head — gently, almost kindly.', 'red');
  print('You don\'t drown. You just... stop being you. Years later, travelers speak of a tall figure at the quarry\'s edge, patient as stone, collecting.', 'red');
  print('', '');
  print('ENDING: THE BARGAIN — you swim free of everything, and nothing. Type RESTART to play again.', 'gold');
}
function endingC() {
  G.over = true; G.ending = 'C';
  hr();
  print('You hold the founders\' ledger over your lantern. The pages catch — names, dates, the brown-ink bargain — and burn blue.', 'lime');
  print('The Drowned SCREAMS without a mouth. The water in the shrine boils backward, and the thing comes apart, unmade, unbound.', 'lime');
  print('"The debt dies with the paper," Ada whispers — or maybe it\'s the river, finally speaking plain.', 'cyan');
  print('', '');
  print('ENDING: ASHES OF THE PACT — no bargain, no collector. Hollow Creek owes nothing. Type RESTART to play again.', 'gold');
}

/* ---------------- save / load / restart ---------------- */
function snapshot() {
  var rooms = {};
  Object.keys(G.rooms).forEach(function (id) {
    var r = G.rooms[id];
    rooms[id] = {
      items: r.items.slice(), npcs: r.npcs.slice(),
      enemies: r.enemies.map(function (e) {
        return { id: e.id, type: e.type, name: e.name, hp: e.hp, maxHp: e.maxHp, alive: e.alive, fled: !!e.fled };
      }),
    };
  });
  return { v: 1, room: G.room, prevRoom: G.prevRoom, hp: G.hp, maxHp: G.maxHp,
           inv: G.inv.slice(), flags: JSON.parse(JSON.stringify(G.flags)),
           quests: JSON.parse(JSON.stringify(G.quests)), turn: G.turn, rooms: rooms };
}
function doSave() {
  try { localStorage.setItem('hc_save', JSON.stringify(snapshot())); print('Game saved.', 'lime'); }
  catch (e) { print('Could not save — this browser is blocking storage.'); }
}
function doLoad() {
  var s = null;
  try { s = JSON.parse(localStorage.getItem('hc_save') || 'null'); } catch (e) {}
  if (!s) { print('No saved game found.'); return; }
  newGame();
  G.room = s.room; G.prevRoom = s.prevRoom; G.hp = s.hp; G.maxHp = s.maxHp;
  G.inv = s.inv; G.flags = s.flags; G.quests = s.quests; G.turn = s.turn;
  Object.keys(s.rooms).forEach(function (id) {
    if (!G.rooms[id]) return;
    G.rooms[id].items = s.rooms[id].items;
    G.rooms[id].npcs = s.rooms[id].npcs;
    G.rooms[id].enemies = s.rooms[id].enemies;
  });
  G.over = false; G.ending = null;
  print('Game loaded.', 'lime');
  doLook();
}

/* ---------------- main dispatcher ---------------- */
var FREE = { help: 1, quests: 1, health: 1, inventory: 1, save: 1, load: 1 };

function cmd(str) {
  if (G.over) {
    var t0 = tokenize(str);
    if (t0 === 'restart' || t0 === 'load') { /* fall through */ }
    else { print('The story is over. Type RESTART to begin again.'); return; }
  }
  echoCmd(str);
  var p = parse(str);
  if (!p.verb) { print('I don\'t understand. Type HELP for commands.'); return; }

  if (G.flags.stunned && p.verb !== 'flee' && !FREE[p.verb]) {
    print('The cold water holds you fast — you can\'t act!', 'red');
    G.flags.stunned = false;
    enemyTurn();
    return;
  }

  var r = dispatch(p);
  G.turn++;
  if (r !== 'noturn' && !G.over) enemyTurn();
}

function dispatch(p) {
  var v = p.verb, o = (p.obj || '').trim(), o2 = (p.obj2 || '').trim();
  switch (v) {
    case 'go': doGo(p); return 'noturn'; // entry turn is safe
    case 'look':
      if (!o) { doLook(); return 'noturn'; }
      doExamine(o); return 'noturn';
    case 'examine': doExamine(o); return 'noturn';
    case 'take':
      if (G.room === 'clearing' && /satchel/.test(o) && !G.flags.jebFate) { doRobJeb(); break; }
      doTake(o); break;
    case 'drop': doDrop(o); return 'noturn';
    case 'inventory': doInventory(); return 'noturn';
    case 'health': doHealth(); return 'noturn';
    case 'quests': doQuests(); return 'noturn';
    case 'help': doHelp(); return 'noturn';
    case 'wait': doWait(); break;
    case 'sleep': doSleep(); break;
    case 'use': doUse(o, o2); break;
    case 'light': doLight(o); break;
    case 'unlock': doUnlock(o, o2); break;
    case 'open': doUnlock(o, o2); break;
    case 'pull': doPull(o); break;
    case 'lift':
      if (/beam/.test(o) && G.room === 'mill' && !G.flags.tomasGone) {
        print('It\'s too heavy to lift bare-handed. You need leverage — a ROPE, maybe.');
      } else print('Lift what?');
      break;
    case 'break': doBreak(o); break;
    case 'talk': doTalk(o); return 'noturn';
    case 'ask': doAsk(o, o2); return 'noturn';
    case 'give': doGive(o, o2); break;
    case 'buy': doBuy(o); return 'noturn';
    case 'eat': doEat(o); break;
    case 'read': doRead(o); return 'noturn';
    case 'attack': return doAttack(o, o2);
    case 'flee': return doFlee();
    case 'warn': doWarn(o); return 'noturn';
    case 'burn':
      if (/hut/.test(o)) { doLight('hut'); break; }
      if (/ledger/.test(o)) { doBurnLedger(); break; }
      print('Burn what?'); return 'noturn';
    case 'accept':
      if (G.flags.drownedOffered && !G.over) { endingB(); return 'noturn'; }
      print('Accept what?'); return 'noturn';
    case 'refuse':
      if (G.flags.drownedOffered && !G.over) { print('You spit river water. "No." The Drowned tilts its head, almost... respectful.', 'gold'); return 'noturn'; }
      print('Refuse what?'); return 'noturn';
    case 'save': doSave(); return 'noturn';
    case 'load': doLoad(); return 'noturn';
    case 'restart': newGame(); print('The bus dies. The rain starts. Again.', 'dim'); doLook(); return 'noturn';
    default: print('I don\'t know how to do that. Type HELP.'); return 'noturn';
  }
}

function doBurnLedger() {
  if (!hasItem('ledger')) { print('You don\'t have the ledger.'); return; }
  if (G.room !== 'shrine') { print('The bargain was sealed in the shrine under the quarry. Burn it there.'); return; }
  if (!hasItem('matches')) { print('You need a flame.'); return; }
  removeItem('ledger');
  if (questStage('q_pact') >= 0) setQuest('q_pact', 1);
  endingC();
}

/* ---------------- init ---------------- */
function intro() {
  print('HOLLOW CREEK', 'gold');
  print('A folk-horror text adventure. Type HELP for commands. Your choices matter — some of them, forever.', 'dim');
  hr();
  print('The bus died a quarter mile back. The driver didn\'t even stop — just kept going, like the town had a smell he knew.');
  print('Rain. A leaning sign: HOLLOW CREEK. Under the name, scratched deep: FIVE GONE.');
  print('You have a knife, some matches, a bus ticket to nowhere, and 8 coins. It\'s enough. It has to be.');
  hr();
}

var inited = false;
function startZorkGame() {
  outBox = document.getElementById('zorkOutput');
  inBox = document.getElementById('zorkInput');
  if (inited) return;
  inited = true;
  newGame();
  intro();
  doLook();
  if (inBox && !inBox.dataset.zbound) {
    inBox.dataset.zbound = '1';
    inBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var v = inBox.value;
        inBox.value = '';
        if (v.trim()) cmd(v);
      }
    });
  }
}

/* test hook */
window.HOLLOW = {
  cmd: function (s) { return cmd(s); },
  get G() { return G; },
  newGame: newGame,
  capture: function (fn) { outFn = fn; },
};

window.startZorkGame = startZorkGame;
// auto-start if section visible on load (keeps old behavior)
if (document.readyState !== 'loading') startZorkGame();
else document.addEventListener('DOMContentLoaded', startZorkGame);

})();
