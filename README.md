# Gym

Gym is a private, local-first strength-training log published at `harsh.bet/gym/`. This repository is the standalone source for the app and its GitHub Pages deployment.

## Product model

- Reusable programs built from exercises, sets, reps, and supersets
- Fast per-set logging with weight, reps, and rest during a live session
- Calendar of past sessions with weekly volume and progress trends
- Personal records and milestone tracking per exercise
- Light and dark themes with a responsive, phone-first layout

## Sync and privacy

Data lives in the browser first for instant startup and offline use. Optional Google sign-in mirrors sessions across devices through the shared Firebase project; the local copy stays the primary read and write path. No analytics.

## Development

```sh
npm ci
npm run typecheck
npm run build
```

Vite's public base is `/gym/`. Navigation is hash-based so every view stays safe on GitHub Pages without a server rewrite. The Pages workflow builds and deploys from `main`.
