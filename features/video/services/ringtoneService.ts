const RINGTONE_URL = '/assets/sounds/ringtone.mp3';

class RingtoneService {
  // Incoming ringtone (receiver side)
  private ringtoneAudio: HTMLAudioElement | null = null;
  private isPlaying = false;

  // Ringback tone (caller side) — uses same file with lower volume
  private ringbackAudio: HTMLAudioElement | null = null;
  private isRingbackPlaying = false;

  // Generation counter: incremented on every stop so pending async starts are cancelled
  private generation = 0;

  /** Play the ringtone file for incoming calls (receiver hears this). */
  async startRingtone() {
    if (this.isPlaying) return;
    const gen = this.generation;
    try {
      const audio = this.createAudio(0.7);
      // Await the play() promise — browsers may reject if no user gesture yet
      await audio.play();
      if (gen !== this.generation) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
      this.ringtoneAudio = audio;
      this.isPlaying = true;
    } catch (error) {
      console.warn('Ringtone play blocked (no user gesture yet), will retry on interaction:', error);
    }
  }

  stopRingtone() {
    this.isPlaying = false;
    this.generation++;

    if (this.ringtoneAudio) {
      this.ringtoneAudio.pause();
      this.ringtoneAudio.currentTime = 0;
      this.ringtoneAudio = null;
    }
  }

  /** Play ringback tone for outgoing calls (caller hears this while waiting). */
  async startRingback() {
    if (this.isRingbackPlaying) return;
    const gen = this.generation;
    try {
      const audio = this.createAudio(0.35);
      await audio.play();
      if (gen !== this.generation) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
      this.ringbackAudio = audio;
      this.isRingbackPlaying = true;
    } catch (error) {
      console.warn('Ringback play blocked:', error);
    }
  }

  stopRingback() {
    this.isRingbackPlaying = false;
    this.generation++;

    if (this.ringbackAudio) {
      this.ringbackAudio.pause();
      this.ringbackAudio.currentTime = 0;
      this.ringbackAudio = null;
    }
  }

  /** Stop all tones (both ringtone and ringback). */
  stopAll() {
    this.stopRingtone();
    this.stopRingback();
  }

  async playRingtone() {
    try {
      await this.startRingtone();
      return { stop: () => this.stopRingtone() };
    } catch {
      return { stop: () => this.stopRingtone() };
    }
  }

  async playRingbackTone() {
    try {
      await this.startRingback();
      return { stop: () => this.stopRingback() };
    } catch {
      return { stop: () => this.stopRingback() };
    }
  }

  dispose() {
    this.stopAll();
  }

  /** Create a looping Audio element from the ringtone file. */
  private createAudio(volume: number): HTMLAudioElement {
    const audio = new Audio(RINGTONE_URL);
    audio.loop = true;
    audio.volume = volume;
    audio.preload = 'auto';
    return audio;
  }
}

// Singleton instance
export const ringtoneService = new RingtoneService();
export default ringtoneService;
