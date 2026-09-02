import "./styles.css";
import type { ProjectSettings, ZoomSegment } from "./types";
import { GRADIENTS, gradientCss } from "./gradients";
import { computeCardRect, drawFrame, zoomAt } from "./renderer";
import { startRecording, type ActiveRecording } from "./recorder";
import { Timeline } from "./timeline";
import { exportVideo } from "./export";
import { clamp, ensureDuration, formatTime, uid } from "./utils";

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Élément introuvable : ${sel}`);
  return el;
};

// --- État -------------------------------------------------------------------

const settings: ProjectSettings = {
  gradientId: "violet",
  padding: 6,
  radius: 24,
  shadow: 60,
};
const zooms: ZoomSegment[] = [];
let selectedId: string | null = null;
let duration = 0;
let recording: ActiveRecording | null = null;
let recTimerInterval = 0;
let objectUrl: string | null = null;

const video = document.createElement("video");
video.playsInline = true;
video.preload = "auto";

// --- Références DOM ---------------------------------------------------------

const previewCanvas = $<HTMLCanvasElement>("#preview");
const previewCtx = previewCanvas.getContext("2d")!;
const timeLabel = $("#time-label");
const btnPlay = $("#btn-play");
const zoomPanel = $("#zoom-panel");
const homeError = $("#home-error");

const timeline = new Timeline($("#timeline"), zooms, {
  onSeek: (t) => {
    video.currentTime = clamp(t, 0, duration);
  },
  onSelect: (id) => {
    selectedId = id;
    syncZoomPanel();
    timeline.render(selectedId);
  },
  onChange: () => {
    /* re-rendu au prochain rAF */
  },
});

// --- Navigation entre écrans ------------------------------------------------

function showScreen(id: string): void {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  $(`#${id}`).classList.add("active");
}

// --- Enregistrement ---------------------------------------------------------

$("#btn-record").addEventListener("click", async () => {
  homeError.hidden = true;
  const withMic = $<HTMLInputElement>("#chk-mic").checked;
  try {
    recording = await startRecording(withMic);
  } catch {
    homeError.textContent =
      "Impossible de démarrer la capture. Vérifiez que votre navigateur autorise le partage d'écran.";
    homeError.hidden = false;
    return;
  }
  showScreen("screen-recording");
  const startedAt = Date.now();
  const timerEl = $("#rec-timer");
  timerEl.textContent = "00:00";
  recTimerInterval = window.setInterval(() => {
    timerEl.textContent = formatTime((Date.now() - startedAt) / 1000);
  }, 500);
  recording.onAutoStop((blob) => endRecording(blob));
});

$("#btn-stop").addEventListener("click", async () => {
  if (!recording) return;
  const blob = await recording.stop();
  endRecording(blob);
});

function endRecording(blob: Blob): void {
  clearInterval(recTimerInterval);
  recording = null;
  openEditor(blob);
}

// --- Import de fichier ------------------------------------------------------

$("#btn-import").addEventListener("click", () => $<HTMLInputElement>("#input-import").click());
$<HTMLInputElement>("#input-import").addEventListener("change", (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) openEditor(file);
});

// Point d'entrée utilisé par les tests automatisés.
(window as unknown as Record<string, unknown>).__loadVideoBlob = (blob: Blob) =>
  openEditor(blob);

// --- Éditeur ----------------------------------------------------------------

async function openEditor(blob: Blob): Promise<void> {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(blob);
  video.src = objectUrl;

  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  duration = await ensureDuration(video);

  zooms.length = 0;
  selectedId = null;
  timeline.setDuration(duration);
  syncZoomPanel();
  syncSettingsControls();
  showScreen("screen-editor");
}

function previewLoop(): void {
  if (video.videoWidth) {
    drawFrame(previewCtx, video, video.currentTime, settings, zooms);
    drawZoomTarget();
    timeline.updatePlayhead(video.currentTime);
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
    btnPlay.textContent = video.paused ? "▶" : "⏸";
  }
  requestAnimationFrame(previewLoop);
}
requestAnimationFrame(previewLoop);

