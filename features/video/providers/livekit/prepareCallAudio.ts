import {
  ExternalE2EEKeyProvider,
  Room,
  createLocalTracks,
  type AudioCaptureOptions,
  type LocalTrack,
  type RoomOptions,
} from 'livekit-client';

export const CALL_AUDIO_CAPTURE: AudioCaptureOptions = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export type PreparedLiveKitJoin = {
  room: Room;
  tracks: LocalTrack[];
};

export async function connectLiveKitWithPreparedAudio(options: {
  serverUrl: string;
  token: string;
  video: boolean;
  roomOptions?: RoomOptions;
  encryptionKey?: string;
}): Promise<PreparedLiveKitJoin> {
  const { serverUrl, token, video, roomOptions, encryptionKey } = options;
  const key = encryptionKey?.trim();

  const keyProvider = key ? new ExternalE2EEKeyProvider() : undefined;
  const worker = key
    ? new Worker(new URL('livekit-client/e2ee-worker', import.meta.url))
    : undefined;

  const room = new Room({
    ...roomOptions,
    audioCaptureDefaults: {
      ...CALL_AUDIO_CAPTURE,
      ...(roomOptions?.audioCaptureDefaults ?? {}),
    },
    ...(keyProvider && worker
      ? {
          encryption: {
            keyProvider,
            worker,
          },
        }
      : {}),
  });

  const tracks = await createLocalTracks({
    audio: CALL_AUDIO_CAPTURE,
    video,
  });

  try {
    if (keyProvider && key) {
      await keyProvider.setKey(key);
      await room.setE2EEEnabled(true);
    }

    await room.connect(serverUrl, token);

    await Promise.all(
      tracks.map((track) => room.localParticipant.publishTrack(track)),
    );

    await room.startAudio().catch(() => undefined);

    return { room, tracks };
  } catch (err) {
    tracks.forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    await room.disconnect().catch(() => undefined);
    worker?.terminate();
    throw err;
  }
}
