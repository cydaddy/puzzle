// ============================================
// TAPPLE WHEEL — Game Logic
// Optimized for tabletop play & elementary students
// ============================================

// --- Sound Synthesis via Web Audio API ---
let audioCtx = null;
let isSoundEnabled = true;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(type) {
  if (!isSoundEnabled) return;
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  if (type === 'tick') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.04);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'danger-tick') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(10, now + 0.05);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  } else if (type === 'click') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.03);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  } else if (type === 'buzzer') {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(100, now);
    osc1.frequency.linearRampToValueAtTime(80, now + 1.2);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(147, now);
    osc2.frequency.linearRampToValueAtTime(115, now + 1.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 1.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.2);
    osc2.stop(now + 1.2);
  } else if (type === 'success') {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, index) => {
      const timeOffset = index * 0.08;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + timeOffset);
      gain.gain.setValueAtTime(0.08, now + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + 0.3);
    });
  } else if (type === 'card-draw') {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

// --- Categories Database ---
// Each category has: text, difficulty, enabled (toggleable), used (consumed in current cycle)
const DEFAULT_CATEGORIES_KO = [
  { text: "동물 이름", difficulty: "EASY" },
  { text: "과일 이름", difficulty: "EASY" },
  { text: "나라 이름", difficulty: "EASY" },
  { text: "좋아하는 음식", difficulty: "EASY" },
  { text: "운동/스포츠 종목", difficulty: "EASY" },
  { text: "방 안에 있는 것", difficulty: "EASY" },
  { text: "가전제품", difficulty: "EASY" },
  { text: "맛있는 음식 이름", difficulty: "EASY" },
  { text: "직업 이름", difficulty: "EASY" },
  { text: "만화/애니메이션 캐릭터", difficulty: "EASY" },
  { text: "학교에서 쓰는 물건", difficulty: "EASY" },
  { text: "유명한 사람 이름", difficulty: "EASY" },
  { text: "탈것/교통수단", difficulty: "EASY" },
  { text: "겨울 하면 생각나는 것", difficulty: "EASY" },
  { text: "여름 하면 생각나는 것", difficulty: "EASY" },
  { text: "마실 것 / 음료", difficulty: "EASY" },
  { text: "길거리 음식", difficulty: "EASY" },
  { text: "색깔 이름", difficulty: "EASY" },
  { text: "취미 / 놀이", difficulty: "EASY" },
  { text: "마트에서 파는 것", difficulty: "EASY" },
  { text: "주방에 있는 것", difficulty: "EASY" },
  { text: "바다에 사는 생물", difficulty: "EASY" },
  { text: "편의점에서 파는 것", difficulty: "EASY" },
  { text: "동화 제목", difficulty: "EASY" },
  { text: "날씨 관련 단어", difficulty: "EASY" },
  { text: "악기 이름", difficulty: "EASY" },
  { text: "학용품 / 필기구", difficulty: "EASY" },
  { text: "기분을 나타내는 말", difficulty: "EASY" },
  { text: "곤충 이름", difficulty: "EASY" },
  { text: "여행 갈 때 챙기는 것", difficulty: "EASY" },
  { text: "게임 이름", difficulty: "EASY" },
  { text: "노래 제목", difficulty: "EASY" },
  { text: "과일과 채소", difficulty: "EASY" },
  { text: "몸의 부위", difficulty: "EASY" },
  { text: "옷/패션 아이템", difficulty: "EASY" },
  { text: "생일파티에 필요한 것", difficulty: "EASY" },
  { text: "공원에서 볼 수 있는 것", difficulty: "EASY" },
  { text: "병원에서 볼 수 있는 것", difficulty: "EASY" },
  { text: "유튜브에서 볼 수 있는 것", difficulty: "EASY" },
  { text: "웹툰/만화 제목", difficulty: "EASY" },
  { text: "역사 속 인물", difficulty: "HARD" },
  { text: "꽃과 나무 이름", difficulty: "HARD" },
  { text: "우주 관련 단어", difficulty: "HARD" },
  { text: "세계 유명 관광지", difficulty: "HARD" },
  { text: "수학/과학 용어", difficulty: "HARD" },
  { text: "형용사 (예: 예쁘다)", difficulty: "HARD" },
  { text: "동사 (예: 먹다, 가다)", difficulty: "HARD" },
  { text: "화장품 / 뷰티 제품", difficulty: "HARD" },
  { text: "자동차 브랜드", difficulty: "HARD" },
  { text: "인터넷 유행어", difficulty: "HARD" },
];

const DEFAULT_CATEGORIES_EN = [
  { text: "Animals", difficulty: "EASY" },
  { text: "Fruits", difficulty: "EASY" },
  { text: "Countries", difficulty: "EASY" },
  { text: "Favorite Foods", difficulty: "EASY" },
  { text: "Sports & Games", difficulty: "EASY" },
  { text: "Things in a Room", difficulty: "EASY" },
  { text: "Home Appliances", difficulty: "EASY" },
  { text: "Yummy Dishes", difficulty: "EASY" },
  { text: "Jobs & Occupations", difficulty: "EASY" },
  { text: "Cartoon Characters", difficulty: "EASY" },
  { text: "School Supplies", difficulty: "EASY" },
  { text: "Famous People", difficulty: "EASY" },
  { text: "Vehicles", difficulty: "EASY" },
  { text: "Winter Things", difficulty: "EASY" },
  { text: "Summer Things", difficulty: "EASY" },
  { text: "Drinks & Beverages", difficulty: "EASY" },
  { text: "Street Food", difficulty: "EASY" },
  { text: "Colors", difficulty: "EASY" },
  { text: "Hobbies & Activities", difficulty: "EASY" },
  { text: "Supermarket Items", difficulty: "EASY" },
  { text: "Kitchen Items", difficulty: "EASY" },
  { text: "Sea Creatures", difficulty: "EASY" },
  { text: "Convenience Store Items", difficulty: "EASY" },
  { text: "Fairy Tales", difficulty: "EASY" },
  { text: "Weather Words", difficulty: "EASY" },
  { text: "Musical Instruments", difficulty: "EASY" },
  { text: "Stationery Items", difficulty: "EASY" },
  { text: "Emotions & Feelings", difficulty: "EASY" },
  { text: "Insects & Bugs", difficulty: "EASY" },
  { text: "Travel Essentials", difficulty: "EASY" },
  { text: "Video Game Names", difficulty: "EASY" },
  { text: "Song Titles", difficulty: "EASY" },
  { text: "Fruits & Vegetables", difficulty: "EASY" },
  { text: "Body Parts", difficulty: "EASY" },
  { text: "Clothing Items", difficulty: "EASY" },
  { text: "Birthday Party Items", difficulty: "EASY" },
  { text: "Things in a Park", difficulty: "EASY" },
  { text: "Things in a Hospital", difficulty: "EASY" },
  { text: "Things on YouTube", difficulty: "EASY" },
  { text: "Comic / Webtoon Titles", difficulty: "EASY" },
  { text: "Historical Figures", difficulty: "HARD" },
  { text: "Flowers & Trees", difficulty: "HARD" },
  { text: "Space & Astronomy", difficulty: "HARD" },
  { text: "Famous Landmarks", difficulty: "HARD" },
  { text: "Math & Science Terms", difficulty: "HARD" },
  { text: "Adjectives", difficulty: "HARD" },
  { text: "Verbs", difficulty: "HARD" },
  { text: "Cosmetics & Beauty", difficulty: "HARD" },
  { text: "Car Brands", difficulty: "HARD" },
  { text: "Internet Slang", difficulty: "HARD" },
];

// Live category lists with enabled/used state
let categoriesKo = [];
let categoriesEn = [];

// --- Alphabet configuration ---
const LETTERS_EN = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'W'];
const LETTERS_KO = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// --- Game State ---
let currentLang = 'ko';
let difficultyFilter = 'easy'; // 'easy' or 'all'
let gameDuration = 15.0;
let timeLeft = 15.0;
let gameState = 'idle'; // 'idle', 'running', 'paused', 'gameover'
let timerId = null;
let lastTimestamp = 0;
let lastTickSecond = 0;

