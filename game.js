/* ===================================================================
   サンリオ ゲーム — game.js
   もぐらたたき ＆ キャラキャッチ
   3歳児向け：ゆっくりペース、ゲームオーバーなし、星スコア
   =================================================================== */

// ---- 定数 ----
const CHARACTERS = [
  { name: 'キティ',         src: 'images/mv-hellokitty.png' },
  { name: 'シナモロール',   src: 'images/mv-cinnamon.png' },
  { name: 'クロミ',         src: 'images/list-kuromi.png' },
  { name: 'マイメロディ',   src: 'images/list-mymelody.png' },
  { name: 'ポチャッコ',     src: 'images/list-pochacco.png' },
  { name: 'ポムポムプリン', src: 'images/list-pompompurin.png' },
];

const GAME_DURATION   = 30;        // 秒
const PARTICLE_EMOJIS = ['⭐', '🌟', '✨', '💖', '🎀', '🩷', '💗', '🌸'];
const CONFETTI_COLORS = ['#FF69B4', '#FFD700', '#87CEEB', '#FF6347', '#98FB98', '#DDA0DD', '#FFA07A', '#B0E0E6'];

// モグラたたき定数
const MOLE_HOLE_COUNT  = 6;
const MOLE_SHOW_MIN    = 1800;
const MOLE_SHOW_MAX    = 3000;
const MOLE_SPAWN_MIN   = 800;
const MOLE_SPAWN_MAX   = 1600;

// キャラキャッチ定数
const CATCH_FALL_MIN   = 3000;      // 落下速度（ms）最速
const CATCH_FALL_MAX   = 5000;      // 落下速度（ms）最遅
const CATCH_SPAWN_MIN  = 600;
const CATCH_SPAWN_MAX  = 1400;

// ---- 共通ゲーム状態 ----
let currentGame   = null;   // 'mole' | 'catch'
let score          = 0;
let timeLeft       = GAME_DURATION;
let timerInterval  = null;
let isPlaying      = false;
let audioCtx       = null;

// モグラたたき状態
let moleHoles       = [];
let moleSpawnTimeout = null;

// キャラキャッチ状態
let catchSpawnTimeout = null;
let catchFallingChars = [];
let catchBubbleInterval = null;

// ===================================================================
//  音声 (Web Audio API)
// ===================================================================
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playPopSound() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {}
}

function playHitSound() {
  try {
    const ctx = getAudioCtx();
    const notes = [800, 1000, 1200];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.08 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.3);
    });
  } catch (e) {}
}

function playCatchSound() {
  try {
    const ctx = getAudioCtx();
    // ぽよん＋きらきら
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(500, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.25);
    gain1.gain.setValueAtTime(0.25, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // 高音きらきら
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1400, ctx.currentTime + 0.1);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (e) {}
}

function playCheerSound() {
  try {
    const ctx = getAudioCtx();
    const melody = [523, 659, 784, 1047];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch (e) {}
}

// ===================================================================
//  共通関数
// ===================================================================
function preloadImages() {
  CHARACTERS.forEach(c => { const img = new Image(); img.src = c.src; });
  const bg = new Image(); bg.src = 'images/bg.png';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===================================================================
//  メニュー
// ===================================================================
function selectGame(type) {
  getAudioCtx();
  currentGame = type;
  if (type === 'mole') {
    startMoleGame();
  } else {
    startCatchGame();
  }
}

function goToMenu() {
  stopAllGames();
  showScreen('screen-menu');
}

function stopAllGames() {
  isPlaying = false;
  clearInterval(timerInterval);
  clearTimeout(moleSpawnTimeout);
  clearTimeout(catchSpawnTimeout);
  clearInterval(catchBubbleInterval);
  // キャッチのアニメをすべてキャンセル
  catchFallingChars.forEach(c => {
    if (c.anim) c.anim.cancel();
  });
  catchFallingChars = [];
}

function restartGame() {
  document.getElementById('confetti').innerHTML = '';
  if (currentGame === 'mole') {
    startMoleGame();
  } else {
    startCatchGame();
  }
}

// ===================================================================
//  スコア＆タイマー（共通）
// ===================================================================
function getScoreContainer() {
  return document.getElementById(currentGame === 'mole' ? 'mole-score-stars' : 'catch-score-stars');
}

function getTimerBar() {
  return document.getElementById(currentGame === 'mole' ? 'mole-timer-bar' : 'catch-timer-bar');
}

function getParticlesContainer() {
  return document.getElementById(currentGame === 'mole' ? 'mole-particles' : 'catch-particles');
}

function updateScoreDisplay() {
  const container = getScoreContainer();
  if (score <= 20) {
    container.innerHTML = '';
    for (let i = 0; i < score; i++) {
      const star = document.createElement('span');
      star.className = 'score-star';
      star.textContent = '⭐';
      container.appendChild(star);
    }
  } else {
    container.innerHTML = `<span class="score-star" style="font-size:1.4rem;">⭐×${score}</span>`;
  }
}

function updateTimerBar() {
  const bar = getTimerBar();
  const pct = Math.max(0, (timeLeft / GAME_DURATION) * 100);
  bar.style.width = pct + '%';
  if (pct < 20) {
    bar.style.background = 'linear-gradient(90deg, #FF6B6B, #FF1493)';
  } else {
    bar.style.background = '';
  }
}

function startTimer() {
  timerInterval = setInterval(() => {
    timeLeft -= 0.1;
    updateTimerBar();
    if (timeLeft <= 0) {
      endGame();
    }
  }, 100);
}

function endGame() {
  isPlaying = false;
  clearInterval(timerInterval);

  if (currentGame === 'mole') {
    clearTimeout(moleSpawnTimeout);
    moleHoles.forEach(h => hideMole(h));
  } else {
    clearTimeout(catchSpawnTimeout);
    clearInterval(catchBubbleInterval);
  }

  setTimeout(() => showResult(), 600);
}

// ===================================================================
//  パーティクル＆紙吹雪（共通）
// ===================================================================
function spawnParticles(x, y) {
  const container = getParticlesContainer();
  const count = 8;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.textContent = PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)];
    const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.5;
    const dist = 35 + Math.random() * 55;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 25;
    const rot = (Math.random() - 0.5) * 720;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.setProperty('--tx', tx + 'px');
    p.style.setProperty('--ty', ty + 'px');
    p.style.setProperty('--rot', rot + 'deg');
    container.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

function spawnConfetti() {
  const container = document.getElementById('confetti');
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.backgroundColor = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.width = (6 + Math.random() * 10) + 'px';
      piece.style.height = (6 + Math.random() * 10) + 'px';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      piece.animate([
        { top: '-20px', opacity: 1, transform: 'rotateZ(0deg)' },
        { top: '110vh', opacity: 0.5, transform: `rotateZ(${Math.random()*720}deg)` }
      ], {
        duration: 2000 + Math.random() * 2000,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      });
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 5000);
    }, i * 50);
  }
}

