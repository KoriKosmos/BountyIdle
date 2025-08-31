/**
 * Game Engine
 * Core game logic, cooldown management, and action handling
 */

import { GAME_CONFIG, CREW_TYPES, UPGRADE_TYPES, CONTRACTS, getCrewCost, getUpgradeCost, getSnitchIntervalMs } from './gameData.js';
import { GameState } from './gameState.js';

export class GameEngine {
  constructor() {
    this.gameState = new GameState();
    this.crew = [...CREW_TYPES];
    this.upgrades = [...UPGRADE_TYPES];
    this.contracts = [...CONTRACTS];
    
    this.tickInterval = null;
    this.snitchTimer = null;
    this.cooldownTimers = new Map();
    
    // Callbacks for UI updates
    this.onUpdate = null;
    this.onToast = null;
    this.onCooldownUpdate = null;
    
    this.initializeCrewCounts();
    this.applyAllUpgrades();
  }

  initializeCrewCounts() {
    // Restore crew counts from saved state
    const savedCrew = this.gameState.state.crew;
    if (savedCrew) {
      this.crew.forEach(crewType => {
        const saved = savedCrew[crewType.id];
        if (saved) {
          crewType.count = saved.count || 0;
          crewType.revealed = saved.revealed || false;
        }
      });
    }
  }

  start() {
    this.startGameTick();
    this.updateSnitchAutoclicker();
    this.gameState.startAutosave();
    this.updateCooldownVisuals();
  }

  stop() {
    this.stopGameTick();
    this.stopSnitchAutoclicker();
    this.gameState.stopAutosave();
    this.cooldownTimers.forEach(timer => clearTimeout(timer));
    this.cooldownTimers.clear();
  }

  startGameTick() {
    this.tickInterval = setInterval(() => {
      this.tick();
    }, GAME_CONFIG.TICK_MS);
  }

  stopGameTick() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  tick() {
    this.gameState.ticks++;
    
    // Calculate passive income from crew
    let passiveIncome = 0;
    this.crew.forEach(crewType => {
      if (crewType.perTick && crewType.count > 0) {
        passiveIncome += crewType.perTick * crewType.count;
      }
    });
    
    if (passiveIncome > 0) {
      this.gameState.credits += passiveIncome;
      this.gameState.state.unbanked += passiveIncome;
    }
    
    // Check banking threshold
    this.checkBanking();
    
    // Update UI
    this.onUpdate?.();
  }

  checkBanking() {
    const bankTarget = this.calculateBankTarget();
    if (this.gameState.state.unbanked >= bankTarget) {
      const reward = Math.floor(this.gameState.state.unbanked * GAME_CONFIG.BANK_REWARD_MULTIPLIER);
      this.gameState.credits += reward;
      this.gameState.state.unbanked = 0;
      
      this.onToast?.(`Banked! +${reward} bonus credits`, 'success');
    }
  }

  calculateBankTarget() {
    // Exponential banking targets based on crew count
    const totalCrew = this.crew.reduce((sum, c) => sum + c.count, 0);
    return GAME_CONFIG.INITIAL_BANK_TARGET * Math.pow(GAME_CONFIG.BANK_TARGET_MULTIPLIER, totalCrew);
  }

  performAction(type = 'action') {
    if (!this.canPerformAction(type)) return false;
    
    const value = this.getActionValue(type);
    
    if (type === 'action') {
      if (this.gameState.contractActive) {
        // Apply to contract progress
        this.gameState.contractProgress += value;
        this.checkContractCompletion();
      } else {
        // Add to credits
        this.gameState.credits += value;
      }
    }
    
    this.startCooldown(type);
    this.onUpdate?.();
    return true;
  }

  canPerformAction(type) {
    const cooldown = this.gameState.getCooldown(type);
    if (!cooldown) return true;
    return Date.now() >= cooldown.readyAt;
  }

  getActionValue(type = 'action') {
    const base = this.gameState.state.buttonTypes[type]?.base || 1;
    const multiplier = this.gameState.getButtonMultiplier(type);
    return base * multiplier;
  }

  startCooldown(type) {
    const cooldown = this.gameState.getCooldown(type);
    if (!cooldown || cooldown.ms === 0) return;
    
    cooldown.readyAt = Date.now() + cooldown.ms;
    this.updateCooldownVisuals();
  }

  updateCooldownVisuals() {
    const now = Date.now();
    let anyCooling = false;
    
    Object.keys(this.gameState.state.cooldowns).forEach(type => {
      const cooldown = this.gameState.getCooldown(type);
      if (!cooldown) return;
      
      const total = cooldown.ms || GAME_CONFIG.BASE_HUNT_COOLDOWN_MS;
      const readyAt = cooldown.readyAt || 0;
      
      let progress = 0;
      let ready = true;
      
      if (total > 0 && now < readyAt) {
        const elapsed = Math.max(0, total - (readyAt - now));
        progress = Math.min(1, elapsed / total);
        ready = false;
        anyCooling = true;
      }
      
      this.onCooldownUpdate?.(type, progress, ready);
    });
    
    if (anyCooling) {
      requestAnimationFrame(() => this.updateCooldownVisuals());
    }
  }

