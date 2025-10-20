/* Hydrohomies HQ — game script
   Implements: scoring, hazards, timer, pause/resume, mute, keyboard/touch, accessibility, localStorage highscore
*/

const scoreEl = document.getElementById('score');
const highEl = document.getElementById('highscore');
const game = document.getElementById('game');
const resetBtn = document.getElementById('resetBtn');
const pauseBtn = document.getElementById('pauseBtn');
const muteBtn = document.getElementById('muteBtn');
const timerEl = document.getElementById('timer');
const banner = document.getElementById('banner');

let score = 0;
let highscore = Number(localStorage.getItem('hh_high') || 0);
let muted = localStorage.getItem('hh_muted') === '1';
let gameState = 'running'; // running, paused, finished

highEl.textContent = highscore;

const CONFIG = {
  // defaults (Normal)
  sessionSeconds: 30,
  goalScore: 25,
  initialSpawnMs: 600,
  minSpawnMs: 250,
  spawnRampRate: 0.98, // multiplies spawn interval every Xms
  spawnRampIntervalMs: 5000,
  hazardChance: 0.12,
  badChance: 0.25,
  goodPoints: 1,
  badPoints: -2,
  hazardPoints: -4,
};

let remaining = CONFIG.sessionSeconds;
let spawnInterval = CONFIG.initialSpawnMs;
let lastSpawn = 0;
let lastRamp = 0;
let rafId = null;

// Difficulty modes
const MODES = {
  Easy: { sessionSeconds: 45, goalScore: 15, initialSpawnMs: 800 },
  Normal: { sessionSeconds: 30, goalScore: 25, initialSpawnMs: 600 },
  Hard: { sessionSeconds: 25, goalScore: 35, initialSpawnMs: 420 },
};
let currentMode = localStorage.getItem('hh_mode') || 'Normal';

// Milestones
const MILESTONES = [5, 10, 15, 20, 25, 30, 35];
const MESSAGES = [
  'Every drop counts!',
  'Clean water is life.',
  'Communities thrive with access.',
  'Small actions, big impact.',
  'Thank you for caring!',
  'You are making waves!',
  'Keep it up — share the love!'
];
let seenMilestones = new Set();

// Audio: lightweight WebAudio synth (no external files)
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let activeVoices = 0;
const MAX_VOICES = 4;

function ensureAudio() {
  if (!audioCtx && AudioCtx) audioCtx = new AudioCtx();
}