// ===================================================================
//  リザルト画面（共通）
// ===================================================================
function showResult() {
  const starsEl = document.getElementById('result-stars');
  const displayCount = Math.min(score, 15);
  let starsHTML = '';
  for (let i = 0; i < displayCount; i++) starsHTML += '⭐';
  if (score > 15) starsHTML += ` ×${score}`;
  starsEl.textContent = starsHTML;

  const msgEl = document.getElementById('result-message');
  if (score >= 15)     msgEl.textContent = 'てんさい！！🎊';
  else if (score >= 10) msgEl.textContent = 'すごーい！💖';
  else if (score >= 5)  msgEl.textContent = 'じょうずだね！🌟';
  else                  msgEl.textContent = 'たのしかったね！🎀';

  showScreen('screen-result');
  playCheerSound();
  spawnConfetti();
}

// ===================================================================
//  ゲーム１：もぐらたたき
// ===================================================================
function startMoleGame() {
  score = 0;
  timeLeft = GAME_DURATION;
  isPlaying = true;
  currentGame = 'mole';

  initMoleBoard();
  updateScoreDisplay();
  updateTimerBar();
  showScreen('screen-mole');
  startTimer();
  scheduleMoleSpawn();
}

function initMoleBoard() {
  const board = document.getElementById('mole-board');
  board.innerHTML = '';
  moleHoles = [];

  for (let i = 0; i < MOLE_HOLE_COUNT; i++) {
    const hole = document.createElement('div');
    hole.className = 'hole';
    hole.dataset.index = i;

    const mask = document.createElement('div');
    mask.className = 'hole-mask';

    const mole = document.createElement('img');
    mole.className = 'mole';
    mole.src = CHARACTERS[i].src;
    mole.alt = CHARACTERS[i].name;
    mole.draggable = false;

    mask.appendChild(mole);

    const front = document.createElement('div');
    front.className = 'hole-front';

    hole.appendChild(mask);
    hole.appendChild(front);

    hole.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onMoleHit(i, e);
    });

    board.appendChild(hole);
    moleHoles.push({ el: hole, mole, isUp: false, timeout: null });
  }
}

function scheduleMoleSpawn() {
  if (!isPlaying) return;
  const delay = randomBetween(MOLE_SPAWN_MIN, MOLE_SPAWN_MAX);
  moleSpawnTimeout = setTimeout(() => {
    if (!isPlaying) return;
    spawnMole();
    scheduleMoleSpawn();
  }, delay);
}

function spawnMole() {
  const available = moleHoles.filter(h => !h.isUp);
  if (available.length === 0) return;

  const hole = available[Math.floor(Math.random() * available.length)];
  const charIndex = Math.floor(Math.random() * CHARACTERS.length);
  hole.mole.src = CHARACTERS[charIndex].src;
  hole.mole.alt = CHARACTERS[charIndex].name;

  hole.isUp = true;
  hole.mole.classList.add('active');
  hole.mole.classList.remove('hit');
  playPopSound();

  const showTime = randomBetween(MOLE_SHOW_MIN, MOLE_SHOW_MAX);
  hole.timeout = setTimeout(() => hideMole(hole), showTime);
}

