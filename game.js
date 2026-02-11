/* ===================================================================
   サンリオ もぐらたたき — game.js
   3歳児向け：ゆっくりペース、ゲームオーバーなし、星スコア
   =================================================================== */

// ---- 定数 ----
const CHARACTERS = [
  { name: "キティ", src: "images/mv-hellokitty.png" },
  { name: "シナモロール", src: "images/mv-cinnamon.png" },
  { name: "クロミ", src: "images/list-kuromi.png" },
  { name: "マイメロディ", src: "images/list-mymelody.png" },
  { name: "ポチャッコ", src: "images/list-pochacco.png" },
  { name: "ポムポムプリン", src: "images/list-pompompurin.png" },
];

const HOLE_COUNT = 6;
const GAME_DURATION = 30; // 秒
const SHOW_MIN = 1800; // キャラ表示最短 ms
const SHOW_MAX = 3000; // キャラ表示最長 ms
const SPAWN_MIN = 800; // 次の出現まで最短 ms
const SPAWN_MAX = 1600; // 次の出現まで最長 ms
const PARTICLE_EMOJIS = ["⭐", "🌟", "✨", "💖", "🎀", "🩷", "💗", "🌸"];
const CONFETTI_COLORS = [
  "#FF69B4",
  "#FFD700",
  "#87CEEB",
  "#FF6347",
  "#98FB98",
  "#DDA0DD",
  "#FFA07A",
  "#B0E0E6",
];

// ---- ゲーム状態 ----
let score = 0;
let timeLeft = GAME_DURATION;
let gameInterval = null;
let timerInterval = null;
let spawnTimeout = null;
let isPlaying = false;
let audioCtx = null;
let holes = []; // DOM 参照

// ---- 音声 (Web Audio API) ----
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
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    /* 音声エラーは無視 */
  }
}

function playHitSound() {
  try {
    const ctx = getAudioCtx();
    // きらきら音（3つの音を重ねる）
    const notes = [800, 1000, 1200];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + i * 0.08 + 0.3,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.3);
    });
  } catch (e) {
    /* 音声エラーは無視 */
  }
}

function playCheerSound() {
  try {
    const ctx = getAudioCtx();
    const melody = [523, 659, 784, 1047];
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(
        0.01,
        ctx.currentTime + i * 0.15 + 0.4,
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch (e) {
    /* 音声エラーは無視 */
  }
}

// ---- 初期化 ----
function initBoard() {
  const board = document.getElementById("game-board");
  board.innerHTML = "";
  holes = [];

  for (let i = 0; i < HOLE_COUNT; i++) {
    const hole = document.createElement("div");
    hole.className = "hole";
    hole.dataset.index = i;

    const mask = document.createElement("div");
    mask.className = "hole-mask";

    const mole = document.createElement("img");
    mole.className = "mole";
    mole.src = CHARACTERS[i].src;
    mole.alt = CHARACTERS[i].name;
    mole.draggable = false;

    mask.appendChild(mole);

    const front = document.createElement("div");
    front.className = "hole-front";

    hole.appendChild(mask);
    hole.appendChild(front);

    // タッチ＆クリック
    hole.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onHit(i, e);
    });

    board.appendChild(hole);
    holes.push({ el: hole, mole, isUp: false, timeout: null });
  }
}

// ---- 画像のプリロード ----
function preloadImages() {
  CHARACTERS.forEach((c) => {
    const img = new Image();
    img.src = c.src;
  });
  const bg = new Image();
  bg.src = "images/bg.png";
}

