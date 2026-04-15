const playToggle = document.getElementById("play-toggle");
const audio = document.getElementById("radio");
const canvas = document.getElementById("spectrometer");
const ctx = canvas.getContext("2d");

const STREAM_URL =
  "https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=dreams-110734.mp3";

let audioContext;
let analyser;
let dataArray;
let sourceNode;
let animationId;

const fallbackOscillators = [];
let fallbackNoise;

function setupAnalyser() {
  if (audioContext) {
    return;
  }

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.82;

  dataArray = new Uint8Array(analyser.frequencyBinCount);

  sourceNode = audioContext.createMediaElementSource(audio);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);
}

function drawSpectrum() {
  const width = canvas.width;
  const height = canvas.height;

  analyser.getByteFrequencyData(dataArray);
  ctx.clearRect(0, 0, width, height);

  const barCount = 20;
  const bucketSize = Math.floor(dataArray.length / barCount);
  const barWidth = 9;
  const gap = 10;
  const totalBarsWidth = barCount * barWidth + (barCount - 1) * gap;
  const startX = (width - totalBarsWidth) / 2;

  for (let i = 0; i < barCount; i += 1) {
    let sum = 0;

    for (let j = 0; j < bucketSize; j += 1) {
      sum += dataArray[i * bucketSize + j];
    }

    const avg = sum / bucketSize;
    const normalized = Math.max(0.08, avg / 255);
    const barHeight = Math.max(8, normalized * (height - 8));
    const x = startX + i * (barWidth + gap);
    const y = height - barHeight;
    const radius = Math.min(6, barWidth / 2);

    ctx.fillStyle = "#1b1c22";
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, radius);
    ctx.fill();
  }

  animationId = requestAnimationFrame(drawSpectrum);
}

function stopFallback() {
  fallbackOscillators.forEach((osc) => {
    try {
      osc.stop();
    } catch {
      // noop
    }
    osc.disconnect();
  });
  fallbackOscillators.length = 0;

  if (fallbackNoise) {
    fallbackNoise.stop();
    fallbackNoise.disconnect();
    fallbackNoise = null;
  }
}

function startFallbackSynth() {
  stopFallback();

  const freqs = [110, 220, 330];
  freqs.forEach((freq) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.06;

    osc.connect(gain);
    gain.connect(analyser);
    osc.start();
    fallbackOscillators.push(osc);
  });

  const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * 0.2;
  }

  const noise = audioContext.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const noiseFilter = audioContext.createBiquadFilter();
  noiseFilter.type = "highpass";
  noiseFilter.frequency.value = 900;

  const noiseGain = audioContext.createGain();
  noiseGain.gain.value = 0.05;

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(analyser);
  noise.start();
  fallbackNoise = noise;
}

async function togglePlayback() {
  setupAnalyser();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  if (!animationId) {
    drawSpectrum();
  }

  if (playToggle.classList.contains("is-playing")) {
    audio.pause();
    stopFallback();
    playToggle.classList.remove("is-playing");
    return;
  }

  audio.src = STREAM_URL;

  try {
    await audio.play();
  } catch {
    startFallbackSynth();
  }

  playToggle.classList.add("is-playing");
}

audio.addEventListener("error", () => {
  if (audioContext) {
    startFallbackSynth();
  }
});

playToggle.addEventListener("click", togglePlayback);
