/**
 * Tiny WebAudio chiptune engine: no assets, everything synthesised.
 * SFX are one-shot voices, music is a small step sequencer per level theme.
 */

type Wave = OscillatorType;

interface Voice {
  freq: number;
  freq2?: number;
  dur: number;
  type?: Wave;
  gain?: number;
  delay?: number;
}

interface ThemeTrack {
  lead: number[]; // MIDI note numbers
  bass: number[];
  tempo: number;
  wave: Wave;
  bassWave: Wave;
  drums: boolean;
}

/** Safari still exposes the constructor under a vendor prefix. */
interface PrefixedWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

const TRACKS: ThemeTrack[] = [
  {
    // Meadow - bouncy C major
    lead: [76, 79, 81, 79, 77, 81, 84, 81, 76, 79, 81, 83, 81, 79, 76, 74],
    bass: [48, 48, 55, 55, 53, 53, 60, 60, 48, 48, 55, 55, 56, 56, 53, 53],
    tempo: 150,
    wave: 'square',
    bassWave: 'triangle',
    drums: true,
  },
  {
    // Sunset - lazy minor sway
    lead: [69, 72, 76, 72, 74, 77, 81, 77, 69, 72, 76, 79, 77, 76, 72, 69],
    bass: [45, 45, 52, 52, 50, 50, 57, 57, 45, 45, 52, 52, 48, 48, 50, 50],
    tempo: 118,
    wave: 'triangle',
    bassWave: 'sine',
    drums: true,
  },
  {
    // Night - sparse waltz
    lead: [72, 76, 79, 84, 79, 76, 74, 76, 72, 76, 79, 81, 79, 76, 72, 71],
    bass: [48, 43, 50, 45, 48, 43, 50, 45, 48, 43, 50, 45, 46, 42, 48, 43],
    tempo: 104,
    wave: 'square',
    bassWave: 'sine',
    drums: false,
  },
];