let currentCategory = null;

let players = [];
let activePlayerIndex = 0;
let cardsToWin = 3;
let letterPressedThisTurn = false;

const WHEEL_RADIUS_PERCENT = 37.5;

// --- DOM Elements ---
const gameScreen = document.getElementById('game-screen');
const tappleWheel = document.getElementById('tapple-wheel');
const tapBtn = document.getElementById('tap-btn');
const countdownDisplay = document.getElementById('countdown-display');
const timerBar = document.getElementById('timer-bar');

const floatingSettingsBtn = document.getElementById('floating-settings-btn');
const settingsDialog = document.getElementById('settings-dialog');
const closeSettingsBtn = document.getElementById('close-settings');

const overlayCategoryText = document.getElementById('overlay-category-text');
const overlayPlayerText = document.getElementById('overlay-player-text');
const playerOverlay = document.getElementById('player-overlay');
const eliminationFlash = document.getElementById('elimination-flash');
const victoryOverlay = document.getElementById('victory-overlay');
const victoryText = document.getElementById('victory-text');
const victoryNextBtn = document.getElementById('victory-next-btn');

const categoryListContainer = document.getElementById('category-list-container');
const newCategoryInput = document.getElementById('new-category-input');
const addCategoryBtn = document.getElementById('add-category-btn');
const cardCountDisplay = document.getElementById('card-count');

