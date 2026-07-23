import type { ZoomSegment } from "./types";
import { clamp, formatTime } from "./utils";

export interface TimelineCallbacks {
  onSeek: (t: number) => void;
  onSelect: (id: string | null) => void;
  onChange: () => void;
}

const MIN_SEGMENT = 0.5;

/**
 * Timeline DOM : une piste cliquable (seek), des blocs de zoom déplaçables
 * et redimensionnables par leurs bords, et une tête de lecture.
 */
export class Timeline {
  private track: HTMLDivElement;
  private playhead: HTMLDivElement;
  private duration = 0;

  constructor(
    private root: HTMLElement,
    private zooms: ZoomSegment[],
    private cb: TimelineCallbacks
  ) {
    this.root.innerHTML = "";
    this.track = document.createElement("div");
    this.track.className = "tl-track";
    this.playhead = document.createElement("div");
    this.playhead.className = "tl-playhead";
    this.root.appendChild(this.track);
    this.track.appendChild(this.playhead);

    this.track.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest(".tl-segment")) return;
      this.cb.onSelect(null);
      const seek = (ev: PointerEvent) => {
        const rect = this.track.getBoundingClientRect();
        const t = clamp((ev.clientX - rect.left) / rect.width, 0, 1) * this.duration;
        this.cb.onSeek(t);
      };
      seek(e);
      const onMove = (ev: PointerEvent) => seek(ev);
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  setDuration(d: number): void {
    this.duration = d;
    this.render(null);
  }

  updatePlayhead(t: number): void {
    if (this.duration <= 0) return;
    this.playhead.style.left = `${(t / this.duration) * 100}%`;
  }

  render(selectedId: string | null): void {
    this.track.querySelectorAll(".tl-segment").forEach((el) => el.remove());
    if (this.duration <= 0) return;

    for (const z of this.zooms) {
      const el = document.createElement("div");
      el.className = "tl-segment" + (z.id === selectedId ? " selected" : "");
      el.style.left = `${(z.start / this.duration) * 100}%`;
      el.style.width = `${((z.end - z.start) / this.duration) * 100}%`;
      el.innerHTML =
        `<span class="tl-handle tl-handle-l"></span>` +
        `<span class="tl-label">🔍 ×${z.scale.toFixed(1)} · ${formatTime(z.start)}</span>` +
        `<span class="tl-handle tl-handle-r"></span>`;
      this.attachDrag(el, z);
      this.track.appendChild(el);
    }
  }

  private attachDrag(el: HTMLDivElement, z: ZoomSegment): void {
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      this.cb.onSelect(z.id);

      const target = e.target as HTMLElement;
      const mode = target.classList.contains("tl-handle-l")
        ? "resize-l"
        : target.classList.contains("tl-handle-r")
          ? "resize-r"
          : "move";

      const rect = this.track.getBoundingClientRect();
      const startX = e.clientX;
      const orig = { start: z.start, end: z.end };

      const onMove = (ev: PointerEvent) => {
        const dt = ((ev.clientX - startX) / rect.width) * this.duration;
        if (mode === "move") {
          const len = orig.end - orig.start;
          z.start = clamp(orig.start + dt, 0, this.duration - len);
          z.end = z.start + len;
        } else if (mode === "resize-l") {
          z.start = clamp(orig.start + dt, 0, z.end - MIN_SEGMENT);
        } else {
          z.end = clamp(orig.end + dt, z.start + MIN_SEGMENT, this.duration);
        }
        this.render(z.id);
        this.cb.onChange();
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }
}
