// Procedural Web Audio soundscape (no external assets)
// Gentle morning breeze, soft burner puff, thermal chime, footsteps, clock tower bronze bell.

import { clamp } from './math.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.windFilter = null;
    this.burnerGain = null;
    this.unlocked = false;
    this.stepAccum = 0;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);

      // Filtered noise buffer for morning breeze & burner
      const len = this.ctx.sampleRate * 2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.04 * w) / 1.04;
        data[i] = last * 2.5;
      }

      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 340;
      this.windFilter.Q.value = 0.9;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.03;
      windSrc.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      windSrc.start();

      const burnerSrc = this.ctx.createBufferSource();
      burnerSrc.buffer = buf;
      burnerSrc.loop = true;
      const burnerFilter = this.ctx.createBiquadFilter();
      burnerFilter.type = 'lowpass';
      burnerFilter.frequency.value = 210;
      this.burnerGain = this.ctx.createGain();
      this.burnerGain.gain.value = 0.0;
      burnerSrc.connect(burnerFilter);
      burnerFilter.connect(this.burnerGain);
      this.burnerGain.connect(this.master);
      burnerSrc.start();

      this.unlocked = true;
    } catch (_) {
      // Safe fallback when Web Audio is unavailable
    }
  }

  update(dt, speed, altitude, burnerOn, walking) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const airFactor = clamp(speed / 16, 0, 1) * 0.65 + clamp(altitude / 65, 0, 1) * 0.35;
    this.windGain.gain.setTargetAtTime(0.025 + airFactor * 0.14, t, 0.18);
    this.windFilter.frequency.setTargetAtTime(320 + airFactor * 520, t, 0.18);
    this.burnerGain.gain.setTargetAtTime(burnerOn ? 0.14 : 0.0, t, 0.12);

    if (walking) {
      this.stepAccum += dt;
      if (this.stepAccum > 0.38) {
        this.stepAccum = 0;
        this._softTick();
      }
    } else {
      this.stepAccum = 0.22;
    }
  }

  _softTick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + Math.random() * 25, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.05);
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playPickup() {
    this._chime([523.25, 659.25, 783.99], 0.07, 0.45);
  }

  playThermal() {
    this._chime([523.25, 659.25, 783.99, 987.77, 1174.66], 0.065, 0.9);
  }

  playFloatOpen() {
    this._chime([659.25, 880.0, 1046.5], 0.08, 0.8);
  }

  playTowerBell() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const freqs = [392.0, 493.88, 587.33];
    freqs.forEach((f, idx) => {
      const start = this.ctx.currentTime + idx * 0.42;
      this._bellNote(f, start, 2.2, 0.12);
    });
  }

  _bellNote(freq, start, dur, amp) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, start);
    osc2.frequency.setValueAtTime(freq * 2.0, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(amp, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0005, start + dur);
    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.master);
    osc1.start(start);
    osc2.start(start);
    osc1.stop(start + dur + 0.05);
    osc2.stop(start + dur + 0.05);
  }

  _chime(notes, stepDelay, dur) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    notes.forEach((f, i) => {
      const t = now + i * stepDelay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.075, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    });
  }
}
