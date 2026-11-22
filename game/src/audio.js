// audio.js — every sound in NEON TIDE is synthesized with WebAudio: engine,
// sirens, gunshots, rain, UI blips and a small bass-loop music sequencer.
// No audio files, nothing to load. The engine starts on the first user
// gesture (browser autoplay policy) and degrades silently if audio is off.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.step = 0;
  }

  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.#startRain();
    this.#startMusic();
  }

  // Looping filtered noise = rain on neon streets.
  #startRain() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer; src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 900; filter.Q.value = 0.4;
    const gain = ctx.createGain(); gain.gain.value = 0.035;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  // A moody four-bar synthwave bass loop, scheduled one note at a time.
  #startMusic() {
    const bass = [55, 55, 65.4, 55, 49, 49, 73.4, 82.4]; // A1 A1 C2 A1 G1 G1 D2 E2
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const f = bass[this.step % bass.length];
      this.step++;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.value = f;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass'; flt.frequency.value = 320;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(flt).connect(g).connect(this.master);
      osc.start(t); osc.stop(t + 0.45);
    }, 460);
  }

  // Continuous engine tone while driving; pitch follows speed.
  setEngine(on, speedRatio = 0) {
    if (!this.ctx) return;
    if (on && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'triangle';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      const target = on ? 0.05 + speedRatio * 0.05 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, this.ctx.currentTime, 0.08);
    }
  }

  // Police siren: a wailing oscillator that exists only while wanted.
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.016;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.55;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 160;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 760;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start(); lfo.start();
      this.sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this.sirenLfo?.stop(); } catch { /* already stopped */ }
      this.sirenOsc = null; this.sirenLfo = null;
    }
  }

  #blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  #noiseBurst(dur, vol, freq) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(flt).connect(g).connect(this.master);
    src.start(t);
  }

  shot(kind) { this.#noiseBurst(kind === 'smg' ? 0.07 : 0.13, 0.22, kind === 'smg' ? 2600 : 1500); this.#blip(140, 0.06, 'square', 0.06, -70); }
  melee() { this.#noiseBurst(0.08, 0.15, 700); }
  hit() { this.#blip(180, 0.12, 'sawtooth', 0.14, -90); }
  hurt() { this.#blip(110, 0.2, 'sawtooth', 0.16, -50); }
  cash() { this.#blip(880, 0.09, 'square', 0.1); setTimeout(() => this.#blip(1320, 0.14, 'square', 0.1), 70); }
  missionDone() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.#blip(f, 0.16, 'triangle', 0.13), i * 90)); }
  crime() { this.#blip(220, 0.1, 'square', 0.07, -40); }
  select() { this.#blip(660, 0.06, 'square', 0.08); }
  denied() { this.#blip(160, 0.15, 'square', 0.1, -40); }
}
