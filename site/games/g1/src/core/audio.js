/**
 * Procedural Web Audio synthesizer:
 * - Rhythmic locomotive steam chuffing synced to wheel rotation
 * - Harmonic 3-chime Swiss alpine brass steam whistle + steam valve hiss
 * - Station puppy bark & tiny brass collar bell
 * - Alpine breeze / umbrella float shimmer / summit arrival chord
 */
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.windGain = null;
    this.windFilter = null;
    this.unlocked = false;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);

      // Shared white-noise buffer for steam & wind
      const sr = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, sr * 2, sr);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

      // Continuous subtle alpine breeze bed
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 340;
      this.windFilter.Q.value = 1.4;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.015;
      src.connect(this.windFilter).connect(this.windGain).connect(this.master);
      src.start();

      this.unlocked = true;
    } catch {
      // Audio unavailable (headless / blocked) - fail silently
    }
  }

  updateAmbient(speed, altitude, isFloating) {
    if (!this.ctx || !this.windGain) return;
    const now = this.ctx.currentTime;
    const targetFreq = isFloating ? 520 : 280 + Math.min(speed * 26, 480) + Math.min(altitude * 2.5, 220);
    const targetGain = isFloating ? 0.055 : 0.016 + Math.min(speed * 0.004, 0.045);
    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.15);
    this.windGain.gain.setTargetAtTime(targetGain, now, 0.15);
  }

  playChuff(power = 0.6) {
    if (!this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(620 + power * 280, now);
    bp.frequency.exponentialRampToValueAtTime(240, now + 0.11);
    bp.Q.value = 1.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.08 + power * 0.07, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.14);
  }

  playWhistle(duration = 0.65) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Swiss narrow-gauge 3-chime brass whistle (warm major-sixth triad)
    const freqs = [523.25, 659.25, 783.99];
    const mix = this.ctx.createGain();
    mix.gain.setValueAtTime(0.001, now);
    mix.gain.linearRampToValueAtTime(0.22, now + 0.055);
    mix.gain.setValueAtTime(0.2, now + duration * 0.65);
    mix.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2100;
    mix.connect(lp).connect(this.master);

    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * 0.985, now);
      osc.frequency.linearRampToValueAtTime(f, now + 0.06);
      osc.connect(mix);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    }

    // Accompanying breathy steam hiss
    if (this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 2200;
      hp.Q.value = 1.1;
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.001, now);
      hg.gain.linearRampToValueAtTime(0.07, now + 0.05);
      hg.gain.exponentialRampToValueAtTime(0.001, now + duration);
      src.connect(hp).connect(hg).connect(this.master);
      src.start(now);
      src.stop(now + duration + 0.03);
    }
  }

  playSteamValve() {
    if (!this.ctx || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2800, now);
    bp.frequency.exponentialRampToValueAtTime(1100, now + 0.42);
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(bp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 0.48);
  }

  playBark() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.16;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(390, t);
      osc.frequency.exponentialRampToValueAtTime(560, t + 0.035);
      osc.frequency.exponentialRampToValueAtTime(280, t + 0.1);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.16, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  }

  playBell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [1174.66, 1567.98];
    notes.forEach((f, idx) => {
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  playSwitchClick() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playArrival() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, i) => {
      const t = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 1.55);
    });
  }
}
