/* ═══════════════════════════════════════════════════════════
   Sound — a small generative score, no external audio files
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25];

  class SoundEngine {
    constructor(options = {}) {
      this.ctx = null;
      this.master = null;
      this.musicBus = null;
      this.sfxBus = null;
      this.delay = null;
      this.musicVolume = (options.music ?? 55) / 100;
      this.sfxVolume = (options.sfx ?? 70) / 100;
      this.muted = Boolean(options.muted);
      this.started = false;
      this.bellTimer = null;
      this.bellStep = 0;
      this.droneNodes = [];
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVolume * 0.3;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVolume * 0.55;
      this.sfxBus.connect(this.master);

      // shared echo for bells
      this.delay = this.ctx.createDelay(2.5);
      this.delay.delayTime.value = 0.42;
      const feedback = this.ctx.createGain();
      feedback.gain.value = 0.33;
      const wet = this.ctx.createGain();
      wet.gain.value = 0.35;
      this.delay.connect(feedback);
      feedback.connect(this.delay);
      this.delay.connect(wet);
      wet.connect(this.musicBus);

      this._startScore();
      this.started = true;
    }

    _startScore() {
      const ctx = this.ctx;
      if (!ctx) return;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      filter.Q.value = 0.7;
      filter.connect(this.musicBus);

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.035;
      lfoGain.gain.value = 90;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const specs = [
        { f: 73.42, type: 'sine', gain: 0.19, detune: 0 },
        { f: 110.0, type: 'triangle', gain: 0.055, detune: 4 },
        { f: 146.83, type: 'sine', gain: 0.045, detune: -5 },
        { f: 220.0, type: 'sine', gain: 0.018, detune: 7 },
      ];
      for (const spec of specs) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = spec.type;
        osc.frequency.value = spec.f;
        osc.detune.value = spec.detune;
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(spec.gain, ctx.currentTime + 6);
        osc.connect(gain);
        gain.connect(filter);
        osc.start();
        this.droneNodes.push({ osc, gain });
      }

      // slow shimmer
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.value = 587.33;
      shimmerGain.gain.value = 0.008;
      const shimmerLfo = ctx.createOscillator();
      const shimmerLfoGain = ctx.createGain();
      shimmerLfo.frequency.value = 0.06;
      shimmerLfoGain.gain.value = 0.006;
      shimmerLfo.connect(shimmerLfoGain);
      shimmerLfoGain.connect(shimmerGain.gain);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(this.delay);
      shimmer.start();
      shimmerLfo.start();
      this.shimmer = { shimmer, shimmerGain, shimmerLfo };

      const bell = () => {
        if (!this.ctx || this.muted) return;
        const notes = [SCALE[5], SCALE[6], SCALE[7], SCALE[8], SCALE[9], SCALE[4]];
        const f = notes[this.bellStep % notes.length] * (this.bellStep % 7 === 0 ? 0.5 : 1);
        this.bellStep++;
        this._bell(f, 0.05);
        if (Math.random() > 0.55) setTimeout(() => this._bell(f * 1.5, 0.025), 420);
      };
      this.bellTimer = setInterval(bell, 5400);
      setTimeout(bell, 2600);
    }

    _bell(freq, level = 0.04) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      osc2.type = 'sine'; osc2.frequency.value = freq * 2.01;
      osc.connect(gain); osc2.connect(gain);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(level, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 4.6);
      gain.connect(this.delay);
      gain.connect(this.musicBus);
      osc.start(t); osc2.start(t);
      osc.stop(t + 4.8); osc2.stop(t + 4.8);
    }

    setMusic(value) {
      this.musicVolume = Math.max(0, Math.min(1, value / 100));
      if (this.musicBus && this.ctx) {
        this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicBus.gain.linearRampToValueAtTime(this.musicVolume * 0.3, this.ctx.currentTime + 0.3);
      }
    }

    setSfx(value) {
      this.sfxVolume = Math.max(0, Math.min(1, value / 100));
      if (this.sfxBus && this.ctx) {
        this.sfxBus.gain.cancelScheduledValues(this.ctx.currentTime);
        this.sfxBus.gain.linearRampToValueAtTime(this.sfxVolume * 0.55, this.ctx.currentTime + 0.2);
      }
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.master && this.ctx) {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, this.ctx.currentTime + 0.25);
      }
    }

    _tone({ freq = 440, dur = 0.15, type = 'sine', level = 0.08, slide = 0, delay = 0 }) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(level, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }

    _noise({ dur = 0.5, level = 0.12, cutoff = 900, delay = 0 }) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + delay;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, t);
      filter.frequency.exponentialRampToValueAtTime(140, t + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(level, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter); filter.connect(gain); gain.connect(this.sfxBus);
      src.start(t);
    }

    click() { this._tone({ freq: 740, dur: 0.045, type: 'triangle', level: 0.035, slide: -180 }); }
    hover() { this._tone({ freq: 1180, dur: 0.025, type: 'sine', level: 0.012 }); }
    open() {
      this._tone({ freq: 392, dur: 0.35, type: 'sine', level: 0.05 });
      this._tone({ freq: 587.33, dur: 0.5, type: 'sine', level: 0.03, delay: 0.07 });
    }
    close() {
      this._tone({ freq: 392, dur: 0.28, type: 'sine', level: 0.035, slide: -60 });
    }
    select() {
      this._tone({ freq: 659.25, dur: 0.18, type: 'triangle', level: 0.045 });
      this._tone({ freq: 987.77, dur: 0.3, type: 'sine', level: 0.02, delay: 0.05 });
    }
    lock() {
      this._tone({ freq: 130, dur: 0.1, type: 'square', level: 0.03 });
      this._tone({ freq: 98, dur: 0.16, type: 'square', level: 0.025, delay: 0.09 });
    }
    power() {
      this._noise({ dur: 0.5, level: 0.05, cutoff: 2400 });
      this._tone({ freq: 180, dur: 0.5, type: 'sine', level: 0.06, slide: 540 });
      this._tone({ freq: 523.25, dur: 0.7, type: 'sine', level: 0.03, delay: 0.2 });
    }
    move() {
      this._noise({ dur: 0.35, level: 0.045, cutoff: 600 });
      this._tone({ freq: 220, dur: 0.2, type: 'sine', level: 0.03, slide: -40 });
    }
    battle() {
      this._noise({ dur: 0.8, level: 0.16, cutoff: 1500 });
      this._tone({ freq: 70, dur: 0.4, type: 'sine', level: 0.1, slide: -25 });
      this._tone({ freq: 160, dur: 0.18, type: 'square', level: 0.03, delay: 0.06 });
    }
    victory() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this._tone({ freq: f, dur: 1.5, type: 'sine', level: 0.04, delay: i * 0.16 });
      });
      this._bell(523.25, 0.05);
      setTimeout(() => this._bell(783.99, 0.04), 700);
    }
    defeat() {
      [392, 311.13, 261.63, 196].forEach((f, i) => {
        this._tone({ freq: f, dur: 1.8, type: 'sine', level: 0.045, delay: i * 0.26 });
      });
      this._noise({ dur: 1.4, level: 0.05, cutoff: 300 });
    }
    save() {
      this._tone({ freq: 880, dur: 0.2, type: 'sine', level: 0.03 });
      this._tone({ freq: 1174.66, dur: 0.4, type: 'sine', level: 0.02, delay: 0.09 });
    }
    deny() {
      this._tone({ freq: 180, dur: 0.20, type: 'triangle', level: 0.035, slide: -40 });
    }
  }

  window.GATC_AUDIO = { SoundEngine };
})();
