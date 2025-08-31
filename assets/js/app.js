/**
 * Bounty Office - Main Application Entry Point
 */

import { GameEngine } from './gameEngine.js';
import { UIManager } from './ui.js';

class BountyOfficeApp {
  constructor() {
    this.gameEngine = null;
    this.uiManager = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
      return;
    }
    
    try {
      // Initialize game engine
      this.gameEngine = new GameEngine();
      
      // Initialize UI manager
      this.uiManager = new UIManager(this.gameEngine);
      this.uiManager.init();
      
      // Start the game
      this.gameEngine.start();
      
      // Handle page visibility changes
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.gameEngine.gameState.save();
        }
      });
      
      // Save before unload
      window.addEventListener('beforeunload', () => {
        this.gameEngine.gameState.save();
      });
      
      this.initialized = true;
      console.log('Bounty Office initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Bounty Office:', error);
      this.showErrorMessage();
    }
  }

  showErrorMessage() {
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h2>Failed to Initialize Game</h2>
          <p>Please refresh the page to try again.</p>
          <button onclick="location.reload()">Refresh</button>
        </div>
      `;
    }
  }
}

// Create and initialize the app
const app = new BountyOfficeApp();
app.init();

// Export for debugging
window.BountyOfficeApp = app;