const playerListContainer = document.getElementById('player-list');
const newPlayerInput = document.getElementById('new-player-input');
const addPlayerBtn = document.getElementById('add-player-btn');

const timerDurationSelect = document.getElementById('timer-duration-select');
const difficultyFilterSelect = document.getElementById('difficulty-filter-select');
const langSelect = document.getElementById('lang-select');
const soundCheckbox = document.getElementById('sound-checkbox');

const startGameBtn = document.getElementById('start-game-btn');
const resetRoundBtn = document.getElementById('reset-round-btn');
const resetAllBtn = document.getElementById('reset-all-btn');

// SVG Timer
const SVG_CIRCUMFERENCE = 2 * Math.PI * 80;
timerBar.style.strokeDasharray = SVG_CIRCUMFERENCE;
timerBar.style.strokeDashoffset = 0;

// ============================================
// INITIALIZATION
// ============================================

function init() {
  // Initialize category lists with enabled/used flags
  initCategories();

  // Add default players
  addPlayer("플레이어 1");
  addPlayer("플레이어 2");

  // Build wheel
  initWheel();

  // Reset display
  countdownDisplay.textContent = gameDuration.toFixed(1);

  // Render category list in settings
  renderCategoryList();
  updateCategoryCardCount();

  // Setup events
  setupEventListeners();

  // Show settings on first load
  settingsDialog.showModal();
}

function initCategories() {
  categoriesKo = DEFAULT_CATEGORIES_KO.map((c, i) => ({
    id: 'ko_' + i,
    text: c.text,
    difficulty: c.difficulty,
    enabled: c.difficulty === 'EASY', // HARD disabled by default
    used: false,
    custom: false,
  }));
  categoriesEn = DEFAULT_CATEGORIES_EN.map((c, i) => ({
    id: 'en_' + i,
    text: c.text,
    difficulty: c.difficulty,
    enabled: c.difficulty === 'EASY',
    used: false,
    custom: false,
  }));
}

// ============================================
// WHEEL RENDERING
// ============================================

function initWheel() {
  tappleWheel.querySelectorAll('.letter-btn').forEach(btn => btn.remove());

  const currentLetters = currentLang === 'ko' ? LETTERS_KO : LETTERS_EN;
  const totalLetters = currentLetters.length;

  currentLetters.forEach((letter, index) => {
    const button = document.createElement('button');
    button.classList.add('letter-btn');
    if (currentLang === 'ko') {
      button.classList.add('ko-char');
    }
    button.textContent = letter;
    button.setAttribute('aria-label', `글자 ${letter}`);

    const angleRad = (index / totalLetters) * 2 * Math.PI - Math.PI / 2;
    const x = Math.cos(angleRad) * WHEEL_RADIUS_PERCENT;
    const y = Math.sin(angleRad) * WHEEL_RADIUS_PERCENT;

    button.style.left = `calc(50% + ${x.toFixed(2)}%)`;
    button.style.top = `calc(50% + ${y.toFixed(2)}%)`;

    // Rotate letter to face outward from center (like real Tapple device)
    const rotDeg = (index / totalLetters) * 360 + 180;
    button.style.setProperty('--rot', `${rotDeg.toFixed(1)}deg`);

    button.addEventListener('click', () => {
      if (gameState === 'running') {
        playSound('click');
        button.classList.add('pressed');
        letterPressedThisTurn = true;
        checkRemainingLetters();
      }
    });

    tappleWheel.appendChild(button);
  });
}

function checkRemainingLetters() {
  const activeLetters = tappleWheel.querySelectorAll('.letter-btn:not(.pressed)');
  if (activeLetters.length === 0) {
    pauseTimer();
    playSound('success');
    overlayCategoryText.textContent = currentLang === 'ko' ? "모든 글자 사용 완료! 🎉" : "All letters used! 🎉";
  }
}

// ============================================
// TIMER & GAME CONTROL
// ============================================

