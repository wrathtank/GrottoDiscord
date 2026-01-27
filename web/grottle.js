// GROTTLE - The Grotto Word Game
// A cyberpunk/horror themed Wordle clone

// Cyberpunk/Horror themed 5-letter words - THESE ARE THE TARGET WORDS
const WORD_LIST = [
  // Horror
  'blood', 'death', 'demon', 'ghost', 'grave', 'haunt', 'curse',
  'crypt', 'decay', 'dread', 'fiend', 'flesh', 'gloom', 'ghoul', 'grime',
  'groan', 'howls', 'leech', 'lurks', 'moans', 'night', 'panic',
  'prowl', 'reeks', 'scary', 'shade', 'skull', 'slash', 'slime', 'spell',
  'spine', 'spook', 'stalk', 'swamp', 'taint', 'talon', 'teeth', 'tombs',
  'toxin', 'venom', 'viper', 'wails', 'witch', 'abyss', 'agony',
  'beast', 'black', 'bleed', 'bones', 'brood', 'chaos', 'choke',
  'claws', 'crawl', 'creep', 'cries', 'cruel', 'crush', 'damns',
  'devil', 'dirge', 'drool', 'eerie', 'fangs',
  'fatal', 'feast', 'feral', 'fetid', 'filth', 'freak', 'frost', 'fungi',
  'gaunt', 'gnash', 'gored', 'greed', 'grimy', 'hexed', 'horde',

  // Cyberpunk
  'cyber', 'neons', 'proxy', 'rogue', 'synth', 'vapor', 'virus',
  'pixel', 'coder', 'drone', 'laser', 'nodes', 'ports', 'scans', 'stack',
  'techs', 'wired', 'bytes', 'chips', 'clone', 'coded', 'corps', 'crash',
  'datum', 'debug', 'decks', 'droid', 'fiber', 'forge',
  'gamma', 'grids', 'hacks', 'heist', 'input', 'jacks', 'layer',
  'links', 'logic', 'loops', 'mains', 'mechs', 'media', 'merge', 'metal',
  'micro', 'minds', 'modem', 'morph', 'nerve', 'nexus', 'noise',
  'omega', 'optic', 'orbit', 'oxide', 'phase', 'pipes', 'power', 'prime',
  'probe', 'pulse', 'radar', 'raids', 'realm', 'relay', 'relic',
  'route', 'scale', 'scrap', 'servo', 'shell', 'shift', 'sigma',
  'siren', 'slate', 'slots', 'smart', 'smoke', 'solar', 'solid',
  'sonic', 'spark', 'specs', 'speed', 'spike', 'split', 'squad',
  'stage', 'stark', 'state', 'steam', 'steel', 'stock', 'storm', 'surge',
  'swarm', 'syncs', 'tapes', 'tasks', 'tower', 'trace', 'track', 'trade',
  'trans', 'trash', 'trial', 'tribe', 'ultra', 'units', 'urban', 'vault',
  'vents', 'verge', 'views', 'viral', 'visor', 'vista', 'vital',
  'volts', 'watts', 'waves', 'welds', 'wires', 'zeros', 'zones',

  // Grotto/Game themed
  'token', 'guild', 'quest', 'blade', 'craft',
  'armor', 'chain', 'shard', 'runes', 'souls', 'flame',
  'lunar', 'solar', 'raven', 'drake', 'wyrms', 'titan', 'giant',
  'troll', 'golem', 'spawn', 'siege', 'coven', 'banes', 'hexes',
  'plague', 'risen', 'glyph', 'sigil', 'ether', 'mists', 'voids'
];

