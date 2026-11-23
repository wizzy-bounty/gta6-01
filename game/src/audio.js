// MARISOL BAY — synthesized sound. No audio files: every effect is an
// oscillator or a noise burst through the Web Audio API.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
    }
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  blip(freq, dur, type = 'sine', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }

  pickup() { this.blip(880, 0.12, 'sine', 0.14); setTimeout(() => this.blip(1318, 0.16, 'sine', 0.12), 90); }
  steal() { this.blip(220, 0.18, 'square', 0.1); setTimeout(() => this.blip(165, 0.22, 'square', 0.1), 120); }
  crash() { this.noise(0.25, 0.22); }
  shot() { this.noise(0.09, 0.2); this.blip(160, 0.08, 'square', 0.12); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.14), i * 110)); }

  noise(dur, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  setEngine(rpm) {
    if (!this.ctx || this.muted) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(48 + rpm * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.028 + rpm * 0.03, t, 0.1);
  }

  stopEngine() {
    if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      const g = this.ctx.createGain();
      g.gain.value = 0.02;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.8;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 320;
      lfo.connect(lfoGain).connect(this.sirenOsc.frequency);
      this.sirenOsc.frequency.value = 950;
      this.sirenOsc.connect(g).connect(this.ctx.destination);
      this.sirenOsc.start();
      lfo.start();
      this._sirenLfo = lfo;
      this._sirenGain = g;
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.stop(); this._sirenLfo.stop(); } catch (e) {}
      this.sirenOsc = null;
    }
  }
}