function startTimer() {
  if (gameState === 'running') return;

  initAudio();

  gameState = 'running';
  tapBtn.classList.remove('paused', 'gameover');

  lastTimestamp = performance.now();
  lastTickSecond = Math.ceil(timeLeft);

  timerId = requestAnimationFrame(updateTimer);
  updateOverlays();
}

function pauseTimer() {
  if (gameState !== 'running') return;

  gameState = 'paused';
  tapBtn.classList.add('paused');
  cancelAnimationFrame(timerId);
}

function resetTimerDisplay() {
  timeLeft = gameDuration;
  countdownDisplay.textContent = timeLeft.toFixed(1);
  tapBtn.classList.remove('paused', 'gameover');
  timerBar.classList.remove('danger-flash');
  timerBar.style.stroke = 'var(--accent-cyan)';
  timerBar.style.strokeDashoffset = 0;
}

function resetRound() {
  pauseTimer();
  gameState = 'idle';
  resetTimerDisplay();

  // Reset all letter keys
  tappleWheel.querySelectorAll('.letter-btn').forEach(btn => {
    btn.classList.remove('pressed');
  });

  // Reset all players to active
  players.forEach(p => { p.active = true; });
  activePlayerIndex = 0;
  renderPlayers();

  updateOverlays();
}

function resetAll() {
  resetRound();
  players.forEach(p => { p.score = 0; });
  currentCategory = null;

  // Reset category used flags
  categoriesKo.forEach(c => { c.used = false; });
  categoriesEn.forEach(c => { c.used = false; });
  updateCategoryCardCount();
  renderCategoryList();
  renderPlayers();
  updateOverlays();
}

function updateTimer(timestamp) {
  if (gameState !== 'running') return;

  const elapsed = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  timeLeft -= elapsed;

  if (timeLeft <= 0) {
    timeLeft = 0;
    triggerTimeOut();
    return;
  }

  countdownDisplay.textContent = timeLeft.toFixed(1);

  const offset = SVG_CIRCUMFERENCE * (1 - timeLeft / gameDuration);
  timerBar.style.strokeDashoffset = offset;

  const isDanger = timeLeft <= 3.0;
  if (isDanger) {
    timerBar.classList.add('danger-flash');
    timerBar.style.stroke = 'var(--accent-red)';

    const currentHalfSecond = Math.ceil(timeLeft * 2);
    if (currentHalfSecond !== lastTickSecond) {
      playSound('danger-tick');
      lastTickSecond = currentHalfSecond;
    }
  } else {
    timerBar.classList.remove('danger-flash');
    timerBar.style.stroke = 'var(--accent-cyan)';

    const currentSecond = Math.ceil(timeLeft);
    if (currentSecond !== lastTickSecond) {
      playSound('tick');
      lastTickSecond = currentSecond;
    }
  }

  timerId = requestAnimationFrame(updateTimer);
}

function triggerTimeOut() {
  gameState = 'gameover';
  countdownDisplay.textContent = "0.0";
  timerBar.style.strokeDashoffset = SVG_CIRCUMFERENCE;
  tapBtn.classList.add('gameover');
  playSound('buzzer');

  // Flash screen red
  triggerEliminationFlash();

  if (players.length > 0 && activePlayerIndex >= 0) {
    const player = players[activePlayerIndex];
    player.active = false;
    renderPlayers();

    const activePlayers = players.filter(p => p.active);

    if (activePlayers.length <= 1) {
      // Round over!
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        winner.score += 1;
        renderPlayers();

        // Check if someone won the game
        if (winner.score >= cardsToWin) {
          setTimeout(() => showVictory(winner, true), 800);
        } else {
          setTimeout(() => showVictory(winner, false), 800);
        }
      } else {
        // All eliminated (edge case)
        overlayPlayerText.textContent = currentLang === 'ko' ? "모두 탈락! 😱" : "Everyone eliminated! 😱";
      }
    } else {
      overlayPlayerText.textContent = currentLang === 'ko'
        ? `${player.name} 탈락! 💀`
        : `${player.name} eliminated! 💀`;

      // Move to next active player after a brief pause
      setTimeout(() => {
        moveToNextActivePlayer();
        updateOverlays();
      }, 1200);
    }
  }
}

function triggerEliminationFlash() {
  eliminationFlash.classList.remove('active');
  void eliminationFlash.offsetWidth; // Force reflow
  eliminationFlash.classList.add('active');
  setTimeout(() => eliminationFlash.classList.remove('active'), 700);
}

