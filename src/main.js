import { Game } from './game.js';
import { UI } from './ui.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    const ui = new UI(game);
    
    game.init();
    ui.init();
    
    // Debug helper
    window.game = game;
});
