# System Architecture 🏗️

> **Note**: For a high-level overview of the project features, please see the [README](../README.md).

## 📂 Project Structure

The project has been refactored from a monolithic script into a modern, modular ES6 architecture.

```text
BountyIdle/
├── index.html          # Entry point (Main UI shell)
├── .dev/               # Development documentation & logs
│   ├── ARCHITECTURE.md # This file
│   └── DEV_LOG.md      # Chronological engineering log
└── src/                # Source code
    ├── main.js         # Bootstrapper
    ├── game.js         # Core Game Logic (Loop, Rules)
    ├── state.js        # Game State Data Model
    ├── ui.js           # UI Rendering & Event Handling
    ├── data.js         # Static Content (Crew, Upgrades, Contracts)
    ├── config.js       # Global Constants
    └── utils.js        # Helper Functions
```

## 🛠️ Technical Design

### 1. Data-Driven Design

All game content is defined in `src/data.js` rather than hardcoded in logic. This generic implementation allows for easy expansion:

- **Crew**: Add new objects to `CREW_TYPES` to automatically generate shop items and passive income logic.
- **Upgrades**: Defined in `UPGRADE_TYPES`, supporting scalable costs and custom effects.

### 2. State Management (`state.js`)

The `GameState` class is a pure data container used for serialization. It holds:

- Currency (Credits)
- Progression Flags (Unlocks, Tutorials)
- Inventory (Crew counts, Upgrades)
- Active Contracts

This clean separation ensures the **Save/Load system** is robust—we simply serialize this single object to `localStorage`.

### 3. Logic Layer (`game.js`)

The `Game` class manages the simulation:

- **Game Loop**: A `setInterval` tick (1000ms) handles passive income and cooldown management.
- **Input Validation**: All actions (hire, hunt, buy) check conditions (cost, cooldown) before mutating state.
- **Observer Pattern**: When state changes, `notifyUI()` is called. This decouples logic from the view.

### 4. Presentation Layer (`ui.js`)

The `UI` class subscribes to game updates. It uses a simplistic "Render" patterns:

- **Functional Rendering**: UI components (`updateCrew`, `updateUpgrades`) take the current state and rebuild/update the DOM.
- **Event Delegation**: A single listener on container elements handles clicks for all dynamic items (hiring buttons), ensuring performance creates no memory leaks.

## 🚧 Development Guide

### How to Run

Due to ES Module CORS policies, you must use a local server:

```bash
python3 -m http.server
# OR
npx http-server .
```

### Extending the Game

#### Adding a New Crew Member

1. Open `src/data.js`
2. Add an entry to `CREW_TYPES`:
   ```javascript
   {
     id: "master_hunter",
     name: "Master Hunter",
     baseCost: 5000,
     scaling: 1.15,
     perTick: 50,
     count: 0,
     revealed: false,
     description: "An elite bounty hunter."
   }
   ```
3. That's it! The UI and Game Loop will automatically handle it.

#### Adding a New Upgrade

1. Open `src/data.js`.
2. Add to `UPGRADE_TYPES`.
3. If it has a custom effect (e.g., unlocking a feature), add the handler in `src/game.js` inside `applyUpgradeEffects()` or the relevant action method.