function showVictory(winner, isGameWinner) {
  playSound('success');
  victoryOverlay.classList.remove('hidden');

  if (isGameWinner) {
    victoryText.textContent = currentLang === 'ko'
      ? `🏆 ${winner.name} 최종 우승! 🏆`
      : `🏆 ${winner.name} wins the game! 🏆`;
    victoryNextBtn.textContent = currentLang === 'ko' ? "새 게임 시작" : "New Game";
  } else {
    victoryText.textContent = currentLang === 'ko'
      ? `${winner.name}님이 카드 획득! (${winner.score}/${cardsToWin})`
      : `${winner.name} gets the card! (${winner.score}/${cardsToWin})`;
    victoryNextBtn.textContent = currentLang === 'ko' ? "다음 라운드" : "Next Round";
  }

  victoryNextBtn.onclick = () => {
    victoryOverlay.classList.add('hidden');
    if (isGameWinner) {
      resetAll();
      settingsDialog.showModal();
    } else {
      startNewRound();
    }
  };
}

function startNewRound() {
  pauseTimer();
  gameState = 'idle';
  resetTimerDisplay();

  // Reset letter buttons
  tappleWheel.querySelectorAll('.letter-btn').forEach(btn => {
    btn.classList.remove('pressed');
  });

  // Reset all players to active
  players.forEach(p => { p.active = true; });
  activePlayerIndex = 0;

  // Auto-draw next category
  drawCategoryCard();

  renderPlayers();
  updateOverlays();
}

// TAP button handler
function handleTap() {
  initAudio();

  if (gameState === 'gameover') {
    // After timeout, TAP opens settings rather than auto-restarting
    // (prevents accidental restarts in group play)
    return;
  }

  if (gameState === 'running') {
    // During gameplay, require a letter to be pressed before TAP works
    if (!letterPressedThisTurn) {
      // Visual shake feedback — letter must be pressed first
      tapBtn.classList.add('shake');
      setTimeout(() => tapBtn.classList.remove('shake'), 400);
      return;
    }

    playSound('click');

    // Visual feedback
    tapBtn.classList.add('activated');
    setTimeout(() => tapBtn.classList.remove('activated'), 150);

    // Reset timer and pass turn
    timeLeft = gameDuration;
    countdownDisplay.textContent = timeLeft.toFixed(1);
    timerBar.style.strokeDashoffset = 0;
    timerBar.classList.remove('danger-flash');
    timerBar.style.stroke = 'var(--accent-cyan)';
    lastTickSecond = Math.ceil(timeLeft);

    letterPressedThisTurn = false; // Reset for next player's turn
    if (players.length > 0) {
      moveToNextActivePlayer();
      updateOverlays();
    }
  } else if (gameState === 'idle' || gameState === 'paused') {
    playSound('click');

    tapBtn.classList.add('activated');
    setTimeout(() => tapBtn.classList.remove('activated'), 150);

    // Reset timer and start
    timeLeft = gameDuration;
    countdownDisplay.textContent = timeLeft.toFixed(1);
    timerBar.style.strokeDashoffset = 0;
    timerBar.classList.remove('danger-flash');
    timerBar.style.stroke = 'var(--accent-cyan)';
    lastTickSecond = Math.ceil(timeLeft);

    letterPressedThisTurn = false;
    startTimer();
  }
}

// ============================================
// CATEGORY SYSTEM
// ============================================

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getCategories() {
  return currentLang === 'ko' ? categoriesKo : categoriesEn;
}

function drawCategoryCard() {
  playSound('card-draw');

  const cats = getCategories();
  // Get enabled & not yet used categories
  let available = cats.filter(c => c.enabled && !c.used);

  if (available.length === 0) {
    // All used — reset cycle
    cats.forEach(c => { c.used = false; });
    available = cats.filter(c => c.enabled && !c.used);
  }

  if (available.length === 0) {
    // No enabled categories at all
    currentCategory = null;
    overlayCategoryText.textContent = currentLang === 'ko' ? "카테고리 없음!" : "No categories!";
    return;
  }

  // Pick random
  const idx = Math.floor(Math.random() * available.length);
  const card = available[idx];
  card.used = true;
  currentCategory = card;

  // Update overlay
  overlayCategoryText.textContent = card.text;

  updateCategoryCardCount();
  renderCategoryList();
}

function updateCategoryCardCount() {
  const cats = getCategories();
  const enabled = cats.filter(c => c.enabled);
  const used = enabled.filter(c => c.used).length;
  cardCountDisplay.textContent = `${used}/${enabled.length}`;
}