// ---- 画面切り替え ----
function showScreen(id) {
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// ---- ゲーム開始 ----
function startGame() {
  // AudioContext をユーザーインタラクションで初期化
  getAudioCtx();

  score = 0;
  timeLeft = GAME_DURATION;
  isPlaying = true;

  initBoard();
  updateScoreDisplay();
  updateTimerBar();

  showScreen("screen-game");

  // タイマー
  timerInterval = setInterval(() => {
    timeLeft -= 0.1;
    updateTimerBar();
    if (timeLeft <= 0) {
      endGame();
    }
  }, 100);

  // 最初の出現
  scheduleSpawn();
}

// ---- モグラ出現スケジュール ----
function scheduleSpawn() {
  if (!isPlaying) return;
  const delay = randomBetween(SPAWN_MIN, SPAWN_MAX);
  spawnTimeout = setTimeout(() => {
    if (!isPlaying) return;
    spawnMole();
    scheduleSpawn();
  }, delay);
}

function spawnMole() {
  // 出ていない穴から選ぶ
  const available = holes.filter((h) => !h.isUp);
  if (available.length === 0) return;

  const hole = available[Math.floor(Math.random() * available.length)];
  const charIndex = Math.floor(Math.random() * CHARACTERS.length);
  hole.mole.src = CHARACTERS[charIndex].src;
  hole.mole.alt = CHARACTERS[charIndex].name;

  hole.isUp = true;
  hole.mole.classList.add("active");
  hole.mole.classList.remove("hit");
  playPopSound();

  // 一定時間後に引っ込む
  const showTime = randomBetween(SHOW_MIN, SHOW_MAX);
  hole.timeout = setTimeout(() => {
    hideMole(hole);
  }, showTime);
}

function hideMole(hole) {
  hole.isUp = false;
  hole.mole.classList.remove("active");
  if (hole.timeout) {
    clearTimeout(hole.timeout);
    hole.timeout = null;
  }
}

// ---- たたく処理 ----
function onHit(index, event) {
  if (!isPlaying) return;
  const hole = holes[index];
  if (!hole.isUp) return;

  // スコア加算
  score++;
  updateScoreDisplay();

  // 効果音
  playHitSound();

  // スクイッシュアニメ
  hole.mole.classList.add("hit");

  // パーティクル発射
  const rect = hole.el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 3;
  spawnParticles(cx, cy);

  // 引っ込む
  setTimeout(() => {
    hideMole(hole);
  }, 300);
}

// ---- スコア表示 ----
function updateScoreDisplay() {
  const container = document.getElementById("score-stars");
  // 星の数を更新（最大20個表示、それ以降は数字）
  if (score <= 20) {
    container.innerHTML = "";
    for (let i = 0; i < score; i++) {
      const star = document.createElement("span");
      star.className = "score-star";
      star.textContent = "⭐";
      container.appendChild(star);
    }
  } else {
    container.innerHTML = `<span class="score-star" style="font-size:1.6rem;">⭐×${score}</span>`;
  }
}

// ---- タイマー ----
function updateTimerBar() {
  const bar = document.getElementById("timer-bar");
  const pct = Math.max(0, (timeLeft / GAME_DURATION) * 100);
  bar.style.width = pct + "%";

  // 残り少ないとき色変更
  if (pct < 20) {
    bar.style.background = "linear-gradient(90deg, #FF6B6B, #FF1493)";
  }
}

// ---- ゲーム終了 ----
function endGame() {
  isPlaying = false;
  clearInterval(timerInterval);
  clearTimeout(spawnTimeout);
  holes.forEach((h) => hideMole(h));

  // 少し待ってからリザルト表示
  setTimeout(() => {
    showResult();
  }, 600);
}

// ---- リザルト ----
function showResult() {
  // 星表示
  const starsEl = document.getElementById("result-stars");
  const displayCount = Math.min(score, 15);
  let starsHTML = "";
  for (let i = 0; i < displayCount; i++) {
    starsHTML += "⭐";
  }
  if (score > 15) {
    starsHTML += ` ×${score}`;
  }
  starsEl.textContent = starsHTML;

  // メッセージ
  const msgEl = document.getElementById("result-message");
  if (score >= 15) {
    msgEl.textContent = "てんさい！！🎊";
  } else if (score >= 10) {
    msgEl.textContent = "すごーい！💖";
  } else if (score >= 5) {
    msgEl.textContent = "じょうずだね！🌟";
  } else {
    msgEl.textContent = "たのしかったね！🎀";
  }

  showScreen("screen-result");
  playCheerSound();
  spawnConfetti();
}

// ---- リスタート ----
function restartGame() {
  // 紙吹雪クリア
  document.getElementById("confetti").innerHTML = "";
  startGame();
}

// ---- パーティクル ----
function spawnParticles(x, y) {
  const container = document.getElementById("particles");
  const count = 8;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.textContent =
      PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)];

    const angle = ((Math.PI * 2) / count) * i + (Math.random() - 0.5) * 0.5;
    const dist = 40 + Math.random() * 60;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 30; // 上に飛ばす
    const rot = (Math.random() - 0.5) * 720;

    p.style.left = x + "px";
    p.style.top = y + "px";
    p.style.setProperty("--tx", tx + "px");
    p.style.setProperty("--ty", ty + "px");
    p.style.setProperty("--rot", rot + "deg");

    container.appendChild(p);

    // アニメ後に削除
    setTimeout(() => p.remove(), 900);
  }
}

// ---- 紙吹雪 ----
function spawnConfetti() {
  const container = document.getElementById("confetti");
  const count = 60;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.backgroundColor =
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
      piece.style.width = 6 + Math.random() * 10 + "px";
      piece.style.height = 6 + Math.random() * 10 + "px";
      piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
      piece.style.setProperty("--drift", (Math.random() - 0.5) * 200 + "px");
      piece.style.setProperty("--spin", Math.random() * 720 + "deg");
      piece.style.animationDuration = 2 + Math.random() * 2 + "s";
      piece.style.top = "-20px";

      // アニメーション: 上から下へ落ちる
      piece.animate(
        [
          { top: "-20px", opacity: 1 },
          { top: "110vh", opacity: 0.5 },
        ],
        {
          duration: 2000 + Math.random() * 2000,
          easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          fill: "forwards",
        },
      );

      container.appendChild(piece);
      setTimeout(() => piece.remove(), 5000);
    }, i * 50);
  }
}

// ---- ユーティリティ ----
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- 起動 ----
preloadImages();
