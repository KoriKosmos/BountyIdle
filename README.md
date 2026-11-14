# Bounty Office

An idle game about running a bounty office on a frontier station. Hunt skips by hand, hire crew who work while you don't, take contracts off the guild board, and build a reputation.

Play it at [game.korikosmos.dev](https://game.korikosmos.dev).

## How it plays

- **Hunt.** The big amber button (or <kbd>Space</kbd> / <kbd>H</kbd>) pays out on a short cooldown.
- **Crew.** Eight tiers, from Rookies to a Pursuit Fleet. Each produces credits per second; hire ×1, ×10 or as many as you can afford.
- **Upgrades.** Faster hunts, bigger hunts, a Snitch who hunts for you, office-wide income boosts, and training that doubles a crew type's output at 10 / 25 / 50 / 100 hires.
- **Contracts.** Once you employ 10 crew, the guild posts work. Taking a contract sends all crew output and hunts to that target until it's closed. The payout is a multiple of what you put in, plus **reputation**, which permanently raises all income.
- **Offline progress.** Crew keep earning for up to 8 hours while the tab is closed.

Saves go to `localStorage` every 30 seconds and when you leave the page. Settings has export/import (a plain text string) and a wipe. Saves from the old version are migrated automatically.

## Running locally

The game is plain HTML, CSS and ES modules, with no build step. Browsers block ES modules on `file://`, so serve the folder:

```bash
python3 -m http.server
```

Then open http://localhost:8000.

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
  ui.js           rendering and input
  settings.js     validated user settings
  format.js       number and duration formatting
  dom.js          tiny DOM helpers
```

See [.dev/ARCHITECTURE.md](.dev/ARCHITECTURE.md) for how the pieces fit together.

## License

See [LICENSE](LICENSE).
