// NEON TIDE — audio.js: all sound is synthesized WebAudio, no assets.
// Engine hum follows the player's speed, police sirens warble nearby, rain
// is filtered noise, and a slow synth bassline loops under the dusk. Every
// call is guarded: with no user gesture yet (or no AudioContext at all, as
// in a headless screenshot run) the whole system stays silent and harmless.

export class AudioSys {
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
      this.startEngine();
      this.startRain();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  startEngine() {
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
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
  }

  startRain() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 1.4;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2400;
    const gain = ctx.createGain();
    gain.gain.value = 0.016;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  startMusic() {
    // Slow minor-key bass pulse + sparse pluck, scheduled with setInterval.
    const bass = [55, 55, 65.4, 49];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime;
      const note = bass[this.step % bass.length];
      this.tone(note, t, 0.42, 'triangle', 0.05);
      if (this.step % 2 === 0) this.tone(note * 4, t + 0.21, 0.16, 'sine', 0.018);
      this.step++;
    }, 430);
  }

  tone(freq, at, dur, type, vol) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  blip(freq, dur = 0.09, vol = 0.06, type = 'square') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.tone(freq, this.ctx.currentTime, dur, type, vol);
  }

  shot(kind, far = false) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const dur = kind === 'smg' ? 0.06 : 0.11;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = far ? 0.05 : 0.16;
    src.connect(gain).connect(this.master);
    src.start();
  }

  swing() { this.blip(180, 0.07, 0.05, 'sine'); }
  dryFire() { this.blip(1200, 0.04, 0.05, 'square'); }
  pickup() { this.blip(880, 0.1, 0.07); setTimeout(() => this.blip(1320, 0.12, 0.07), 70); }
  checkpoint() { this.blip(1046, 0.1, 0.07); setTimeout(() => this.blip(1568, 0.14, 0.07), 80); }
  cash() { this.blip(988, 0.09, 0.08); setTimeout(() => this.blip(1319, 0.16, 0.08), 90); }
  busted() { this.blip(392, 0.3, 0.1, 'sawtooth'); setTimeout(() => this.blip(311, 0.4, 0.1, 'sawtooth'), 220); }
  wasted() { this.blip(220, 0.5, 0.1, 'sawtooth'); setTimeout(() => this.blip(147, 0.7, 0.1, 'sawtooth'), 300); }

  update(dt, game) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const car = game.playerCar;
    const speed = car ? Math.abs(car.speed) : 0;
    const driving = !!car && game.mode === 'play';
    this.engineGain.gain.value += ((driving ? 0.028 + speed / 385 * 0.03 : 0) - this.engineGain.gain.value) * 0.2;
    this.engineOsc.frequency.value = 52 + speed * 0.55;
    const copsNear = game.police.cops.some((c) => !c.wrecked && Math.hypot(c.x - game.player.x, c.y - game.player.y) < 520);
    const t = this.ctx.currentTime;
    if (copsNear && game.police.stars > 0) {
      this.sirenGain.gain.value = 0.014;
      this.sirenOsc.frequency.value = 660 + Math.sin(t * 5.2) * 180;
    } else {
      this.sirenGain.gain.value = 0;
    }
  }
}