// Extended valid guesses - includes common English 5-letter words
// Players can guess these but they won't be the answer
const COMMON_WORDS = [
  // A
  'abide', 'about', 'above', 'abuse', 'acids', 'acres', 'acted', 'actor', 'acute', 'adept',
  'admit', 'adopt', 'adult', 'adieu', 'aegis', 'aeons', 'affix', 'after', 'again', 'agent',
  'agile', 'aging', 'agree', 'ahead', 'aides', 'aided', 'aimed', 'aired', 'aisle', 'alarm',
  'album', 'alert', 'algae', 'alibi', 'alien', 'align', 'alike', 'alive', 'allay', 'allen',
  'allot', 'allow', 'alloy', 'aloft', 'alone', 'along', 'aloof', 'alpha', 'altar', 'alter',
  'amaze', 'amber', 'amend', 'amids', 'amino', 'among', 'ample', 'amuse', 'angel', 'anger',
  'angle', 'angry', 'angst', 'anime', 'ankle', 'annex', 'annoy', 'annual', 'antic', 'anvil',
  'apart', 'aphid', 'apple', 'apply', 'apron', 'aptly', 'areas', 'arena', 'argue', 'arise',
  'armor', 'aroma', 'arose', 'array', 'arrow', 'arson', 'artsy', 'ascot', 'ashen', 'ashes',
  'aside', 'asked', 'asset', 'atlas', 'attic', 'audio', 'audit', 'augur', 'aunts', 'auras',
  'autos', 'avail', 'avert', 'avoid', 'await', 'awake', 'award', 'aware', 'awful', 'awoke',
  'axial', 'axiom', 'axles', 'azure',

  // B
  'babel', 'babes', 'backs', 'bacon', 'badge', 'badly', 'bagel', 'baggy', 'bails', 'baits',
  'baked', 'baker', 'bales', 'balls', 'balms', 'balmy', 'banal', 'bands', 'bangs', 'banjo',
  'banks', 'barbs', 'bards', 'bared', 'barely', 'barfs', 'barge', 'barks', 'barns', 'baron',
  'basal', 'based', 'baser', 'bases', 'basic', 'basil', 'basin', 'basis', 'basks', 'batch',
  'bated', 'bathe', 'baths', 'batty', 'bayou', 'beach', 'beads', 'beady', 'beaks', 'beams',
  'beans', 'beard', 'bears', 'beats', 'beaus', 'beaux', 'bebop', 'becks', 'beech', 'beefs',
  'beefy', 'beeps', 'beers', 'beets', 'began', 'begin', 'begun', 'being', 'belay', 'belch',
  'belie', 'belle', 'bells', 'belly', 'below', 'belts', 'bench', 'bends', 'bendy', 'bergs',
  'berry', 'berth', 'beset', 'beside', 'bests', 'betas', 'betel', 'bevel', 'bible', 'bicep',
  'biddy', 'bided', 'bides', 'bidet', 'biers', 'biffs', 'bigot', 'biked', 'biker', 'bikes',
  'bilge', 'bills', 'billy', 'bimbo', 'binds', 'binge', 'bingo', 'biome', 'biped', 'bipod',
  'birch', 'birds', 'birth', 'bison', 'bites', 'bitsy', 'bitty', 'blade', 'blame', 'bland',
  'blank', 'blare', 'blast', 'blaze', 'bleak', 'bleat', 'blebs', 'blend', 'bless', 'blimp',
  'blind', 'bling', 'blini', 'blink', 'blips', 'bliss', 'blitz', 'bloat', 'blobs', 'block',
  'bloke', 'blond', 'bloom', 'blown', 'blows', 'bluer', 'blues', 'bluff', 'blunt', 'blurb',
  'blurs', 'blurt', 'blush', 'board', 'boars', 'boast', 'boats', 'bobby', 'boded', 'bodes',
  'bogey', 'boggy', 'bogus', 'boils', 'bolds', 'bolls', 'bolts', 'bombs', 'bonds', 'boned',
  'boner', 'bones', 'bongo', 'bonus', 'booby', 'books', 'booms', 'boons', 'boost', 'booth',
  'boots', 'booty', 'booze', 'boozy', 'borax', 'bored', 'borer', 'bores', 'borne', 'bosom',
  'bossy', 'botch', 'bound', 'bouts', 'bowed', 'bowel', 'bower', 'bowls', 'boxed', 'boxer',
  'boxes', 'brace', 'brags', 'braid', 'brain', 'brake', 'brand', 'brash', 'brass', 'brave',
  'bravo', 'brawl', 'brawn', 'bread', 'break', 'breed', 'brews', 'bribe', 'brick', 'bride',
  'brief', 'brier', 'brigs', 'brims', 'brine', 'bring', 'brink', 'briny', 'brisk', 'broad',
  'broil', 'broke', 'brood', 'brook', 'broom', 'broth', 'brown', 'brows', 'brunt', 'brush',
  'brute', 'bucks', 'buddy', 'budge', 'buffs', 'buggy', 'bugle', 'build', 'built', 'bulbs',
  'bulge', 'bulky', 'bulla', 'bulls', 'bully', 'bumps', 'bumpy', 'bunch', 'bunks', 'bunny',
  'bunts', 'buoys', 'burly', 'burns', 'burnt', 'burps', 'burst', 'bury', 'buses', 'bushy',
  'busts', 'busty', 'butch', 'butte', 'butts', 'buxom', 'buyer', 'buzzy', 'bylaw', 'byway',

  // C
  'cabal', 'cabby', 'cabin', 'cable', 'cacao', 'cache', 'cacti', 'cadet', 'cadge', 'cafes',
  'caged', 'cager', 'cages', 'cagey', 'cairn', 'caked', 'cakes', 'calls', 'calms', 'camel',
  'cameo', 'camps', 'campy', 'canal', 'candy', 'caned', 'canes', 'canoe', 'canon', 'canto',
  'caped', 'caper', 'capes', 'cards', 'cared', 'carer', 'cares', 'cargo', 'carps', 'carry',
  'carts', 'carve', 'cased', 'cases', 'casks', 'caste', 'casts', 'catch', 'cater', 'catty',
  'cause', 'caves', 'cease', 'cedar', 'ceded', 'cedes', 'cells', 'cents', 'chafe', 'chaff',
  'chair', 'chalk', 'champ', 'chant', 'chaps', 'chard', 'charm', 'chars', 'chart', 'chase',
  'chasm', 'cheap', 'cheat', 'check', 'cheek', 'cheer', 'chess', 'chest', 'chick', 'chide',
  'chief', 'child', 'chili', 'chill', 'chimp', 'china', 'chins', 'chips', 'chirp', 'chits',
  'chive', 'choir', 'choke', 'chomp', 'chops', 'chord', 'chore', 'chose', 'chuck', 'chump',
  'chunk', 'churn', 'chute', 'cider', 'cigar', 'cinch', 'circa', 'cisco', 'cited', 'cites',
  'civet', 'civic', 'civil', 'civvy', 'clack', 'claim', 'clamp', 'clams', 'clang', 'clank',
  'clans', 'claps', 'clash', 'clasp', 'class', 'clean', 'clear', 'cleat', 'cleft', 'clerk',
  'click', 'cliff', 'climb', 'cling', 'clink', 'clips', 'cloak', 'clock', 'clods', 'clogs',
  'clone', 'close', 'cloth', 'clots', 'cloud', 'clout', 'clove', 'clown', 'clubs', 'cluck',
  'clued', 'clues', 'clump', 'clung', 'coach', 'coals', 'coast', 'coats', 'cocoa', 'cocos',
  'coded', 'coder', 'codes', 'coils', 'coins', 'cokes', 'colas', 'colds', 'colon', 'color',
  'colts', 'combs', 'comer', 'comes', 'comet', 'comfy', 'comic', 'comma', 'conch', 'condo',
  'coned', 'cones', 'congo', 'conte', 'cooed', 'cooks', 'cools', 'coops', 'coots', 'coped',
  'copes', 'copse', 'coral', 'cords', 'cored', 'corer', 'cores', 'corgi', 'corks', 'corky',
  'corns', 'corny', 'corps', 'couch', 'cough', 'could', 'count', 'coupe', 'coups', 'court',
  'coven', 'cover', 'covet', 'cowed', 'cower', 'cowls', 'coyly', 'cozen', 'crabs', 'crack',
  'craft', 'crags', 'cramp', 'crams', 'crane', 'crank', 'craps', 'crash', 'crass', 'crate',
  'crave', 'crawl', 'craze', 'crazy', 'creak', 'cream', 'credo', 'creed', 'creek', 'creep',
  'creme', 'crepe', 'crept', 'cress', 'crest', 'crews', 'cribs', 'crick', 'cried', 'crier',
  'cries', 'crime', 'crimp', 'crisp', 'croak', 'crock', 'crook', 'crops', 'cross', 'group',
  'crowd', 'crown', 'crows', 'crude', 'cruds', 'cruel', 'crumb', 'crush', 'crust', 'cubby',
  'cubed', 'cubes', 'cubic', 'cuffs', 'culls', 'curbs', 'curds', 'cured', 'curer', 'cures',
  'curls', 'curly', 'curry', 'curse', 'curve', 'curvy', 'cushy', 'cusps', 'cutie', 'cycle',
  'cynic',

  // D
  'daddy', 'daily', 'dairy', 'daisy', 'dales', 'dally', 'dance', 'dandy', 'dares', 'darks',
  'darns', 'darts', 'dated', 'dater', 'dates', 'datum', 'daunt', 'dawns', 'dazed', 'deals',
  'dealt', 'deans', 'dears', 'deary', 'debit', 'debts', 'debug', 'debut', 'decaf', 'decal',
  'decks', 'decor', 'decoy', 'decry', 'deeds', 'deems', 'deeps', 'deers', 'defer', 'deign',
  'deity', 'delay', 'delta', 'delve', 'demob', 'demon', 'demur', 'denim', 'dense', 'dents',
  'depot', 'depth', 'derby', 'desks', 'deter', 'detox', 'deuce', 'devil', 'diary', 'diced',
  'dicer', 'dices', 'dicey', 'dicks', 'diets', 'digit', 'dikes', 'dildo', 'dills', 'dilly',
  'dimer', 'dimes', 'dimly', 'dined', 'diner', 'dines', 'dingo', 'dingy', 'dinky', 'diode',
  'dippy', 'dipso', 'direr', 'dirge', 'dirty', 'disco', 'discs', 'dishy', 'disks', 'ditch',
  'ditto', 'ditty', 'divan', 'divas', 'dived', 'diver', 'dives', 'divot', 'dizzy', 'docks',
  'dodge', 'dodgy', 'doers', 'doest', 'doffs', 'dogie', 'doily', 'doing', 'dolls', 'dolly',
  'domed', 'domes', 'donor', 'donut', 'dooms', 'doors', 'dopes', 'dopey', 'dorks', 'dorky',
  'dorms', 'dosed', 'doser', 'doses', 'dotty', 'doubt', 'dough', 'douse', 'doves', 'dowdy',
  'dowel', 'downs', 'downy', 'dowry', 'dowse', 'dozed', 'dozen', 'dozer', 'dozes', 'drabs',
  'draft', 'drags', 'drain', 'drake', 'drama', 'drank', 'drape', 'drawl', 'drawn', 'draws',
  'dread', 'dream', 'dress', 'dried', 'drier', 'dries', 'drift', 'drill', 'drink', 'drips',
  'drive', 'droit', 'droll', 'drone', 'drool', 'droop', 'drops', 'dross', 'drove', 'drown',
  'drugs', 'drums', 'drunk', 'dryer', 'dryly', 'ducal', 'ducks', 'ducky', 'ducts', 'dudes',
  'duels', 'duets', 'duffs', 'duked', 'dukes', 'dulls', 'dully', 'dumbo', 'dumps', 'dumpy',
  'dunce', 'dunes', 'dunks', 'duped', 'duper', 'dupes', 'dural', 'dusky', 'dusty', 'dutch',
  'duvet', 'dwarf', 'dwell', 'dwelt', 'dying', 'dykes',

  // E
  'eager', 'eagle', 'eared', 'earls', 'early', 'earns', 'earth', 'eased', 'easel', 'easer',
  'eases', 'eaten', 'eater', 'eaves', 'ebbed', 'ebony', 'edged', 'edger', 'edges', 'edgier',
  'edict', 'edify', 'edits', 'eerie', 'egads', 'egged', 'egger', 'egos', 'eider', 'eight',
  'eject', 'eking', 'elate', 'elbow', 'elder', 'elect', 'elegy', 'elfin', 'elide', 'elite',
  'elope', 'elude', 'elves', 'email', 'embed', 'ember', 'emcee', 'emery', 'emits', 'empty',
  'enact', 'ended', 'ender', 'endow', 'enema', 'enemy', 'enjoy', 'ennui', 'enrol', 'ensue',
  'enter', 'entry', 'envoy', 'epoch', 'epoxy', 'equal', 'equip', 'erase', 'erect', 'erode',
  'erred', 'error', 'erupt', 'essay', 'ether', 'ethic', 'ethos', 'evade', 'evens', 'event',
  'every', 'evict', 'evils', 'evoke', 'exact', 'exalt', 'exams', 'excel', 'execs', 'exert',
  'exile', 'exist', 'exits', 'expat', 'expel', 'extol', 'extra', 'exude', 'exult', 'eying',
  'eyrie',

  // F
  'fable', 'faced', 'facer', 'faces', 'facet', 'facts', 'faddy', 'faded', 'fader', 'fades',
  'fails', 'faint', 'fairs', 'fairy', 'faith', 'faked', 'faker', 'fakes', 'falls', 'false',
  'famed', 'fancy', 'fangs', 'fanny', 'farce', 'fared', 'fares', 'farms', 'farts', 'fasts',
  'fatal', 'fated', 'fates', 'fatty', 'fatwa', 'fault', 'fauna', 'fauns', 'favor', 'fawns',
  'faxed', 'faxes', 'fazed', 'fazes', 'fears', 'feast', 'feats', 'fecal', 'feces', 'feeds',
  'feels', 'feign', 'feint', 'fella', 'fells', 'felon', 'felts', 'femur', 'fence', 'fends',
  'feral', 'ferns', 'ferny', 'ferry', 'fetal', 'fetch', 'feted', 'fetid', 'fetus', 'feud',
  'fever', 'fewer', 'fiber', 'fibre', 'ficus', 'field', 'fiend', 'fiery', 'fifes', 'fifth',
  'fifty', 'fight', 'filch', 'filed', 'filer', 'files', 'filet', 'fills', 'filly', 'films',
  'filmy', 'filth', 'final', 'finch', 'finds', 'fined', 'finer', 'fines', 'fired', 'firer',
  'fires', 'firms', 'first', 'fishy', 'fists', 'fitly', 'fits', 'fiver', 'fives', 'fixed',
  'fixer', 'fixes', 'fizzy', 'fjord', 'flack', 'flags', 'flair', 'flake', 'flaky', 'flame',
  'flank', 'flaps', 'flare', 'flash', 'flask', 'flats', 'flaws', 'flaxy', 'fleas', 'fleck',
  'flees', 'fleet', 'flesh', 'flick', 'flier', 'flies', 'fling', 'flint', 'flips', 'flirt',
  'float', 'flock', 'flogs', 'flood', 'floor', 'flops', 'flora', 'floss', 'flour', 'flout',
  'flows', 'flubs', 'flues', 'fluff', 'fluid', 'fluke', 'fluky', 'flung', 'flunk', 'flush',
  'flute', 'flyby', 'flyer', 'foals', 'foams', 'foamy', 'focal', 'focus', 'foggy', 'foils',
  'foist', 'folds', 'folks', 'folky', 'folly', 'fonts', 'foods', 'fools', 'foots', 'foray',
  'force', 'forgo', 'forks', 'forms', 'forte', 'forth', 'forts', 'forty', 'forum', 'fossil',
  'fouls', 'found', 'fount', 'fours', 'foyer', 'frail', 'frame', 'frank', 'fraud', 'frays',
  'freak', 'freed', 'freer', 'frees', 'fresh', 'friar', 'fried', 'frier', 'fries', 'frill',
  'frisk', 'fritz', 'frizz', 'frock', 'frogs', 'frolic', 'from', 'front', 'frost', 'froth',
  'frown', 'froze', 'fruit', 'frump', 'fudge', 'fuels', 'fugue', 'fully', 'fumed', 'fumer',
  'fumes', 'funds', 'fungi', 'funks', 'funky', 'funny', 'furry', 'fused', 'fuses', 'fussy',
  'fusty', 'futile', 'futon', 'fuzzy',

  // G
  'gaily', 'gains', 'gaits', 'gales', 'galls', 'games', 'gamma', 'gamut', 'gangs', 'gaped',
  'gapes', 'garbs', 'gases', 'gasps', 'gassy', 'gates', 'gauge', 'gaunt', 'gauze', 'gauzy',
  'gavel', 'gawks', 'gawky', 'gazer', 'gazes', 'gears', 'gecko', 'geeks', 'geeky', 'geese',
  'gents', 'genus', 'germs', 'getup', 'ghost', 'giant', 'gifts', 'gilds', 'gills', 'gilts',
  'gimpy', 'girds', 'girls', 'girly', 'girth', 'gismo', 'given', 'giver', 'gives', 'gizmo',
  'glade', 'gland', 'glare', 'glass', 'glaze', 'gleam', 'glean', 'glebe', 'glees', 'glens',
  'glide', 'glint', 'glitz', 'gloat', 'globe', 'globs', 'gloom', 'glory', 'gloss', 'glove',
  'glows', 'glued', 'gluer', 'glues', 'gluey', 'glugs', 'gluts', 'gnarl', 'gnars', 'gnash',
  'gnats', 'gnaws', 'gnome', 'goads', 'goals', 'goats', 'godly', 'goers', 'going', 'golds',
  'golfs', 'goner', 'gongs', 'gonna', 'goods', 'goody', 'gooey', 'goofs', 'goofy', 'goons',
  'goose', 'gored', 'gores', 'gorge', 'gorse', 'gotta', 'gouge', 'gourd', 'gowns', 'grace',
  'grade', 'graft', 'grail', 'grain', 'grams', 'grand', 'grant', 'grape', 'graph', 'grasp',
  'grass', 'grate', 'grave', 'gravy', 'grays', 'graze', 'great', 'greed', 'greek', 'green',
  'greet', 'greys', 'grief', 'grill', 'grime', 'grimy', 'grind', 'grins', 'gripe', 'grips',
  'grist', 'grits', 'groan', 'groat', 'groin', 'groom', 'grope', 'gross', 'group', 'grout',
  'grove', 'growl', 'grown', 'grows', 'grubs', 'gruel', 'gruff', 'grump', 'grunt', 'guano',
  'guard', 'guava', 'guess', 'guest', 'guide', 'guild', 'guilt', 'guise', 'gulch', 'gulfs',
  'gulls', 'gulps', 'gummy', 'gumps', 'gunks', 'gunky', 'gunny', 'guppy', 'gusts', 'gusty',
  'gutsy', 'guyed', 'guys', 'gypsy',

  // H
  'habit', 'hacks', 'hadji', 'hails', 'hairs', 'hairy', 'hajji', 'haled', 'haler', 'hales',
  'halfs', 'halls', 'halos', 'halts', 'halve', 'hands', 'handy', 'hangs', 'hanks', 'happy',
  'hardy', 'hared', 'harem', 'hares', 'harks', 'harms', 'harps', 'harpy', 'harry', 'harsh',
  'haste', 'hasty', 'hatch', 'hated', 'hater', 'hates', 'hauls', 'haunt', 'haven', 'haves',
  'havoc', 'hawks', 'hazed', 'hazel', 'hazer', 'hazes', 'heads', 'heady', 'heals', 'heaps',
  'heard', 'hears', 'heart', 'heath', 'heats', 'heave', 'heavy', 'hedge', 'heeds', 'heels',
  'hefts', 'hefty', 'heirs', 'heist', 'helix', 'hello', 'hells', 'helms', 'helps', 'hence',
  'henna', 'henry', 'herbs', 'herds', 'heron', 'heros', 'hertz', 'hewed', 'hewer', 'hexed',
  'hexes', 'hicks', 'hided', 'hider', 'hides', 'highs', 'hiked', 'hiker', 'hikes', 'hills',
  'hilly', 'hilts', 'hinds', 'hinge', 'hinny', 'hints', 'hippo', 'hippy', 'hired', 'hirer',
  'hires', 'hitch', 'hived', 'hiver', 'hives', 'hoard', 'hoars', 'hoary', 'hobby', 'hobos',
  'hocks', 'hoist', 'holds', 'holed', 'holes', 'holey', 'holly', 'homer', 'homes', 'homey',
  'honed', 'honer', 'hones', 'honey', 'honks', 'honor', 'hoods', 'hoofs', 'hooks', 'hooky',
  'hoops', 'hoots', 'hoped', 'hoper', 'hopes', 'horde', 'horns', 'horny', 'horse', 'horsy',
  'hosed', 'hoser', 'hoses', 'hosts', 'hotel', 'hotly', 'hound', 'hours', 'house', 'hovel',
  'hover', 'howdy', 'howls', 'hubby', 'huffs', 'huffy', 'huger', 'hulks', 'hulky', 'hulls',
  'human', 'humid', 'humps', 'humpy', 'humus', 'bunch', 'hunks', 'hunky', 'hunts', 'hurds',
  'hurls', 'hurry', 'hurts', 'husks', 'husky', 'hussy', 'hutch', 'hyena', 'hymen', 'hymns',
  'hyped', 'hyper', 'hypes',

  // I
  'icier', 'icily', 'icing', 'icons', 'ideal', 'ideas', 'idiom', 'idiot', 'idled', 'idler',
  'idles', 'idols', 'igloos', 'image', 'imams', 'imbue', 'impel', 'imply', 'inane', 'incur',
  'index', 'indie', 'inept', 'inert', 'infer', 'ingle', 'ingot', 'inked', 'inker', 'inkle',
  'inlay', 'inlet', 'inner', 'input', 'inset', 'inter', 'intro', 'ionic', 'irate', 'irked',
  'irony', 'isles', 'islet', 'issue', 'itchy', 'items', 'ivied', 'ivies', 'ivory',

  // J
  'jab', 'jacks', 'jaded', 'jades', 'jails', 'jakes', 'jambs', 'james', 'jammed', 'janky',
  'japan', 'japed', 'japer', 'japes', 'jarred', 'jasper', 'jaunt', 'jazzy', 'jeans', 'jeeps',
  'jeers', 'jelly', 'jenny', 'jerks', 'jerky', 'jerry', 'jests', 'jesus', 'jetty', 'jewel',
  'jibed', 'jiber', 'jibes', 'jiffs', 'jiffy', 'jilts', 'jimmy', 'jingo', 'jinks', 'jinni',
  'jived', 'jiver', 'jives', 'jobs', 'jocks', 'joeys', 'johns', 'joins', 'joint', 'joist',
  'joked', 'joker', 'jokes', 'jokey', 'jolly', 'jolts', 'jones', 'joule', 'joust', 'joyed',
  'judge', 'juice', 'juicy', 'julep', 'jumbo', 'jumps', 'jumpy', 'junco', 'junks', 'junky',
  'junta', 'juror', 'jests',

  // K
  'kappa', 'karma', 'kayak', 'kazoo', 'kebab', 'keels', 'keens', 'keeps', 'kelps', 'kennel',
  'keyed', 'khaki', 'kicks', 'kiddo', 'kiddy', 'kills', 'kilns', 'kilts', 'kinds', 'kinda',
  'kings', 'kinks', 'kinky', 'kiosk', 'kited', 'kiter', 'kites', 'kitty', 'kiwis', 'knack',
  'knave', 'knead', 'kneed', 'kneel', 'knees', 'knell', 'knelt', 'knife', 'knits', 'knobs',
  'knock', 'knoll', 'knots', 'known', 'knows', 'knurl', 'koala', 'kooks', 'kooky', 'kraft',

  // L
  'label', 'labor', 'laced', 'lacer', 'laces', 'lacey', 'lacks', 'laded', 'laden', 'lades',
  'ladle', 'lager', 'laird', 'lairs', 'lakes', 'lamas', 'lambs', 'lamed', 'lamer', 'lames',
  'lamps', 'lance', 'lands', 'lanes', 'lanky', 'lapel', 'lapse', 'larch', 'lards', 'lardy',
  'large', 'largo', 'larks', 'larva', 'laser', 'lasso', 'lasts', 'latch', 'later', 'latex',
  'lathe', 'latte', 'lauds', 'laugh', 'lawns', 'layer', 'layup', 'lazed', 'lazes', 'leach',
  'leads', 'leafy', 'leaks', 'leaky', 'leans', 'leant', 'leaps', 'leapt', 'learn', 'lease',
  'leash', 'least', 'leave', 'ledge', 'leech', 'leeks', 'leers', 'leery', 'lefts', 'lefty',
  'legal', 'leggy', 'lemma', 'lemon', 'lemur', 'lends', 'leper', 'level', 'lever', 'lewis',
  'liars', 'libel', 'licks', 'lidos', 'liege', 'liens', 'lifer', 'lifts', 'light', 'liked',
  'liken', 'liker', 'likes', 'lilac', 'lilts', 'limbo', 'limbs', 'limed', 'limes', 'limey',
  'limit', 'limns', 'limos', 'limps', 'lined', 'linen', 'liner', 'lines', 'lingo', 'lings',
  'links', 'lints', 'lions', 'lipid', 'lisps', 'lists', 'liter', 'lithe', 'litre', 'lived',
  'liven', 'liver', 'lives', 'livid', 'llama', 'loads', 'loafs', 'loams', 'loamy', 'loans',
  'loath', 'lobby', 'lobed', 'lobes', 'local', 'locus', 'lodge', 'lofts', 'lofty', 'logan',
  'logic', 'login', 'logos', 'loins', 'lolls', 'loner', 'longs', 'looks', 'looms', 'loons',
  'loony', 'loops', 'loopy', 'loose', 'loots', 'loped', 'loper', 'lopes', 'lords', 'lores',
  'lorry', 'loser', 'loses', 'lossy', 'lotto', 'lotus', 'louse', 'lousy', 'louts', 'loved',
  'lover', 'loves', 'lower', 'lowly', 'loyal', 'lucid', 'lucks', 'lucky', 'lucre', 'lulls',
  'lumen', 'lumps', 'lumpy', 'lunar', 'lunch', 'lunge', 'lungs', 'lurch', 'lured', 'lurer',
  'lures', 'lurks', 'lusts', 'lusty', 'lutes', 'lying', 'lymph', 'lynch', 'lyric',

  // M
  'macho', 'macro', 'madam', 'madly', 'mafia', 'magic', 'magma', 'maids', 'mails', 'maims',
  'mains', 'maize', 'major', 'maker', 'makes', 'males', 'malls', 'malts', 'malty', 'mamas',
  'mambo', 'mamma', 'mammy', 'mango', 'manga', 'mange', 'mangy', 'mania', 'manic', 'manly',
  'manna', 'manor', 'maple', 'march', 'mares', 'marks', 'marry', 'marsh', 'marts', 'masks',
  'mason', 'masse', 'masts', 'match', 'mated', 'mater', 'mates', 'maths', 'matey', 'mauls',
  'mauve', 'maven', 'maxed', 'maxes', 'maxim', 'maybe', 'mayor', 'mazes', 'meads', 'meals',
  'mealy', 'means', 'meant', 'meats', 'meaty', 'mecca', 'medal', 'media', 'medic', 'meets',
  'melee', 'melon', 'melts', 'memos', 'mends', 'menus', 'meows', 'mercy', 'merge', 'merit',
  'merry', 'messy', 'metal', 'meted', 'meter', 'metro', 'micas', 'micro', 'middy', 'midst',
  'miens', 'might', 'miked', 'mikes', 'milch', 'milds', 'miler', 'miles', 'milks', 'milky',
  'mills', 'mimed', 'mimer', 'mimes', 'mimic', 'mince', 'minds', 'mined', 'miner', 'mines',
  'mingy', 'minim', 'minks', 'minor', 'mints', 'minty', 'minus', 'mired', 'mires', 'mirth',
  'miser', 'missy', 'mists', 'misty', 'miter', 'mites', 'mixed', 'mixer', 'mixes', 'moans',
  'moats', 'mocks', 'modal', 'model', 'modem', 'modes', 'modus', 'mogul', 'moist', 'molar',
  'molds', 'moldy', 'moles', 'molls', 'molts', 'momma', 'mommy', 'monks', 'month', 'mooch',
  'moods', 'moody', 'moons', 'moony', 'moors', 'moose', 'moots', 'moped', 'moper', 'mopes',
  'moral', 'moray', 'mores', 'morns', 'moron', 'morph', 'morse', 'mossy', 'mosts', 'motel',
  'motes', 'moths', 'motif', 'motor', 'motto', 'mould', 'moult', 'mound', 'mount', 'mourn',
  'mouse', 'mousy', 'mouth', 'moved', 'mover', 'moves', 'movie', 'mowed', 'mower', 'mucks',
  'mucky', 'mucus', 'muddy', 'muffs', 'muggy', 'mulch', 'mules', 'mulls', 'mumbo', 'mummy',
  'mumps', 'munch', 'muons', 'mural', 'murks', 'murky', 'mused', 'muser', 'muses', 'mushy',
  'music', 'musks', 'musky', 'musts', 'musty', 'muted', 'muter', 'mutes', 'mutts', 'myrrh',
  'myths',

  // N
  'naans', 'nabob', 'nacho', 'nadir', 'nails', 'naive', 'naked', 'named', 'namer', 'names',
  'nanny', 'napkin', 'nappe', 'nappy', 'narco', 'narcs', 'nards', 'nares', 'nasal', 'nasty',
  'natal', 'nates', 'naval', 'navel', 'naves', 'navvy', 'neaps', 'nears', 'neath', 'neato',
  'necks', 'needs', 'needy', 'negro', 'neigh', 'neons', 'nerds', 'nerdy', 'nerve', 'nervy',
  'nests', 'never', 'newer', 'newly', 'newsy', 'newts', 'nexus', 'nicer', 'niche', 'nicks',
  'niece', 'nifty', 'night', 'nimbi', 'ninja', 'ninny', 'ninth', 'nippy', 'nisei', 'niter',
  'nitro', 'nitty', 'nixed', 'nixer', 'nixes', 'nixie', 'noble', 'nobly', 'nocks', 'nodal',
  'noddy', 'nodes', 'nodus', 'noels', 'noire', 'noise', 'noisy', 'nomad', 'nonce', 'nones',
  'nooks', 'nooky', 'noons', 'noose', 'norms', 'north', 'nosed', 'noser', 'noses', 'nosey',
  'notch', 'noted', 'noter', 'notes', 'nouns', 'novae', 'novas', 'novel', 'nubby', 'nuked',
  'nuker', 'nukes', 'nulls', 'numbs', 'nurse', 'nutso', 'nutsy', 'nutty', 'nylon', 'nymph',

  // O
  'oaken', 'oakum', 'oared', 'oases', 'oasis', 'oaten', 'oater', 'oaths', 'obese', 'obeys',
  'occur', 'ocean', 'ocher', 'ochre', 'octal', 'octet', 'oculi', 'oddly', 'odder', 'odeon',
  'odors', 'odour', 'offal', 'offed', 'offer', 'often', 'ogled', 'ogler', 'ogles', 'ogres',
  'oiled', 'oiler', 'oinks', 'okapi', 'okays', 'okras', 'olden', 'older', 'oldie', 'olive',
  'ombre', 'omega', 'omens', 'omits', 'onion', 'onset', 'oohed', 'oomph', 'oozed', 'oozes',
  'opahs', 'opals', 'opens', 'opera', 'opted', 'optic', 'orals', 'orate', 'orbit', 'orcas',
  'order', 'organ', 'orgys', 'oriole', 'other', 'otter', 'ought', 'ounce', 'ousel', 'ousts',
  'outdo', 'outed', 'outer', 'outgo', 'ovary', 'ovate', 'ovens', 'overt', 'ovoid', 'ovule',
  'owing', 'owled', 'owlet', 'owned', 'owner', 'oxide', 'ozone',

  // P
  'paced', 'pacer', 'paces', 'packs', 'pacts', 'paddy', 'padre', 'paean', 'pagan', 'paged',
  'pager', 'pages', 'pails', 'pains', 'paint', 'pairs', 'paled', 'paler', 'pales', 'palms',
  'palmy', 'palsy', 'panda', 'paned', 'panel', 'panes', 'pangs', 'panic', 'pansy', 'pants',
  'panty', 'papal', 'papas', 'papaw', 'paper', 'pappy', 'paras', 'parch', 'pared', 'parer',
  'pares', 'paris', 'parka', 'parks', 'parry', 'parse', 'parts', 'party', 'pases', 'passe',
  'pasta', 'paste', 'pasty', 'patch', 'pated', 'paten', 'pater', 'pates', 'paths', 'patio',
  'patsy', 'patty', 'pause', 'paved', 'paver', 'paves', 'pawed', 'pawns', 'payed', 'payee',
  'payer', 'peace', 'peach', 'peaks', 'peaky', 'peals', 'pearl', 'pears', 'pease', 'peats',
  'peaty', 'pecks', 'pedal', 'peeks', 'peels', 'peeps', 'peers', 'peeve', 'penal', 'pence',
  'pends', 'penis', 'penne', 'penny', 'peons', 'peony', 'peppy', 'perch', 'perks', 'perky',
  'perms', 'perry', 'pesky', 'pesos', 'pests', 'petal', 'peter', 'petit', 'petty', 'pewee',
  'phase', 'phial', 'phone', 'phony', 'photo', 'piano', 'picas', 'picks', 'picky', 'piece',
  'piers', 'pieta', 'piety', 'piggy', 'piked', 'piker', 'pikes', 'pilaf', 'piled', 'piles',
  'pills', 'pilot', 'pimps', 'pinch', 'pined', 'pines', 'piney', 'pings', 'pinko', 'pinks',
  'pinky', 'pinna', 'pinny', 'pinot', 'pints', 'pinup', 'pious', 'piped', 'piper', 'pipes',
  'pique', 'pitch', 'piths', 'pithy', 'piton', 'pitta', 'pivot', 'pixel', 'pixie', 'pizza',
  'place', 'plaid', 'plain', 'plait', 'plane', 'plank', 'plans', 'plant', 'plate', 'plats',
  'plaza', 'plead', 'pleas', 'pleat', 'plebe', 'plebs', 'plena', 'plied', 'plier', 'plies',
  'plink', 'plods', 'plonk', 'plops', 'plots', 'plows', 'ploys', 'pluck', 'plugs', 'plumb',
  'plume', 'plump', 'plums', 'plumy', 'plunk', 'plush', 'plyer', 'poach', 'pocks', 'pocky',
  'podgy', 'poems', 'poesy', 'poets', 'point', 'poise', 'poked', 'poker', 'pokes', 'pokey',
  'polar', 'poled', 'poler', 'poles', 'polka', 'polls', 'polyp', 'pomps', 'ponds', 'pones',
  'pooch', 'poofs', 'poofy', 'pools', 'poops', 'popes', 'poppa', 'poppy', 'porch', 'pored',
  'porer', 'pores', 'porks', 'porky', 'porno', 'porns', 'porny', 'ports', 'posed', 'poser',
  'poses', 'posit', 'posse', 'posts', 'potty', 'pouch', 'poufs', 'pound', 'pours', 'pouts',
  'pouty', 'power', 'prams', 'prank', 'prats', 'prawn', 'prays', 'preen', 'press', 'preys',
  'price', 'prick', 'pride', 'pried', 'prier', 'pries', 'prime', 'primo', 'primp', 'prims',
  'print', 'prion', 'prior', 'prism', 'privy', 'prize', 'probe', 'prods', 'proem', 'profs',
  'promo', 'proms', 'prone', 'prong', 'proof', 'props', 'prose', 'prosy', 'proud', 'prove',
  'prowl', 'prows', 'proxy', 'prude', 'prune', 'pryer', 'psalm', 'pubes', 'pubic', 'pubis',
  'pucks', 'pudgy', 'puffs', 'puffy', 'puked', 'puker', 'pukes', 'pulls', 'pulps', 'pulpy',
  'pulse', 'pumas', 'pumps', 'punch', 'punks', 'punky', 'punny', 'punts', 'pupae', 'pupal',
  'pupas', 'pupil', 'puppy', 'puree', 'purer', 'purge', 'purrs', 'purse', 'pussy', 'put',
  'putts', 'putty', 'pygmy', 'pylon',

  // Q
  'quack', 'quaff', 'quail', 'quake', 'qualm', 'quark', 'quart', 'quasi', 'queen', 'queer',
  'quell', 'query', 'quest', 'queue', 'quick', 'quids', 'quiet', 'quiff', 'quill', 'quilt',
  'quirk', 'quite', 'quits', 'quota', 'quote',

  // R
  'rabbi', 'rabid', 'raced', 'racer', 'races', 'racks', 'radar', 'radii', 'radio', 'radon',
  'rafts', 'raged', 'rager', 'rages', 'raids', 'rails', 'rains', 'rainy', 'raise', 'rajah',
  'raked', 'raker', 'rakes', 'rally', 'ramps', 'ranch', 'rands', 'randy', 'range', 'rangy',
  'ranks', 'rants', 'rapid', 'rarer', 'rasps', 'raspy', 'rated', 'rater', 'rates', 'ratio',
  'ratty', 'raved', 'ravel', 'raven', 'raver', 'raves', 'rawer', 'rawly', 'rayon', 'razed',
  'razer', 'razes', 'razor', 'reach', 'react', 'reads', 'ready', 'realm', 'reals', 'reams',
  'reaps', 'rears', 'rebel', 'rebid', 'rebus', 'rebut', 'recap', 'recur', 'recut', 'redid',
  'redly', 'redos', 'reeds', 'reedy', 'reefs', 'reefy', 'reeks', 'reeky', 'reels', 'refer',
  'refit', 'regal', 'rehab', 'reign', 'reins', 'relax', 'relay', 'relic', 'relit', 'remit',
  'remix', 'renal', 'rends', 'renew', 'rents', 'repay', 'repel', 'reply', 'repos', 'repro',
  'reran', 'rerun', 'reset', 'resin', 'rests', 'retch', 'retro', 'retry', 'reuse', 'revel',
  'revue', 'rhino', 'rhyme', 'riced', 'ricer', 'rices', 'rider', 'rides', 'ridge', 'ridgy',
  'rifle', 'rifts', 'right', 'rigid', 'rigor', 'riled', 'riles', 'rills', 'rinds', 'rings',
  'rinks', 'rinse', 'riots', 'ripen', 'riper', 'risen', 'riser', 'rises', 'risks', 'risky',
  'rites', 'ritzy', 'rival', 'riven', 'river', 'rivet', 'roach', 'roads', 'roams', 'roars',
  'roast', 'robed', 'robes', 'robin', 'robot', 'rocks', 'rocky', 'rodeo', 'roger', 'roles',
  'rolls', 'roman', 'romps', 'roods', 'roofs', 'rooks', 'rooky', 'rooms', 'roomy', 'roost',
  'roots', 'roped', 'roper', 'ropes', 'ropey', 'roses', 'rosin', 'rotas', 'rotor', 'rots',
  'rouge', 'rough', 'round', 'rouse', 'route', 'routs', 'rover', 'roves', 'rowdy', 'rowed',
  'rower', 'royal', 'rubes', 'rubin', 'ruble', 'ricks', 'ruddy', 'ruder', 'ruffs', 'rugby',
  'ruins', 'ruled', 'ruler', 'rules', 'rumba', 'rummy', 'rumor', 'rumps', 'runes', 'rungs',
  'runny', 'runts', 'runty', 'rupee', 'rural', 'rusts', 'rusty', 'ruths',

  // S
  'saber', 'sable', 'sabot', 'sacks', 'sadly', 'safer', 'safes', 'sagas', 'sager', 'sages',
  'saggy', 'sahib', 'sails', 'saint', 'sakes', 'salad', 'sales', 'sally', 'salon', 'salsa',
  'salts', 'salty', 'salve', 'salvo', 'samba', 'same', 'sands', 'sandy', 'saner', 'sappy',
  'saree', 'sarge', 'sassy', 'sated', 'sates', 'satin', 'satyr', 'sauce', 'saucy', 'sauna',
  'saute', 'saved', 'saver', 'saves', 'savoy', 'savvy', 'sawed', 'sawer', 'saxes', 'sayer',
  'scabs', 'scads', 'scald', 'scale', 'scalp', 'scaly', 'scamp', 'scams', 'scant', 'scape',
  'scare', 'scarf', 'scars', 'scary', 'scene', 'scent', 'schmo', 'schwa', 'scion', 'scoff',
  'scold', 'scone', 'scoop', 'scoot', 'scope', 'score', 'scorn', 'scots', 'scour', 'scout',
  'scowl', 'scows', 'scram', 'scrap', 'scree', 'screw', 'scrim', 'scrip', 'scrub', 'scrum',
  'scuba', 'scuds', 'scuff', 'sculp', 'seals', 'seams', 'seamy', 'sears', 'seats', 'sects',
  'sedan', 'sedge', 'sedgy', 'seeds', 'seedy', 'seeks', 'seems', 'seeps', 'seers', 'seize',
  'sells', 'semen', 'semis', 'sends', 'sense', 'sepia', 'sepoy', 'septa', 'serfs', 'serge',
  'serif', 'serum', 'serve', 'setup', 'seven', 'sever', 'sewed', 'sewer', 'sexed', 'sexes',
  'shack', 'shade', 'shads', 'shady', 'shaft', 'shags', 'shake', 'shako', 'shaky', 'shale',
  'shall', 'shame', 'shams', 'shank', 'shape', 'shard', 'share', 'shark', 'sharp', 'shave',
  'shawl', 'shawm', 'shays', 'sheaf', 'shear', 'sheds', 'sheen', 'sheep', 'sheer', 'sheet',
  'sheik', 'shelf', 'shell', 'shied', 'shier', 'shies', 'shift', 'shill', 'shims', 'shine',
  'shins', 'shiny', 'ships', 'shire', 'shirk', 'shirr', 'shirt', 'shish', 'shiva', 'shoal',
  'shock', 'shoed', 'shoer', 'shoes', 'shone', 'shook', 'shoos', 'shoot', 'shops', 'shore',
  'shorn', 'short', 'shots', 'shout', 'shove', 'shown', 'shows', 'showy', 'shred', 'shrew',
  'shrub', 'shrug', 'shtik', 'shuck', 'shuns', 'shunt', 'shush', 'shuts', 'shyer', 'shyly',
  'sibyl', 'sided', 'sider', 'sides', 'siege', 'sieve', 'sifts', 'sighs', 'sight', 'sigma',
  'signs', 'silks', 'silky', 'sills', 'silly', 'silts', 'silty', 'since', 'sinew', 'singe',
  'sings', 'sinks', 'sinus', 'siren', 'sires', 'sissy', 'sites', 'situp', 'sixes', 'sixth',
  'sixty', 'sized', 'sizer', 'sizes', 'skate', 'skeet', 'skein', 'skids', 'skied', 'skier',
  'skies', 'skiff', 'skill', 'skimp', 'skims', 'skins', 'skint', 'skips', 'skirt', 'skits',
  'skulk', 'skull', 'skunk', 'slabs', 'slack', 'slain', 'slake', 'slams', 'slang', 'slant',
  'slaps', 'slash', 'slate', 'slats', 'slaty', 'slave', 'slays', 'sleds', 'sleek', 'sleep',
  'sleet', 'slept', 'slice', 'slick', 'slide', 'slier', 'slime', 'slimy', 'sling', 'slink',
  'slips', 'slits', 'slobs', 'slogs', 'slope', 'slops', 'slosh', 'sloth', 'slots', 'slows',
  'slubs', 'slued', 'slues', 'slugs', 'slums', 'slung', 'slunk', 'slurp', 'slurs', 'slush',
  'slyly', 'smack', 'small', 'smart', 'smash', 'smear', 'smell', 'smelt', 'smile', 'smirk',
  'smite', 'smith', 'smock', 'smogs', 'smoke', 'smoky', 'smote', 'snack', 'snafu', 'snags',
  'snail', 'snake', 'snaky', 'snaps', 'snare', 'snarl', 'sneak', 'sneer', 'snide', 'sniff',
  'snipe', 'snips', 'snits', 'snobs', 'snoop', 'snore', 'snort', 'snots', 'snout', 'snows',
  'snowy', 'snubs', 'snuck', 'snuff', 'snugs', 'soaks', 'soaps', 'soapy', 'soars', 'sober',
  'socks', 'sodas', 'sofas', 'softy', 'soggy', 'soils', 'solar', 'soled', 'soles', 'solid',
  'solos', 'solve', 'sonar', 'songs', 'sonic', 'sonny', 'sooth', 'soots', 'sooty', 'soppy',
  'sorer', 'sores', 'sorry', 'sorts', 'sough', 'souls', 'sound', 'soups', 'soupy', 'sours',
  'south', 'sowed', 'sower', 'space', 'spacy', 'spade', 'spank', 'spans', 'spare', 'spark',
  'spars', 'spasm', 'spate', 'spats', 'spawn', 'speak', 'spear', 'speck', 'specs', 'speed',
  'spell', 'spend', 'spent', 'sperm', 'spice', 'spicy', 'spied', 'spiel', 'spies', 'spiff',
  'spike', 'spiky', 'spill', 'spilt', 'spine', 'spins', 'spiny', 'spire', 'spite', 'spits',
  'splat', 'splay', 'split', 'spoil', 'spoke', 'spoof', 'spook', 'spool', 'spoon', 'spoor',
  'spore', 'sport', 'spots', 'spout', 'spray', 'spree', 'sprig', 'sprit', 'sprog', 'sprue',
  'sprung', 'spuds', 'spume', 'spumy', 'spunk', 'spurn', 'spurs', 'spurt', 'squad', 'squat',
  'squaw', 'squib', 'squid', 'stab', 'stack', 'staff', 'stage', 'stags', 'staid', 'stain',
  'stair', 'stake', 'stale', 'stalk', 'stall', 'stamp', 'stand', 'stank', 'staph', 'stare',
  'stark', 'stars', 'start', 'stash', 'state', 'stats', 'stave', 'stays', 'stead', 'steak',
  'steal', 'steam', 'steed', 'steel', 'steep', 'steer', 'stems', 'steno', 'steps', 'stern',
  'stets', 'stews', 'stick', 'stiff', 'still', 'stilt', 'sting', 'stink', 'stint', 'stock',
  'stoic', 'stoke', 'stole', 'stomp', 'stone', 'stony', 'stood', 'stool', 'stoop', 'stops',
  'store', 'stork', 'storm', 'story', 'stout', 'stove', 'strap', 'straw', 'stray', 'strep',
  'strew', 'strip', 'strut', 'stubs', 'stuck', 'studs', 'study', 'stuff', 'stump', 'stung',
  'stunk', 'stuns', 'stunt', 'style', 'suave', 'sucks', 'sucky', 'sugar', 'suite', 'suits',
  'sulks', 'sulky', 'sully', 'sumac', 'sumps', 'sunny', 'sunup', 'super', 'surer', 'surfs',
  'surfy', 'surge', 'surly', 'sushi', 'swabs', 'swain', 'swamp', 'swami', 'swamp', 'swank',
  'swans', 'swaps', 'swarm', 'swart', 'swash', 'swath', 'swats', 'sways', 'swear', 'sweat',
  'swede', 'sweep', 'sweet', 'swell', 'swept', 'swift', 'swigs', 'swill', 'swims', 'swine',
  'swing', 'swipe', 'swirl', 'swish', 'swiss', 'sword', 'swore', 'sworn', 'swung', 'sylph',
  'syncs', 'synod', 'syrup',

  // T
  'tabby', 'table', 'taboo', 'tabor', 'tacit', 'tacks', 'tacky', 'tacos', 'tacts', 'taffy',
  'tails', 'taint', 'taken', 'taker', 'takes', 'tales', 'talks', 'talky', 'tally', 'talon',
  'tamed', 'tamer', 'tames', 'tamps', 'tangs', 'tangy', 'tanks', 'tansy', 'taped', 'taper',
  'tapes', 'tapir', 'tardy', 'tared', 'tares', 'tarns', 'tarot', 'tarps', 'tarry', 'tarts',
  'tarty', 'tasks', 'taste', 'tasty', 'tatty', 'taunt', 'tawny', 'taxed', 'taxer', 'taxes',
  'taxis', 'teach', 'teaks', 'teals', 'teams', 'tears', 'teary', 'tease', 'teats', 'techs',
  'techy', 'teddy', 'teems', 'teens', 'teeny', 'teeth', 'tells', 'telly', 'tempo', 'temps',
  'tempt', 'tends', 'tenet', 'tenor', 'tense', 'tenth', 'tents', 'tepee', 'tepid', 'terms',
  'terns', 'terra', 'terry', 'terse', 'tests', 'testy', 'texas', 'texts', 'thank', 'thaws',
  'theft', 'their', 'theme', 'thence', 'there', 'these', 'thick', 'thief', 'thigh', 'thing',
  'think', 'thins', 'third', 'thorn', 'those', 'three', 'threw', 'throb', 'throw', 'thuds',
  'thugs', 'thumb', 'thump', 'thyme', 'tiara', 'tibia', 'ticks', 'tidal', 'tided', 'tides',
  'tiers', 'tiger', 'tight', 'tikes', 'tilde', 'tiled', 'tiler', 'tiles', 'tilts', 'timed',
  'timer', 'times', 'timid', 'tinny', 'tints', 'tippy', 'tipsy', 'tired', 'tires', 'titan',
  'title', 'titty', 'toads', 'toady', 'toast', 'today', 'toddy', 'toffs', 'toffy', 'togas',
  'toile', 'toils', 'token', 'toked', 'toker', 'tokes', 'tolls', 'tombs', 'tonal', 'toned',
  'toner', 'tones', 'tongs', 'tonic', 'tools', 'tooth', 'toots', 'topaz', 'topic', 'torch',
  'toric', 'torso', 'torte', 'torts', 'torus', 'total', 'totem', 'touch', 'tough', 'tours',
  'touts', 'towed', 'towel', 'tower', 'towns', 'toxic', 'toxin', 'trace', 'track', 'tract',
  'trade', 'trail', 'train', 'trait', 'tramp', 'trams', 'traps', 'trash', 'trawl', 'trays',
  'tread', 'treat', 'treed', 'trees', 'treks', 'trend', 'tress', 'triad', 'trial', 'tribe',
  'trick', 'tried', 'trier', 'tries', 'trike', 'trill', 'trims', 'trios', 'tripe', 'trips',
  'trite', 'troll', 'tromp', 'troop', 'trope', 'trots', 'trout', 'trove', 'trows', 'truce',
  'truck', 'trudge', 'trued', 'truer', 'trues', 'truly', 'trump', 'trunk', 'truss', 'trust',
  'truth', 'tryst', 'tubas', 'tubby', 'tubed', 'tuber', 'tubes', 'tucks', 'tufts', 'tufty',
  'tulip', 'tulle', 'tumid', 'tummy', 'tumor', 'tunas', 'tuned', 'tuner', 'tunes', 'tunic',
  'turds', 'turfs', 'turfy', 'turns', 'tusks', 'tutor', 'tutti', 'tutus', 'tuxes', 'twain',
  'twang', 'tweak', 'tweed', 'tweet', 'twerp', 'twice', 'twigs', 'twill', 'twine', 'twins',
  'twirl', 'twist', 'twits', 'tying', 'tykes', 'typed', 'types', 'typos', 'tyrant',

  // U
  'udder', 'ulcer', 'ultra', 'umbra', 'umped', 'umps', 'unapt', 'unarm', 'unbar', 'uncle',
  'uncut', 'under', 'undid', 'undue', 'unfed', 'unfit', 'unhip', 'unify', 'union', 'unite',
  'units', 'unity', 'unlit', 'unman', 'unmet', 'unpeg', 'unpin', 'unrig', 'unset', 'untie',
  'until', 'unwed', 'unwet', 'unzip', 'updos', 'upped', 'upper', 'upset', 'urban', 'urged',
  'urger', 'urges', 'urine', 'usage', 'users', 'usher', 'using', 'usual', 'usurp', 'uteri',
  'utter',

  // V
  'vague', 'vails', 'vales', 'valet', 'valid', 'valor', 'value', 'valve', 'vamps', 'vampy',
  'vanes', 'vanity', 'vapor', 'vases', 'vasts', 'vault', 'vaunt', 'veals', 'veers', 'vegan',
  'veils', 'veins', 'veiny', 'veldt', 'venal', 'vends', 'venom', 'vents', 'venue', 'verbs',
  'verge', 'verse', 'verso', 'vests', 'vetch', 'vexed', 'vexes', 'vials', 'vibes', 'vicar',
  'video', 'viers', 'views', 'vigor', 'viler', 'villa', 'vinca', 'vined', 'vines', 'viols',
  'viper', 'viral', 'vireo', 'vires', 'virus', 'visas', 'vised', 'vises', 'visit', 'visor',
  'vista', 'vital', 'vivid', 'vixen', 'vizor', 'vocab', 'vocal', 'vodka', 'vogue', 'voice',
  'voids', 'voila', 'voile', 'voles', 'volts', 'vomit', 'voted', 'voter', 'votes', 'vouch',
  'vowed', 'vowel', 'vying',

  // W
  'wacko', 'wacky', 'wadded', 'waded', 'wader', 'wades', 'wadis', 'wafer', 'wafts', 'waged',
  'wager', 'wages', 'wagon', 'waifs', 'wails', 'waist', 'waits', 'waive', 'waked', 'waken',
  'waker', 'wakes', 'walks', 'walls', 'waltz', 'wands', 'waned', 'wanes', 'wants', 'wards',
  'wares', 'warms', 'warns', 'warps', 'warts', 'warty', 'washy', 'wasps', 'waspy', 'waste',
  'watch', 'water', 'watts', 'waved', 'waver', 'waves', 'wavy', 'waxed', 'waxen', 'waxer',
  'waxes', 'weald', 'weals', 'weans', 'wears', 'weary', 'weave', 'webby', 'weber', 'wedge',
  'wedgy', 'weeds', 'weedy', 'weeks', 'weeny', 'weeps', 'weepy', 'weigh', 'weird', 'weirs',
  'welch', 'welds', 'wells', 'welsh', 'welts', 'wench', 'wends', 'wests', 'wetly', 'whack',
  'whale', 'whamo', 'whams', 'wharf', 'wheat', 'wheel', 'whelk', 'whelm', 'whelp', 'where',
  'which', 'whiff', 'while', 'whims', 'whine', 'whiny', 'whips', 'whirl', 'whirr', 'whirs',
  'whisk', 'white', 'whits', 'whizz', 'whole', 'whoop', 'whore', 'whose', 'wicks', 'widen',
  'wider', 'wides', 'widow', 'width', 'wield', 'wifed', 'wifes', 'wifey', 'wifty', 'wight',
  'wilds', 'wiled', 'wiles', 'wills', 'willy', 'wilts', 'wimps', 'wimpy', 'wince', 'winch',
  'winds', 'windy', 'wined', 'wines', 'winey', 'wings', 'winks', 'winos', 'wiped', 'wiper',
  'wipes', 'wired', 'wirer', 'wires', 'wised', 'wiser', 'wises', 'wisps', 'wispy', 'witch',
  'withe', 'withy', 'witty', 'wived', 'wives', 'wizen', 'woe', 'woken', 'wolds', 'wolfs',
  'woman', 'wombs', 'women', 'wonks', 'wonky', 'wonts', 'woods', 'woody', 'wooed', 'wooer',
  'woofs', 'wools', 'wooly', 'woops', 'woozy', 'words', 'wordy', 'works', 'world', 'worms',
  'wormy', 'worry', 'worse', 'worst', 'worth', 'would', 'wound', 'woven', 'wowed', 'wowser',
  'wrack', 'wraith', 'wrang', 'wraps', 'wrath', 'wreak', 'wreck', 'wrest', 'wrier', 'wring',
  'wrist', 'write', 'writs', 'wrong', 'wrote', 'wrung', 'wurst', 'wushu', 'wussy',

  // X
  'xenon', 'xerox', 'xrays',

  // Y
  'yacht', 'yahoo', 'yanks', 'yards', 'yarns', 'yawls', 'yawns', 'yeahs', 'yearn', 'years',
  'yeast', 'yells', 'yelps', 'yield', 'yikes', 'yobbo', 'yodel', 'yogic', 'yogis', 'yoked',
  'yokel', 'yokes', 'yolks', 'yolky', 'young', 'yourn', 'yours', 'youth', 'yowls', 'yoyos',
  'yucca', 'yucks', 'yucky', 'yukky', 'yummy', 'yuppy',

  // Z
  'zappy', 'zazen', 'zebra', 'zebus', 'zelot', 'zeros', 'zests', 'zesty', 'zilch', 'zincs',
  'zincy', 'zingy', 'zippy', 'zitis', 'zloty', 'zombi', 'zonal', 'zoned', 'zoner', 'zones',
  'zonks', 'zooms', 'zowie'
];

