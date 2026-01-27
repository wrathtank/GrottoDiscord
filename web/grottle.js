// GROTTLE - The Grotto Word Game
// A cyberpunk/horror themed Wordle clone

// Cyberpunk/Horror themed 5-letter words
const WORD_LIST = [
  // Horror
  'blood', 'death', 'demon', 'ghost', 'grave', 'haunt', 'curse', 'corpse',
  'crypt', 'decay', 'dread', 'fiend', 'flesh', 'gloom', 'ghoul', 'grime',
  'groan', 'hex', 'howl', 'leech', 'lurks', 'moans', 'night', 'ooze',
  'panic', 'phantasm', 'plague', 'prowl', 'reeks', 'retch', 'rot', 'scary',
  'seance', 'shade', 'skull', 'slash', 'slime', 'spell', 'spine', 'spook',
  'stalk', 'swamp', 'taint', 'talon', 'teeth', 'tomb', 'toxin', 'undead',
  'venom', 'viper', 'wails', 'witch', 'wraith', 'zombie', 'abyss', 'agony',
  'beast', 'black', 'bleed', 'blight', 'bones', 'brood', 'chaos', 'choke',
  'claws', 'crawl', 'creep', 'cries', 'cruel', 'crush', 'crypts', 'damns',
  'devil', 'dirge', 'dread', 'drool', 'dungeon', 'eerie', 'evil', 'fangs',
  'fatal', 'feast', 'feral', 'fetid', 'filth', 'freak', 'frost', 'fungi',
  'gaunt', 'gloomy', 'gnash', 'gored', 'gory', 'greed', 'grisly', 'grimy',

  // Cyberpunk
  'cyber', 'neons', 'glitch', 'proxy', 'rogue', 'synth', 'vapor', 'virus',
  'pixel', 'coder', 'drone', 'laser', 'nodes', 'ports', 'scans', 'stack',
  'techs', 'wired', 'bytes', 'chips', 'clone', 'coded', 'corps', 'crash',
  'crypt', 'datum', 'debug', 'decks', 'droid', 'elites', 'fiber', 'forge',
  'fugue', 'gamma', 'grids', 'hacks', 'heist', 'input', 'jacks', 'layer',
  'links', 'logic', 'loops', 'mains', 'mechs', 'media', 'merge', 'metal',
  'micro', 'minds', 'modem', 'morph', 'nerve', 'nexus', 'nodes', 'noise',
  'omega', 'optic', 'orbit', 'oxide', 'phase', 'pipes', 'power', 'prime',
  'probe', 'pulse', 'radar', 'raids', 'realm', 'reboot', 'relay', 'relic',
  'rogue', 'route', 'scale', 'scrap', 'servo', 'shell', 'shift', 'sigma',
  'siren', 'skull', 'slate', 'slots', 'smart', 'smoke', 'solar', 'solid',
  'sonic', 'spark', 'specs', 'speed', 'spike', 'spine', 'split', 'squad',
  'stage', 'stark', 'state', 'steam', 'steel', 'stock', 'storm', 'surge',
  'swarm', 'syncs', 'tapes', 'tasks', 'tower', 'trace', 'track', 'trade',
  'trans', 'trash', 'trial', 'tribe', 'ultra', 'units', 'urban', 'vault',
  'vegas', 'vents', 'verge', 'views', 'viral', 'visor', 'vista', 'vital',
  'volts', 'watts', 'waves', 'welds', 'wires', 'zeros', 'zones',

  // Grotto/Game themed
  'grotto', 'token', 'guild', 'quest', 'realm', 'blade', 'craft', 'forge',
  'armor', 'chain', 'shard', 'runes', 'souls', 'chaos', 'flame', 'frost',
  'storm', 'spark', 'shade', 'light', 'lunar', 'solar', 'astral', 'raven',
  'viper', 'drake', 'wyrm', 'titan', 'giant', 'dwarf', 'elfin', 'orcish',
  'troll', 'golem', 'wraith', 'liche', 'spawn', 'horde', 'siege', 'raids'
].filter(w => w.length === 5); // Ensure only 5-letter words

