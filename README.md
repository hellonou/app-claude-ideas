# Prism Studio

Une application web inspirée de [Screen Studio](https://screen.studio) : enregistrez votre écran directement dans le navigateur, embellissez le résultat (zooms animés, arrière-plan dégradé, coins arrondis, ombre portée) et exportez une vidéo prête à partager. Aucune installation, aucune dépendance côté client — tout fonctionne avec les API natives du navigateur.

## Fonctionnalités

- **Enregistrement d'écran** via `getDisplayMedia` (60 fps), avec audio système et microphone optionnel (mixés via Web Audio).
- **Import de vidéo** existante si vous préférez éditer un fichier déjà enregistré.
- **Zooms animés** : ajoutez des segments de zoom sur la timeline, déplacez-les et redimensionnez-les à la souris, choisissez le point ciblé en cliquant sur l'aperçu, réglez l'intensité (×1,2 à ×3). Les transitions sont adoucies (ease-in-out) comme dans Screen Studio.
- **Mise en scène** : 8 arrière-plans dégradés, marge, coins arrondis et ombre portée réglables en direct.
- **Export vidéo** en WebM (VP9, 60 fps, 1080p ou 720p) avec l'audio d'origine, en rejouant la composition sur un canevas enregistré par `MediaRecorder`.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrez l'URL affichée (Chrome ou Edge recommandés : `getDisplayMedia` et `captureStream` y sont les mieux supportés).

Pour un build de production :

```bash
npm run build
npm run preview
```

## Raccourcis

| Touche | Action |
| --- | --- |
| `Espace` | Lecture / pause |
| `Suppr` / `Retour arrière` | Supprimer le zoom sélectionné |

## Architecture

```
src/
  main.ts       # Contrôleur : navigation, état, liaison UI
  recorder.ts   # Capture d'écran + mixage audio (getDisplayMedia / MediaRecorder)
  renderer.ts   # Composition canvas : fond, carte arrondie, ombre, zoom animé
  timeline.ts   # Timeline DOM : seek, segments déplaçables/redimensionnables
  export.ts     # Export : relecture temps réel sur canevas + MediaRecorder
  gradients.ts  # Préréglages d'arrière-plans
  types.ts      # Modèle de données (ZoomSegment, ProjectSettings)
  utils.ts      # Aides (easing, formatage, correctif durée WebM)
```

## Limites connues et pistes

- L'export se fait **en temps réel** (durée d'export = durée de la vidéo), car `MediaRecorder` encode un flux live. Un export plus rapide que le temps réel nécessiterait WebCodecs.
- Sortie WebM uniquement (le MP4 nécessiterait WebCodecs + un muxeur mp4).
- Le suivi automatique du curseur (zoom automatique sur les clics) n'est pas possible depuis une page web pour les autres applications ; les zooms sont donc posés manuellement sur la timeline.

## Pile technique

Vite + TypeScript, zéro dépendance à l'exécution. APIs : Screen Capture, MediaRecorder, Web Audio, Canvas 2D.