function hideMole(hole) {
  hole.isUp = false;
  hole.mole.classList.remove('active');
  if (hole.timeout) { clearTimeout(hole.timeout); hole.timeout = null; }
}

function onMoleHit(index) {
  if (!isPlaying) return;
  const hole = moleHoles[index];
  if (!hole.isUp) return;

  score++;
  updateScoreDisplay();
  playHitSound();
  hole.mole.classList.add('hit');

  const rect = hole.el.getBoundingClientRect();
  spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 3);

  setTimeout(() => hideMole(hole), 300);
}

// ===================================================================
//  ゲーム２：キャラキャッチ
// ===================================================================
function startCatchGame() {
  score = 0;
  timeLeft = GAME_DURATION;
  isPlaying = true;
  currentGame = 'catch';

  const area = document.getElementById('catch-area');
  area.innerHTML = '';
  catchFallingChars = [];

  updateScoreDisplay();
  updateTimerBar();
  showScreen('screen-catch');
  startTimer();
  scheduleCatchSpawn();
  startBubbles();
}

function scheduleCatchSpawn() {
  if (!isPlaying) return;
  const delay = randomBetween(CATCH_SPAWN_MIN, CATCH_SPAWN_MAX);
  catchSpawnTimeout = setTimeout(() => {
    if (!isPlaying) return;
    spawnFallingChar();
    scheduleCatchSpawn();
  }, delay);
}

function spawnFallingChar() {
  const area = document.getElementById('catch-area');
  const areaRect = area.getBoundingClientRect();
  const charData = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];

  const img = document.createElement('img');
  img.className = 'falling-char';
  img.src = charData.src;
  img.alt = charData.name;
  img.draggable = false;

  // charサイズ
  const size = Math.min(window.innerWidth * 0.16, 110);
  const maxLeft = areaRect.width - size - 10;
  const startX = 10 + Math.random() * maxLeft;

  img.style.left = startX + 'px';
  img.style.top = '-120px';
  img.style.width = size + 'px';
  img.style.height = size + 'px';

  // ゆらゆらアニメ
  const wobbleAmount = 15 + Math.random() * 20;
  const wobbleDuration = 800 + Math.random() * 600;

  area.appendChild(img);

  const fallDuration = randomBetween(CATCH_FALL_MIN, CATCH_FALL_MAX);
  const endY = areaRect.height + 130;

  // 落下アニメーション
  const fallAnim = img.animate([
    { top: '-120px' },
    { top: endY + 'px' }
  ], {
    duration: fallDuration,
    easing: 'linear',
    fill: 'forwards'
  });

  // ゆらゆら横揺れ
  img.animate([
    { transform: `translateX(0px) rotate(0deg)` },
    { transform: `translateX(-${wobbleAmount}px) rotate(-8deg)` },
    { transform: `translateX(${wobbleAmount}px) rotate(8deg)` },
    { transform: `translateX(0px) rotate(0deg)` }
  ], {
    duration: wobbleDuration,
    iterations: Infinity,
    easing: 'ease-in-out'
  });

  const charObj = { el: img, anim: fallAnim, caught: false };
  catchFallingChars.push(charObj);

  // タッチ処理
  img.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onCatchHit(charObj, e);
  });

  playPopSound();

  // 画面外に出たら削除
  fallAnim.onfinish = () => {
    if (!charObj.caught) {
      img.remove();
      catchFallingChars = catchFallingChars.filter(c => c !== charObj);
    }
  };
}

function onCatchHit(charObj, event) {
  if (!isPlaying || charObj.caught) return;
  charObj.caught = true;

  score++;
  updateScoreDisplay();
  playCatchSound();

  const rect = charObj.el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // キャッチアニメーション
  if (charObj.anim) charObj.anim.pause();
  charObj.el.classList.add('caught');

  spawnParticles(cx, cy);

  setTimeout(() => {
    charObj.el.remove();
    catchFallingChars = catchFallingChars.filter(c => c !== charObj);
  }, 500);
}

// バブル背景エフェクト
function startBubbles() {
  const area = document.getElementById('catch-area');
  catchBubbleInterval = setInterval(() => {
    if (!isPlaying) return;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = 20 + Math.random() * 40;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = Math.random() * 100 + '%';
    bubble.style.bottom = '-50px';

    bubble.animate([
      { transform: 'translateY(0) scale(1)', opacity: 0.5 },
      { transform: `translateY(-${window.innerHeight + 100}px) scale(0.3)`, opacity: 0 }
    ], {
      duration: 3000 + Math.random() * 3000,
      easing: 'ease-out',
      fill: 'forwards'
    });

    area.appendChild(bubble);
    setTimeout(() => bubble.remove(), 6000);
  }, 400);
}

// ===================================================================
//  起動
// ===================================================================
preloadImages();
