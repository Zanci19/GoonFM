const audio = document.getElementById("audio");
const playBtn = document.getElementById("play-btn");
const volumeSlider = document.getElementById("volume-slider");
const progressBar = document.getElementById("progress-bar");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const statusDot = document.getElementById("player-status");
const heroStatus = document.getElementById("hero-status");
const streamInput = document.getElementById("stream-url");
const connectBtn = document.getElementById("connect-btn");
const fallbackBtn = document.getElementById("fallback-btn");
const toastEl = document.getElementById("toast");
const ticker = document.getElementById("ticker");
const trackTitle = document.getElementById("track-title");

const fallbackStream = "assets/goon-tone.wav";
let liveStream = "";
let usingLive = false;
let tickerInterval;

const playlist = [
  "Goon Anthem (Demo Loop)",
  "Meme Machine Rework",
  "Wobble Wub (Goon Edit)",
  "Lo-Fi Goonrise",
  "After Dark Drift",
];

const tickers = [
  "Stay gooned. Stay tuned. Drink water.",
  "Tip: paste your Icecast URL and hit “Use live stream.”",
  "If playback fails, check CORS on your stream server.",
  "GoonFM is browser-native — no installs needed.",
  "Fallback tone keeps the vibe alive while you prep.",
];

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function setStatus(text, color = "") {
  statusDot.textContent = text;
  heroStatus.textContent = text;
  if (color) {
    statusDot.style.background = color;
  }
}

function formatTime(seconds) {
  if (!isFinite(seconds)) return "∞";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(1, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function setTicker(text) {
  ticker.innerHTML = `<span>${text} • ${text}</span>`;
}

function rotatePlaylist() {
  let i = 0;
  setTicker(tickers[i % tickers.length]);
  tickerInterval = setInterval(() => {
    i = (i + 1) % tickers.length;
    setTicker(tickers[i]);
    trackTitle.textContent = playlist[i % playlist.length];
  }, 8000);
}

function setAudioSource(src, label) {
  audio.pause();
  audio.src = src;
  audio.load();
  audio.play().catch(() => {
    setStatus("Ready", "rgba(255,255,255,0.08)");
  });
  setStatus(label, usingLive ? "rgba(10,255,157,0.2)" : "rgba(255,255,255,0.08)");
}

function connectLive() {
  const value = streamInput.value.trim();
  if (!value) {
    showToast("Enter a stream URL first.");
    return;
  }
  liveStream = value;
  usingLive = true;
  setAudioSource(liveStream, "Connecting…");
  showToast("Connecting to live stream…");
}

function useFallback() {
  usingLive = false;
  setAudioSource(fallbackStream, "Fallback tone");
  showToast("Fallback tone loaded.");
}

function togglePlay() {
  if (!audio.src) {
    useFallback();
  }

  if (audio.paused) {
    audio
      .play()
      .then(() => {
        playBtn.textContent = "Pause";
        setStatus(usingLive ? "Live" : "Fallback tone", usingLive ? "rgba(10,255,157,0.2)" : "");
      })
      .catch((err) => {
        console.error("Playback failed", err);
        showToast("Playback blocked — click again to allow audio.");
      });
  } else {
    audio.pause();
    playBtn.textContent = "Play";
    setStatus("Paused");
  }
}

function setVolume(value) {
  audio.volume = value / 100;
}

function updateProgress() {
  if (!audio.duration) return;
  if (!isFinite(audio.duration)) {
    progressBar.style.width = "0%";
    currentTimeEl.textContent = formatTime(audio.currentTime);
    durationEl.textContent = "∞";
    return;
  }
  const percent = (audio.currentTime / audio.duration) * 100;
  progressBar.style.width = `${percent}%`;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  durationEl.textContent = formatTime(audio.duration);
}

function attachEvents() {
  playBtn.addEventListener("click", togglePlay);
  connectBtn.addEventListener("click", connectLive);
  fallbackBtn.addEventListener("click", useFallback);
  volumeSlider.addEventListener("input", (e) => setVolume(Number(e.target.value)));

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", () => {
    durationEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener("playing", () => {
    playBtn.textContent = "Pause";
    setStatus(usingLive ? "Live" : "Fallback tone", usingLive ? "rgba(10,255,157,0.2)" : "");
  });

  audio.addEventListener("pause", () => {
    playBtn.textContent = "Play";
    setStatus("Paused");
  });

  audio.addEventListener("error", () => {
    setStatus("Playback error", "rgba(255,124,227,0.25)");
    showToast("Stream failed — check URL/CORS. Reverting to fallback.");
    useFallback();
  });
}

function init() {
  setVolume(Number(volumeSlider.value));
  useFallback();
  rotatePlaylist();
  attachEvents();
}

init();