// audio.js — every sound in SOLMAR HEAT is synthesized with WebAudio, no audio files.
// Continuous voices (engine, siren, radio) are long-lived nodes whose parameters the
// game nudges each frame; one-shot sounds (crashes, shots, jingles) are built, played
// and thrown away. The car radio has two stations with their own little step
// sequencers: Solmar FM plays slow mellow chords, Neon Drive FM a faster synth arp.

let ctx = null;
let master = null;
let engineNodes = null;
let sirenNodes = null;
let radioNodes = null;
let radioTimer = 0;
let radioStep = 0;
let currentStation = 0; // 0 off, 1 Solmar FM, 2 Neon Drive FM

const STATION_NAMES = ['', 'Solmar FM', 'Neon Drive FM'];

export function stationName(n) {
  return STATION_NAMES[n] || '';
}

function ensureContext() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  return true;
}

export function initAudio() {
  if (!ensureContext()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

function makeEngine() {
  const oscA = ctx.createOscillator();
  oscA.type = 'sawtooth';
  const oscB = ctx.createOscillator();
  oscB.type = 'square';
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 2;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  oscA.start();
  oscB.start();
  return { oscA, oscB, filter, gain };
}

function makeSiren() {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 800;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(master);
  osc.start();
  return { osc, gain, phase: 0 };
}

// engine(rpm, load): rpm 0..1 from the driven car; silent when on foot.
export function updateEngine(rpm, active) {
  if (!ctx) return;
  if (!engineNodes) engineNodes = makeEngine();
  const t = ctx.currentTime;
  const target = active ? 0.05 + rpm * 0.05 : 0;
  engineNodes.gain.gain.setTargetAtTime(target, t, 0.08);
  const base = 55 + rpm * 165;
  engineNodes.oscA.frequency.setTargetAtTime(base, t, 0.05);
  engineNodes.oscB.frequency.setTargetAtTime(base * 0.5 + 2, t, 0.05);
  engineNodes.filter.frequency.setTargetAtTime(300 + rpm * 1400, t, 0.08);
}

// updateSiren(nearness): 0..1, loudest when a police car is close.
export function updateSiren(nearness, elapsed) {
  if (!ctx) return;
  if (!sirenNodes) sirenNodes = makeSiren();
  const t = ctx.currentTime;
  sirenNodes.gain.gain.setTargetAtTime(nearness * 0.045, t, 0.1);
  if (nearness > 0.01) {
    sirenNodes.osc.frequency.setTargetAtTime(750 + Math.sin(elapsed * 5.2) * 190, t, 0.03);
  }
}

function noiseBuffer() {
  const len = ctx.sampleRate * 0.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

let sharedNoise = null;
function burst({ dur = 0.15, freq = 1000, type = 'lowpass', gain = 0.3, sweepTo = null }) {
  if (!ctx) return;
  if (!sharedNoise) sharedNoise = noiseBuffer();
  const src = ctx.createBufferSource();
  src.buffer = sharedNoise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start();
  src.stop(ctx.currentTime + dur + 0.02);
}

function tone({ freq = 440, dur = 0.15, type = 'sine', gain = 0.2, at = 0, slideTo = null }) {
  if (!ctx) return;
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

export function playCrash(intensity) {
  burst({ dur: 0.22 + intensity * 0.2, freq: 900, gain: 0.25 + intensity * 0.4, sweepTo: 120 });
  tone({ freq: 90, dur: 0.25, type: 'sine', gain: 0.3 * intensity, slideTo: 40 });
}

export function playShot() {
  burst({ dur: 0.11, freq: 3200, type: 'highpass', gain: 0.32 });
  tone({ freq: 160, dur: 0.08, type: 'square', gain: 0.12, slideTo: 60 });
}

export function playPunch() {
  tone({ freq: 120, dur: 0.1, type: 'sine', gain: 0.3, slideTo: 50 });
  burst({ dur: 0.06, freq: 700, gain: 0.12 });
}

export function playHit() {
  tone({ freq: 220, dur: 0.08, type: 'square', gain: 0.14, slideTo: 110 });
}

export function playPickup() {
  tone({ freq: 660, dur: 0.09, type: 'triangle', gain: 0.22 });
  tone({ freq: 990, dur: 0.14, type: 'triangle', gain: 0.22, at: 0.08 });
}

export function playSuccess() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.2, at: i * 0.09 }));
}

export function playFail() {
  tone({ freq: 392, dur: 0.25, type: 'triangle', gain: 0.2 });
  tone({ freq: 311, dur: 0.25, type: 'triangle', gain: 0.2, at: 0.2 });
  tone({ freq: 233, dur: 0.45, type: 'triangle', gain: 0.2, at: 0.4 });
}

export function playUiClick() {
  tone({ freq: 840, dur: 0.05, type: 'square', gain: 0.08 });
}

export function playDoor() {
  tone({ freq: 180, dur: 0.07, type: 'square', gain: 0.16, slideTo: 90 });
  tone({ freq: 140, dur: 0.06, type: 'square', gain: 0.12, at: 0.09, slideTo: 80 });
}

// --- radio -----------------------------------------------------------------
// A tiny lookahead sequencer: every frame the game calls updateRadio(dt);
// notes are scheduled a step at a time from the station's pattern tables.

const FM_CHORDS = [
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 349.23], // Fmaj7
  [196.0, 246.94, 293.66, 392.0], // G add
  [164.81, 220.0, 261.63, 329.63], // Am / E bass colour
];
const NEON_BASS = [55, 55, 82.4, 55, 65.4, 55, 98, 73.4];
const NEON_LEAD = [440, 0, 523.25, 0, 659.25, 0, 523.25, 392];

function radioGainNode() {
  if (!radioNodes) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    radioNodes = { gain };
  }
  return radioNodes.gain;
}

export function setRadio(station) {
  currentStation = station;
  radioStep = 0;
  radioTimer = 0;
  if (!ctx) return;
  const g = radioGainNode();
  g.gain.setTargetAtTime(station > 0 ? 0.16 : 0, ctx.currentTime, 0.15);
}

export function getRadioStation() {
  return currentStation;
}

export function cycleRadio() {
  const next = (currentStation + 1) % 3;
  setRadio(next);
  return next;
}

export function updateRadio(dt) {
  if (!ctx || currentStation === 0) return;
  radioTimer -= dt;
  if (radioTimer > 0) return;
  if (currentStation === 1) {
    // Solmar FM: one soft chord every two seconds.
    radioTimer = 2.0;
    const chord = FM_CHORDS[radioStep % FM_CHORDS.length];
    radioStep++;
    for (const f of chord) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 0.3);
      g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 1.9);
      osc.connect(g);
      g.connect(radioGainNode());
      osc.start();
      osc.stop(ctx.currentTime + 2.0);
    }
  } else {
    // Neon Drive FM: driving eighth-note bass + lead at 132 BPM.
    radioTimer = 60 / 132 / 2;
    const i = radioStep % 8;
    radioStep++;
    const bass = NEON_BASS[i];
    if (bass) tone({ freq: bass, dur: 0.16, type: 'sawtooth', gain: 0.1 });
    const lead = NEON_LEAD[i];
    if (lead) tone({ freq: lead, dur: 0.12, type: 'square', gain: 0.045 });
    if (i % 2 === 0) burst({ dur: 0.03, freq: 6000, type: 'highpass', gain: 0.03 });
  }
}

export function stopAllVoices() {
  if (!ctx) return;
  if (engineNodes) engineNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  if (sirenNodes) sirenNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
  if (radioNodes) radioNodes.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}
