class RingtoneService {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    // Initialize AudioContext on user interaction
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
    if (!this.audioContext) {
      this.initializeAudioContext();
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Failed to resume audio context:', error);
      }
    }
  }

  async startRingtone() {
    if (this.isPlaying || !this.audioContext) return;

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

    // Play ringtone pattern: ring for 2 seconds, pause for 1 second, repeat
    this.playTone();
    
    this.intervalId = setInterval(() => {
      if (this.isPlaying) {
        this.playTone();
      }
    }, 3000); // Repeat every 3 seconds (2s ring + 1s pause)
  }

  private playTone() {
    if (!this.audioContext) return;

    try {
      // Create oscillator for the ringtone
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      // Connect nodes
      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Set ringtone frequency (pleasant phone ring tone)
      this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      
      // Set volume
      this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.1);
      this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 2);

      // Create ringtone pattern with frequency modulation
      this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
      this.oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 0.5);
      this.oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime + 1);
      this.oscillator.frequency.setValueAtTime(1000, this.audioContext.currentTime + 1.5);

      // Start and stop the tone
      this.oscillator.start(this.audioContext.currentTime);
      this.oscillator.stop(this.audioContext.currentTime + 2);

      // Clean up
      this.oscillator.onended = () => {
        if (this.oscillator) {
          this.oscillator.disconnect();
          this.oscillator = null;
        }
        if (this.gainNode) {
          this.gainNode.disconnect();
          this.gainNode = null;
        }
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
      try {
        this.oscillator.stop();
      } catch (error) {
        // Oscillator might already be stopped
      }
      this.oscillator = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  // Main method for playing ringtone (used by VideoSDKCallModal)
  async playRingtone() {
    try {
      await this.startRingtone();
      return {
        stop: () => this.stopRingtone()
      };
    } catch (error) {
      console.error('Failed to play ringtone:', error);
      return {
        stop: () => this.stopRingtone()
      };
    }
  }

  // Alternative method using HTML5 Audio with a ringtone file
  async playRingtoneFile(audioUrl: string = '/sounds/ringtone.mp3') {
    try {
      const audio = new Audio(audioUrl);
      audio.loop = true;
      audio.volume = 0.5;
      
      await audio.play();
      
      return {
        stop: () => {
          audio.pause();
          audio.currentTime = 0;
        }
      };
    } catch (error) {
      console.warn('Failed to play ringtone file, falling back to generated tone:', error);
      this.startRingtone();
      return {
        stop: () => this.stopRingtone()
      };
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

// Create a singleton instance
export const ringtoneService = new RingtoneService();

export default ringtoneService;


