// audio.js — all sound is synthesized with WebAudio: engine, siren, shots,
// crashes, punches and two car-radio stations. No audio files are loaded.
const STATIONS = [
  {
    name: 'SOLMAR FM 101.2 — Sunset Drive',
    style: 'wave',
    bpm: 96,
    bass: [55.0, 0, 65.41, 0, 49.0, 0, 58.27, 0],
    lead: [220.0, 261.63, 329.63, 392.0, 329.63, 261.63, 196.0, 246.94],
  },
  {
    name: 'HEAT 98.5 — Night Shift',
    style: 'pulse',
    bpm: 128,
    bass: [41.2, 41.2, 49.0, 55.0, 41.2, 41.2, 61.74, 49.0],
    lead: [164.81, 0, 196.0, 0, 246.94, 0, 220.0, 293.66],
  },
];

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenLfo: null,
    musicGain: null,
    stationIndex: 0,
    musicTimer: null,
    step: 0,
    enabled: true,
    inCar: false,
  };

  audio.ensure = function ensure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      // Engine hum: two detuned saws through a lowpass.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 50;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      // Police siren: triangle wailing via LFO on frequency.
      audio.sirenOsc = audio.ctx.createOscillator();
      audio.sirenOsc.type = 'triangle';
      audio.sirenOsc.frequency.value = 750;
      audio.sirenLfo = audio.ctx.createOscillator();
      audio.sirenLfo.type = 'sine';
      audio.sirenLfo.frequency.value = 0.55;
      const lfoGain = audio.ctx.createGain();
      lfoGain.gain.value = 260;
      audio.sirenLfo.connect(lfoGain);
      lfoGain.connect(audio.sirenOsc.frequency);
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.sirenOsc.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.sirenOsc.start();
      audio.sirenLfo.start();
      // Radio bus.
      audio.musicGain = audio.ctx.createGain();
      audio.musicGain.gain.value = 0;
      audio.musicGain.connect(audio.master);
    } catch {
      audio.ctx = null;
    }
  };

  function blip(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || !audio.enabled) return;
    try {
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  audio.setEngine = function setEngine(speedNorm, driving) {
    if (!audio.ctx) return;
    const t = audio.ctx.currentTime;
    const target = driving ? 0.05 + 0.06 * speedNorm : 0.0;
    audio.engineGain.gain.setTargetAtTime(target, t, 0.1);
    audio.engineOsc.frequency.setTargetAtTime(48 + 130 * speedNorm, t, 0.08);
  };

  audio.setSiren = function setSiren(on) {
    if (!audio.ctx) return;
    audio.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, audio.ctx.currentTime, 0.2);
  };

  audio.shot = function shot() { blip(880, 0.12, 'square', 0.22, 110); blip(160, 0.1, 'sawtooth', 0.18, 60); };
  audio.enemyShot = function enemyShot() { blip(620, 0.1, 'square', 0.1, 90); };
  audio.crash = function crash() { blip(90, 0.35, 'sawtooth', 0.3, 35); blip(55, 0.4, 'triangle', 0.25, 30); };
  audio.punch = function punch() { blip(140, 0.09, 'sine', 0.3, 70); };
  audio.pickup = function pickup() { blip(523, 0.09, 'sine', 0.2); setTimeout(() => blip(784, 0.14, 'sine', 0.2), 90); };
  audio.missionDone = function missionDone() {
    blip(523, 0.12, 'triangle', 0.22); setTimeout(() => blip(659, 0.12, 'triangle', 0.22), 110);
    setTimeout(() => blip(784, 0.22, 'triangle', 0.24), 220);
  };
  audio.missionFail = function missionFail() { blip(330, 0.25, 'sawtooth', 0.18, 165); };
  audio.steal = function steal() { blip(440, 0.08, 'square', 0.15, 660); };

  audio.stationName = function stationName() { return STATIONS[audio.stationIndex].name; };

  audio.nextStation = function nextStation() {
    audio.stationIndex = (audio.stationIndex + 1) % STATIONS.length;
    audio.step = 0;
    return audio.stationName();
  };

  function scheduleStep() {
    if (!audio.ctx) return;
    const station = STATIONS[audio.stationIndex];
    const stepDur = 60 / station.bpm / 2;
    const i = audio.step % 8;
    const t = audio.ctx.currentTime + 0.03;
    if (station.bass[i] > 0) {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = station.bass[i];
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.95);
      osc.connect(gain); gain.connect(audio.musicGain);
      osc.start(t); osc.stop(t + stepDur);
    }
    if (station.lead[i] > 0) {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = station.style === 'wave' ? 'sine' : 'square';
      osc.frequency.value = station.lead[i];
      gain.gain.setValueAtTime(station.style === 'wave' ? 0.07 : 0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
      osc.connect(gain); gain.connect(audio.musicGain);
      osc.start(t); osc.stop(t + stepDur);
    }
    // Hat tick on the pulse station.
    if (station.style === 'pulse' && i % 2 === 1) {
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = 6000;
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc.connect(gain); gain.connect(audio.musicGain);
      osc.start(t); osc.stop(t + 0.04);
    }
    audio.step += 1;
  }

  audio.setRadio = function setRadio(on) {
    if (!audio.ctx) return;
    audio.inCar = on;
    if (on && !audio.musicTimer) {
      audio.musicGain.gain.setTargetAtTime(0.9, audio.ctx.currentTime, 0.3);
      const station = STATIONS[audio.stationIndex];
      const stepDur = 60 / station.bpm / 2;
      audio.musicTimer = setInterval(scheduleStep, stepDur * 1000);
    } else if (!on && audio.musicTimer) {
      clearInterval(audio.musicTimer);
      audio.musicTimer = null;
      audio.musicGain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2);
    }
  };

  return audio;
}
