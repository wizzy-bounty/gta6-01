// audio.js — all sound in MARISOL BAY is synthesised with WebAudio: engine,
// siren, sea-and-city ambience, UI blips and a success sting. No audio files.
// The context only starts after a real user gesture; in screenshot mode (or
// before the first click) every call is a safe no-op.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenFlip = null;
  }

  /** Call from a click/keydown handler. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.#engine();
      this.#ambience();
    } catch {
      this.ctx = null;
    }
  }

  #engine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  #ambience() {
    // slow warm pad: two detuned triangles through a gentle lowpass
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    [110, 164.8].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(filter);
      o.start();
    });
    filter.connect(gain).connect(this.master);
  }

  /** speedKmh 0..160, inCar whether the player is driving */
  engine(speedKmh, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.05 + Math.min(speedKmh / 160, 1) * 0.05 : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.12);
    this.engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.6, t, 0.1);
  }

  /** Start/stop the two-tone siren; distance 0..60 fades it. */
  siren(on, distance = 20) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.sirenOsc) {
      this.sirenOsc = ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenGain = ctx.createGain();
      this.sirenGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1600;
      this.sirenOsc.connect(filter).connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      let hi = false;
      this.sirenFlip = window.setInterval(() => {
        hi = !hi;
        if (this.sirenOsc) this.sirenOsc.frequency.value = hi ? 960 : 720;
      }, 380);
    }
    if (this.sirenGain) {
      const vol = on ? Math.max(0, 0.055 * (1 - distance / 70)) : 0;
      this.sirenGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.2);
    }
    if (!on && this.sirenOsc) {
      window.clearInterval(this.sirenFlip);
      const osc = this.sirenOsc;
      window.setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 600);
      this.sirenOsc = null;
      this.sirenGain = null;
    }
  }

  blip(freq = 660, dur = 0.07, vol = 0.08) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  sting() {
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => this.blip(f, 0.22, 0.09), i * 90);
    });
  }
}
