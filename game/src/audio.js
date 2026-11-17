// audio.js — all sound is synthesized with WebAudio: engine hum, siren, gunshots,
// UI chimes and a looping bassline. No audio files, no network.
// One job: start on the first user gesture and keep the mix alive.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // engine: low sawtooth, pitch follows speed
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // siren: two-tone triangle, wails when wanted
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0.0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type = 'square', vol = 0.15) {
    if (!ctx || muted) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur = 0.18, vol = 0.3) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  // Simple 8-step bassline loop (A minor groove), one note per 220 ms.
  const BASSLINE = [55, 0, 55, 65.4, 55, 0, 82.4, 73.4];
  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const freq = BASSLINE[musicStep % BASSLINE.length];
      musicStep++;
      if (!freq) return;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      o.connect(g); g.connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.22);
    }, 220);
  }

  return {
    ensure,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() { return muted; },
    // Per-frame mix: engine pitch by speed, siren wail by wanted level.
    update(carSpeed, inCar, wanted, now) {
      if (!ctx) return;
      if (engineGain) {
        engineGain.gain.value = inCar ? 0.05 + Math.min(0.09, Math.abs(carSpeed) * 0.003) : 0.0;
        engineOsc.frequency.value = 48 + Math.abs(carSpeed) * 4.5;
      }
      if (sirenGain) {
        sirenGain.gain.value = wanted > 0 ? 0.045 : 0.0;
        sirenOsc.frequency.value = Math.sin(now * 4) > 0 ? 720 : 540;
      }
    },
    gunshot() { noiseBurst(0.16, 0.35); blip(160, 0.08, 'square', 0.12); },
    punch() { noiseBurst(0.1, 0.22); },
    chime() { blip(660, 0.12, 'sine', 0.2); blip(990, 0.18, 'sine', 0.2); },
    crash() { noiseBurst(0.3, 0.3); },
    pickup() { blip(880, 0.1, 'sine', 0.18); blip(1320, 0.16, 'sine', 0.18); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sine', 0.2), i * 110));
    },
  };
}