/** Réticule sur l'aperçu quand un zoom est sélectionné et inactif à l'instant t. */
function drawZoomTarget(): void {
  const z = zooms.find((s) => s.id === selectedId);
  if (!z) return;
  const card = computeCardRect(
    previewCanvas.width,
    previewCanvas.height,
    video.videoWidth,
    video.videoHeight,
    settings.padding
  );
  const active = zoomAt(video.currentTime, zooms);
  if (active && active.scale > 1.05) return;
  const px = card.x + z.x * card.w;
  const py = card.y + z.y * card.h;
  const ctx = previewCtx;
  ctx.save();
  ctx.strokeStyle = "rgba(139, 92, 246, 0.95)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(px, py, 28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px - 40, py);
  ctx.lineTo(px + 40, py);
  ctx.moveTo(px, py - 40);
  ctx.lineTo(px, py + 40);
  ctx.stroke();
  ctx.restore();
}

btnPlay.addEventListener("click", togglePlay);
function togglePlay(): void {
  if (video.paused) {
    if (video.currentTime >= duration - 0.05) video.currentTime = 0;
    video.play();
  } else {
    video.pause();
  }
}

document.addEventListener("keydown", (e) => {
  if (!$("#screen-editor").classList.contains("active")) return;
  if ((e.target as HTMLElement).tagName === "INPUT") return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if ((e.code === "Delete" || e.code === "Backspace") && selectedId) {
    deleteSelectedZoom();
  }
});

// Cibler un zoom en cliquant sur l'aperçu.
previewCanvas.addEventListener("pointerdown", (e) => {
  const z = zooms.find((s) => s.id === selectedId);
  if (!z || !video.videoWidth) return;
  const rect = previewCanvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * previewCanvas.width;
  const cy = ((e.clientY - rect.top) / rect.height) * previewCanvas.height;
  const card = computeCardRect(
    previewCanvas.width,
    previewCanvas.height,
    video.videoWidth,
    video.videoHeight,
    settings.padding
  );
  z.x = clamp((cx - card.x) / card.w, 0, 1);
  z.y = clamp((cy - card.y) / card.h, 0, 1);
});

// --- Zooms ------------------------------------------------------------------

$("#btn-add-zoom").addEventListener("click", () => {
  if (duration <= 0) return;
  const start = clamp(video.currentTime, 0, Math.max(0, duration - 0.5));
  const z: ZoomSegment = {
    id: uid(),
    start,
    end: Math.min(start + 3, duration),
    x: 0.5,
    y: 0.5,
    scale: 1.8,
  };
  zooms.push(z);
  selectedId = z.id;
  timeline.render(selectedId);
  syncZoomPanel();
});

$("#btn-del-zoom").addEventListener("click", deleteSelectedZoom);
function deleteSelectedZoom(): void {
  const idx = zooms.findIndex((z) => z.id === selectedId);
  if (idx >= 0) zooms.splice(idx, 1);
  selectedId = null;
  timeline.render(null);
  syncZoomPanel();
}

const zScale = $<HTMLInputElement>("#ctl-zscale");
zScale.addEventListener("input", () => {
  const z = zooms.find((s) => s.id === selectedId);
  if (!z) return;
  z.scale = Number(zScale.value);
  $("#val-zscale").textContent = `×${z.scale.toFixed(1)}`;
  timeline.render(selectedId);
});

function syncZoomPanel(): void {
  const z = zooms.find((s) => s.id === selectedId);
  zoomPanel.hidden = !z;
  if (z) {
    zScale.value = String(z.scale);
    $("#val-zscale").textContent = `×${z.scale.toFixed(1)}`;
  }
}

// --- Réglages d'apparence ---------------------------------------------------

const gradientGrid = $("#gradient-grid");
for (const g of GRADIENTS) {
  const btn = document.createElement("button");
  btn.className = "gradient-swatch";
  btn.title = g.name;
  btn.dataset.id = g.id;
  btn.style.background = gradientCss(g);
  btn.addEventListener("click", () => {
    settings.gradientId = g.id;
    syncSettingsControls();
  });
  gradientGrid.appendChild(btn);
}