// Combine word list and common words for valid guesses
const VALID_GUESSES = new Set([
  ...WORD_LIST,
  ...COMMON_WORDS
].map(w => w.toLowerCase()).filter(w => w.length === 5));

// Game State
let currentWord = '';
let currentRow = 0;
let currentTile = 0;
let currentGuess = '';
let gameOver = false;
let guessHistory = [];
let todayDateString = ''; // Track today's date for daily word

// Stats
let stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0
};

// Get current date in CST (Central Standard Time) as YYYY-MM-DD
function getCSTDateString() {
  const now = new Date();
  // CST is UTC-6, CDT is UTC-5. Use America/Chicago for automatic DST handling
  const cstString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const cstDate = new Date(cstString);
  const year = cstDate.getFullYear();
  const month = String(cstDate.getMonth() + 1).padStart(2, '0');
  const day = String(cstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get milliseconds until midnight CST
function getMsUntilMidnightCST() {
  const now = new Date();
  const cstString = now.toLocaleString('en-US', { timeZone: 'America/Chicago' });
  const cstNow = new Date(cstString);

  const midnight = new Date(cstNow);
  midnight.setDate(midnight.getDate() + 1);
  midnight.setHours(0, 0, 0, 0);

  return midnight.getTime() - cstNow.getTime();
}

// Simple hash function for deterministic word selection
function hashDateString(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Get the daily word based on current CST date
function getDailyWord() {
  const dateStr = getCSTDateString();
  const hash = hashDateString(dateStr);
  const index = hash % WORD_LIST.length;
  return WORD_LIST[index].toUpperCase();
}

// Check if user has already played today
function hasPlayedToday() {
  const lastPlayed = localStorage.getItem('grottle-last-played');
  const today = getCSTDateString();
  return lastPlayed === today;
}

// Mark today as played
function markTodayAsPlayed() {
  localStorage.setItem('grottle-last-played', getCSTDateString());
}

// Get saved game state for today
function getSavedGameState() {
  const saved = localStorage.getItem('grottle-game-state');
  if (!saved) return null;

  const state = JSON.parse(saved);
  if (state.date !== getCSTDateString()) {
    // Old game state, clear it
    localStorage.removeItem('grottle-game-state');
    return null;
  }
  return state;
}

// Save current game state
function saveGameState() {
  const state = {
    date: getCSTDateString(),
    currentRow,
    guessHistory,
    gameOver
  };
  localStorage.setItem('grottle-game-state', JSON.stringify(state));
}

// DOM Elements
const gameBoard = document.getElementById('game-board');
const keyboard = document.getElementById('keyboard');
const messageEl = document.getElementById('message');
const modal = document.getElementById('game-over-modal');

// Initialize game
function init() {
  loadStats();
  todayDateString = getCSTDateString();
  currentWord = getDailyWord();

  // Check for saved game state from today
  const savedState = getSavedGameState();
  if (savedState) {
    // Restore saved game
    restoreGameState(savedState);
  } else {
    // Start fresh daily game
    newGame();
  }

  setupEventListeners();
  initVisualEffects();
  startMidnightCountdown();
}

// Restore game state from saved data
function restoreGameState(state) {
  currentRow = state.currentRow;
  guessHistory = state.guessHistory;
  gameOver = state.gameOver;
  currentTile = 0;
  currentGuess = '';

  // Clear and restore board
  document.querySelectorAll('.tile').forEach(tile => {
    tile.textContent = '';
    tile.className = 'tile';
  });

  // Replay all guesses visually (without animation)
  guessHistory.forEach((result, rowIndex) => {
    const row = document.querySelector(`.board-row[data-row="${rowIndex}"]`);
    const tiles = row.querySelectorAll('.tile');
    const guessWord = getGuessFromResult(rowIndex);

    tiles.forEach((tile, colIndex) => {
      tile.textContent = guessWord[colIndex];
      tile.classList.add('filled', 'reveal', result[colIndex]);
      updateKeyboard(guessWord[colIndex], result[colIndex]);
    });
  });

  // If game is over, show modal after a short delay
  if (gameOver) {
    const won = guessHistory.length > 0 &&
      guessHistory[guessHistory.length - 1].every(s => s === 'correct');
    setTimeout(() => showGameOver(won), 500);
  }
}

// Get the guessed word for a row (reconstruct from localStorage)
function getGuessFromResult(rowIndex) {
  const savedGuesses = localStorage.getItem('grottle-guesses');
  if (savedGuesses) {
    const guesses = JSON.parse(savedGuesses);
    if (guesses.date === getCSTDateString() && guesses.words[rowIndex]) {
      return guesses.words[rowIndex];
    }
  }
  return '     '; // Fallback
}

// Save guess words for restoration
function saveGuess(guess) {
  let savedGuesses = localStorage.getItem('grottle-guesses');
  let guesses = savedGuesses ? JSON.parse(savedGuesses) : { date: getCSTDateString(), words: [] };

  if (guesses.date !== getCSTDateString()) {
    guesses = { date: getCSTDateString(), words: [] };
  }

  guesses.words.push(guess);
  localStorage.setItem('grottle-guesses', JSON.stringify(guesses));
}

// Start countdown to midnight CST for new word
function startMidnightCountdown() {
  const msUntilMidnight = getMsUntilMidnightCST();

  // Refresh page at midnight to get new word
  setTimeout(() => {
    localStorage.removeItem('grottle-game-state');
    localStorage.removeItem('grottle-guesses');
    location.reload();
  }, msUntilMidnight + 1000); // Add 1 second buffer
}

function loadStats() {
  const saved = localStorage.getItem('grottle-stats');
  if (saved) {
    stats = JSON.parse(saved);
  }
  updateStatsDisplay();
}

function saveStats() {
  localStorage.setItem('grottle-stats', JSON.stringify(stats));
}

function updateStatsDisplay() {
  document.getElementById('games-played').textContent = stats.gamesPlayed;
  document.getElementById('win-percent').textContent =
    stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  document.getElementById('current-streak').textContent = stats.currentStreak;
  document.getElementById('max-streak').textContent = stats.maxStreak;
}

function newGame() {
  // Use daily word (same for everyone)
  currentWord = getDailyWord();
  todayDateString = getCSTDateString();

  // Reset state
  currentRow = 0;
  currentTile = 0;
  currentGuess = '';
  gameOver = false;
  guessHistory = [];

  // Clear saved guesses for today
  localStorage.setItem('grottle-guesses', JSON.stringify({ date: todayDateString, words: [] }));

  // Clear board
  document.querySelectorAll('.tile').forEach(tile => {
    tile.textContent = '';
    tile.className = 'tile';
  });

  // Reset keyboard
  document.querySelectorAll('.key').forEach(key => {
    key.classList.remove('correct', 'present', 'absent');
  });

  // Hide modal
  modal.classList.add('hidden');

  // Remove glitch effects
  gameBoard.classList.remove('win-glitch', 'lose-glitch');

  // Save initial game state
  saveGameState();
}

function setupEventListeners() {
  // Keyboard clicks
  keyboard.addEventListener('click', (e) => {
    if (e.target.classList.contains('key')) {
      handleKeyPress(e.target.dataset.key);
    }
  });

  // Physical keyboard
  document.addEventListener('keydown', (e) => {
    if (gameOver) return;

    if (e.key === 'Enter') {
      handleKeyPress('ENTER');
    } else if (e.key === 'Backspace') {
      handleKeyPress('BACKSPACE');
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      handleKeyPress(e.key.toUpperCase());
    }
  });

  // Modal buttons
  document.getElementById('btn-share').addEventListener('click', shareResults);
  document.getElementById('btn-play-again').addEventListener('click', () => {
    // In daily mode, don't allow playing again until tomorrow
    if (gameOver) return;
    newGame();
  });
}

function handleKeyPress(key) {
  if (gameOver) return;

  if (key === 'ENTER') {
    submitGuess();
  } else if (key === 'BACKSPACE') {
    deleteLetter();
  } else if (currentTile < 5) {
    addLetter(key);
  }
}

function addLetter(letter) {
  if (currentTile >= 5) return;

  const row = document.querySelector(`.board-row[data-row="${currentRow}"]`);
  const tile = row.querySelector(`.tile[data-col="${currentTile}"]`);

  tile.textContent = letter;
  tile.classList.add('filled');

  currentGuess += letter;
  currentTile++;
}

function deleteLetter() {
  if (currentTile <= 0) return;

  currentTile--;
  currentGuess = currentGuess.slice(0, -1);

  const row = document.querySelector(`.board-row[data-row="${currentRow}"]`);
  const tile = row.querySelector(`.tile[data-col="${currentTile}"]`);

  tile.textContent = '';
  tile.classList.remove('filled');
}

function submitGuess() {
  if (currentGuess.length !== 5) {
    showMessage('Not enough letters');
    shakeRow();
    return;
  }

  if (!VALID_GUESSES.has(currentGuess.toLowerCase())) {
    showMessage('Not in word list');
    shakeRow();
    return;
  }

  // Save the guess word for state restoration
  saveGuess(currentGuess);

  // Evaluate guess
  const result = evaluateGuess(currentGuess);
  guessHistory.push(result);

  // Animate tiles
  revealTiles(result);

  // Check win/lose
  if (currentGuess === currentWord) {
    setTimeout(() => {
      gameOver = true;
      stats.gamesPlayed++;
      stats.gamesWon++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.maxStreak) {
        stats.maxStreak = stats.currentStreak;
      }
      saveStats();
      saveGameState();
      updateStatsDisplay();
      gameBoard.classList.add('win-glitch');
      setTimeout(() => showGameOver(true), 800);
    }, 1500);
  } else if (currentRow === 5) {
    setTimeout(() => {
      gameOver = true;
      stats.gamesPlayed++;
      stats.currentStreak = 0;
      saveStats();
      saveGameState();
      updateStatsDisplay();
      gameBoard.classList.add('lose-glitch');
      setTimeout(() => showGameOver(false), 1000);
    }, 1500);
  } else {
    // Move to next row
    currentRow++;
    currentTile = 0;
    currentGuess = '';
    saveGameState();
  }
}

function evaluateGuess(guess) {
  const result = [];
  const wordArray = currentWord.split('');
  const guessArray = guess.split('');
  const letterCount = {};

  // Count letters in word
  wordArray.forEach(letter => {
    letterCount[letter] = (letterCount[letter] || 0) + 1;
  });

  // First pass: mark correct
  guessArray.forEach((letter, i) => {
    if (letter === wordArray[i]) {
      result[i] = 'correct';
      letterCount[letter]--;
    }
  });

  // Second pass: mark present or absent
  guessArray.forEach((letter, i) => {
    if (result[i]) return;

    if (letterCount[letter] > 0) {
      result[i] = 'present';
      letterCount[letter]--;
    } else {
      result[i] = 'absent';
    }
  });

  return result;
}

function revealTiles(result) {
  const row = document.querySelector(`.board-row[data-row="${currentRow}"]`);
  const tiles = row.querySelectorAll('.tile');
  // Capture the guess now before it gets cleared
  const guess = currentGuess;

  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('reveal');

      setTimeout(() => {
        tile.classList.add(result[i]);
        updateKeyboard(guess[i], result[i]);
      }, 250);
    }, i * 300);
  });
}

