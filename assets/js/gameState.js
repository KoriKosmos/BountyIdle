/**
 * Game State Manager
 * Handles all game state, save/load functionality, and state migrations
 */

export class GameState {
  constructor() {
    this.defaultState = {
      credits: 0,
      ticks: 0,
      unbanked: 0,
      revealedUpgrades: {},
      buttonTypes: {
        action: { base: 1, multiplier: 1 }
      },
      cooldowns: {
        action: { baseMs: 2000, ms: 2000, readyAt: 0 },
        hire: { baseMs: 2000, ms: 2000, readyAt: 0 }
      },
      upgrades: {},
      flags: {
        contractsUnlocked: false,
        contractsHintRemoved: false,
        upgradesRevealed: false
      },
      contractActive: false,
      contractProgress: 0,
      currentContract: 0
    };
    
    this.state = this.loadState();
    this.lastSaveTime = Date.now();
    this.autosaveEnabled = true;
    this.autosaveInterval = null;
    this.saveKey = 'bountyOfficeState';
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.saveKey);
      if (!saved) return { ...this.defaultState };
      
      const loaded = JSON.parse(saved);
      // Merge with defaults to handle missing properties
      const state = { ...this.defaultState, ...loaded };
      
      // Apply migrations
      this.migrateState(state);
      
      return state;
    } catch (error) {
      console.error('Failed to load state:', error);
      return { ...this.defaultState };
    }
  }

  migrateState(state) {
    // Handle old cooldown structure
    if (typeof state.huntReadyAt === 'number') {
      state.cooldowns.action.readyAt = state.huntReadyAt;
      delete state.huntReadyAt;
    }
    
    // Handle old upgrades structure
    if (state.upgrades?.reduceCooldownPurchased && state.upgrades.reduceCooldown == null) {
      state.upgrades.reduceCooldown = 1;
      delete state.upgrades.reduceCooldownPurchased;
      state.flags.upgradesRevealed = true;
    }
    
    if (state.upgrades?.reduceCooldownCount != null) {
      state.upgrades.reduceCooldown = state.upgrades.reduceCooldownCount;
      delete state.upgrades.reduceCooldownCount;
      state.flags.upgradesRevealed = true;
    }
    
    // Handle old click multiplier
    if (typeof state.clickMultiplier === 'number') {
      state.buttonTypes.action.multiplier = state.clickMultiplier;
      delete state.clickMultiplier;
    }
    
    // Ensure contract state consistency
    if (state.contractActive && state.contracts && 
        state.contractProgress >= state.contracts[state.currentContract]?.goal) {
      state.contractActive = false;
      state.contractProgress = 0;
    }
  }

  save() {
    try {
      localStorage.setItem(this.saveKey, JSON.stringify(this.state));
      this.lastSaveTime = Date.now();
      return true;
    } catch (error) {
      console.error('Failed to save state:', error);
      return false;
    }
  }

  reset() {
    this.state = { ...this.defaultState };
    this.save();
  }

  startAutosave(interval = 30000) {
    this.stopAutosave();
    if (this.autosaveEnabled) {
      this.autosaveInterval = setInterval(() => {
        if (this.autosaveEnabled) {
          this.save();
          this.onAutosave?.();
        }
      }, interval);
    }
  }

  stopAutosave() {
    if (this.autosaveInterval) {
      clearInterval(this.autosaveInterval);
      this.autosaveInterval = null;
    }
  }

  toggleAutosave() {
    this.autosaveEnabled = !this.autosaveEnabled;
    if (this.autosaveEnabled) {
      this.startAutosave();
    } else {
      this.stopAutosave();
    }
    return this.autosaveEnabled;
  }

  getTimeSinceLastSave() {
    return Math.floor((Date.now() - this.lastSaveTime) / 1000);
  }

  // Getters for commonly accessed state
  get credits() { return this.state.credits; }
  set credits(value) { this.state.credits = Math.max(0, value); }

  get ticks() { return this.state.ticks; }
  set ticks(value) { this.state.ticks = value; }

  get contractActive() { return this.state.contractActive; }
  set contractActive(value) { this.state.contractActive = value; }

  get contractProgress() { return this.state.contractProgress; }
  set contractProgress(value) { this.state.contractProgress = Math.max(0, value); }

  get currentContract() { return this.state.currentContract; }
  set currentContract(value) { this.state.currentContract = value; }

  getUpgradeCount(upgradeId) {
    return this.state.upgrades[upgradeId] || 0;
  }

  setUpgradeCount(upgradeId, count) {
    this.state.upgrades[upgradeId] = count;
  }

  getCooldown(type) {
    return this.state.cooldowns[type] || null;
  }

  getButtonMultiplier(type) {
    return this.state.buttonTypes[type]?.multiplier || 1;
  }

  setButtonMultiplier(type, multiplier) {
    if (this.state.buttonTypes[type]) {
      this.state.buttonTypes[type].multiplier = multiplier;
    }
  }

  isUpgradeRevealed(upgradeId) {
    return this.state.revealedUpgrades[upgradeId] || false;
  }

  revealUpgrade(upgradeId) {
    this.state.revealedUpgrades[upgradeId] = true;
  }

  getFlag(flagName) {
    return this.state.flags[flagName] || false;
  }

  setFlag(flagName, value) {
    this.state.flags[flagName] = value;
  }
}