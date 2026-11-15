# Architecture

> Feature overview: [README](../README.md).

Plain ES modules, no framework, no build. Two objects do the work:

```
         events (log, hunt, purchase, offers, change, offline, saved)
  Game ───────────────────────────────────────────────────────────▶ UI
   ▲                                                                │
   └──────────── method calls (hunt, hire, buyUpgrade, takeContract)┘
```

## Game (`src/game.js`)

Owns the state object and every rule. Never touches the DOM.

- **Loop.** `setInterval` every 100 ms measures real elapsed time and calls `tick(dt)`. Everything is rate × dt, so a throttled background tab still earns correctly (each step is clamped to 5 s; longer gaps are covered by offline progress on next load).
- **Derived values.** `recompute()` rebuilds all multipliers (income, crew rates, hunt value, cooldown, snitch interval, contract and reputation bonuses) from the upgrade list. It runs after every purchase, not every tick.
- **Contracts.** Offers are sized from `power` (income plus a share of hunt output) times the tier's duration, so the board scales with you. While a contract is active, income and hunts go to `progress`; overflow on completion is paid out as credits.
- **Persistence.** `save()` writes JSON to `localStorage`. `start()` reads it through `state.js#readSave`, applies offline progress and starts the loop.

## Back Room (`src/backroom.js`, `src/backroom-ui.js`)

Minigames that unlock at lifetime-earnings thresholds (`RACKETS`). `BackRoom` holds the rules and reads and writes `state.backroom`; `Game#tick` calls `backroom.tick(dt)`, which handles unlocks and steps the exchange every 2 s while the page is open. Stakes, position limits and intercept payouts are all sized from `game.power`, so they stay relevant at every stage. `hydrateBackroom()` validates the saved minigame state the same way `hydrate()` does for the rest. `BackRoomUI` renders the panel and is driven by the main UI's 10 Hz text pass.

## State (`src/state.js`)

`createState()` defines the save shape. `hydrate(raw)` type-checks every field of a parsed save and clamps it, so a corrupt or hand-edited save can't break the game. `migrateLegacy()` converts the v2 `{ state, crewCounts }` format.

## UI (`src/ui.js`)

- Static markup lives in `index.html`. Crew rows are built once; upgrade cards and contract offers are rebuilt only when their set changes.
- A `requestAnimationFrame` loop updates the hunt cooldown bar every frame and all text at about 10 Hz. `setText` skips writes when nothing changed.
- Dialogs are native `<dialog>` elements, so focus trapping and <kbd>Esc</kbd> come from the browser.

## Adding content

- **Crew:** add a row to `CREW` in `src/data.js`. Training upgrades for it are generated automatically.
- **Upgrades:** add to `UPGRADES`. Supported effects: `incomeMult`, `huntMult`, `huntFromIncome`, `contractMult`, `repMult`, `crewMult`, `autoHunt`, `cooldownStep`. A new kind of effect needs a line in `Game#recompute`.
- **Contracts:** tiers and name pools are in `CONTRACT_TIERS` and `CONTRACT_NAMES`.

## Debugging

`window.game` is exposed. Useful calls: `game.earn(1e6)`, `game.hire('gunhand', 50)`, `game.refreshOffers(true)`, `game.state`.