function renderCategoryList() {
  const cats = getCategories();
  categoryListContainer.innerHTML = '';

  cats.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'category-item';
    if (!cat.enabled) el.classList.add('disabled');
    if (cat.used) el.classList.add('used');

    const diffClass = cat.custom ? 'custom' : cat.difficulty.toLowerCase();
    const diffLabel = cat.custom ? '✚' : cat.difficulty;
    const deleteBtn = cat.custom ? `<button class="category-delete-btn" data-cat-id="${cat.id}" aria-label="삭제"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>` : '';

    el.innerHTML = `
      <label class="switch">
        <input type="checkbox" ${cat.enabled ? 'checked' : ''} data-cat-id="${cat.id}">
        <span class="slider round"></span>
      </label>
      <span class="category-item-text">${cat.text}</span>
      <span class="difficulty-badge ${diffClass}">${diffLabel}</span>
      ${deleteBtn}
    `;

    // Toggle enabled
    el.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      cat.enabled = e.target.checked;
      if (!cat.enabled) cat.used = false;
      renderCategoryList();
      updateCategoryCardCount();
      updateStartBtnState();
    });

    // Delete custom
    const delBtn = el.querySelector('.category-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        const list = currentLang === 'ko' ? categoriesKo : categoriesEn;
        const idx = list.findIndex(c => c.id === cat.id);
        if (idx !== -1) list.splice(idx, 1);
        renderCategoryList();
        updateCategoryCardCount();
      });
    }

    categoryListContainer.appendChild(el);
  });
}

function addCustomCategory(text) {
  if (!text.trim()) return;
  const cats = getCategories();
  const id = 'custom_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
  cats.push({
    id: id,
    text: text.trim(),
    difficulty: 'EASY',
    enabled: true,
    used: false,
    custom: true,
  });
  renderCategoryList();
  updateCategoryCardCount();
}

// ============================================
// PLAYER SYSTEM
// ============================================

function addPlayer(name = "") {
  if (!name) {
    const count = players.length + 1;
    name = currentLang === 'ko' ? `플레이어 ${count}` : `Player ${count}`;
  }

  const colorHues = [180, 210, 280, 340, 30, 90, 150, 60, 240, 310];
  const hue = colorHues[players.length % colorHues.length];

  const player = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    name: name,
    active: true,
    score: 0,
    hue: hue,
  };

  players.push(player);
  renderPlayers();
  updateStartBtnState();
}

function deletePlayer(id) {
  players = players.filter(p => p.id !== id);
  if (activePlayerIndex >= players.length) {
    activePlayerIndex = 0;
  }
  renderPlayers();
  updateStartBtnState();
}

function renamePlayer(id, newName) {
  const player = players.find(p => p.id === id);
  if (player && newName.trim()) {
    player.name = newName.trim();
    renderPlayers();
    updateOverlays();
  }
}

function moveToNextActivePlayer() {
  if (players.length === 0) return;

  const activePlayers = players.filter(p => p.active);
  if (activePlayers.length <= 1) return;

  let index = activePlayerIndex;
  do {
    index = (index + 1) % players.length;
  } while (!players[index].active);

  activePlayerIndex = index;
  renderPlayers();
}

