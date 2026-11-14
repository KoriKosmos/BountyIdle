import { Game } from './game.js';
import { UI } from './ui.js';

const game = new Game();
const ui = new UI(game);

// UI subscribes first so it hears the load/offline events start() emits.
ui.init();
game.start();

// Handy from the console: game.earn(1e6); game.recompute();
window.game = game;
