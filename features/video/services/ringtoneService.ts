const RINGTONE_URL = '/assets/sounds/ringtone.mp3';

let ringtoneAudio: HTMLAudioElement | null = null;
let isRingtonePlaying = false;
let ringbackAudio: HTMLAudioElement | null = null;
let isRingbackPlaying = false;
let generation = 0;
let ringtoneInteractionCleanup: (() => void) | null = null;
let ringbackInteractionCleanup: (() => void) | null = null;

function createAudio(volume: number): HTMLAudioElement {
  const audio = new Audio(RINGTONE_URL);
  audio.loop = true;
  audio.volume = volume;
  audio.preload = 'auto';
  return audio;
}

/**
 * Registers click/touch/key listeners so the audio starts on the very
 * first user interaction. Handles browsers that block autoplay when
 * the page hasn't received a gesture yet.
 */
function setupInteractionRetry(audio: HTMLAudioElement, gen: number): () => void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.removeEventListener('click', tryPlay);
    document.removeEventListener('touchstart', tryPlay);
    document.removeEventListener('keydown', tryPlay);
  };
  const tryPlay = () => {
    if (generation !== gen || cleaned) { cleanup(); return; }
    audio.play().then(cleanup).catch(() => {});
  };
  document.addEventListener('click', tryPlay);
  document.addEventListener('touchstart', tryPlay);
  document.addEventListener('keydown', tryPlay);
  return cleanup;
}

/** Play the ringtone for incoming calls (receiver hears this). */
export async function startRingtone(): Promise<void> {
  if (isRingtonePlaying) return;
  const gen = generation;
  const audio = createAudio(0.7);
  try {
    await audio.play();
    if (gen !== generation) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    ringtoneAudio = audio;
    isRingtonePlaying = true;
  } catch {
    // Autoplay blocked — store audio and retry on next user interaction
    ringtoneAudio = audio;
    isRingtonePlaying = true;
    ringtoneInteractionCleanup = setupInteractionRetry(audio, gen);
  }
}

export function stopRingtone(): void {
  isRingtonePlaying = false;
  generation++;
  if (ringtoneInteractionCleanup) {
    ringtoneInteractionCleanup();
    ringtoneInteractionCleanup = null;
  }
  if (ringtoneAudio) {
    ringtoneAudio.pause();
    ringtoneAudio.currentTime = 0;
    ringtoneAudio = null;
  }
}

/** Play ringback tone for outgoing calls (caller hears this while waiting). */
export async function startRingback(): Promise<void> {
  if (isRingbackPlaying) return;
  const gen = generation;
  const audio = createAudio(0.35);
  try {
    await audio.play();
    if (gen !== generation) {
      audio.pause();
      audio.currentTime = 0;
      return;
    }
    ringbackAudio = audio;
    isRingbackPlaying = true;
  } catch {
    ringbackAudio = audio;
    isRingbackPlaying = true;
    ringbackInteractionCleanup = setupInteractionRetry(audio, gen);
  }
}

export function stopRingback(): void {
  isRingbackPlaying = false;
  generation++;
  if (ringbackInteractionCleanup) {
    ringbackInteractionCleanup();
    ringbackInteractionCleanup = null;
  }
  if (ringbackAudio) {
    ringbackAudio.pause();
    ringbackAudio.currentTime = 0;
    ringbackAudio = null;
  }
}

export function stopAll(): void {
  stopRingtone();
  stopRingback();
}

export async function playRingtone(): Promise<{ stop: () => void }> {
  await startRingtone();
  return { stop: stopRingtone };
}

export async function playRingbackTone(): Promise<{ stop: () => void }> {
  await startRingback();
  return { stop: stopRingback };
}

export function dispose(): void {
  stopAll();
}
