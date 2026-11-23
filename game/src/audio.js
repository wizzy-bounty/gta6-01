// Tiny WebAudio synth: engine hum, siren, UI blips. No assets, starts on first input.
let ctx = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenTimer = 0;
let muted = false;

export function ensureAudio() {
  if (ctx || muted) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
    sirenOsc.start();
  } catch { muted = true; }
}

export function setEngine(speed01, on) {
  if (!ctx || !engineOsc) return;
  const t = ctx.currentTime;
  engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
  engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, t, 0.08);
}

export function setSiren(wanted, dt) {
  if (!ctx || !sirenOsc) return;
  sirenTimer += dt;
  if (wanted > 0) {
    sirenGain.gain.setTargetAtTime(0.028, ctx.currentTime, 0.1);
    sirenOsc.frequency.setTargetAtTime(Math.floor(sirenTimer * 1.6) % 2 === 0 ? 660 : 880, ctx.currentTime, 0.05);
  } else {
    sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }
}

export function blip(freq = 880) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  o.connect(g); g.connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + 0.13);
}
