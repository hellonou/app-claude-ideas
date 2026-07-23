export interface GradientPreset {
  id: string;
  name: string;
  /** Angle en degrés (0 = vers le haut) */
  angle: number;
  stops: [number, string][];
}

export const GRADIENTS: GradientPreset[] = [
  { id: "violet", name: "Violet", angle: 135, stops: [[0, "#6d28d9"], [0.5, "#8b5cf6"], [1, "#3b82f6"]] },
  { id: "sunset", name: "Crépuscule", angle: 120, stops: [[0, "#f97316"], [0.5, "#ec4899"], [1, "#8b5cf6"]] },
  { id: "ocean", name: "Océan", angle: 160, stops: [[0, "#0ea5e9"], [1, "#14b8a6"]] },
  { id: "menthe", name: "Menthe", angle: 135, stops: [[0, "#34d399"], [1, "#0891b2"]] },
  { id: "peche", name: "Pêche", angle: 135, stops: [[0, "#fbbf24"], [1, "#f87171"]] },
  { id: "bonbon", name: "Bonbon", angle: 135, stops: [[0, "#f472b6"], [1, "#818cf8"]] },
  { id: "graphite", name: "Graphite", angle: 135, stops: [[0, "#334155"], [1, "#0f172a"]] },
  { id: "nuit", name: "Nuit", angle: 135, stops: [[0, "#1e1b4b"], [1, "#020617"]] },
];

export function getGradient(id: string): GradientPreset {
  return GRADIENTS.find((g) => g.id === id) ?? GRADIENTS[0];
}

export function fillGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  preset: GradientPreset
): void {
  const rad = ((preset.angle - 90) * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2;
  const g = ctx.createLinearGradient(
    cx - Math.cos(rad) * len,
    cy - Math.sin(rad) * len,
    cx + Math.cos(rad) * len,
    cy + Math.sin(rad) * len
  );
  for (const [pos, color] of preset.stops) g.addColorStop(pos, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Rendu CSS d'un préréglage, pour les vignettes de la barre latérale. */
export function gradientCss(preset: GradientPreset): string {
  const stops = preset.stops.map(([p, c]) => `${c} ${p * 100}%`).join(", ");
  return `linear-gradient(${preset.angle}deg, ${stops})`;
}
