# Developer Log / Architecture Archive

## Refactoring to ES Modules (2026-01-12)

### Context

The original implementation was a monolithic `game.js` file (~1100 lines) that became difficult to maintain. We successfully refactored it into a modular architecture using standard ES6 Modules (`import`/`export`).

### Technical Changes

1.  **Structure**:
    - `src/main.js`: Entry point.
    - `src/game.js`: Core Game Loop and Logic.
    - `src/state.js`: Game State Data.
    - `src/ui.js`: DOM Manipulation and View Logic.
    - `src/data.js`: Static Data (Crew, Config, Upgrades).
2.  **HTML**:
    - Script tag updated to `<script type="module" src="src/main.js"></script>`.

### ⚠️ Critical Execution Change

**The game can no longer be run directly from the file system (`file:///.../index.html`).**

ES Modules enforce CORS (Cross-Origin Resource Sharing) policies, which browsers block for `file://` protocols securely. You **must** serve the files via a local HTTP server.

#### How to Run Locally

**Python 3:**

```bash
python3 -m http.server
# Open http://localhost:8000
```

**Node.js (http-server):**

```bash
npx http-server .
# Open http://localhost:8080 or port shown
```

**VS Code Live Server:**

- Use the "Go Live" button if the extension is installed.

### Debugging Notes

- **Console Errors**: If you see `Access to fetch ... has been blocked by CORS policy`, you are likely trying to open the file directly without a server.
- **Global Scope**: The `game` instance is still exposed as `window.game` in `main.js` to allow for easy console debugging.
- **Cheats**: The hidden dev menu (Ctrl+Shift+D) and developer console commands still work.

### Future Development

- **Adding Features**:
  - Add new data to `src/data.js`.
  - Add logic to `src/game.js`.
  - Add rendering code to `src/ui.js`.
- **Building**: No build step is currently required (no Webpack/Vite), keeping it lightweight. If we add npm dependencies later, we will need a bundler.

## v3 rewrite (2026-11-14)

Rebuilt the game and its interface from scratch.

- **Design.** Replaced the neon/Orbitron look with a warm dark palette, one amber accent, a condensed display face (Big Shoulders Display) and IBM Plex for body and numbers. Three-column desk / roster / dispatch layout that collapses to one column on phones.
- **Gameplay.** Eight crew tiers, bulk hiring, a generated training-upgrade track, a contract board with three risk tiers that scales with your output, reputation as a permanent income bonus, offline progress (8 h cap), and a stats ledger.
- **Engine.** Time-based simulation instead of fixed 1 s ticks, a single `recompute()` for multipliers, validated save hydration, and v2 save migration.
- **Old open fixes.** The unmerged fixes on `story-ui` (settings validation, conflicting Escape handlers, CRT opacity) targeted the pre-module `game.js`. They're superseded: settings are now schema-validated in `settings.js`, dialogs use native `<dialog>` Escape handling, and the CRT warp effect was replaced by an optional scanline overlay.
