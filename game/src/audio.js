// audio.js — all sound is synthesized with WebAudio: no audio files.
// Engine hum, two-tone siren, gunshot, punch, pickup chime, wanted sting
// and a small synthwave bassline loop. Safe to call before any user
// gesture: the context is created lazily and resumes on first input.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 58;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain); engineGain.connect(master);
      engineOsc.start(); engineOsc2.start();
      // Siren: sine alternating 660 / 880 Hz.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch (err) {
      ctx = null;
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (err) { /* ignore */ }
  }

  function noiseBurst(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = filterFreq || 1800;
      const g = ctx.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (err) { /* ignore */ }
  }

  // Synthwave loop: A-minor bassline + sparkle arp, 8 steps a bar.
  const BASS = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
  const ARP = [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 0];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const b = BASS[musicStep % BASS.length];
      if (b) blipNote(b, 0.22, 'triangle', 0.5, musicGain);
      const a = ARP[musicStep % ARP.length];
      if (a && musicStep % 2 === 0) blipNote(a * 2, 0.1, 'sine', 0.12, musicGain);
      musicStep++;
    }, 190);
  }
  function blipNote(freq, dur, type, vol, dest) {
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(dest || master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (err) { /* ignore */ }
  }

  return {
    unlock() { ensure(); },
    setMuted(m) {
      muted = m;
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.05);
      if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      if (sirenGain && ctx) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    },
    get muted() { return muted; },
    setEngine(speed01, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speed01 * 0.12 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      const f = 55 + speed01 * 130;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(f * 1.007, ctx.currentTime, 0.08);
    },
    setSiren(on, wanted) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (on) sirenOsc.frequency.setTargetAtTime((Date.now() % 900 < 450 ? 660 : 880), ctx.currentTime, 0.05);
    },
    gunshot() { noiseBurst(0.14, 0.5, 2600); blip(160, 0.1, 'square', 0.25, 60); },
    punch() { noiseBurst(0.09, 0.35, 500); },
    crash() { noiseBurst(0.3, 0.5, 900); },
    pickup() { blip(660, 0.09, 'sine', 0.3); setTimeout(() => blip(990, 0.14, 'sine', 0.3), 90); },
    missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.3), i * 110)); },
    wantedUp() { blip(220, 0.35, 'sawtooth', 0.25, 440); },
    busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.25), i * 160)); },
    click() { blip(1200, 0.05, 'square', 0.12); },
    step() { noiseBurst(0.05, 0.08, 700); },
  };
}