function playTone(freq, duration = 0.08, type = 'sine') {
  if (muted) return;
  if (!AudioCtx) return; // not supported
  ensureAudio();
  if (activeVoices >= MAX_VOICES) return;
  activeVoices++;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  o.start(now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  o.stop(now + duration + 0.02);
  o.onended = () => { activeVoices = Math.max(0, activeVoices - 1); };
}

function playChord(notes = [440,660,880], dur = 0.12) {
  if (muted) return;
  ensureAudio();
  notes.forEach((n, i) => setTimeout(() => playTone(n, dur, 'sine'), i * 80));
}

// Audio
const audio = {
  good: null,
  bad: null,
};
function safeLoadAudio() {
  try {
    audio.good = new Audio();
    audio.good.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='; // tiny silent placeholder
    audio.bad = new Audio();
    audio.bad.src =
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    audio.good.volume = 0.6;
    audio.bad.volume = 0.6;
  } catch (e) {
    /* ignore */
  }
}
safeLoadAudio();

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function announce(msg, timeout = 1500) {
  banner.textContent = msg;
  banner.hidden = false;
  clearTimeout(banner._t);
  banner._t = setTimeout(() => {
    banner.hidden = true;
  }, timeout);
}

function updateScore(delta) {
  score += delta;
  if (score < -999) score = -999; // clamp
  scoreEl.textContent = score;
  // announce via aria-live already set on score
  // confetti every 10 points
  if (score > 0 && score % 10 === 0) triggerConfetti();
  // milestone check
  if (MILESTONES.includes(score) && !seenMilestones.has(score)) {
    seenMilestones.add(score);
    const msg = MESSAGES[Math.min(MESSAGES.length - 1, MILESTONES.indexOf(score))] || 'Milestone!';
    // respects prefers-reduced-motion via CSS
    announce(msg, 2000);
  }
  if (score > highscore) {
    highscore = score;
    localStorage.setItem('hh_high', String(highscore));
    highEl.textContent = highscore;
  }
}

function createDrop(type) {
  const d = document.createElement('button');
  d.className = `drop ${type}`;
  d.setAttribute(
    'aria-label',
    type === 'good' ? 'Good drop' : type === 'bad' ? 'Bad drop' : 'Hazard drop'
  );
  d.innerText = type === 'good' ? '💧' : type === 'bad' ? '💧' : '☣️';
  // position
  d.style.left = `${rand(6, 94)}%`;
  const travel = rand(3500, 7000);
  d.dataset.travel = travel;
  d.dataset.start = Date.now();

  // Expose a helper for automated tests to create drops from outside
  try { window.createTestDrop = (type) => createDrop(type); } catch (e) {}

  // Test API: allow tests to trigger hits directly (avoids viewport/click flakiness)
  try{
    window.__hh_test = {
      hit(type){
        if (type === 'good') updateScore(CONFIG.goodPoints);
        else if (type === 'bad') updateScore(CONFIG.badPoints);
        else if (type === 'hazard') updateScore(CONFIG.hazardPoints);
        return score;
      },
      reset(){ resetGame(); }
    };
  }catch(e){}

  // click or touch with micro-animation and SFX
  d.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gameState !== 'running') return;
    // micro-animation: scale & rotate briefly
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.style.transition = 'transform 160ms ease-out';
      d.style.transform += ' scale(1.08) rotate(8deg)';
    }
    setTimeout(() => {
      // remove after micro-animation
      d.remove();
    }, 170);

    if (type === 'good') {
      // soft ping
      playTone(660, 0.08, 'sine');
      updateScore(CONFIG.goodPoints);
    } else if (type === 'bad') {
      // lower thud
      playTone(220, 0.12, 'sine');
      updateScore(CONFIG.badPoints);
    } else {
      // hazard
      playTone(220, 0.12, 'sine');
      updateScore(CONFIG.hazardPoints);
      announce('Ouch — hazard!');
    }
  });

  // remove on end using rAF loop
  game.appendChild(d);
  return d;
}

function triggerConfetti() {
  const pieces = 18;
  const emojis = ['🎉', '✨', '💧', '⭐'];
  for (let i = 0; i < pieces; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.textContent = emojis[rand(0, emojis.length - 1)];
    c.style.left = `${rand(5, 95)}%`;
    c.style.top = `${rand(5, 35)}%`;
    c.style.setProperty('--dx', `${rand(-120, 120)}px`);
    c.style.setProperty('--dy', `${rand(60, 180)}px`);
    game.appendChild(c);
    setTimeout(() => c.remove(), 1000);
  }
}

function spawnIfNeeded(now) {
  if (gameState !== 'running') return;
  if (now - lastSpawn > spawnInterval) {
    lastSpawn = now;
    // decide type
    const r = Math.random();
    if (r < CONFIG.hazardChance) createDrop('hazard');
    else if (r < CONFIG.hazardChance + CONFIG.badChance) createDrop('bad');
    else createDrop('good');
  }
}

function rampDifficulty(now) {
  if (now - lastRamp > CONFIG.spawnRampIntervalMs) {
    lastRamp = now;
    spawnInterval = Math.max(CONFIG.minSpawnMs, spawnInterval * CONFIG.spawnRampRate);
  }
}

function animationLoop(now) {
  spawnIfNeeded(now);
  rampDifficulty(now);

  // move drops using transform to avoid layout thrash
  const drops = game.querySelectorAll('.drop');
  drops.forEach((d) => {
    const start = Number(d.dataset.start) || Date.now();
    const travel = Number(d.dataset.travel) || 5000;
    const t = (now - start) / travel; // 0..1
    const y = Math.min(1, t) * (window.innerHeight + 120);
    d.style.transform = `translateY(${y}px)`;
    if (t >= 1) d.remove();
  });

  // confetti also handled by CSS animation

  rafId = requestAnimationFrame(animationLoop);
}

