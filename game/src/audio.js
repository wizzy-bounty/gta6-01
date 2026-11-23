// audio.js — a pocket WebAudio synth: engine hum, siren wail, radio
// crackle and UI blips, all generated. No audio files, nothing fetched.

export class SoundKit {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.enabled = false;
  }

  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.enabled = true;
    // engine: a low saw through a soft gain, pitch follows speed
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(engineFilter).connect(this.engineGain).connect(this.ctx.destination);
    this.engineOsc.start();
    // siren: a slow LFO sweeping a triangle between two notes
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 800;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.0;
    this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
    this.sirenOsc.start(); lfo.start();
  }

  setEngine(speedRatio, driving) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(driving ? 0.05 : 0.012, t, 0.1);
  }

  setSiren(on, near = 1) {
    if (!this.enabled) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.016 * near : 0.0, this.ctx.currentTime, 0.2);
  }

  blip(freq = 660, dur = 0.07, gain = 0.04) {
    if (!this.enabled) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square'; osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  }

  cashRegister() { this.blip(880, 0.08); setTimeout(() => this.blip(1320, 0.12), 70); }
}
