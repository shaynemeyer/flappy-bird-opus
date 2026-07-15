/**
 * Lightweight synthesized sound effects using the Web Audio API — no audio
 * assets required. The AudioContext is created lazily on the first user gesture
 * to comply with browser autoplay policies, and every call degrades gracefully
 * if audio is unavailable.
 */
type Ctor = typeof AudioContext;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;

  /** Must be called from within a user-gesture handler (e.g. tap/keydown). */
  resume(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      const Ctx: Ctor | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!Ctx) {
        this.enabled = false;
        return;
      }
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch {
        this.enabled = false;
        return;
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private tone(
    type: OscillatorType,
    startFreq: number,
    endFreq: number,
    duration: number,
    gain: number,
    delay = 0,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, gain: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, t0);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(env);
    env.connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  flap(): void {
    this.tone('square', 480, 700, 0.1, 0.25);
  }

  score(): void {
    this.tone('square', 720, 720, 0.08, 0.25);
    this.tone('square', 1040, 1040, 0.1, 0.22, 0.07);
  }

  hit(): void {
    this.noise(0.12, 0.5);
    this.tone('square', 260, 90, 0.18, 0.3);
  }

  die(): void {
    this.tone('sawtooth', 420, 70, 0.5, 0.28, 0.05);
  }
}
