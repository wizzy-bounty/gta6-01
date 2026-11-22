// audio.js — every sound in NEON TIDE is synthesized WebAudio; there are no
// audio files. Engine hum follows the player's car, police sirens wail by
// distance, rain hisses through a filtered noise loop, gunshots are noise
// bursts, and a slow neon bassline loops under everything once Sable calls.

export class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null;
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.rainGain = null; this.sirenOsc = null; this.sirenGain = null;
    this.musicOn = false; this.musicStep = 0; this.nextNoteAt = 0;
    this.started = false;
  }

  /** Browsers only allow audio after a gesture; call from clicks/keys. */
  unlock() {
    if (this.started) { if (this.ctx?.state === 'suspended') this.ctx.resume(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.55;
      this.master.connect(ctx.destination);
      this.startEngineVoice(); this.startRainVoice(); this.startSirenVoice();
      this.started = true; this.musicOn = true;
      this.nextNoteAt = ctx.currentTime + 0.1;
    } catch { /* no audio device: the game plays silent */ }
  }

  noiseBuffer(seconds) {
    const ctx = this.ctx, buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  startEngineVoice() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
    this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 320;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();
  }

  startRainVoice() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(2); src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0.035;
    src.connect(filter).connect(this.rainGain).connect(this.master);
    src.start();
  }

  startSirenVoice() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 750;
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain).connect(this.master);
    this.sirenOsc.start();
  }

  /** Per-frame: engine pitch from the driven car, siren from the nearest cop. */
  tick(G) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const car = G.player.inCar;
    const speed = car ? Math.abs(car.speed) : 0;
    const throttle = car && G.mode === 'playing' ? Math.min(1, Math.abs(car.throttle || 0) + speed / 40) : 0;
    this.engineGain.gain.setTargetAtTime(car ? 0.05 + throttle * 0.075 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed * 3.4 + throttle * 22, t, 0.06);
    let nearest = 1e9;
    for (const cop of G.police.cars) {
      const d = cop.group.position.distanceTo(G.player.group.position);
      if (d < nearest) nearest = d;
    }
    const wail = G.wanted > 0 && nearest < 95 ? Math.max(0, 0.05 * (1 - nearest / 95)) : 0;
    this.sirenGain.gain.setTargetAtTime(wail, t, 0.1);
    if (wail > 0) this.sirenOsc.frequency.setTargetAtTime(720 + Math.sin(t * 4.4) * 190, t, 0.03);
    this.tickMusic(t);
  }

  /** A 8-step minor bassline with a soft hat, scheduled a step ahead. */
  tickMusic(t) {
    if (!this.musicOn) return;
    const bass = [55, 0, 55, 65.4, 0, 55, 82.4, 73.4]; // A1 C2 E2 D2 — the Sirena theme
    while (this.nextNoteAt < t + 0.18) {
      const f = bass[this.musicStep % bass.length];
      if (f) this.tone(f, this.nextNoteAt, 0.34, 'square', 0.045);
      if (this.musicStep % 2 === 0) this.hat(this.nextNoteAt);
      this.musicStep++; this.nextNoteAt += 0.36;
    }
  }

  tone(freq, at, dur, type, gain) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master); o.start(at); o.stop(at + dur + 0.02);
  }

  hat(at) {
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(0.05);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.012, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(f).connect(g).connect(this.master); src.start(at);
  }

  burst(dur, freq, gain, type = 'lowpass') {
    if (!this.started) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuffer(dur);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master); src.start(t);
  }

  shot(kind) { this.burst(kind === 'smg' ? 0.07 : 0.13, kind === 'smg' ? 2400 : 1500, 0.22); }
  enemyShot() { this.burst(0.1, 1100, 0.1); }
  melee() { this.burst(0.09, 300, 0.3); }
  crash() { this.burst(0.25, 500, 0.28); }
  blip() { if (this.started) this.tone(880, this.ctx.currentTime, 0.09, 'sine', 0.06); }
  cash() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this.tone(1320, t, 0.09, 'sine', 0.07); this.tone(1760, t + 0.08, 0.14, 'sine', 0.07);
  }
  checkpoint() { if (this.started) this.tone(1046, this.ctx.currentTime, 0.16, 'triangle', 0.09); }
}
