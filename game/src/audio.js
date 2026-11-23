// MARISOL BAY — tiny WebAudio synth: engine hum, two-tone siren, UI blips.
// Everything is guarded: audio only starts after a user gesture, and any
// failure (e.g. headless capture) leaves the game silent, never broken.
export class GameAudio {
  constructor() {
    this.ctx = null; this.engineOsc = null; this.engineGain = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenTimer = 0; this.ready = false;
  }
  unlock() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.ctx.destination);
      this.sirenOsc.start();
      this.ready = true;
    } catch { /* silent */ }
  }
  update(dt, speedKmh, wanted) {
    if (!this.ready) return;
    try {
      const t = this.ctx.currentTime;
      const load = Math.min(1, Math.abs(speedKmh) / 140);
      this.engineOsc.frequency.setTargetAtTime(55 + load * 165, t, 0.06);
      this.engineGain.gain.setTargetAtTime(speedKmh === 0 ? 0.012 : 0.02 + load * 0.05, t, 0.09);
      if (wanted > 0) {
        this.sirenTimer += dt;
        const hi = this.sirenTimer % 0.84 < 0.42;
        this.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 690, t, 0.03);
        this.sirenGain.gain.setTargetAtTime(0.016, t, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0.0, t, 0.15);
      }
    } catch { /* silent */ }
  }
  blip(freq = 880) {
    if (!this.ready) return;
    try {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.06, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + 0.2);
    } catch { /* silent */ }
  }
}
