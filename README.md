# Bounty Office

An idle game about running a bounty office on a frontier station. Hunt skips by hand, hire crew who work while you don't, take contracts off the guild board, and build a reputation.

Play it at [game.korikosmos.dev](https://game.korikosmos.dev).

## How it plays

- **Hunt.** The big amber button (or <kbd>Space</kbd> / <kbd>H</kbd>) pays out on a short cooldown.
- **Crew.** Eight tiers, from Rookies to a Pursuit Fleet. Each produces credits per second; hire ×1, ×10 or as many as you can afford.
- **Upgrades.** Faster hunts, bigger hunts, a Snitch who hunts for you, office-wide income boosts, and training that doubles a crew type's output at 10 / 25 / 50 / 100 hires.
- **Contracts.** Once you employ 10 crew, the guild posts work. Taking a contract sends all crew output and hunts to that target until it's closed. The payout is a multiple of what you put in, plus **reputation**, which permanently raises all income.
- **The Back Room.** As lifetime earnings pass set thresholds, side rackets open up, each a different way to make money:
  - **Dock Dice** (3K earned): stake credits, keep rolling to grow the pot, walk away before a one takes it all.
  - **Warrant Exchange** (60K earned): a live, mean-reverting index with a chart. Buy below par, sell above it, and choose your leverage.
  - **Intercepts** (750K earned): a code-breaking puzzle. Find the 4-symbol key in 8 tries; fewer tries pay more. A new one arrives every 3 minutes.
- **Offline progress.** Crew keep earning for up to 8 hours while the tab is closed.

Saves go to `localStorage` every 30 seconds and when you leave the page. Settings has export/import (a plain text string) and a wipe. Saves from the old version are migrated automatically.

## Running locally

The game is plain HTML, CSS and ES modules, with no build step. Browsers block ES modules on `file://`, so serve the folder:

```bash
python3 -m http.server
```

Then open http://localhost:8000.

## Deployment

Pushes to `main` deploy to [game.korikosmos.dev](https://game.korikosmos.dev) and also rebuild [korikosmos.dev](https://korikosmos.dev/games/bounty-office/), which bakes the newest `main` into its image. The second step (`.github/workflows/deploy-site.yml`) runs `update-deploy.sh` on the korikosmos.dev server through a self-hosted runner, so it needs no tokens. It is skipped until the repository variable `DEPLOY_DIR` is set; see the comment in the workflow for setup.

## Project layout

```
index.html        page shell and dialogs
styles.css        all styling
src/
  main.js         wires Game and UI together
  config.js       tunable constants
  data.js         crew, upgrades, contract tiers and name pools
  state.js        save shape, validation, legacy migration, encode/decode
  game.js         simulation: economy, hunting, contracts, offline progress
  backroom.js     Back Room minigames: dice, exchange, intercepts (logic only)
  backroom-ui.js  Back Room panel rendering and input
  ui.js           rendering and input
  settings.js     validated user settings
  format.js       number and duration formatting
  dom.js          tiny DOM helpers
```

See [.dev/ARCHITECTURE.md](.dev/ARCHITECTURE.md) for how the pieces fit together.

## License

See [LICENSE](LICENSE).
