// audio.js — all sound is synthesized with WebAudio: engine, siren, shots, music loop.
export function createAudio() {
  const A = { ctx: null, master: null, musicGain: null, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null, muted: false, musicTimer: null, beat: 0 };
  function ensure() {
    if (A.ctx) return true;
    try {
      A.ctx = new (window.AudioContext || window.webkitAudioContext)();
      A.master = A.ctx.createGain(); A.master.gain.value = 0.5; A.master.connect(A.ctx.destination);
      A.musicGain = A.ctx.createGain(); A.musicGain.gain.value = 0.16; A.musicGain.connect(A.master);
      A.engineOsc = A.ctx.createOscillator(); A.engineOsc.type = 'sawtooth'; A.engineOsc.frequency.value = 60;
      A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0; A.engineOsc.connect(A.engineGain); A.engineGain.connect(A.master);
      A.engineOsc.start();
      A.sirenOsc = A.ctx.createOscillator(); A.sirenOsc.type = 'triangle'; A.sirenOsc.frequency.value = 700;
      A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0; A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
      A.sirenOsc.start();
      startMusic();
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, lowpass) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const g = A.ctx.createGain(); g.gain.value = vol || 0.3;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    src.connect(f); f.connect(g); g.connect(A.master); src.start(t);
  }
  // Looping bassline + hats: A minor groove, 112 BPM, scheduled ahead.
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 73.42, 0];
  function startMusic() {
    if (A.musicTimer) return;
    A.musicTimer = setInterval(() => {
      if (!A.ctx || A.muted) return;
      const step = A.beat % 16, t = A.ctx.currentTime;
      const f = BASS[step];
      if (f) {
        const o = A.ctx.createOscillator(), g = A.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + 0.24);
        o.connect(g); g.connect(A.musicGain); o.start(t); o.stop(t + 0.26);
      }
      if (step % 4 === 2) { // hat tick
        const len = Math.floor(A.ctx.sampleRate * 0.03);
        const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const s = A.ctx.createBufferSource(); s.buffer = buf;
        const g = A.ctx.createGain(); g.gain.value = 0.12;
        s.connect(g); g.connect(A.musicGain); s.start(t);
      }
      A.beat++;
    }, 134); // 16th notes at 112 BPM
  }
  return {
    ensure, get muted() { return A.muted; },
    toggleMute() { A.muted = !A.muted; if (A.master) A.master.gain.value = A.muted ? 0 : 0.5; return A.muted; },
    setEngine(speed01, on) {
      if (!A.ctx) return;
      A.engineOsc.frequency.value = 50 + speed01 * 160;
      A.engineGain.gain.value = on && !A.muted ? 0.05 + speed01 * 0.05 : 0;
    },
    setSiren(on, t) {
      if (!A.ctx) return;
      A.sirenOsc.frequency.value = 650 + Math.sin(t * 6) * 220;
      A.sirenGain.gain.value = on && !A.muted ? 0.045 : 0;
    },
    gunshot() { noise(0.14, 0.5, 2600); tone(180, 0.08, 'square', 0.2, 60); },
    punch() { noise(0.08, 0.35, 500); },
    pickup() { tone(660, 0.1, 'sine', 0.25); tone(990, 0.16, 'sine', 0.25); },
    missionDone() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110)); },
    busted() { tone(220, 0.5, 'sawtooth', 0.25, 110); },
    horn() { tone(370, 0.18, 'square', 0.18); tone(440, 0.18, 'square', 0.15); },
    click() { tone(800, 0.05, 'sine', 0.15); },
  };
}
