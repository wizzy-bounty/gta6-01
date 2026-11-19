// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, punches, crashes, jingles and two
// radio stations (sequenced synth loops) live here.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null, engineGain = null, engineFilter = null;
  let sirenOsc = null, sirenGain = null, sirenTimer = null;
  let radioTimer = null, radioStep = 0;
  let muted = false;
  let station = 0; // 0 = SOLMAR FM 92.1 (sunset synth), 1 = HEAT 98 (driving bass)

  const STATIONS = [
    { name: 'SOLMAR FM 92.1', bpm: 96, root: 220.00, minor: true, wave: 'triangle' },
    { name: 'HEAT 98', bpm: 128, root: 164.81, minor: false, wave: 'sawtooth' },
  ];

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch { return false; }
    return !!ctx;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  // --- radio sequencer: 16-step loop, bass + pad + sparkle per station ---
  function radioTick() {
    if (!ctx || muted) return;
    const st = STATIONS[station];
    const stepDur = 60 / st.bpm / 4;
    const step = radioStep % 16;
    const scale = st.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    const bassNotes = [0, 0, 3, 5, 0, 0, 5, 3];
    if (step % 4 === 0) {
      const n = bassNotes[(step / 4) | 0];
      tone(st.root * Math.pow(2, n / 12) / 2, stepDur * 3.4, 'sine', 0.20);
    }
    if (step % 2 === 0) {
      const deg = scale[(step * 2 + (station === 0 ? 1 : 0)) % scale.length];
      tone(st.root * 2 * Math.pow(2, deg / 12), stepDur * 1.6, st.wave, 0.045);
    }
    if (step === 0 || step === 8) {
      tone(st.root * 2, stepDur * 8, 'sine', 0.05);
      tone(st.root * 2 * 1.5, stepDur * 8, 'sine', 0.04);
    }
    if (station === 1 && step % 4 === 2) noise(0.05, 0.10, 6000);
    radioStep++;
    radioTimer = setTimeout(radioTick, stepDur * 1000);
  }

  function startRadio() {
    if (!ctx) return;
    stopRadio();
    radioStep = 0;
    radioTick();
  }
  function stopRadio() { if (radioTimer) { clearTimeout(radioTimer); radioTimer = null; } }

  return {
    unlock() { if (ensure()) startRadio(); },
    get stationName() { return STATIONS[station].name; },
    get stationIndex() { return station; },
    get isMuted() { return muted; },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      if (ctx && !muted) startRadio();
      return STATIONS[station].name;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      if (muted) stopRadio(); else if (ctx) startRadio();
      return muted;
    },
    engine(on, speed01) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineFilter = ctx.createBiquadFilter();
        engineFilter.type = 'lowpass'; engineFilter.frequency.value = 420;
        engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
        engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      if (!engineOsc) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 165, ctx.currentTime, 0.08);
      engineFilter.frequency.setTargetAtTime(320 + speed01 * 1400, ctx.currentTime, 0.1);
      if (!on && target === 0) {
        const o = engineOsc; engineOsc = null;
        setTimeout(() => { try { o.stop(); } catch { /* already stopped */ } }, 300);
      }
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain(); sirenGain.gain.value = 0.035;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
        let hi = false;
        sirenTimer = setInterval(() => {
          if (!sirenOsc) return;
          hi = !hi;
          sirenOsc.frequency.setTargetAtTime(hi ? 960 : 720, ctx.currentTime, 0.05);
        }, 420);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer); sirenTimer = null;
        const o = sirenOsc, g = sirenGain; sirenOsc = null; sirenGain = null;
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        setTimeout(() => { try { o.stop(); } catch { /* stopped */ } }, 300);
      }
    },
    shot() { if (ensure()) { noise(0.14, 0.5, 3200); tone(180, 0.1, 'square', 0.16, 0, 60); } },
    enemyShot() { if (ensure()) { noise(0.1, 0.22, 2400); } },
    punch() { if (ensure()) { noise(0.09, 0.4, 900); tone(120, 0.09, 'sine', 0.3, 0, 55); } },
    crash(strength = 1) { if (ensure()) { noise(0.25, Math.min(0.6, 0.25 + strength * 0.35), 700); tone(90, 0.2, 'sine', 0.3, 0, 40); } },
    pickup() { if (ensure()) { tone(660, 0.09, 'sine', 0.2); tone(990, 0.14, 'sine', 0.2, 0.09); } },
    missionComplete() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.22, i * 0.11));
    },
    missionFail() {
      if (!ensure()) return;
      [330, 262, 196].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.12, i * 0.14));
    },
    wantedUp() { if (ensure()) { tone(880, 0.12, 'square', 0.1); tone(880, 0.12, 'square', 0.1, 0.16); } },
    click() { if (ensure()) tone(1200, 0.05, 'square', 0.08); },
    // v8: garage till + race cues.
    purchase() { if (ensure()) { tone(880, 0.08, 'square', 0.12); tone(1318, 0.16, 'square', 0.12, 0.08); } },
    denied() { if (ensure()) { tone(196, 0.16, 'square', 0.14); tone(147, 0.2, 'square', 0.14, 0.12); } },
    countdownBeep(final) { if (ensure()) tone(final ? 1320 : 660, final ? 0.3 : 0.12, 'square', 0.14); },
    weaponSwitch() { if (ensure()) { noise(0.05, 0.2, 2400); tone(520, 0.05, 'square', 0.08, 0.02); } },
  };
}
