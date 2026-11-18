// audio.js — synthesized WebAudio sound for SOLMAR HEAT.
// No audio files: engine hum, police sirens, gunshots, punches, mission
// chimes and a looping bass-and-hats groove are all built from oscillators
// and filtered noise. Everything is guarded so the game runs fine when
// audio is unavailable (headless screenshots, muted browsers).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.musicStep = 0;
    this.musicTimer = 0;
    this._noiseBuffer = null;
  }

  /** Create the context. Must be called from a user gesture (Start click). */
  init() {
    if (this.ctx) { this.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const data = this._noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this._startEngine();
      this._startSiren();
    } catch { this.ctx = null; }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.ctx.suspend().catch(() => {});
    if (!muted) this.resume();
  }

  _startEngine() {
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
  }

  _startSiren() {
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 750;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
    this.sirenOsc.start();
  }

  /** Per-frame update: engine pitch by speed, siren wail by wanted level, music step. */
  update(dt, speed, wanted, driving) {
    if (!this.ctx || this.muted) return;
    if (this.engineGain) {
      const target = driving ? 0.05 + Math.min(0.09, speed * 0.0035) : 0.015;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(48 + speed * 2.6, this.ctx.currentTime, 0.08);
    }
    if (this.sirenGain) {
      if (wanted > 0) {
        this.sirenTimer += dt;
        const f = Math.sin(this.sirenTimer * 2.4) > 0 ? 950 : 700;
        this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
        this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      }
    }
    this._musicTick(dt);
  }

  _musicTick(dt) {
    // A laid-back coastal groove: root notes + hats, 100 BPM, 8 steps a bar.
    this.musicTimer += dt;
    const stepDur = 60 / 100 / 2;
    while (this.musicTimer >= stepDur) {
      this.musicTimer -= stepDur;
      this.musicStep = (this.musicStep + 1) % 32;
      const bassLine = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0,
        55, 0, 55, 0, 65.4, 0, 55, 0, 73.4, 0, 65.4, 0, 58.3, 0, 49, 0];
      const note = bassLine[this.musicStep];
      if (note > 0) this._blip(note, stepDur * 0.9, 'triangle', 0.05);
      if (this.musicStep % 2 === 0) this._hat();
    }
  }

  _blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type; osc.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  }

  _hat() {
    if (!this.ctx || !this._noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.02, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(); src.stop(this.ctx.currentTime + 0.06);
  }

  gunshot() {
    if (!this.ctx || this.muted || !this._noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(); src.stop(this.ctx.currentTime + 0.15);
  }

  punch() {
    if (!this.ctx || this.muted) return;
    this._blip(90, 0.12, 'sine', 0.25);
  }

  chime() {
    if (!this.ctx || this.muted) return;
    this._blip(660, 0.18, 'sine', 0.12);
    setTimeout(() => this._blip(880, 0.25, 'sine', 0.12), 140);
    setTimeout(() => this._blip(1320, 0.3, 'sine', 0.1), 280);
  }

  steal() {
    if (!this.ctx || this.muted) return;
    this._blip(220, 0.1, 'square', 0.06);
    setTimeout(() => this._blip(330, 0.12, 'square', 0.06), 90);
  }
}