const midiToFreq = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private theme = 0;
  muted = false;

  get ready() {
    return !!this.ctx;
  }

  /** Creates the audio graph. Safe to call repeatedly. */
  init() {
    if (this.ctx) return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext || (window as PrefixedWindow).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.75;
      this.sfxBus.connect(this.master);

      const len = Math.floor(this.ctx.sampleRate * 0.3);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.startMusic(this.theme);
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  }

  setMusicPaused(paused: boolean) {
    if (paused) this.stopMusic();
    else if (this.ctx) this.startMusic(this.theme);
  }

  setTheme(theme: number) {
    this.theme = ((theme % TRACKS.length) + TRACKS.length) % TRACKS.length;
    if (this.timer) this.startMusic(this.theme);
  }

  // --- Voices ---------------------------------------------------------------

  private voice(v: Voice, bus: GainNode | null = this.sfxBus) {
    if (!this.ctx || !bus) return;
    const t0 = this.ctx.currentTime + (v.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = v.type ?? 'square';
    osc.frequency.setValueAtTime(v.freq, t0);
    if (v.freq2 !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, v.freq2), t0 + v.dur);
    }
    const peak = v.gain ?? 0.25;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, v.dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + v.dur);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(t0);
    osc.stop(t0 + v.dur + 0.02);
  }

  private noiseHit(dur: number, gain: number, freq: number, delay = 0) {
    if (!this.ctx || !this.sfxBus || !this.noise) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  // --- SFX ------------------------------------------------------------------

  jump() {
    this.voice({ freq: 320, freq2: 720, dur: 0.16, type: 'square', gain: 0.2 });
  }

  doubleJump() {
    this.voice({ freq: 480, freq2: 980, dur: 0.18, type: 'square', gain: 0.2 });
  }

  coin() {
    this.voice({ freq: 988, dur: 0.06, type: 'square', gain: 0.18 });
    this.voice({ freq: 1319, dur: 0.22, type: 'square', gain: 0.16, delay: 0.06 });
  }

  stomp() {
    this.voice({ freq: 220, freq2: 80, dur: 0.12, type: 'square', gain: 0.22 });
    this.noiseHit(0.08, 0.12, 900);
  }

  kick() {
    this.voice({ freq: 420, freq2: 120, dur: 0.14, type: 'square', gain: 0.2 });
  }

  powerup() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.voice({ freq: f, dur: 0.12, type: 'square', gain: 0.2, delay: i * 0.06 }));
  }

  mega() {
    const notes = [392, 523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.voice({ freq: f, dur: 0.16, type: 'sawtooth', gain: 0.16, delay: i * 0.05 }));
  }

  oneUp() {
    const notes = [784, 1047, 1319, 1568];
    notes.forEach((f, i) => this.voice({ freq: f, dur: 0.16, type: 'triangle', gain: 0.22, delay: i * 0.09 }));
  }

  die() {
    const notes = [660, 622, 587, 523, 440, 392, 330];
    notes.forEach((f, i) => this.voice({ freq: f, dur: 0.2, type: 'square', gain: 0.22, delay: i * 0.12 }));
  }

  fireball() {
    this.voice({ freq: 700, freq2: 200, dur: 0.12, type: 'sawtooth', gain: 0.14 });
  }

  freeze() {
    this.voice({ freq: 1600, freq2: 400, dur: 0.3, type: 'triangle', gain: 0.16 });
  }

  boomerang() {
    this.voice({ freq: 900, freq2: 300, dur: 0.18, type: 'square', gain: 0.16 });
  }

  brick() {
    this.noiseHit(0.14, 0.18, 1400);
    this.voice({ freq: 300, freq2: 120, dur: 0.12, type: 'square', gain: 0.12 });
  }

  blockBump() {
    this.voice({ freq: 260, freq2: 180, dur: 0.08, type: 'square', gain: 0.12 });
  }

  slowmo() {
    this.voice({ freq: 800, freq2: 200, dur: 0.5, type: 'sine', gain: 0.2 });
  }

  magnet() {
    this.voice({ freq: 300, freq2: 900, dur: 0.4, type: 'triangle', gain: 0.16 });
  }

  jet() {
    this.noiseHit(0.09, 0.07, 2200);
  }

  combo(step: number) {
    const f = 440 * Math.pow(2, Math.min(step, 8) / 12);
    this.voice({ freq: f, freq2: f * 1.5, dur: 0.14, type: 'square', gain: 0.2 });
  }

  hurry() {
    for (let i = 0; i < 3; i++) this.voice({ freq: 880, dur: 0.12, type: 'square', gain: 0.18, delay: i * 0.18 });
  }

  levelClear() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.voice({ freq: f, dur: 0.3, type: 'square', gain: 0.2, delay: i * 0.16 }));
  }

  pause() {
    this.voice({ freq: 500, freq2: 300, dur: 0.12, type: 'triangle', gain: 0.16 });
  }

  // --- Music ----------------------------------------------------------------

  private startMusic(theme: number) {
    if (!this.ctx) return;
    this.stopMusic();
    const track = TRACKS[theme % TRACKS.length];
    const stepDur = 60 / track.tempo / 4;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => {
      if (!this.ctx || !this.musicBus) return;
      while (this.nextTime < this.ctx.currentTime + 0.2) {
        const t = this.nextTime;
        const lead = track.lead[this.step % track.lead.length];
        const bass = track.bass[this.step % track.bass.length];
        if (lead !== undefined) this.scheduleNote(midiToFreq(lead), t, stepDur * 1.7, track.wave, 0.16);
        if (bass !== undefined) this.scheduleNote(midiToFreq(bass), t, stepDur * 1.9, track.bassWave, 0.2);
        if (track.drums) {
          if (this.step % 4 === 0) this.scheduleKick(t);
          if (this.step % 2 === 1) this.scheduleHat(t, stepDur * 0.6);
        }
        this.nextTime += stepDur;
        this.step++;
      }
    }, 40);
  }

  private stopMusic() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private scheduleNote(freq: number, t: number, dur: number, type: Wave, gain: number) {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private scheduleKick(t: number) {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  private scheduleHat(t: number, dur: number) {
    if (!this.ctx || !this.musicBus || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const audio = new AudioEngine();
