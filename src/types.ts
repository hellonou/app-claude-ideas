export interface ZoomSegment {
  id: string;
  /** Début / fin en secondes */
  start: number;
  end: number;
  /** Point ciblé, normalisé (0–1) dans la vidéo */
  x: number;
  y: number;
  /** Facteur de zoom (1 = aucun) */
  scale: number;
}

export interface ProjectSettings {
  gradientId: string;
  /** Marge autour de la vidéo, en % de la plus petite dimension du canevas */
  padding: number;
  /** Rayon des coins, en px (référence 1080p) */
  radius: number;
  /** Intensité de l'ombre, 0–100 */
  shadow: number;
}
