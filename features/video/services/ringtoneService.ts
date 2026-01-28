class RingtoneService {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private intervalId: NodeJS.Timeout | null = null;

  // Default ringtone settings (WhatsApp-like)
  private waveform: OscillatorType = 'triangle';
  private pattern: { time: number; frequency: number }[] = [
    { time: 0, frequency: 600 },
    { time: 0.2, frequency: 800 },
    { time: 0.4, frequency: 600 },
  ];
  private ringDuration = 0.6; // total of 3 short beeps
  private pauseDuration = 0.4; // pause before repeating
  private volume = 0.3;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  private async ensureAudioContext() {
    if (!this.audioContext) this.initializeAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
      }
    }
  }

  setTone(options: {
    waveform?: OscillatorType;
    pattern?: { time: number; frequency: number }[];
    ringDuration?: number;
    pauseDuration?: number;
    volume?: number;
  }) {
    if (options.waveform) this.waveform = options.waveform;
    if (options.pattern) this.pattern = options.pattern;
    if (options.ringDuration !== undefined) this.ringDuration = options.ringDuration;
    if (options.pauseDuration !== undefined) this.pauseDuration = options.pauseDuration;
    if (options.volume !== undefined) this.volume = options.volume;
  }

  async startRingtone() {
    if (this.isPlaying) return;
    try {
      await this.ensureAudioContext();
      this.isPlaying = true;
      this.playRingtonePattern();
    } catch (error) {
      console.error('Failed to start ringtone:', error);
    }
  }

  private playRingtonePattern() {
    if (!this.audioContext || !this.isPlaying) return;

    this.playTone();

    const intervalTime = (this.ringDuration + this.pauseDuration) * 1000;
    this.intervalId = setInterval(() => {
      if (this.isPlaying) this.playTone();
    }, intervalTime);
  }

  private playTone() {
    if (!this.audioContext) return;

    try {
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      this.oscillator.type = this.waveform;

      this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.05);
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + this.ringDuration);

      this.pattern.forEach(({ time, frequency }) => {
        this.oscillator!.frequency.setValueAtTime(frequency, this.audioContext!.currentTime + time);
      });

      this.oscillator.start(this.audioContext.currentTime);
      this.oscillator.stop(this.audioContext.currentTime + this.ringDuration);

      this.oscillator.onended = () => {
        this.oscillator?.disconnect();
        this.gainNode?.disconnect();
        this.oscillator = null;
        this.gainNode = null;
      };
    } catch (error) {
      console.error('Failed to play tone:', error);
    }
  }

  stopRingtone() {
    this.isPlaying = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.oscillator) {
      try { this.oscillator.stop(); } catch {}
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  async playRingtone() {
    try {
      await this.startRingtone();
      return { stop: () => this.stopRingtone() };
    } catch {
      return { stop: () => this.stopRingtone() };
    }
  }

  async playRingtoneFile(audioUrl: string = '/sounds/ringtone.mp3') {
    try {
      const audio = new Audio(audioUrl);
      audio.loop = true;
      audio.volume = 0.5;
      await audio.play();
      return { stop: () => { audio.pause(); audio.currentTime = 0; } };
    } catch {
      this.startRingtone();
      return { stop: () => this.stopRingtone() };
    }
  }

  dispose() {
    this.stopRingtone();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Singleton instance
export const ringtoneService = new RingtoneService();
export default ringtoneService;