// Valid guesses - includes word list plus common 5-letter words
const VALID_GUESSES = new Set([
  ...WORD_LIST,
  // Common 5-letter words for valid guesses
  'about', 'above', 'abuse', 'actor', 'acute', 'admit', 'adopt', 'adult',
  'after', 'again', 'agent', 'agree', 'ahead', 'alarm', 'album', 'alert',
  'alien', 'align', 'alike', 'alive', 'allow', 'alone', 'along', 'alter',
  'among', 'angel', 'anger', 'angle', 'angry', 'apart', 'apple', 'apply',
  'arena', 'argue', 'arise', 'array', 'aside', 'asset', 'avoid', 'award',
  'aware', 'badly', 'baker', 'bases', 'basic', 'basis', 'beach', 'began',
  'begin', 'begun', 'being', 'below', 'bench', 'billy', 'birth', 'black',
  'blame', 'blank', 'blast', 'blind', 'block', 'blood', 'board', 'boost',
  'booth', 'bound', 'brain', 'brand', 'bread', 'break', 'breed', 'brief',
  'bring', 'broad', 'broke', 'brown', 'build', 'built', 'buyer', 'cable',
  'calif', 'carry', 'catch', 'cause', 'chain', 'chair', 'chart', 'chase',
  'cheap', 'check', 'chest', 'chief', 'child', 'china', 'chose', 'civil',
  'claim', 'class', 'clean', 'clear', 'climb', 'clock', 'close', 'coach',
  'coast', 'could', 'count', 'court', 'cover', 'craft', 'crash', 'cream',
  'crime', 'cross', 'crowd', 'crown', 'curve', 'cycle', 'daily', 'dance',
  'dated', 'dealt', 'death', 'debut', 'delay', 'depth', 'doing', 'doubt',
  'dozen', 'draft', 'drama', 'drank', 'drawn', 'dream', 'dress', 'drink',
  'drive', 'drove', 'dying', 'early', 'earth', 'eight', 'elite', 'empty',
  'enemy', 'enjoy', 'enter', 'entry', 'equal', 'error', 'event', 'every',
  'exact', 'exist', 'extra', 'faith', 'false', 'fault', 'favor', 'feast',
  'field', 'fifth', 'fifty', 'fight', 'final', 'first', 'fixed', 'flash',
  'fleet', 'floor', 'fluid', 'focus', 'force', 'forth', 'found', 'frame',
  'frank', 'fraud', 'fresh', 'front', 'fruit', 'fully', 'funny', 'giant',
  'given', 'glass', 'globe', 'going', 'grace', 'grade', 'grand', 'grant',
  'grass', 'great', 'green', 'gross', 'group', 'grown', 'guard', 'guess',
  'guest', 'guide', 'happy', 'harry', 'heart', 'heavy', 'hence', 'henry',
  'horse', 'hotel', 'house', 'human', 'ideal', 'image', 'index', 'inner',
  'input', 'issue', 'japan', 'jimmy', 'joint', 'jones', 'judge', 'juice',
  'knife', 'knock', 'known', 'label', 'large', 'laser', 'later', 'laugh',
  'layer', 'learn', 'lease', 'least', 'leave', 'legal', 'level', 'lewis',
  'light', 'limit', 'links', 'lives', 'local', 'logic', 'loose', 'lower',
  'lucky', 'lunch', 'lying', 'magic', 'major', 'maker', 'march', 'maria',
  'match', 'maybe', 'mayor', 'meant', 'media', 'metal', 'might', 'minor',
  'minus', 'mixed', 'model', 'money', 'month', 'moral', 'motor', 'mount',
  'mouse', 'mouth', 'movie', 'music', 'needs', 'nerve', 'never', 'newly',
  'night', 'noise', 'north', 'noted', 'novel', 'nurse', 'occur', 'ocean',
  'offer', 'often', 'order', 'other', 'ought', 'outer', 'owner', 'panel',
  'paper', 'party', 'peace', 'peter', 'phase', 'phone', 'photo', 'piece',
  'pilot', 'pitch', 'place', 'plain', 'plane', 'plant', 'plate', 'plaza',
  'point', 'pound', 'power', 'press', 'price', 'pride', 'prime', 'print',
  'prior', 'prize', 'proof', 'proud', 'prove', 'queen', 'quick', 'quiet',
  'quite', 'radio', 'raise', 'range', 'rapid', 'ratio', 'reach', 'ready',
  'refer', 'reign', 'relax', 'reply', 'right', 'river', 'robin', 'rocky',
  'roger', 'roman', 'rough', 'round', 'route', 'royal', 'rural', 'scale',
  'scene', 'scope', 'score', 'sense', 'serve', 'seven', 'shall', 'shape',
  'share', 'sharp', 'sheet', 'shelf', 'shell', 'shift', 'shirt', 'shock',
  'shoot', 'shore', 'short', 'shown', 'sight', 'simon', 'since', 'sixth',
  'sixty', 'sized', 'skill', 'slave', 'sleep', 'slide', 'small', 'smart',
  'smile', 'smith', 'smoke', 'solid', 'solve', 'sorry', 'sound', 'south',
  'space', 'spare', 'speak', 'speed', 'spend', 'spent', 'split', 'spoke',
  'sport', 'staff', 'stage', 'stake', 'stand', 'start', 'state', 'steam',
  'steel', 'stick', 'still', 'stock', 'stone', 'stood', 'store', 'storm',
  'story', 'strip', 'stuck', 'study', 'stuff', 'style', 'sugar', 'suite',
  'super', 'sweet', 'table', 'taken', 'taste', 'taxes', 'teach', 'teeth',
  'terry', 'texas', 'thank', 'theft', 'their', 'theme', 'there', 'these',
  'thick', 'thing', 'think', 'third', 'those', 'three', 'threw', 'throw',
  'tight', 'times', 'tired', 'title', 'today', 'token', 'topic', 'total',
  'touch', 'tough', 'tower', 'track', 'trade', 'train', 'trash', 'treat',
  'trend', 'trial', 'tribe', 'trick', 'tried', 'tries', 'truck', 'truly',
  'trust', 'truth', 'twice', 'under', 'undue', 'union', 'unity', 'until',
  'upper', 'upset', 'urban', 'usage', 'usual', 'valid', 'value', 'video',
  'virus', 'visit', 'vital', 'voice', 'waste', 'watch', 'water', 'wheel',
  'where', 'which', 'while', 'white', 'whole', 'whose', 'woman', 'women',
  'world', 'worry', 'worse', 'worst', 'worth', 'would', 'wound', 'write',
  'wrong', 'wrote', 'yield', 'young', 'youth'
]);

