import type { GameEffectType } from '../shared/types';

class SalonSoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playCardSnap(): void {
    this.playTone(320, 0.065, 'triangle', 0.09, 0, 140);
    this.playTone(680, 0.04, 'sine', 0.04, 0.01, 420);
  }

  public playSwap(): void {
    this.playTone(380, 0.06, 'sine', 0.06, 0, 520);
    this.playTone(520, 0.06, 'sine', 0.06, 0.065, 640);
  }

  public playSevenAlert(): void {
    this.playTone(587.33, 0.14, 'triangle', 0.09, 0);
    this.playTone(440, 0.2, 'triangle', 0.09, 0.11);
  }

  public playResetTwo(): void {
    this.playTone(440, 0.1, 'sine', 0.07, 0);
    this.playTone(659.25, 0.16, 'sine', 0.08, 0.08);
  }

  public playBurn(): void {
    this.playTone(220, 0.28, 'sawtooth', 0.07, 0, 620);
    this.playTone(440, 0.18, 'triangle', 0.07, 0.07, 880);
    this.playTone(784, 0.24, 'sine', 0.06, 0.14);
  }

  public playPickup(): void {
    this.playTone(240, 0.16, 'triangle', 0.1, 0, 110);
    this.playTone(170, 0.22, 'sine', 0.09, 0.08, 95);
  }

  public playReactionPop(): void {
    this.playTone(520, 0.08, 'sine', 0.06, 0, 820);
  }

  public playVictory(): void {
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((f, idx) => {
      this.playTone(f, 0.36, 'triangle', 0.08, idx * 0.08);
    });
  }

  public playEffect(effect: GameEffectType): void {
    switch (effect) {
      case 'burn':
        this.playBurn();
        break;
      case 'seven':
        this.playSevenAlert();
        break;
      case 'reset':
        this.playResetTwo();
        break;
      case 'pickup':
        this.playPickup();
        break;
      case 'win':
        this.playVictory();
        break;
      case 'swap':
        this.playSwap();
        break;
      case 'deal':
        this.playTone(340, 0.07, 'triangle', 0.06, 0);
        this.playTone(460, 0.08, 'triangle', 0.06, 0.07);
        break;
      default:
        this.playCardSnap();
        break;
    }
  }
}

export const salonSound = new SalonSoundEngine();
