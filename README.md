# Gym

Gym is a private, local-first strength-training log published at `harsh.bet/gym/`. This repository is the standalone source for the app and its GitHub Pages deployment. The shipped program is the owner's 8-day CBL/SARMS cycle.

## Product model

- An 8-day CBL/SARMS rotation (no rest days), anchored to a calendar date in America/Chicago rather than to weekdays
- Reusable session templates built from exercises, sets, reps, and supersets
- Fast per-set logging with weight, reps, and rest during a live session
- Calendar of past sessions with weekly volume and progress trends
- Personal records and milestone tracking per exercise
- Light and dark themes with a responsive, phone-first layout

## Sync and privacy

Data lives in the browser first for instant startup and offline use. Optional Google sign-in resolves provisioned identities through the shared private owner vault, so either approved account reaches the same sessions while unprovisioned accounts fail closed; the local copy stays the primary read and write path. No analytics.

## Development

```sh
npm ci
npm run typecheck
npm run build
```

Vite's public base is `/gym/`. Navigation is hash-based so every view stays safe on GitHub Pages without a server rewrite. The Pages workflow builds and deploys from `main`.
