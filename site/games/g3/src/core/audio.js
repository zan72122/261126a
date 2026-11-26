// Synthesized Web Audio soundscape: soft Mediterranean waves, sail wind, and warm chimes.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.surfGain = null;
    this.windGain = null;
    this.started = false;
  }

  unlock() {
    if (this.started) {
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

      // Pink-ish noise buffer for gentle sea surf & sail breeze
      const len = this.ctx.sampleRate * 3;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
      }

      const surfSrc = this.ctx.createBufferSource();
      surfSrc.buffer = buf;
      surfSrc.loop = true;
      const surfFilter = this.ctx.createBiquadFilter();
      surfFilter.type = 'lowpass';
      surfFilter.frequency.value = 420;
      this.surfGain = this.ctx.createGain();
      this.surfGain.gain.value = 0.16;
      surfSrc.connect(surfFilter);
      surfFilter.connect(this.surfGain);
      this.surfGain.connect(this.master);
      surfSrc.start();

      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = buf;
      windSrc.loop = true;
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 680;
      windFilter.Q.value = 1.2;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.04;
      windSrc.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      windSrc.start();

      this.started = true;
    } catch (_) {
      // Ignore audio errors in headless/restricted environments
    }
  }

  update(t, speed = 0, isFloating = false) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    const surfLfo = 0.13 + 0.05 * Math.sin(t * 0.72);
    this.surfGain.gain.setTargetAtTime(surfLfo, now, 0.2);
    const windLevel = isFloating ? 0.12 : 0.03 + Math.min(0.16, speed * 0.01);
    this.windGain.gain.setTargetAtTime(windLevel, now, 0.2);
  }

  playBreezeWhoosh() {
    if (!this.started || !this.ctx) return;
    this.playChime([587.33, 739.99, 880, 1174.66], 1.1, 0.09);
  }

  playChime(notes = [523.25, 659.25, 783.99], dur = 0.9, gainVal = 0.11) {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      g.gain.setValueAtTime(0.0001, now + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(gainVal, now + idx * 0.09 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + dur + 0.05);
    });
  }
}
