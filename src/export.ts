import type { ProjectSettings, ZoomSegment } from "./types";
import { drawFrame } from "./renderer";

export interface ExportOptions {
  video: HTMLVideoElement;
  duration: number;
  settings: ProjectSettings;
  zooms: ZoomSegment[];
  width: number;
  height: number;
  fps: number;
  onProgress: (ratio: number) => void;
}

interface AudioGraph {
  source: MediaElementAudioSourceNode;
  dest: MediaStreamAudioDestinationNode;
  ctx: AudioContext;
}

// Un élément <video> ne peut être connecté qu'une seule fois à un
// AudioContext : on mémorise le graphe pour les exports suivants.
const audioGraphs = new WeakMap<HTMLVideoElement, AudioGraph>();

function getAudioGraph(video: HTMLVideoElement): AudioGraph {
  let g = audioGraphs.get(video);
  if (!g) {
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);
    source.connect(ctx.destination);
    g = { source, dest, ctx };
    audioGraphs.set(video, g);
  }
  return g;
}

/** Rejoue la vidéo en temps réel en la composant sur un canevas enregistré. */
export function exportVideo(opts: ExportOptions): Promise<Blob> {
  const { video, duration, settings, zooms, width, height, fps, onProgress } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(fps);
  const graph = getAudioGraph(video);
  graph.ctx.resume();
  // Export silencieux pour l'utilisateur : on coupe la sortie haut-parleurs
  // mais le flux d'export garde l'audio.
  graph.source.disconnect(graph.ctx.destination);
  stream.addTrack(graph.dest.stream.getAudioTracks()[0]);

  const mime = ["video/webm;codecs=vp9,opus", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m)
  );
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    let rafId = 0;

    const finish = () => {
      cancelAnimationFrame(rafId);
      video.pause();
      recorder.onstop = () => {
        graph.source.connect(graph.ctx.destination);
        resolve(new Blob(chunks, { type: mime ?? "video/webm" }));
      };
      recorder.stop();
    };

    const tick = () => {
      drawFrame(ctx, video, video.currentTime, settings, zooms);
      onProgress(Math.min(1, video.currentTime / duration));
      if (video.ended || video.currentTime >= duration) {
        finish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    video.pause();
    video.currentTime = 0;
    video.onseeked = () => {
      video.onseeked = null;
      video
        .play()
        .then(() => {
          recorder.start(1000);
          tick();
        })
        .catch((err) => {
          graph.source.connect(graph.ctx.destination);
          reject(err);
        });
    };
  });
}