function updateKeyboard(letter, status) {
  // Convert to uppercase to match keyboard data-key attributes
  const key = document.querySelector(`.key[data-key="${letter.toUpperCase()}"]`);
  if (!key) return;

  // Only upgrade status (absent -> present -> correct)
  if (status === 'correct') {
    key.classList.remove('present', 'absent');
    key.classList.add('correct');
  } else if (status === 'present' && !key.classList.contains('correct')) {
    key.classList.remove('absent');
    key.classList.add('present');
  } else if (status === 'absent' && !key.classList.contains('correct') && !key.classList.contains('present')) {
    key.classList.add('absent');
  }
}

function showMessage(text) {
  messageEl.textContent = text;
  messageEl.classList.remove('hidden');

  setTimeout(() => {
    messageEl.classList.add('hidden');
  }, 1500);
}

function shakeRow() {
  const row = document.querySelector(`.board-row[data-row="${currentRow}"]`);
  row.classList.add('shake');
  setTimeout(() => row.classList.remove('shake'), 500);
}

function showGameOver(won) {
  const title = document.getElementById('game-over-title');
  const wordEl = document.getElementById('game-over-word');
  const attemptsEl = document.getElementById('modal-attempts');
  const preview = document.getElementById('share-preview');
  const playAgainBtn = document.getElementById('btn-play-again');

  title.textContent = won ? 'VICTORY' : 'DEFEATED';
  title.className = 'modal-title ' + (won ? 'win' : 'lose');

  wordEl.textContent = currentWord;
  attemptsEl.textContent = won ? currentRow + 1 : 'X';

  // Generate share preview
  preview.innerHTML = generateShareGrid();

  // Update play again button for daily mode
  playAgainBtn.innerHTML = '<span>NEXT WORD IN</span>';
  playAgainBtn.disabled = true;
  playAgainBtn.style.opacity = '0.7';

  // Start countdown timer
  updateNextWordCountdown(playAgainBtn);

  modal.classList.remove('hidden');
}