function startGame() {
  stopGame();
  score = 0;
  scoreEl.textContent = score;
  // apply current mode parameters
  const modeCfg = MODES[currentMode] || MODES.Normal;
  CONFIG.sessionSeconds = modeCfg.sessionSeconds;
  CONFIG.goalScore = modeCfg.goalScore;
  CONFIG.initialSpawnMs = modeCfg.initialSpawnMs;

  remaining = CONFIG.sessionSeconds;
  timerEl.textContent = remaining;
  spawnInterval = CONFIG.initialSpawnMs;
  lastSpawn = performance.now();
  lastRamp = performance.now();
  gameState = 'running';
  rafId = requestAnimationFrame(animationLoop);
  tickTimer();
}

function stopGame() {
  gameState = 'paused';
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  clearInterval(stopGame._timer);
}

function tickTimer() {
  clearInterval(stopGame._timer);
  stopGame._timer = setInterval(() => {
    if (gameState !== 'running') return;
    remaining -= 1;
    timerEl.textContent = remaining;
    if (remaining <= 0) {
      finishGame();
    }
  }, 1000);
}

function finishGame() {
  stopGame();
  gameState = 'finished';
  announce(score >= CONFIG.goalScore ? 'You win! 🎉' : 'Time up — try again');
  if (score >= CONFIG.goalScore) triggerConfetti();
}

function resetGame() {
  // clear DOM drops and confetti
  game.querySelectorAll('.drop, .confetti').forEach((n) => n.remove());
  // clear milestones for the round
  seenMilestones.clear();
  startGame();
}

function togglePause() {
  if (gameState === 'running') {
    stopGame();
    pauseBtn.setAttribute('aria-pressed', 'true');
    pauseBtn.textContent = 'Resume';
  } else if (gameState === 'paused') {
    gameState = 'running';
    pauseBtn.setAttribute('aria-pressed', 'false');
    pauseBtn.textContent = 'Pause';
    rafId = requestAnimationFrame(animationLoop);
    tickTimer();
  } else if (gameState === 'finished') {
    startGame();
    pauseBtn.setAttribute('aria-pressed', 'false');
    pauseBtn.textContent = 'Pause';
  }
}

function toggleMute() {
  muted = !muted;
  muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  muteBtn.textContent = muted ? 'Unmute' : 'Mute';
  localStorage.setItem('hh_muted', muted ? '1' : '0');
}

// keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault(); /* spawn gentle click in center to simulate tap: find a drop under center? skip for now */
  }
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'r' || e.key === 'R') resetGame();
});

// init buttons
resetBtn.addEventListener('click', resetGame);
pauseBtn.addEventListener('click', togglePause);
muteBtn.addEventListener('click', toggleMute);

// init mute state UI
muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
muteBtn.textContent = muted ? 'Unmute' : 'Mute';

// touch: taps already handled by button click events on drops

// start
// wire mode selector UI
const modeSelect = document.getElementById('modeSelect');
const modeLabel = document.getElementById('modeLabel');
if (modeSelect) {
  modeSelect.value = currentMode;
  modeLabel.textContent = currentMode;
  modeSelect.addEventListener('change', (e) => {
    currentMode = e.target.value;
    localStorage.setItem('hh_mode', currentMode);
    if (modeLabel) modeLabel.textContent = currentMode;
    // apply immediately by resetting round
    resetGame();
  });
}

// play win arpeggio helper
function playWinArpeggio() {
  if (muted) return;
  playChord([660, 880, 990], 0.12);
}

// update finish behavior to play arpeggio
const origFinish = finishGame;
finishGame = function() {
  origFinish();
  if (score >= CONFIG.goalScore) playWinArpeggio();
};

startGame();
