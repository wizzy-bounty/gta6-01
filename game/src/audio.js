// audio.js — all sound is synthesized with WebAudio: engine hum, sirens,
// gunshots, punches, UI blips, and a looping synthwave bassline.
// Nothing is loaded from disk; everything is oscillators + noise.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.started = false;
  }

  // Must be called from a user gesture (the start button).
  init() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this.startEngine();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  startEngine() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  // speed 0..1 of top speed; 0 when on foot.
  setEngine(speedNorm, inCar) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.05 + speedNorm * 0.10 : 0.0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 130, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(320 + speedNorm * 900, t, 0.1);
  }

  startSiren() {
    if (!this.ctx || this.sirenOsc) return;
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.type = 'square';
    this.sirenLfo.frequency.value = 1.4;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 240;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0.035;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  stopSiren() {
    if (!this.sirenOsc) return;
    try {
      this.sirenOsc.stop();
      this.sirenLfo.stop();
    } catch { /* already stopped */ }
    this.sirenOsc = null;
    this.sirenLfo = null;
    this.sirenGain = null;
  }

  blip(freq = 660, dur = 0.08, type = 'sine', vol = 0.12) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  gunshot() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const dur = 0.16;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  punch() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 0.15);
  }

  cash() {
    this.blip(880, 0.09, 'sine', 0.14);
    setTimeout(() => this.blip(1320, 0.14, 'sine', 0.14), 90);
  }

  // A moody synthwave loop: Am – F – C – G bassline + hats, scheduled
  // a bar ahead so it keeps playing without gaps.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const roots = [55, 43.65, 65.41, 49]; // A1 F1 C2 G1
    const stepDur = 0.21;
    let nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      while (nextTime < this.ctx.currentTime + 0.4) {
        const bar = Math.floor(this.musicStep / 8) % 4;
        const step = this.musicStep % 8;
        const root = roots[bar];
        if (step % 2 === 0) {
          const o = this.ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = root * (step === 6 ? 1.5 : 1);
          const f = this.ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 420;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, nextTime);
          g.gain.exponentialRampToValueAtTime(0.09, nextTime + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, nextTime + stepDur * 1.8);
          o.connect(f); f.connect(g); g.connect(this.master);
          o.start(nextTime);
          o.stop(nextTime + stepDur * 2);
        }
        // Off-beat sparkle.
        if (step % 4 === 2) {
          const o = this.ctx.createOscillator();
          o.type = 'sine';
          o.frequency.value = root * 8;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.0001, nextTime);
          g.gain.exponentialRampToValueAtTime(0.03, nextTime + 0.01);
          g.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.3);
          o.connect(g); g.connect(this.master);
          o.start(nextTime);
          o.stop(nextTime + 0.32);
        }
        this.musicStep += 1;
        nextTime += stepDur;
      }
    }, 120);
  }
}
