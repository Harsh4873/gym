# Gym App Maintenance

This repository is for the Gym app only.

## Product Boundary

- Gym lives in the standalone `Harsh4873/gym` repository and publishes under `/gym/`.
- Do not touch PickLedger, gambling, model, scraper, player-prop, grading, or prediction code from this worktree.
- Do not add betting data, PickLedger assets, or PickLedger styling to Gym.
- The `main` branch publishes Gym through this repository's Pages workflow.

## Verification

- Never open the deployed site, a browser preview, rendered Pages output, or live URLs to verify Gym. The user confirms production behavior.
- Agents may review source, run typecheck/build, and inspect GitHub Actions logs.
- Before publishing Gym work, run `npm run typecheck` and `npm run build` from this folder.

## GitHub Publish

- Commit Gym work on the `main` branch and push `main`.
- Commits and pushes must come from the currently logged-in GitHub user.
- Never add AI co-author trailers, `Co-authored-by:` lines, or AI/Cursor/Codex taglines.
- Do not overwrite or revert unrelated user changes.