// Format time remaining as HH:MM:SS
function formatCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Update countdown timer on play again button
function updateNextWordCountdown(btn) {
  const updateTimer = () => {
    const msRemaining = getMsUntilMidnightCST();
    btn.innerHTML = `<span>NEXT: ${formatCountdown(msRemaining)}</span>`;

    if (msRemaining > 1000) {
      setTimeout(updateTimer, 1000);
    } else {
      // Time's up, reload for new word
      location.reload();
    }
  };

  updateTimer();
}

function generateShareGrid() {
  const emojis = {
    correct: '🟥',  // Red for correct
    present: '🟨',  // Yellow for present
    absent: '⬛'    // Black for absent
  };

  let grid = '';
  guessHistory.forEach(row => {
    grid += row.map(status => emojis[status]).join('') + '<br>';
  });

  return grid;
}

function shareResults() {
  const emojis = {
    correct: '🟥',
    present: '🟨',
    absent: '⬛'
  };

  let text = `GROTTLE ${guessHistory.length}/6\n\n`;

  guessHistory.forEach(row => {
    text += row.map(status => emojis[status]).join('') + '\n';
  });

  text += '\nhttps://ggrotto.xyz/grottle';

  // Copy to clipboard
  navigator.clipboard.writeText(text).then(() => {
    const copied = document.getElementById('copied-message');
    copied.classList.remove('hidden');
    setTimeout(() => copied.classList.add('hidden'), 2000);
  }).catch(() => {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    const copied = document.getElementById('copied-message');
    copied.classList.remove('hidden');
    setTimeout(() => copied.classList.add('hidden'), 2000);
  });
}

// Visual Effects
function initVisualEffects() {
  // Custom cursor
  const cursor = document.getElementById('cursor');
  let mouseX = 0, mouseY = 0;
  let cursorX = 0, cursorY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.15;
    cursorY += (mouseY - cursorY) * 0.15;
    if (cursor) {
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';
    }
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  // Background particles
  const particlesContainer = document.getElementById('particles');
  function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.animationDuration = (Math.random() * 2 + 2) + 's';
    particle.style.animationDelay = Math.random() * 2 + 's';
    particlesContainer.appendChild(particle);
    setTimeout(() => particle.remove(), 5000);
  }
  setInterval(createParticle, 300);

  // Random screen flicker
  function screenFlicker() {
    if (Math.random() > 0.98) {
      document.body.style.opacity = '0.9';
      setTimeout(() => document.body.style.opacity = '1', 50);
    }
    setTimeout(screenFlicker, 100);
  }
  screenFlicker();
}

// Start game when DOM loaded
document.addEventListener('DOMContentLoaded', init);
