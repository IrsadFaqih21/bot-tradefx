/**
 * AudioService - Synthesizes high-tech UI audio feedback using Web Audio API.
 * Zero external audio files required, zero latency, works 100% offline.
 */
class AudioService {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('tradefx_sound_enabled') !== 'false';
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound(enable) {
    this.enabled = enable !== undefined ? enable : !this.enabled;
    localStorage.setItem('tradefx_sound_enabled', this.enabled ? 'true' : 'false');
    return this.enabled;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1, delay = 0) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const startTime = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Sound when user starts the bot
  playBotStart() {
    if (!this.enabled) return;
    this.init();
    this.playTone(260, 'sine', 0.12, 0.12, 0);
    this.playTone(390, 'sine', 0.12, 0.12, 0.08);
    this.playTone(520, 'triangle', 0.2, 0.15, 0.16);
  }

  // Sound when user stops the bot
  playBotStop() {
    if (!this.enabled) return;
    this.init();
    this.playTone(520, 'sine', 0.12, 0.12, 0);
    this.playTone(390, 'sine', 0.12, 0.12, 0.08);
    this.playTone(260, 'triangle', 0.25, 0.15, 0.16);
  }

  // Sound when open position is executed
  playOrderPlaced() {
    if (!this.enabled) return;
    this.init();
    this.playTone(580, 'sine', 0.08, 0.12, 0);
    this.playTone(880, 'sine', 0.14, 0.15, 0.07);
  }

  // Sound when trade ends in PROFIT (Win)
  playWin() {
    if (!this.enabled) return;
    this.init();
    // Upbeat victorious major triad (C5 - E5 - G5 - C6)
    this.playTone(523.25, 'triangle', 0.18, 0.15, 0.0);
    this.playTone(659.25, 'triangle', 0.18, 0.18, 0.1);
    this.playTone(783.99, 'triangle', 0.22, 0.20, 0.2);
    this.playTone(1046.50, 'sine', 0.45, 0.25, 0.3);
  }

  // Sound when trade ends in LOSS
  playLoss() {
    if (!this.enabled) return;
    this.init();
    // Gentle low minor tone
    this.playTone(311.13, 'sine', 0.2, 0.12, 0.0);
    this.playTone(261.63, 'sine', 0.35, 0.15, 0.15);
  }

  // Button tap sound
  playTap() {
    if (!this.enabled) return;
    this.playTone(700, 'sine', 0.04, 0.05, 0);
  }
}

export const audioService = new AudioService();

