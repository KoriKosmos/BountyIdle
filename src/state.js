import { CONFIG } from './config.js';

export class GameState {
  constructor() {
    this.credits = 0;
    this.ticks = 0;
    this.unbanked = 0;
    this.revealedUpgrades = {};
    this.buttonTypes = {
      action: { base: 1, multiplier: 1 }
    };
    this.cooldowns = {
      action: { baseMs: CONFIG.BASE_COOLDOWN_MS, ms: CONFIG.BASE_COOLDOWN_MS, readyAt: 0 },
      hire: { baseMs: CONFIG.BASE_COOLDOWN_MS, ms: CONFIG.BASE_COOLDOWN_MS, readyAt: 0 }
    };
    this.upgrades = {};
    this.flags = {
      contractsUnlocked: false,
      contractsHintRemoved: false,
      upgradesRevealed: false
    };
    this.contractActive = false;
    this.contractProgress = 0;
    this.currentContract = 0;
  }
}
