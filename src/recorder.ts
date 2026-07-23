export interface ActiveRecording {
  /** Termine l'enregistrement et renvoie la vidéo. */
  stop: () => Promise<Blob>;
  /** Déclenché si l'utilisateur arrête le partage depuis l'UI du navigateur. */
  onAutoStop: (cb: (blob: Blob) => void) => void;
}

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export async function startRecording(withMic: boolean): Promise<ActiveRecording> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: 60 },
    audio: true,
  });

  const tracks: MediaStreamTrack[] = [...display.getVideoTracks()];
  const audioSources: MediaStream[] = [];
  if (display.getAudioTracks().length > 0) audioSources.push(display);

  let mic: MediaStream | null = null;
  if (withMic) {
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioSources.push(mic);
    } catch {
      // Micro refusé : on continue sans lui.
    }
  }

  let audioCtx: AudioContext | null = null;
  if (audioSources.length > 0) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    for (const s of audioSources) audioCtx.createMediaStreamSource(s).connect(dest);
    tracks.push(...dest.stream.getAudioTracks());
  }

  const mime = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const recorder = new MediaRecorder(new MediaStream(tracks), {
    mimeType: mime || undefined,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(1000);

  let stopped = false;
  const cleanup = () => {
    display.getTracks().forEach((t) => t.stop());
    mic?.getTracks().forEach((t) => t.stop());
    audioCtx?.close();
  };

  const finish = (): Promise<Blob> =>
    new Promise((resolve) => {
      if (stopped) return;
      stopped = true;
      recorder.onstop = () => {
        cleanup();
        resolve(new Blob(chunks, { type: mime || "video/webm" }));
      };
      recorder.stop();
    });

  let autoStopCb: ((blob: Blob) => void) | null = null;
  display.getVideoTracks()[0].addEventListener("ended", async () => {
    if (stopped) return;
    const blob = await finish();
    autoStopCb?.(blob);
  });

  return {
    stop: finish,
    onAutoStop: (cb) => {
      autoStopCb = cb;
    },
  };
}