function renderPlayers() {
  playerListContainer.innerHTML = '';

  players.forEach((player, index) => {
    const el = document.createElement('div');
    el.className = 'player-item';

    if (!player.active) {
      el.classList.add('eliminated');
    }
    if (index === activePlayerIndex && gameState !== 'idle') {
      el.classList.add('current-turn');
    }

    const avatarGradient = `linear-gradient(135deg, hsl(${player.hue}, 80%, 60%), hsl(${player.hue + 30}, 80%, 50%))`;

    el.innerHTML = `
      <div class="player-info">
        <div class="player-avatar" style="background: ${avatarGradient}">${player.name.charAt(0)}</div>
        <span class="player-name" data-player-id="${player.id}">${player.name}</span>
      </div>
      <div class="player-actions">
        <span class="player-score">${player.score}점</span>
        <button class="player-delete-btn" data-delete-id="${player.id}" aria-label="삭제">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    // Name click → inline edit
    const nameEl = el.querySelector('.player-name');
    nameEl.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineEdit(nameEl, player.id);
    });

    // Delete click
    el.querySelector('.player-delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deletePlayer(player.id);
    });

    playerListContainer.appendChild(el);
  });
}

function startInlineEdit(nameEl, playerId) {
  const player = players.find(p => p.id === playerId);
  if (!player) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'player-name-input';
  input.value = player.name;
  input.maxLength = 10;

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  const finishEdit = () => {
    const newName = input.value.trim() || player.name;
    renamePlayer(playerId, newName);
  };

  input.addEventListener('blur', finishEdit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = player.name;
      input.blur();
    }
  });
}

// ============================================
// OVERLAY UPDATES
// ============================================

function updateOverlays() {
  // Category overlay
  if (currentCategory) {
    overlayCategoryText.textContent = currentCategory.text;
  } else {
    overlayCategoryText.textContent = currentLang === 'ko' ? "카테고리를 뽑아주세요" : "Draw a category card";
  }

  // Player overlay
  if (players.length === 0) {
    overlayPlayerText.textContent = currentLang === 'ko' ? "플레이어를 추가하세요" : "Add players";
    playerOverlay.classList.remove('active-turn');
  } else if (gameState === 'idle') {
    overlayPlayerText.textContent = currentLang === 'ko' ? "TAP을 눌러 시작!" : "Press TAP to start!";
    playerOverlay.classList.remove('active-turn');
  } else {
    const activePlayer = players[activePlayerIndex];
    if (activePlayer) {
      overlayPlayerText.textContent = `👉 ${activePlayer.name}`;
      playerOverlay.classList.add('active-turn');
    }
  }
}

function updateStartBtnState() {
  const cats = getCategories();
  const hasEnabledCats = cats.some(c => c.enabled);
  startGameBtn.disabled = !(hasEnabledCats && players.length >= 2);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // TAP button
  tapBtn.addEventListener('click', handleTap);

  // Floating settings button
  floatingSettingsBtn.addEventListener('click', () => {
    if (gameState === 'running') {
      pauseTimer();
    }
    settingsDialog.showModal();
    renderPlayers(); // Refresh player list when opening
  });

  // Close settings
  closeSettingsBtn.addEventListener('click', () => {
    settingsDialog.close();
    updateOverlays();
  });

  settingsDialog.addEventListener('click', (e) => {
    if (e.target === settingsDialog) {
      settingsDialog.close();
      updateOverlays();
    }
  });

  // Add category
  addCategoryBtn.addEventListener('click', () => {
    const name = newCategoryInput.value.trim();
    if (name) {
      addCustomCategory(name);
      newCategoryInput.value = '';
    }
    newCategoryInput.focus();
  });

  newCategoryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addCategoryBtn.click();
    }
  });

  // Add player
  addPlayerBtn.addEventListener('click', () => {
    const name = newPlayerInput.value.trim();
    if (name) {
      addPlayer(name);
      newPlayerInput.value = '';
    } else {
      addPlayer();
    }
    newPlayerInput.focus();
  });

  newPlayerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addPlayerBtn.click();
    }
  });

  // Timer duration
  timerDurationSelect.addEventListener('change', (e) => {
    gameDuration = parseFloat(e.target.value);
    timeLeft = gameDuration;
    countdownDisplay.textContent = timeLeft.toFixed(1);
    resetTimerDisplay();
  });

  // Difficulty filter — toggle all HARD categories
  difficultyFilterSelect.addEventListener('change', (e) => {
    difficultyFilter = e.target.value;
    const cats = getCategories();
    cats.forEach(c => {
      if (!c.custom) {
        c.enabled = difficultyFilter === 'all' || c.difficulty === 'EASY';
      }
    });
    renderCategoryList();
    updateCategoryCardCount();
  });

  // Language
  langSelect.addEventListener('change', (e) => {
    currentLang = e.target.value;
    initWheel();
    renderCategoryList();
    updateCategoryCardCount();
    resetTimerDisplay();
    updateOverlays();
    translateUI();
  });

  // Sound
  soundCheckbox.addEventListener('change', (e) => {
    isSoundEnabled = e.target.checked;
  });

  // Start game button — auto-draws category
  startGameBtn.addEventListener('click', () => {
    const cats = getCategories();
    if (!cats.some(c => c.enabled) || players.length < 2) return;

    settingsDialog.close();

    // Reset for new start
    resetRound();

    // Auto-draw a random category
    drawCategoryCard();
    updateOverlays();
  });

  // Reset round
  resetRoundBtn.addEventListener('click', () => {
    playSound('click');
    resetRound();
  });

  // Reset all
  resetAllBtn.addEventListener('click', () => {
    playSound('click');
    resetAll();
  });

  // Victory next button handled in showVictory

  // Prevent settings dialog from being closeable with Escape during initial setup
  settingsDialog.addEventListener('cancel', (e) => {
    // Allow closing normally
  });
}

// ============================================
// UI TRANSLATION
// ============================================

function translateUI() {
  if (currentLang === 'ko') {
    document.querySelector('.settings-header h2').textContent = "⚙️ 게임 설정";
    document.querySelector('.settings-section:nth-child(1) .section-title span').textContent = "🏷️ 카테고리 관리";
    document.querySelector('.settings-section:nth-child(2) .section-title span').textContent = "👥 플레이어";
    document.querySelector('.settings-section:nth-child(3) .section-title span').textContent = "⏱️ 게임 옵션";
    document.querySelector('.settings-section:nth-child(4) .section-title span').textContent = "🔄 라운드 관리";
    document.querySelector('.settings-section:nth-child(5) .section-title span').textContent = "📖 게임 규칙";
    
    newCategoryInput.placeholder = "새 카테고리 추가...";
    addCategoryBtn.textContent = "+ 추가";
    document.querySelector('.section-desc').textContent = "게임 시작 시 활성화된 카테고리에서 랜덤으로 뽑힙니다.";
    newPlayerInput.placeholder = "새 플레이어 이름...";
    addPlayerBtn.textContent = "+ 추가";
    
    document.querySelector('label[for="timer-duration-select"]').textContent = "제한 시간";
    document.querySelector('label[for="difficulty-filter-select"]').textContent = "난이도 필터";
    document.querySelector('label[for="lang-select"]').textContent = "언어";
    document.querySelector('.toggle-row > span').textContent = "게임 사운드";
    
    resetRoundBtn.textContent = "🔄 라운드 초기화";
    resetAllBtn.textContent = "🗑️ 전체 초기화";
    startGameBtn.textContent = "🎮 게임 시작";
    
    categoryPlaceholder.textContent = "주제를 뽑아주세요!";

    // Timer options
    const opts = timerDurationSelect.options;
    opts[0].text = "5초 (엄청 빠름)";
    opts[1].text = "8초 (어려움)";
    opts[2].text = "10초 (보통)";
    opts[3].text = "15초 (기본)";
    opts[4].text = "20초 (쉬움)";
    opts[5].text = "30초 (연습)";

    // Difficulty options
    const dOpts = difficultyFilterSelect.options;
    dOpts[0].text = "쉬운 카테고리만";
    dOpts[1].text = "전체 카테고리";
  } else {
    document.querySelector('.settings-header h2').textContent = "⚙️ Game Settings";
    document.querySelector('.settings-section:nth-child(1) .section-title span').textContent = "🏷️ Categories";
    document.querySelector('.settings-section:nth-child(2) .section-title span').textContent = "👥 Players";
    document.querySelector('.settings-section:nth-child(3) .section-title span').textContent = "⏱️ Options";
    document.querySelector('.settings-section:nth-child(4) .section-title span').textContent = "🔄 Round Controls";
    document.querySelector('.settings-section:nth-child(5) .section-title span').textContent = "📖 Game Rules";

    newCategoryInput.placeholder = "Add new category...";
    addCategoryBtn.textContent = "+ Add";
    document.querySelector('.section-desc').textContent = "A random category is auto-drawn when the game starts.";
    newPlayerInput.placeholder = "New player name...";
    addPlayerBtn.textContent = "+ Add";

    document.querySelector('label[for="timer-duration-select"]').textContent = "Timer";
    document.querySelector('label[for="difficulty-filter-select"]').textContent = "Difficulty";
    document.querySelector('label[for="lang-select"]').textContent = "Language";
    document.querySelector('.toggle-row > span').textContent = "Sound";

    resetRoundBtn.textContent = "🔄 Reset Round";
    resetAllBtn.textContent = "🗑️ Reset All";
    startGameBtn.textContent = "🎮 Start Game";

    categoryPlaceholder.textContent = "Draw a category!";

    const opts = timerDurationSelect.options;
    opts[0].text = "5s (Very Fast)";
    opts[1].text = "8s (Hard)";
    opts[2].text = "10s (Normal)";
    opts[3].text = "15s (Default)";
    opts[4].text = "20s (Easy)";
    opts[5].text = "30s (Practice)";

    const dOpts = difficultyFilterSelect.options;
    dOpts[0].text = "Easy only";
    dOpts[1].text = "All categories";
  }
}

// ============================================
// START
// ============================================

document.addEventListener('DOMContentLoaded', init);