// Game State
let currentWord = '';
let currentRow = 0;
let currentTile = 0;
let currentGuess = '';
let gameOver = false;
let guessHistory = [];

// Stats
let stats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0
};

// DOM Elements
const gameBoard = document.getElementById('game-board');
const keyboard = document.getElementById('keyboard');
const messageEl = document.getElementById('message');
const modal = document.getElementById('game-over-modal');

// Initialize game
function init() {
  loadStats();
  newGame();
  setupEventListeners();
  initVisualEffects();
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
  // Pick random word
  currentWord = WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)].toUpperCase();
  console.log('Debug - Word:', currentWord); // For testing, remove in production

  // Reset state
  currentRow = 0;
  currentTile = 0;
  currentGuess = '';
  gameOver = false;
  guessHistory = [];

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
      updateStatsDisplay();
      gameBoard.classList.add('lose-glitch');
      setTimeout(() => showGameOver(false), 1000);
    }, 1500);
  } else {
    // Move to next row
    currentRow++;
    currentTile = 0;
    currentGuess = '';
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

  tiles.forEach((tile, i) => {
    setTimeout(() => {
      tile.classList.add('reveal');

      setTimeout(() => {
        tile.classList.add(result[i]);
        updateKeyboard(currentGuess[i], result[i]);
      }, 250);
    }, i * 300);
  });
}

function updateKeyboard(letter, status) {
  const key = document.querySelector(`.key[data-key="${letter}"]`);
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

  title.textContent = won ? 'VICTORY' : 'DEFEATED';
  title.className = 'modal-title ' + (won ? 'win' : 'lose');

  wordEl.textContent = currentWord;
  attemptsEl.textContent = won ? currentRow + 1 : 'X';

  // Generate share preview
  preview.innerHTML = generateShareGrid();

  modal.classList.remove('hidden');
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
