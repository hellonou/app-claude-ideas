export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Les WebM produits par MediaRecorder ont souvent une durée `Infinity`
 * (bug Chromium connu). Forcer un seek très loin oblige le navigateur
 * à calculer la vraie durée.
 */
export function ensureDuration(video: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    if (isFinite(video.duration) && video.duration > 0) {
      resolve(video.duration);
      return;
    }
    const onUpdate = () => {
      video.removeEventListener("timeupdate", onUpdate);
      video.currentTime = 0;
      resolve(video.duration);
    };
    video.addEventListener("timeupdate", onUpdate);
    video.currentTime = 1e101;
  });
}