function bindRange(sel: string, valSel: string, key: "padding" | "radius" | "shadow", suffix: string): void {
  const input = $<HTMLInputElement>(sel);
  input.addEventListener("input", () => {
    settings[key] = Number(input.value);
    $(valSel).textContent = `${input.value}${suffix}`;
  });
}
bindRange("#ctl-padding", "#val-padding", "padding", " %");
bindRange("#ctl-radius", "#val-radius", "radius", " px");
bindRange("#ctl-shadow", "#val-shadow", "shadow", "");

function syncSettingsControls(): void {
  gradientGrid.querySelectorAll<HTMLButtonElement>(".gradient-swatch").forEach((b) => {
    b.classList.toggle("selected", b.dataset.id === settings.gradientId);
  });
  const set = (sel: string, valSel: string, v: number, suffix: string) => {
    $<HTMLInputElement>(sel).value = String(v);
    $(valSel).textContent = `${v}${suffix}`;
  };
  set("#ctl-padding", "#val-padding", settings.padding, " %");
  set("#ctl-radius", "#val-radius", settings.radius, " px");
  set("#ctl-shadow", "#val-shadow", settings.shadow, "");
}

// --- Nouveau projet ---------------------------------------------------------

$("#btn-new").addEventListener("click", () => {
  if (!confirm("Abandonner ce projet et revenir à l'accueil ?")) return;
  video.pause();
  showScreen("screen-home");
});

// --- Export -----------------------------------------------------------------

const exportModal = $("#export-modal");
const exportSetup = $("#export-setup");
const exportProgress = $("#export-progress");
const exportDone = $("#export-done");
const exportBar = $("#export-bar");

$("#btn-export").addEventListener("click", () => {
  video.pause();
  exportSetup.hidden = false;
  exportProgress.hidden = true;
  exportDone.hidden = true;
  exportModal.hidden = false;
});
$("#btn-export-cancel").addEventListener("click", () => (exportModal.hidden = true));
$("#btn-export-close").addEventListener("click", () => (exportModal.hidden = true));

// --- Bienvenue (première visite) --------------------------------------------

const WELCOME_KEY = "prism-welcome-seen";
const welcomeModal = $("#welcome-modal");

function dismissWelcome(): void {
  welcomeModal.hidden = true;
  try {
    localStorage.setItem(WELCOME_KEY, "1");
  } catch {
    /* Mode privé : on ne persiste pas, l'app continue de fonctionner. */
  }
}

function maybeShowWelcome(): void {
  let alreadySeen = false;
  try {
    alreadySeen = localStorage.getItem(WELCOME_KEY) !== null;
  } catch {
    /* Stockage inaccessible : on affiche la bienvenue sans planter. */
  }
  if (!alreadySeen) welcomeModal.hidden = false;
}

$("#btn-welcome-start").addEventListener("click", dismissWelcome);
$("#btn-welcome-close").addEventListener("click", dismissWelcome);
welcomeModal.addEventListener("click", (e) => {
  if (e.target === welcomeModal) dismissWelcome();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !welcomeModal.hidden) dismissWelcome();
});

maybeShowWelcome();

// --- Export (suite) ---------------------------------------------------------

$("#btn-export-start").addEventListener("click", async () => {
  const width = Number($<HTMLSelectElement>("#export-res").value);
  const height = Math.round((width * 9) / 16);
  exportSetup.hidden = true;
  exportProgress.hidden = false;
  exportBar.style.width = "0%";

  try {
    const blob = await exportVideo({
      video,
      duration,
      settings,
      zooms,
      width,
      height,
      fps: 60,
      onProgress: (r) => {
        exportBar.style.width = `${Math.round(r * 100)}%`;
      },
    });
    const link = $<HTMLAnchorElement>("#btn-download");
    if (link.href) URL.revokeObjectURL(link.href);
    link.href = URL.createObjectURL(blob);
    exportProgress.hidden = true;
    exportDone.hidden = false;
  } catch (err) {
    console.error(err);
    exportProgress.hidden = true;
    exportSetup.hidden = false;
    alert("L'export a échoué. Réessayez.");
  }
});
