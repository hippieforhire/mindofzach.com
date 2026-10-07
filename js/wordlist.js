/* wordlist.js — validation dictionaries for Zach's Wordle Game.
 * WORDS: general English words by length (5/6/7).
 * THEME_WORDS: theme-specific valid answers (movie titles, band names, etc.)
 * A guess is accepted if it appears in either list.
 * (Each list is filtered by length at load, so typos can't pollute it.) */
(function () {
  'use strict';

  function clean(list, len) {
    return new Set(list.filter(w => w.length === len));
  }

  const W5 = ("about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive " +
  "allow alone along alter angel anger angle angry apart apple apply arena argue arise array arrow aside asset attic audio " +
  "audit avoid awake award aware awful bacon badge baker basic basin beach beard beast begin belly below bench berry birth " +
  "black blade blame blank blast blend bless blind block blood board boast bonus boost booth bound brain brand brave bread " +
  "break breed brick bride brief bring broad broke brown brush build bunch buyer cabin cable candy carry catch cause chain " +
  "chair chaos charm chart chase cheap check cheer chess chest chief child choir choke chunk church civil claim class clean " +
  "clear clerk click cliff climb clock clone close cloth cloud coach coast color comet comic comma coral could count court " +
  "cover crack craft crash crate crawl crazy cream crime crisp critic cross crowd crown crude crush crust curve cycle daily " +
  "dairy dance dealt death delay depth diary dirty disco ditch dodge doing donor doubt dozen draft drain drama drank dream " +
  "dress drift drill drink drive drone dummy eager early earth eight elbow elder elect elite empty enemy enjoy enter entry " +
  "equal error erupt essay event every exact exist extra fabric faint fairy faith fancy fatal fault favor feast fence fever " +
  "fiber fiction field fiery fifty fight final first flame flash fleet flesh float flock flood floor flour fluid flush flute " +
  "focus force forth forty forum found frame frank fraud fresh front frost fruit funny giant given glass globe glory glove " +
  "going grace grade grain grand grant grape graph grasp grass grave great green greet grief grill grind group grove grown " +
  "guard guess guest guide habit happy harsh heart heavy hello hinge hobby honey honor horse hotel house human hurry ideal " +
  "image index inner input issue ivory joint judge juice knife knock known label labor large later laugh layer learn least " +
  "leave legal lemon level light limit liver local logic loose lover lower lucky lunch lyric magic major maker march match " +
  "maybe mayor meant medal media merry metal meter micro might minor minus misty mixed model money month moral motor " +
  "mount mouse mouth movie music nasty naval never night noble noise north novel nurse ocean offer often older olive onion " +
  "opera order other ought outer owner paint panel panic paper party patch pause peace penny phase phone photo piano piece " +
  "pilot pitch place plain plane plant plate plaza point pound power press price pride prime print prize proof proud prove " +
  "pulse punch pupil queen query quest queue quick quiet quite quota radar radio raise range rapid ratio reach ready realm " +
  "rebel refer renew reply rider right river roast robot rocky roman rough round route royal rural salad scale scene score " +
  "sense serve seven shade shake shall shape share sharp sheep sheet shelf shell shift shine shirt shock shoot shore short " +
  "shout shown sight silly since sixth sixty skate skill skirt sleep slice slide slope small smart smell smile smoke snake " +
  "solar solid solve sorry sound south space spare speak speed spell spend spice split spoke sport staff stage stair stake " +
  "stand stare start state steam steel steep stick still stock stone stood store storm story strip style sugar sunny super " +
  "sweet table taken taste teach teeth thank their theme there these thick thing think third those three threw throw thumb " +
  "tiger tight tired title today token tooth total touch tough tower town trace track trade trail train trait treat trend " +
  "trial tribe trick truck truly trust truth twice under union unite unity until upper upset urban usual valid value video " +
  "visit vital vivid vocal voice voter waste watch water weave wheel where which while white whole whose woman women world " +
  "worry worth would wound wrist write wrong wrote yacht yeast yield young youth").split(" ");

  const W6 = ("across actual adapt affair alarm album alert alike alive allow almost alone along altar alter angel anger angle " +
  "ankle anthem appear apply arena argue array arrow aside assure attic audio avoid awake award aware bacon badge baker " +
  "basket beach beard beast become before begin begun behind belly below bench better beyond bishop bitter blade blame " +
  "blank blast blend bless blind block bloom board bonus booth border borrow bottle bound brain branch brand brave bread " +
  "breeze brick bridge brief bring broad broken brown brush budget bunch bundle buyer cabin cable candy canon canvas " +
  "carbon career carpet carry castle catch cause cease chain chair chalk champ chant chaos charge charm chart chase " +
  "cheap check cheer chess chest chief child chill choice choose chord chunk church cider civil claim class clean " +
  "clear clerk clever click cliff climb clock close cloth cloud clown coach coast coffee collar color comet common " +
  "coral cotton could count county court cover crack craft crash crate crawl crazy cream crime crisis critic cross " +
  "crowd crown crush crust curtain curve cycle daily dancer danger dealt death debate debut delay delete depth deputy " +
  "diary digit dinner dirty disco ditch diver dodge doing dollar donor donut doubt dozen draft drain drama drank " +
  "dream dress dried drift drill drink drive drone eager early earth eighty elbow elder elect elite empty enact " +
  "enemy energy enjoy enter entry equal error erupt essay event every exact exist extra fabric faint fairy faith " +
  "fancy fatal fault favor feast fence fever fiber fiction field fierce fifth fifty fight final finish first flame " +
  "flash flask fleet flesh float flock flood floor flour fluid flush focus force forge formal forth forty forum " +
  "found frame frank fraud fresh friend front frost fruit funny galaxy glance glass globe glory glove going golden " +
  "grace grade grain grand grant grape graph grasp grass grave gravel great green greet grief grill grind groom " +
  "gross group grove guard guess guest guide habit happy harsh heart heavy hello hobby honey honor horse hotel " +
  "house human hurry ideal image impact index inner input issue ivory jungle junior kernel kitten knife knock " +
  "known label labor large laser later laugh layer learn least leave legal lemon length lesson level light limit " +
  "liquid listen little lively liver local logic lonely loose lover lower lucky lunar lunch lyric magic major " +
  "maker manage march margin market match maybe mayor meant medal media merry metal method meter micro might " +
  "minor minus minute misty mixed model modern money month moral mother motor mount mouse mouth movie music " +
  "nasty nation native never night noble noise north novel nurse ocean offer often older olive onion opera " +
  "orbit order other ought outer owner paint palace panel paper party patch pause peace penny phase phone " +
  "photo piano piece pilot pitch pizza place plain plane planet plant plate plaza point pound power praise " +
  "press price pride prime print prize proof proud prove pulse punch pupil queen query quest queue quick " +
  "quiet quite quota radar radio raise range rapid ratio reach ready realm rebel refer reform renew reply " +
  "rider right river roast robot rocket roman rough round route royal rural salad scale scene score screen " +
  "sense serve seven shade shake shall shape share sharp sheep sheet shelf shell shift shine shirt shock " +
  "shoot shore short shout shown sight silly silver since sixth sixty skate skill skirt sleep slice slide " +
  "slope small smart smell smile smoke snake solar solid solve sorry sound south space spare spark speak " +
  "speed spell spend spice split spoke sport staff stage stair stake stand stare start state steam steel " +
  "steep stick still stock stone stood store storm story strip stripe style sugar sunny super sweet symbol " +
  "table taken taste teach teeth thank their theme there these thick thing think third those three threw " +
  "throw thumb tiger tight tired title today token tooth total touch tough tower town trace track trade " +
  "trail train trait treat trend trial tribe trick truck truly trust truth turtle twice under union unite " +
  "unity until upper upset urban usual valid value video visit vital vivid vocal voice voter waste watch " +
  "water weave wheel where which while white whole whose woman women world worry worth would wound wrist " +
  "write wrong wrote yield young youth absent accept access accuse action active actor actual advice advise affair affect afford afraid agency agenda agile agony alarm album alert alien align alike alive allege alley allow alloy almost alone along aloud altar alter amber amend amount ample amuse angel anger angle animal ankle annex annoy annual answer anthem antic anyone appeal appear append apple apply apron arctic argue arise armed armor aroma array arrow aside aspect asset assign assist assume assure atlas attic attire august author autumn avenue avert avoid await awake award aware awning bacon badge baker ballot banana bandit banner barber barrel basket battle beacon beauty beckon become before behalf behave behind belly belong beside better beyond bidder binary bishop bitter blouse bodily boiler border borrow bottle bounce branch breath breeze bridge bright broker bronze browse bruise brunch brutal bubble bucket budget buffer buffet bundle bunker burden bureau burger burial burner bushel bustle butter button byline bypass").split(" ");

  // 7-letter candidates (filtered by length at load — only true 7s survive)
  const W7 = ("abandon abalone abridge abscess abscond achieve address advance advise agitate alchemy align allow almost " +
  "alone along aloud alter amber amend amenity amiable amount ample angel anger angle angelic animal ankle annex annoy " +
  "annual answer anthem anxiety anyone apart apology appear apple apply appoint approve arrange arrow article artist " +
  "ashamed askance asleep aspect aspire assault assert assess assign assist assume assure atlas attic audio avoid awake " +
  "award aware awful awkward bacon badge baker basic beach beard beast beauty become before begin begun behind belly " +
  "below bench berry birth biscuit black blade blank blast blend bless blind block bloom board boast bonus booth bound " +
  "bracket brain brand brave bread break bridge brief bring broad broke brown brush build bunch buyer cabin cable candy " +
  "canvas carbon career carry castle catch cause cease chain chair champ chaos charm chart chase cheap check cheer " +
  "chess chest chief child choice choir choke chunk church cider civil claim class clean clear clerk clever click " +
  "cliff climb clock clone close cloth cloud coach coast collar color comet common coral cotton could count county " +
  "court cover crack craft crash crate crawl crazy cream crime critic cross crowd crown crush crust curtain curve " +
  "daily dancer danger death debate debut delay delete depth deputy diary dinner dirty disco ditch diver dodge doing " +
  "dollar donor doubt dozen draft drain drama dream dress drift drill drink drive eager early earth elbow elder elect " +
  "empty enemy energy enjoy enter entry equal error erupt essay event every exact exist extra fabric faint fairy " +
  "faith fancy fatal fault favor feast fence fever fiber fiction field fierce fifty fight final finish first flame " +
  "flash flask fleet flesh float flock flood floor flour fluid flush focus force forge forth forty forum found " +
  "frame frank fraud fresh friend front frost fruit funny galaxy glance glass globe glory glove going golden grace " +
  "grade grain grand grant grape graph grasp grass grave great green greet grief grill grind groom gross group " +
  "grove guard guess guest guide habit happy harsh heart heavy hello hobby honey honor horse hotel house human " +
  "hurry ideal image impact index inner input issue ivory jewel joint judge juice journey knife knock known label " +
  "labor large laser later laugh layer learn least leave legal lemon length lesson level light limit liquid listen " +
  "little lively liver local logic lonely loose lover lower lucky lunar lunch lyric magic major maker manage march " +
  "margin market match maybe mayor meant medal media merry metal method meter micro might minor minus minute misty " +
  "mixed model modern money month moral mother motor mount mouse mouth movie music nasty nation native never " +
  "night noble noise north novel nurse ocean offer often older olive onion opera orbit order other ought outer " +
  "owner paint palace panel paper party patch pause peace penny phase phone photo piano piece pilot pitch place " +
  "plain plane planet plant plate plaza point pound power praise press price pride prime print prize proof proud " +
  "prove pulse punch pupil queen query quest queue quick quiet quite quota radar radio raise range rapid ratio " +
  "reach ready realm rebel refer renew reply rider right river roast robot rocket roman rough round route royal " +
  "rural salad scale scene score screen sense serve seven shade shake shall shape share sharp sheep sheet shelf " +
  "shell shift shine shirt shock shoot shore short shout shown sight silly silver since sixth sixty skate skill " +
  "skirt sleep slice slide slope small smart smell smile smoke snake solar solid solve sorry sound south space " +
  "spare spark speak speed spell spend spice split spoke sport staff stage stair stake stand stare start state " +
  "steam steel steep stick still stock stone stood store storm story strip stripe style sugar sunny super sweet " +
  "symbol table taken taste teach teeth thank their theme there these thick thing think third those three threw " +
  "throw thumb tiger tight tired title today token tooth total touch tough tower town trace track trade trail " +
  "train trait treat trend trial tribe trick truck truly trust truth turtle twice under union unite unity until " +
  "upper upset urban usual valid value video visit vital vivid vocal voice voter waste watch water weave wheel " +
  "where which while white whole whose woman women world worry worth would wound wrist write wrong wrote yield " +
  "young youth cabbage cabinet cadence capable capital captain caption captive capture caravan careful caribou carnage carrier cascade catalog caution cavalry ceiling central century certain chamber channel chapter chariot charity chatter cherish chimney chronic circuit citizen classic cleanse climate cluster cobbler collate collect college collide combine comfort command comment commune compact compare compass compete compile conceit concept concern concert condemn conduct conduit confide confirm conform confuse congeal congest conquer consent consist console consort consult consume contact contain contend contest context contour control convene convent convert convict correct corrode corrupt corsage costume cottage council counsel counter country courage courier cremate crevice cricket crucial crumble crystal cuisine culprit culture culvert cunning curable curious currant current cursive curtail curtain cushion custard custody cutlery cyclone").split(" ");

  // Theme-specific valid answers: famous single-word titles/names (5-7 letters).
  const THEME_WORDS = {
    "Famous Movies": "alien psycho titanic pound rocky ghost scream dune avatar friday heat tron blade memento fargo " +
      "jumanji twister speed crash taken hanna brave tangled shrek rango bolt nemo coco soul luca frozen moana " +
      "platoon creed venom logan joker se7en",
    "Famous Bands": "queen weezer nirvana abba kiss cream blur oasis rush inxs toto boston kansas styx eagles doors " +
      " floyd zeppelin police cure clash rem muse muse radiohead coldplay genesis rush",
    "Country or State Capitals": "texas berlin jakarta paris rome madrid lisbon dublin oslo helsinki athens cairo nairobi " +
      "accra dakar lima quito bogota albany austin boston dover boise helena lincoln carson trenton columbia salem " +
      "raleigh columbus nashville cheyenne denver phoenix sacramento des moines topeka frankfort augusta annapolis " +
      "jackson olympia madison",
    "Common Cat Names": "salem oliver smokey luna bella lucy daisy lily willow ruby stella pepper mocha oreo tiger " +
      "shadow pumpkin simba nala mittens whiskers boots socks patches gizmo frankie louie milo otis leo max sammy " +
      "oscar felix jasper theo arlo winston murphy bandit rocky lucky coco chloe zoe mia sophie penny rosie olive " +
      "maple hazel ivy juniper cleo athena freya nova pixel echo loki thor odin zeus apollo",
    "Car Types/Models": "civic accord mustang camry corolla prius sentra altima maxima versa leaf tesla bronco wrangler " +
      "cherokee explorer tahoe suburban yukon escalade blazer equinox traverse malibu impala cruze spark sonic volt " +
      "bolt elantra sonata venue kona tucson forte stinger soul seltos sportage sorento telluride palisade mazda " +
      "miata wrx supra jetta tiguan atlas passat beetle mini cooper countryman",
    "Common Dog Names": "buddy bailey charlie max bella lucy daisy lola sadie maggie molly ruby rosie stella winston " +
      "murphy louie teddy frankie otis leo milo archie ollie benny sammy rocky lucky duke zeus apollo thor loki " +
      "bruno diesel tank moose bear scout ranger hunter gunner nova willow maple pepper mocha oreo ginger pumpkin " +
      "biscuit waffles nugget olive penny hazel ivy juniper poppy clover shadow pearl opal jade jasper theo arlo",
    "American Cuisine": "cajun burger pizza chili grits gumbo beignet praline pecan cobbler brownie cookie donut bagel " +
      "pretzel fries shake malt sundae meatloaf turkey bacon pancakes waffles biscuit gravy hashbrown omelet burrito " +
      "taco nachos fajita enchilada tamale hotdogs funnel popcorn peanuts cracker hushpuppy okra collard salad slaw beans " +
      "cheese salsa"
  };

  const WORDS = { 5: clean(W5, 5), 6: clean(W6, 6), 7: clean(W7, 7) };
  const THEMES = {};
  Object.keys(THEME_WORDS).forEach(t => {
    THEMES[t] = new Set(THEME_WORDS[t].split(" ").map(w => w.toLowerCase()).filter(w => w.length >= 5 && w.length <= 7));
  });

  window.Wordlist = {
    isWord(word, theme) {
      word = String(word).toLowerCase();
      const len = word.length;
      if (WORDS[len] && WORDS[len].has(word)) return true;
      if (theme && THEMES[theme] && THEMES[theme].has(word)) return true;
      return false;
    },
    // for debugging
    sizes() { return { 5: WORDS[5].size, 6: WORDS[6].size, 7: WORDS[7].size }; }
  };
})();