  hireCrew(crewId) {
    const crewType = this.crew.find(c => c.id === crewId);
    if (!crewType) return false;
    
    const cost = getCrewCost(crewType);
    if (this.gameState.credits < cost) return false;
    if (!this.canPerformAction('hire')) return false;
    
    this.gameState.credits -= cost;
    crewType.count++;
    crewType.revealed = true;
    
    this.startCooldown('hire');
    this.saveCrew();
    
    if (crewType.id === 'snitch') {
      this.updateSnitchAutoclicker();
    }
    
    this.onToast?.(`Hired ${crewType.name}! ${crewType.perTick ? `+${crewType.perTick} credits/tick` : 'Autoclicker activated'}`, 'success');
    this.onUpdate?.();
    
    return true;
  }

  saveCrew() {
    // Save crew state
    const crewState = {};
    this.crew.forEach(crewType => {
      crewState[crewType.id] = {
        count: crewType.count,
        revealed: crewType.revealed
      };
    });
    this.gameState.state.crew = crewState;
  }

  purchaseUpgrade(upgradeId) {
    const upgrade = this.upgrades.find(u => u.id === upgradeId);
    if (!upgrade) return false;
    
    const currentCount = this.gameState.getUpgradeCount(upgradeId);
    
    // Check max count
    if (upgrade.maxCount && currentCount >= upgrade.maxCount) return false;
    
    const cost = getUpgradeCost(upgrade, currentCount);
    if (this.gameState.credits < cost) return false;
    
    this.gameState.credits -= cost;
    this.gameState.setUpgradeCount(upgradeId, currentCount + 1);
    this.gameState.revealUpgrade(upgradeId);
    
    // Apply upgrade effect
    if (upgrade.effect) {
      upgrade.effect(this.gameState, currentCount + 1);
    }
    
    this.onToast?.(`Purchased ${upgrade.name}!`, 'success');
    this.onUpdate?.();
    
    return true;
  }

  applyAllUpgrades() {
    this.upgrades.forEach(upgrade => {
      const count = this.gameState.getUpgradeCount(upgrade.id);
      if (count > 0 && upgrade.effect) {
        upgrade.effect(this.gameState, count);
      }
    });
  }

  takeContract(contractIndex = null) {
    if (contractIndex === null) {
      contractIndex = this.gameState.currentContract;
    }
    
    if (contractIndex >= this.contracts.length) return false;
    
    this.gameState.contractActive = true;
    this.gameState.contractProgress = 0;
    this.gameState.currentContract = contractIndex;
    this.gameState.setFlag('contractsHintRemoved', true);
    
    const contract = this.contracts[contractIndex];
    this.onToast?.(`Contract taken: ${contract.name}`, 'info');
    this.onUpdate?.();
    
    return true;
  }

  checkContractCompletion() {
    if (!this.gameState.contractActive) return;
    
    const contract = this.contracts[this.gameState.currentContract];
    if (!contract) return;
    
    if (this.gameState.contractProgress >= contract.goal) {
      // Complete contract
      this.gameState.credits += contract.reward;
      this.gameState.contractActive = false;
      this.gameState.contractProgress = 0;
      
      // Move to next contract
      if (this.gameState.currentContract < this.contracts.length - 1) {
        this.gameState.currentContract++;
      }
      
      this.onToast?.(`Contract completed! +${contract.reward} credits`, 'success');
      this.onUpdate?.();
    }
  }

  updateSnitchAutoclicker() {
    this.stopSnitchAutoclicker();
    
    const snitch = this.crew.find(c => c.id === 'snitch');
    if (!snitch || snitch.count <= 0) return;
    
    const intervalMs = getSnitchIntervalMs(snitch);
    if (!intervalMs) return;
    
    this.snitchTimer = setInterval(() => {
      this.performAction(snitch.autoclickType);
    }, intervalMs);
  }

  stopSnitchAutoclicker() {
    if (this.snitchTimer) {
      clearInterval(this.snitchTimer);
      this.snitchTimer = null;
    }
  }

  reset() {
    this.stop();
    this.gameState.reset();
    
    // Reset crew
    this.crew.forEach(crewType => {
      crewType.count = 0;
      crewType.revealed = false;
    });
    
    // Re-initialize
    this.initializeCrewCounts();
    this.applyAllUpgrades();
    this.start();
    
    this.onToast?.('Game reset!', 'info');
    this.onUpdate?.();
  }

  getCurrentContract() {
    return this.contracts[this.gameState.currentContract];
  }

  getNextContract() {
    const nextIndex = this.gameState.currentContract + 1;
    return nextIndex < this.contracts.length ? this.contracts[nextIndex] : null;
  }

  shouldRevealContracts() {
    return this.gameState.credits >= 500 && !this.gameState.getFlag('contractsUnlocked');
  }

  shouldRevealUpgrades() {
    return this.gameState.credits >= 10 && !this.gameState.getFlag('upgradesRevealed');
  }

  unlockContracts() {
    this.gameState.setFlag('contractsUnlocked', true);
  }

  unlockUpgrades() {
    this.gameState.setFlag('upgradesRevealed', true);
  }
}