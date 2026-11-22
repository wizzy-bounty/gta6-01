// NEON TIDE — synthesized sound, no audio files: a two-oscillator engine
// hum, police siren wail, gunshot noise bursts, rain hiss and a slow neon
// synthwave loop. Everything is wrapped so a blocked AudioContext (autoplay
// rules) can never throw into the game loop.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.step = 0;
  }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngine();
      this.startRain();
    } catch { this.ctx = null; }
  }

  startEngine() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 320;
      this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch { /* engine stays silent */ }
  }

  startRain() {
    try {
      const len = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer; src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass'; filter.frequency.value = 1400;
      const gain = this.ctx.createGain(); gain.gain.value = 0.05;
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start();
    } catch { /* no rain */ }
  }

  setEngine(speedRatio, driving) {
    if (!this.ctx || !this.engineOsc) return;
    try {
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(50 + speedRatio * 130, t, 0.08);
      this.engineGain.gain.setTargetAtTime(driving ? 0.06 + speedRatio * 0.05 : 0, t, 0.1);
    } catch { /* ignore */ }
  }

  setSiren(active) {
    if (!this.ctx) return;
    try {
      if (active && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.018;
        this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      }
      if (!active && this.sirenOsc) {
        this.sirenOsc.stop(); this.sirenOsc.disconnect();
        this.sirenOsc = null; this.sirenGain = null;
      }
      if (this.sirenOsc) {
        const wail = 620 + Math.sin(this.ctx.currentTime * 2.4) * 160;
        this.sirenOsc.frequency.setTargetAtTime(wail, this.ctx.currentTime, 0.05);
      }
    } catch { /* ignore */ }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch { /* ignore */ }
  }

  shot(kind) {
    if (!this.ctx) return;
    try {
      const dur = kind === 'smg' ? 0.07 : 0.12;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource(); src.buffer = buffer;
      const g = this.ctx.createGain(); g.gain.value = 0.16;
      src.connect(g); g.connect(this.master); src.start();
    } catch { /* ignore */ }
  }

  hurt() { this.blip(140, 0.15, 'sawtooth', 0.1); }
  cash() { this.blip(880, 0.09, 'square', 0.07); setTimeout(() => this.blip(1320, 0.12, 'square', 0.07), 70); }
  pickup() { this.blip(520, 0.1, 'triangle', 0.09); }

  updateMusic(dt, playing) {
    if (!this.ctx || !playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    // slow synthwave arpeggio in D minor, one note every 0.24 s
    const scale = [146.83, 174.61, 220, 261.63, 293.66, 349.23, 440, 349.23];
    const note = scale[this.step % scale.length];
    this.blip(note, 0.22, 'triangle', 0.045);
    if (this.step % 4 === 0) this.blip(note / 2, 0.5, 'sine', 0.06);
    this.step++;
    this.musicTimer = 0.24;
  }
}
