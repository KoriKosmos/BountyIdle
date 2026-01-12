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
