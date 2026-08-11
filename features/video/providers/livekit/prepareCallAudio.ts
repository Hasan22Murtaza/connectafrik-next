import {
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
}): Promise<PreparedLiveKitJoin> {
  const { serverUrl, token, video, roomOptions } = options;

  const room = new Room({
    ...roomOptions,
    audioCaptureDefaults: {
      ...CALL_AUDIO_CAPTURE,
      ...(roomOptions?.audioCaptureDefaults ?? {}),
    },
  });

  const tracks = await createLocalTracks({
    audio: CALL_AUDIO_CAPTURE,
    video,
  });

  try {
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
    throw err;
  }
}
