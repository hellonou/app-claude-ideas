import type { ProjectSettings, ZoomSegment } from "./types";
import { clamp, easeInOutCubic } from "./utils";
import { fillGradient, getGradient } from "./gradients";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Zone occupée par la vidéo (la « carte ») dans le canevas, marge déduite. */
export function computeCardRect(
  canvasW: number,
  canvasH: number,
  videoW: number,
  videoH: number,
  paddingPct: number
): Rect {
  const pad = (Math.min(canvasW, canvasH) * paddingPct) / 100;
  const availW = canvasW - pad * 2;
  const availH = canvasH - pad * 2;
  const scale = Math.min(availW / videoW, availH / videoH);
  const w = videoW * scale;
  const h = videoH * scale;
  return { x: (canvasW - w) / 2, y: (canvasH - h) / 2, w, h };
}

/** Facteur de zoom effectif à l'instant t (rampes adoucies en entrée/sortie). */
export function zoomAt(
  t: number,
  zooms: ZoomSegment[]
): { scale: number; x: number; y: number } | null {
  for (const z of zooms) {
    if (t < z.start || t > z.end) continue;
    const transition = Math.min(0.6, (z.end - z.start) / 2);
    const tIn = clamp((t - z.start) / transition, 0, 1);
    const tOut = clamp((z.end - t) / transition, 0, 1);
    const k = easeInOutCubic(Math.min(tIn, tOut));
    return { scale: 1 + (z.scale - 1) * k, x: z.x, y: z.y };
  }
  return null;
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  time: number,
  settings: ProjectSettings,
  zooms: ZoomSegment[]
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  fillGradient(ctx, w, h, getGradient(settings.gradientId));

  if (!video.videoWidth || !video.videoHeight) return;

  const card = computeCardRect(w, h, video.videoWidth, video.videoHeight, settings.padding);
  const radius = settings.radius * (h / 1080);

  if (settings.shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${0.25 + settings.shadow * 0.005})`;
    ctx.shadowBlur = settings.shadow * (h / 1080) * 1.2;
    ctx.shadowOffsetY = settings.shadow * (h / 1080) * 0.35;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, card.w, card.h, radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.w, card.h, radius);
  ctx.clip();

  const zoom = zoomAt(time, zooms);
  if (zoom && zoom.scale > 1) {
    const px = card.x + zoom.x * card.w;
    const py = card.y + zoom.y * card.h;
    ctx.translate(px, py);
    ctx.scale(zoom.scale, zoom.scale);
    ctx.translate(-px, -py);
  }
  ctx.drawImage(video, card.x, card.y, card.w, card.h);
  ctx.restore();
}
