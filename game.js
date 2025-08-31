/**
 * Bounty Office - Modern Idle Game
 * Completely refactored with ES6+ features and optimized performance
 */

// ========================================
// CONSTANTS & CONFIGURATION
// ========================================
const CONFIG = {
  SAVE_KEY: "bountySaveV2",
  TICK_INTERVAL: 1000,
  BASE_COOLDOWN: 1000,
  AUTOSAVE_INTERVAL: 30000,
  MAX_TOASTS: 5,
  DEV_TRIGGER: "kori",
  
  // Game balance
  REDUCE_COOLDOWN_MAX: 20,
  TICK_THRESHOLD: 1,
  TOLERANCE: 0.001,
  
  // UI performance
  UI_THROTTLE_BASE: 100,
  UI_THROTTLE_MEDIUM: 150,
  UI_THROTTLE_HIGH: 250,
};

// ========================================
// GAME DATA STRUCTURES
// ========================================
const CREW_TYPES = [
  {
    id: "novice",
    name: "Novice Hunter",
    description: "A rookie bounty hunter eager to prove themselves",
    icon: "🔰",
    baseCost: 20,
    scaling: 1.15,
    perTick: 0.5,
    count: 0,
    revealed: false,
  },
  {
    id: "snitch",
    name: "Snitch",
    description: "Provides intel and automates hunting",
    icon: "🕵️",
    baseCost: 1000,
    scaling: 10,
    perTick: 0,
    count: 0,
    revealed: false,
    autoclickType: "action",
    baseClickInterval: 1,
  },
];

const CONTRACTS = [
  {
    id: "familiar-face",
    title: "A Familiar Face",
    description: "An old friend enters the office with a lucrative opportunity",
    details: "Your former partner needs help tracking down a high-value target. The pay is good, but it'll take time and effort to complete.",
    goal: 1000,
    reward: 2000,
    icon: "🤝",
  },
];

const UPGRADE_TYPES = [
  {
    id: "reduceCooldown",
    name: "Quick Draw",
    description: "Reduces action cooldown by 5% per level",
    icon: "⚡",
    baseCost: 10,
    scaling: 1.15,
    maxLevel: CONFIG.REDUCE_COOLDOWN_MAX,
  },
  {
    id: "doubleClick",
    name: "Precision Shot",
    description: "Doubles your hunting effectiveness per level",
    icon: "🎯",
    baseCost: 20,
    scaling: 2.5,
  },
];

// ========================================
// GAME STATE MANAGEMENT
// ========================================
class GameState {
  constructor() {
    this.data = {
      credits: 0,
      ticks: 0,
      unbanked: 0,
      revealedUpgrades: new Set(),
      buttonTypes: {
        action: { base: 1, multiplier: 1 },
      },
      cooldowns: {
        action: { baseMs: CONFIG.BASE_COOLDOWN, ms: CONFIG.BASE_COOLDOWN, readyAt: 0 },
        hire: { baseMs: CONFIG.BASE_COOLDOWN, ms: CONFIG.BASE_COOLDOWN, readyAt: 0 },
      },
      upgrades: new Map(),
      flags: {
        contractsUnlocked: false,
        contractsHintRemoved: false,
      },
      contractActive: false,
      contractProgress: 0,
      currentContract: 0,
    };
  }

  get credits() { return this.data.credits; }
  set credits(value) { this.data.credits = Math.max(0, value); }

  get contractActive() { return this.data.contractActive; }
  set contractActive(value) { this.data.contractActive = value; }

  get contractProgress() { return this.data.contractProgress; }
  set contractProgress(value) { this.data.contractProgress = Math.max(0, value); }

  getUpgradeCount(upgradeId) {
    return this.data.upgrades.get(upgradeId) || 0;
  }

  setUpgradeCount(upgradeId, count) {
    this.data.upgrades.set(upgradeId, Math.max(0, count));
  }

  incrementUpgrade(upgradeId) {
    const current = this.getUpgradeCount(upgradeId);
    this.setUpgradeCount(upgradeId, current + 1);
  }

  isUpgradeRevealed(upgradeId) {
    return this.data.revealedUpgrades.has(upgradeId);
  }

  revealUpgrade(upgradeId) {
    this.data.revealedUpgrades.add(upgradeId);
  }

  canClick(cooldownType) {
    const cooldown = this.data.cooldowns[cooldownType];
    return !cooldown || Date.now() >= (cooldown.readyAt || 0);
  }

  startCooldown(cooldownType) {
    const cooldown = this.data.cooldowns[cooldownType];
    if (!cooldown) return;
    
    const duration = cooldown.ms || CONFIG.BASE_COOLDOWN;
    cooldown.readyAt = Date.now() + duration;
  }

  // Serialization for save/load
  serialize() {
    return {
      ...this.data,
      revealedUpgrades: Array.from(this.data.revealedUpgrades),
      upgrades: Array.from(this.data.upgrades.entries()),
    };
  }

  deserialize(data) {
    Object.assign(this.data, data);
    this.data.revealedUpgrades = new Set(data.revealedUpgrades || []);
    this.data.upgrades = new Map(data.upgrades || []);
  }
}

// ========================================
// GAME LOGIC CLASSES
// ========================================
class CrewManager {
  static getCrewCost(crew) {
    return Math.floor(crew.baseCost * Math.pow(crew.scaling, crew.count));
  }

  static getSnitchInterval(snitch) {
    if (snitch.count <= 0) return snitch.baseClickInterval;
    return 1 / Math.pow(2, snitch.count - 1);
  }

  static getTotalPassiveIncome() {
    return CREW_TYPES.reduce((total, crew) => total + (crew.count * crew.perTick), 0);
  }

  static canAffordCrew(crew) {
    return gameState.credits >= this.getCrewCost(crew);
  }

  static hireCrew(crewId) {
    const crew = CREW_TYPES.find(c => c.id === crewId);
    if (!crew) return false;

    const cost = this.getCrewCost(crew);
    if (!this.canAffordCrew(crew) || !gameState.canClick('hire')) return false;

    gameState.credits -= cost;
    crew.count += 1;
    gameState.startCooldown('hire');

    // Update autoclicker if it's a snitch
    if (crew.id === 'snitch') {
      autoclicker.updateSnitchTimer();
    }

    toastManager.show(`Hired ${crew.name}! ${crew.perTick > 0 ? `+${crew.perTick} credits/tick` : 'Autoclick enabled'}`);
    return true;
  }
}

class UpgradeManager {
  static getUpgradeCost(upgrade) {
    const count = gameState.getUpgradeCount(upgrade.id);
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.scaling, count));
  }

  static canAffordUpgrade(upgrade) {
    return gameState.credits >= this.getUpgradeCost(upgrade);
  }

  static isUpgradeMaxed(upgrade) {
    if (!upgrade.maxLevel) return false;
    return gameState.getUpgradeCount(upgrade.id) >= upgrade.maxLevel;
  }

  static purchaseUpgrade(upgradeId) {
    const upgrade = UPGRADE_TYPES.find(u => u.id === upgradeId);
    if (!upgrade) return false;

    if (this.isUpgradeMaxed(upgrade) || !this.canAffordUpgrade(upgrade)) return false;

    const cost = this.getUpgradeCost(upgrade);
    gameState.credits -= cost;
    gameState.incrementUpgrade(upgradeId);
    gameState.revealUpgrade(upgradeId);

    this.applyUpgradeEffect(upgradeId);
    toastManager.show(`Purchased: ${upgrade.name}`);
    return true;
  }

  static applyUpgradeEffect(upgradeId) {
    switch (upgradeId) {
      case 'reduceCooldown':
        this.updateCooldownReduction();
        break;
      case 'doubleClick':
        this.updateClickMultiplier();
        break;
    }
  }

  static updateCooldownReduction() {
    const count = gameState.getUpgradeCount('reduceCooldown');
    const reduction = count >= CONFIG.REDUCE_COOLDOWN_MAX ? 1 : Math.min(1, 0.05 * count);
    const multiplier = 1 - reduction;

    Object.values(gameState.data.cooldowns).forEach(cooldown => {
      const newMs = multiplier === 0 ? 0 : Math.max(100, Math.round(cooldown.baseMs * multiplier));
      cooldown.ms = newMs;
    });
  }

  static updateClickMultiplier() {
    const count = gameState.getUpgradeCount('doubleClick');
    gameState.data.buttonTypes.action.multiplier = Math.pow(2, count);
  }

  static getClickValue() {
    const action = gameState.data.buttonTypes.action;
    return action.base * action.multiplier;
  }
}

class ContractManager {
  static shouldUnlockContracts() {
    return CREW_TYPES.some(crew => crew.count >= 10);
  }

  static unlockContracts() {
    if (!gameState.data.flags.contractsUnlocked && this.shouldUnlockContracts()) {
      gameState.data.flags.contractsUnlocked = true;
      toastManager.show("Contracts unlocked!", 'success');
      saveManager.save();
    }
  }

  static takeContract() {
    if (gameState.contractActive) return false;
    
    gameState.contractActive = true;
    gameState.contractProgress = 0;
    gameState.data.flags.contractsHintRemoved = true;
    
    const contract = CONTRACTS[gameState.data.currentContract];
    toastManager.show(`Contract taken: ${contract.title}`, 'info');
    saveManager.save();
    return true;
  }

  static advanceContract(amount) {
    if (!gameState.contractActive) return false;
    
    const contract = CONTRACTS[gameState.data.currentContract];
    gameState.contractProgress += amount;
    
    if (gameState.contractProgress >= contract.goal) {
      this.completeContract(contract);
      return true;
    }
    return false;
  }

  static completeContract(contract) {
    gameState.credits += contract.reward;
    gameState.contractActive = false;
    gameState.contractProgress = 0;
    toastManager.show(`Contract completed! +${contract.reward} credits`, 'success');
  }
}

// ========================================
// AUTOCLICKER SYSTEM
// ========================================
class AutoclickerManager {
  constructor() {
    this.snitchTimer = null;
    this.uiUpdatePending = false;
    this.uiThrottle = CONFIG.UI_THROTTLE_BASE;
  }

  updateSnitchTimer() {
    this.clearTimer();
    this.updateThrottleRate();
    
    const snitch = CREW_TYPES.find(c => c.id === 'snitch');
    if (!snitch || snitch.count <= 0) return;

    const intervalTicks = CrewManager.getSnitchInterval(snitch);
    const intervalMs = intervalTicks * CONFIG.TICK_INTERVAL;

    this.snitchTimer = setInterval(() => {
      if (gameState.canClick('action')) {
        this.performAutoclick();
      }
    }, intervalMs);
  }

  performAutoclick() {
    gameState.startCooldown('action');
    const clickValue = UpgradeManager.getClickValue();

    if (gameState.contractActive) {
      ContractManager.advanceContract(clickValue);
    } else {
      gameState.credits += clickValue;
    }

    this.updateCriticalUI();
    this.scheduleUIUpdate();
  }

  updateCriticalUI() {
    const creditsEl = document.getElementById('credits');
    if (creditsEl) {
      creditsEl.textContent = gameState.credits.toLocaleString();
    }

    const progressEl = document.getElementById('contractProgressNum');
    if (progressEl && gameState.contractActive) {
      progressEl.textContent = gameState.contractProgress.toLocaleString();
    }
  }

  scheduleUIUpdate() {
    if (!this.uiUpdatePending) {
      this.uiUpdatePending = true;
      setTimeout(() => {
        uiManager.updateAll();
        this.uiUpdatePending = false;
      }, this.uiThrottle);
    }
  }

  updateThrottleRate() {
    const snitch = CREW_TYPES.find(c => c.id === 'snitch');
    if (snitch.count > 50) {
      this.uiThrottle = CONFIG.UI_THROTTLE_HIGH;
    } else if (snitch.count > 20) {
      this.uiThrottle = CONFIG.UI_THROTTLE_MEDIUM;
    } else {
      this.uiThrottle = CONFIG.UI_THROTTLE_BASE;
    }
  }

  clearTimer() {
    if (this.snitchTimer) {
      clearInterval(this.snitchTimer);
      this.snitchTimer = null;
    }
  }
}

// ========================================
// UI MANAGEMENT SYSTEM
// ========================================
class UIManager {
  constructor() {
    this.elements = new Map();
    this.lastUpdateTime = 0;
    this.updateThrottle = 16; // ~60fps
  }

  // Cache frequently accessed elements
  cacheElement(id) {
    if (!this.elements.has(id)) {
      this.elements.set(id, document.getElementById(id));
    }
    return this.elements.get(id);
  }

  updateAll() {
    const now = Date.now();
    if (now - this.lastUpdateTime < this.updateThrottle) return;
    this.lastUpdateTime = now;

    this.updateCredits();
    this.updateCrew();
    this.updateUpgrades();
    this.updateContracts();
    this.updateCooldowns();
  }

  updateCredits() {
    const creditsEl = this.cacheElement('credits');
    if (creditsEl) {
      creditsEl.textContent = gameState.credits.toLocaleString();
    }

    const clickInfoEl = this.cacheElement('clickInfo');
    if (clickInfoEl) {
      const value = UpgradeManager.getClickValue();
      clickInfoEl.textContent = `+${value.toLocaleString()} credit${value !== 1 ? 's' : ''}`;
    }
  }

  updateCrew() {
    const container = this.cacheElement('crewContainer');
    if (!container) return;

    let html = '';
    
    CREW_TYPES.forEach(crew => {
      // Show crew if revealed or affordable
      const cost = CrewManager.getCrewCost(crew);
      const shouldShow = crew.revealed || gameState.credits >= cost || crew.count > 0;
      
      // Special reveal condition for snitch
      if (crew.id === 'snitch') {
        const cooldownMaxed = gameState.getUpgradeCount('reduceCooldown') >= CONFIG.REDUCE_COOLDOWN_MAX;
        if (!cooldownMaxed && crew.count === 0) return;
      }

      if (!shouldShow) return;
      
      crew.revealed = true;
      
      const canAfford = CrewManager.canAffordCrew(crew);
      const canHire = canAfford && gameState.canClick('hire');
      
      let statsHtml = '';
      if (crew.perTick > 0) {
        const totalIncome = crew.count * crew.perTick;
        statsHtml = `
          <div class="crew-stat">
            <span class="crew-stat-label">Income:</span>
            <span class="crew-stat-value">+${totalIncome.toFixed(1)}/tick</span>
          </div>
        `;
      } else if (crew.id === 'snitch') {
        const interval = CrewManager.getSnitchInterval(crew);
        const tickText = Math.abs(interval - CONFIG.TICK_THRESHOLD) < CONFIG.TOLERANCE ? "tick" : "ticks";
        statsHtml = `
          <div class="crew-stat">
            <span class="crew-stat-label">Autoclick:</span>
            <span class="crew-stat-value">Every ${interval.toFixed(1)} ${tickText}</span>
          </div>
        `;
      }

      html += `
        <div class="crew-member" data-crew-id="${crew.id}">
          <div class="crew-header">
            <div class="crew-info">
              <h3 class="crew-name">${crew.icon} ${crew.name}</h3>
              <p class="crew-description">${crew.description}</p>
              <div class="crew-stats">
                <div class="crew-stat">
                  <span class="crew-stat-label">Count:</span>
                  <span class="crew-stat-value">${crew.count}</span>
                </div>
                ${statsHtml}
              </div>
            </div>
          </div>
          <div class="crew-actions">
            <button class="crew-btn cooldownable" 
                    data-crew-id="${crew.id}" 
                    data-cooldown-type="hire"
                    ${!canHire ? 'disabled' : ''}>
              <span class="btn-text">Hire ${crew.name}</span>
            </button>
            <div class="crew-cost">Cost: ${cost.toLocaleString()} credits</div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  updateUpgrades() {
    const container = this.cacheElement('upgradeContainer');
    if (!container) return;

    let html = '';

    UPGRADE_TYPES.forEach(upgrade => {
      const count = gameState.getUpgradeCount(upgrade.id);
      const isRevealed = gameState.isUpgradeRevealed(upgrade.id);
      const cost = UpgradeManager.getUpgradeCost(upgrade);
      const shouldShow = isRevealed || count > 0 || gameState.credits >= cost;
      
      if (!shouldShow) return;
      
      gameState.revealUpgrade(upgrade.id);
      
      const canAfford = UpgradeManager.canAffordUpgrade(upgrade);
      const isMaxed = UpgradeManager.isUpgradeMaxed(upgrade);
      
      let effectText = '';
      if (upgrade.id === 'reduceCooldown') {
        const reduction = Math.min(100, 5 * count);
        effectText = `Current: ${reduction}% cooldown reduction`;
      } else if (upgrade.id === 'doubleClick') {
        const multiplier = Math.pow(2, count);
        effectText = `Current: ${multiplier}x click power`;
      }

      html += `
        <div class="upgrade-item ${isMaxed ? 'maxed' : ''}" data-upgrade-id="${upgrade.id}">
          <div class="upgrade-header">
            <h3 class="upgrade-name">${upgrade.icon} ${upgrade.name}</h3>
            ${!isMaxed ? `<div class="upgrade-cost">${cost.toLocaleString()}</div>` : ''}
          </div>
          <p class="upgrade-description">${upgrade.description}</p>
          ${effectText ? `<p class="upgrade-effect">${effectText}</p>` : ''}
          <button class="upgrade-btn" 
                  data-upgrade-id="${upgrade.id}"
                  ${!canAfford || isMaxed ? 'disabled' : ''}>
            ${isMaxed ? 'MAXED OUT' : 'Purchase Upgrade'}
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  updateContracts() {
    const section = this.cacheElement('contractsSection');
    const area = this.cacheElement('contractArea');
    const hint = this.cacheElement('contractsHint');
    
    if (!section) return;

    // Check if contracts should be unlocked
    ContractManager.unlockContracts();

    if (gameState.data.flags.contractsUnlocked) {
      section.classList.remove('hidden');
      
      // Remove hint if contracts have been taken
      if (gameState.data.flags.contractsHintRemoved && hint) {
        hint.remove();
      }

      if (area) {
        const contract = CONTRACTS[gameState.data.currentContract];
        
        if (!gameState.contractActive) {
          area.innerHTML = `
            <div class="contract-item">
              <div class="contract-description">${contract.icon} ${contract.title}</div>
              <div class="contract-details">${contract.details}</div>
              <button id="takeContractBtn" class="crew-btn">
                Take Contract (Reward: ${contract.reward.toLocaleString()} credits)
              </button>
            </div>
          `;
        } else {
          const progress = gameState.contractProgress;
          const goal = contract.goal;
          const percentage = Math.min(100, (progress / goal) * 100);
          
          area.innerHTML = `
            <div class="contract-item">
              <div class="contract-description">${contract.icon} ${contract.title}</div>
              <div class="contract-details">${contract.details}</div>
              <div class="contract-progress">
                <div>Progress: <span id="contractProgressNum">${progress.toLocaleString()}</span> / ${goal.toLocaleString()}</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
              </div>
            </div>
          `;
        }
      }
    } else {
      section.classList.add('hidden');
    }

    // Update contract click button visibility
    const contractClickBtn = this.cacheElement('contractClickBtn');
    if (contractClickBtn) {
      if (gameState.contractActive) {
        contractClickBtn.classList.remove('hidden');
      } else {
        contractClickBtn.classList.add('hidden');
      }
    }
  }

  updateCooldowns() {
    const cooldownButtons = document.querySelectorAll('.cooldownable');
    let anyCooling = false;

    cooldownButtons.forEach(button => {
      const cooldownType = button.dataset.cooldownType || 'action';
      const cooldown = gameState.data.cooldowns[cooldownType];
      
      if (!cooldown) return;

      const now = Date.now();
      const total = cooldown.ms || CONFIG.BASE_COOLDOWN;
      const readyAt = cooldown.readyAt || 0;

      if (total === 0 || now >= readyAt) {
        button.style.setProperty('--cdw', '0%');
        
        // Check additional conditions for specific buttons
        if (button.dataset.crewId) {
          const crew = CREW_TYPES.find(c => c.id === button.dataset.crewId);
          const canAfford = crew && CrewManager.canAffordCrew(crew);
          button.disabled = !canAfford;
        } else {
          button.disabled = false;
        }
      } else {
        const elapsed = Math.max(0, total - (readyAt - now));
        const percentage = Math.max(0, Math.min(1, elapsed / total));
        button.style.setProperty('--cdw', `${(percentage * 100).toFixed(1)}%`);
        button.disabled = true;
        anyCooling = true;
      }
    });

    if (anyCooling) {
      requestAnimationFrame(() => this.updateCooldowns());
    }
  }

  showLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    
    if (loadingScreen) loadingScreen.classList.remove('hidden');
    if (app) app.classList.add('hidden');
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const app = document.getElementById('app');
    
    setTimeout(() => {
      if (loadingScreen) loadingScreen.classList.add('hidden');
      if (app) app.classList.remove('hidden');
    }, 1000); // Show loading for 1 second for polish
  }
}

// ========================================
// TOAST NOTIFICATION SYSTEM
// ========================================
class ToastManager {
  constructor() {
    this.container = document.getElementById('toastContainer');
    this.toastCounter = 0;
  }

  show(message, type = 'info') {
    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toast.dataset.toastId = ++this.toastCounter;

    this.container.appendChild(toast);

    // Remove excess toasts
    this.cleanupToasts();

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto remove
    setTimeout(() => {
      this.removeToast(toast);
    }, 3000);
  }

  removeToast(toast) {
    if (!toast.parentNode) return;
    
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  cleanupToasts() {
    const toasts = this.container.querySelectorAll('.toast');
    if (toasts.length > CONFIG.MAX_TOASTS) {
      const excess = toasts.length - CONFIG.MAX_TOASTS;
      for (let i = 0; i < excess; i++) {
        this.removeToast(toasts[i]);
      }
    }
  }
}

// ========================================
// SAVE SYSTEM
// ========================================
class SaveManager {
  constructor() {
    this.autosaveEnabled = true;
    this.autosaveTimer = null;
    this.lastSaveTime = Date.now();
    this.suppressSaves = false;
  }

  save() {
    if (this.suppressSaves) return;

    try {
      const saveData = {
        gameState: gameState.serialize(),
        crewTypes: CREW_TYPES.map(crew => ({ ...crew })),
        version: "2.0",
        timestamp: Date.now(),
      };
      
      localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(saveData));
      this.lastSaveTime = Date.now();
      this.updateLastSavedDisplay();
    } catch (error) {
      console.error('Failed to save game:', error);
      toastManager.show('Failed to save game', 'error');
    }
  }

  load() {
    try {
      const saveData = localStorage.getItem(CONFIG.SAVE_KEY);
      if (!saveData) {
        // Try to migrate from old save format
        this.migrateOldSave();
        return;
      }

      const data = JSON.parse(saveData);
      
      if (data.gameState) {
        gameState.deserialize(data.gameState);
      }
      
      if (data.crewTypes && Array.isArray(data.crewTypes)) {
        data.crewTypes.forEach((savedCrew, index) => {
          if (CREW_TYPES[index]) {
            Object.assign(CREW_TYPES[index], savedCrew);
          }
        });
      }

      // Apply upgrade effects
      UpgradeManager.updateCooldownReduction();
      UpgradeManager.updateClickMultiplier();
      
      console.log('Game loaded successfully');
    } catch (error) {
      console.error('Failed to load game:', error);
      toastManager.show('Failed to load save data', 'error');
    }
  }

  migrateOldSave() {
    try {
      const oldSave = localStorage.getItem("bountySaveV1");
      if (!oldSave) return;

      const oldData = JSON.parse(oldSave);
      
      // Migrate old state structure to new format
      if (oldData.state) {
        const oldState = oldData.state;
        gameState.data.credits = oldState.credits || 0;
        gameState.data.ticks = oldState.ticks || 0;
        gameState.data.unbanked = oldState.unbanked || 0;
        
        // Migrate upgrades
        if (oldState.upgrades) {
          Object.entries(oldState.upgrades).forEach(([key, value]) => {
            gameState.setUpgradeCount(key, value);
          });
        }
        
        // Migrate flags
        if (oldState.flags) {
          Object.assign(gameState.data.flags, oldState.flags);
        }
        
        // Migrate contract state
        gameState.contractActive = oldState.contractActive || false;
        gameState.contractProgress = oldState.contractProgress || 0;
        gameState.data.currentContract = oldState.currentContract || 0;
      }
      
      // Migrate crew data
      if (oldData.crewTypes && Array.isArray(oldData.crewTypes)) {
        oldData.crewTypes.forEach((oldCrew, index) => {
          if (CREW_TYPES[index]) {
            CREW_TYPES[index].count = oldCrew.count || 0;
            CREW_TYPES[index].revealed = oldCrew.revealed || false;
          }
        });
      }

      // Save in new format and remove old save
      this.save();
      localStorage.removeItem("bountySaveV1");
      
      toastManager.show('Save data migrated to new format', 'success');
      console.log('Successfully migrated old save data');
    } catch (error) {
      console.error('Failed to migrate old save:', error);
    }
  }

  enableAutosave() {
    if (this.autosaveTimer) return;
    
    this.autosaveTimer = setInterval(() => {
      if (this.autosaveEnabled) {
        this.save();
        toastManager.show('Game autosaved', 'success');
      }
    }, CONFIG.AUTOSAVE_INTERVAL);
  }

  disableAutosave() {
    if (this.autosaveTimer) {
      clearInterval(this.autosaveTimer);
      this.autosaveTimer = null;
    }
  }

  toggleAutosave() {
    this.autosaveEnabled = !this.autosaveEnabled;
    const button = document.getElementById('autosaveToggleBtn');
    
    if (button) {
      const textEl = button.querySelector('.btn-text');
      if (textEl) {
        textEl.textContent = this.autosaveEnabled ? 'Auto: ON' : 'Auto: OFF';
      }
      
      if (this.autosaveEnabled) {
        button.classList.add('active');
        this.enableAutosave();
      } else {
        button.classList.remove('active');
        this.disableAutosave();
      }
    }
  }

  updateLastSavedDisplay() {
    const element = document.getElementById('lastSaved');
    if (!element) return;

    const secondsAgo = Math.floor((Date.now() - this.lastSaveTime) / 1000);
    element.textContent = secondsAgo === 0 ? 'Last saved just now' : `Last saved ${secondsAgo}s ago`;
  }

  reset() {
    if (!confirm('Are you sure you want to reset all progress? This cannot be undone!')) {
      return;
    }

    this.suppressSaves = true;
    this.disableAutosave();
    
    // Clear all save data
    localStorage.removeItem(CONFIG.SAVE_KEY);
    localStorage.removeItem("bountySaveV1"); // Also clear legacy save
    
    // Reload the page
    window.location.reload();
  }
}

// ========================================
// DEVELOPER MENU SYSTEM
// ========================================
class DevMenu {
  constructor() {
    this.isOpen = false;
    this.keySequence = '';
    this.element = null;
  }

  init() {
    this.createMenu();
    this.bindEvents();
  }

  createMenu() {
    const menu = document.getElementById('devMenu');
    if (!menu) return;

    const content = menu.querySelector('.dev-menu-content');
    if (!content) return;

    content.innerHTML = `
      <div class="dev-section">
        <h4>💰 Credits</h4>
        <div class="dev-input-group">
          <input type="number" id="devCreditsInput" placeholder="Enter credits" min="0">
          <button onclick="devMenu.setCredits()">Set Credits</button>
        </div>
        <div class="dev-button-group">
          <button onclick="devMenu.addCredits(1000)">+1K</button>
          <button onclick="devMenu.addCredits(10000)">+10K</button>
          <button onclick="devMenu.addCredits(100000)">+100K</button>
          <button onclick="devMenu.addCredits(1000000)">+1M</button>
        </div>
      </div>
      
      <div class="dev-section">
        <h4>👥 Crew Management</h4>
        <div class="dev-input-group">
          <select id="devCrewSelect">
            ${CREW_TYPES.map(crew => `<option value="${crew.id}">${crew.name}</option>`).join('')}
          </select>
          <input type="number" id="devCrewCount" placeholder="Count" min="0">
          <button onclick="devMenu.setCrew()">Set Count</button>
        </div>
        <div class="dev-button-group">
          <button onclick="devMenu.addCrew(1)">+1</button>
          <button onclick="devMenu.addCrew(10)">+10</button>
          <button onclick="devMenu.addCrew(100)">+100</button>
        </div>
      </div>
      
      <div class="dev-section">
        <h4>⚡ Upgrades</h4>
        <div class="dev-input-group">
          <select id="devUpgradeSelect">
            ${UPGRADE_TYPES.map(upgrade => `<option value="${upgrade.id}">${upgrade.name}</option>`).join('')}
          </select>
          <input type="number" id="devUpgradeCount" placeholder="Count" min="0">
          <button onclick="devMenu.setUpgrade()">Set Count</button>
        </div>
        <div class="dev-button-group">
          <button onclick="devMenu.addUpgrade(1)">+1</button>
          <button onclick="devMenu.addUpgrade(5)">+5</button>
          <button onclick="devMenu.addUpgrade(20)">+20</button>
        </div>
      </div>
      
      <div class="dev-section">
        <h4>🎮 Game State</h4>
        <div class="dev-button-group">
          <button onclick="devMenu.unlockContracts()">Unlock Contracts</button>
          <button onclick="devMenu.completeContract()">Complete Contract</button>
          <button onclick="devMenu.resetCooldowns()">Reset Cooldowns</button>
          <button onclick="devMenu.maxEverything()">Max Everything</button>
        </div>
      </div>
      
      <div class="dev-section">
        <h4>💾 Save Management</h4>
        <div class="dev-button-group">
          <button onclick="devMenu.exportSave()">Export Save</button>
          <button onclick="devMenu.importSave()">Import Save</button>
          <button onclick="devMenu.resetGame()">Reset Game</button>
        </div>
      </div>
    `;

    this.element = menu;
  }

  bindEvents() {
    // Keyboard trigger
    document.addEventListener('keydown', (e) => {
      if (e.key.length === 1) {
        this.keySequence += e.key.toLowerCase();
        
        if (this.keySequence.length > CONFIG.DEV_TRIGGER.length) {
          this.keySequence = this.keySequence.slice(-CONFIG.DEV_TRIGGER.length);
        }
        
        if (this.keySequence === CONFIG.DEV_TRIGGER) {
          this.open();
          this.keySequence = '';
        }
      }
      
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isOpen && this.element && !this.element.contains(e.target)) {
        this.close();
      }
    });
  }

  open() {
    if (!this.element) this.createMenu();
    this.element.classList.remove('hidden');
    this.isOpen = true;
  }

  close() {
    if (this.element) {
      this.element.classList.add('hidden');
      this.isOpen = false;
    }
  }

  // Dev menu functions
  setCredits() {
    const input = document.getElementById('devCreditsInput');
    const value = parseInt(input.value);
    if (!isNaN(value) && value >= 0) {
      gameState.credits = value;
      input.value = '';
      uiManager.updateAll();
      toastManager.show(`Credits set to ${value.toLocaleString()}`);
    }
  }

  addCredits(amount) {
    gameState.credits += amount;
    uiManager.updateAll();
    toastManager.show(`Added ${amount.toLocaleString()} credits`);
  }

  setCrew() {
    const crewType = document.getElementById('devCrewSelect').value;
    const count = parseInt(document.getElementById('devCrewCount').value);
    
    if (!isNaN(count) && count >= 0) {
      const crew = CREW_TYPES.find(c => c.id === crewType);
      if (crew) {
        crew.count = count;
        document.getElementById('devCrewCount').value = '';
        
        if (crewType === 'snitch') {
          autoclicker.updateSnitchTimer();
        }
        
        uiManager.updateAll();
        toastManager.show(`${crew.name} count set to ${count}`);
      }
    }
  }

  addCrew(amount) {
    const crewType = document.getElementById('devCrewSelect').value;
    const crew = CREW_TYPES.find(c => c.id === crewType);
    
    if (crew) {
      crew.count += amount;
      
      if (crewType === 'snitch') {
        autoclicker.updateSnitchTimer();
      }
      
      uiManager.updateAll();
      toastManager.show(`Added ${amount} ${crew.name}`);
    }
  }

  setUpgrade() {
    const upgradeType = document.getElementById('devUpgradeSelect').value;
    const count = parseInt(document.getElementById('devUpgradeCount').value);
    
    if (!isNaN(count) && count >= 0) {
      gameState.setUpgradeCount(upgradeType, count);
      document.getElementById('devUpgradeCount').value = '';
      UpgradeManager.applyUpgradeEffect(upgradeType);
      uiManager.updateAll();
      toastManager.show(`${upgradeType} set to ${count}`);
    }
  }

  addUpgrade(amount) {
    const upgradeType = document.getElementById('devUpgradeSelect').value;
    const currentCount = gameState.getUpgradeCount(upgradeType);
    gameState.setUpgradeCount(upgradeType, currentCount + amount);
    UpgradeManager.applyUpgradeEffect(upgradeType);
    uiManager.updateAll();
    toastManager.show(`Added ${amount} ${upgradeType}`);
  }

  unlockContracts() {
    gameState.data.flags.contractsUnlocked = true;
    uiManager.updateAll();
    toastManager.show('Contracts unlocked!');
  }

  completeContract() {
    if (gameState.contractActive) {
      const contract = CONTRACTS[gameState.data.currentContract];
      ContractManager.completeContract(contract);
      uiManager.updateAll();
    } else {
      toastManager.show('No active contract', 'warning');
    }
  }

  resetCooldowns() {
    const now = Date.now();
    Object.values(gameState.data.cooldowns).forEach(cooldown => {
      cooldown.readyAt = now;
    });
    uiManager.updateCooldowns();
    toastManager.show('All cooldowns reset');
  }

  maxEverything() {
    // Max credits
    gameState.credits = 999999999;
    
    // Max crew
    CREW_TYPES.forEach(crew => {
      crew.count = 999;
    });
    
    // Max upgrades
    UPGRADE_TYPES.forEach(upgrade => {
      gameState.setUpgradeCount(upgrade.id, upgrade.maxLevel || 999);
    });
    
    // Unlock everything
    gameState.data.flags.contractsUnlocked = true;
    
    // Apply effects
    UpgradeManager.updateCooldownReduction();
    UpgradeManager.updateClickMultiplier();
    autoclicker.updateSnitchTimer();
    
    uiManager.updateAll();
    toastManager.show('Everything maxed out!', 'success');
  }

  exportSave() {
    const saveData = {
      gameState: gameState.serialize(),
      crewTypes: CREW_TYPES.map(crew => ({ ...crew })),
      version: "2.0",
      timestamp: Date.now(),
    };
    
    const dataStr = JSON.stringify(saveData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `bounty-save-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    toastManager.show('Save exported!', 'success');
  }

  importSave() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const saveData = JSON.parse(e.target.result);
          
          if (saveData.gameState && saveData.crewTypes) {
            gameState.deserialize(saveData.gameState);
            
            saveData.crewTypes.forEach((savedCrew, index) => {
              if (CREW_TYPES[index]) {
                Object.assign(CREW_TYPES[index], savedCrew);
              }
            });
            
            UpgradeManager.updateCooldownReduction();
            UpgradeManager.updateClickMultiplier();
            autoclicker.updateSnitchTimer();
            uiManager.updateAll();
            
            toastManager.show('Save imported successfully!', 'success');
          } else {
            toastManager.show('Invalid save file format', 'error');
          }
        } catch (error) {
          console.error('Import error:', error);
          toastManager.show('Error importing save file', 'error');
        }
      };
      
      reader.readAsText(file);
    };
    
    input.click();
  }

  resetGame() {
    saveManager.reset();
  }
}

// ========================================
// GAME ENGINE
// ========================================
class GameEngine {
  constructor() {
    this.tickTimer = null;
    this.running = false;
  }

  start() {
    if (this.running) return;
    
    this.running = true;
    this.tickTimer = setInterval(() => this.tick(), CONFIG.TICK_INTERVAL);
  }

  stop() {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  tick() {
    gameState.data.ticks += 1;

    if (gameState.contractActive) {
      // During contracts, passive income goes to contract progress
      const passiveIncome = CrewManager.getTotalPassiveIncome();
      const contract = CONTRACTS[gameState.data.currentContract];
      gameState.contractProgress += passiveIncome;
      ContractManager.advanceContract(0); // Check completion
    } else {
      // Normal passive income
      const passiveIncome = CrewManager.getTotalPassiveIncome();
      gameState.data.unbanked += passiveIncome;

      // Bank whole credits
      const wholeBanked = Math.floor(gameState.data.unbanked);
      if (wholeBanked > 0) {
        gameState.credits += wholeBanked;
        gameState.data.unbanked -= wholeBanked;
      }
    }

    // Update critical UI elements
    autoclicker.updateCriticalUI();
  }
}

// ========================================
// EVENT HANDLERS
// ========================================
class EventManager {
  static init() {
    this.bindGameActions();
    this.bindControlActions();
    this.bindDelegatedEvents();
    this.bindWindowEvents();
  }

  static bindGameActions() {
    // Hunt button
    const huntBtn = document.getElementById('huntBtn');
    if (huntBtn) {
      huntBtn.addEventListener('click', () => {
        if (!gameState.canClick('action')) return;
        
        const clickValue = UpgradeManager.getClickValue();
        
        if (gameState.contractActive) {
          ContractManager.advanceContract(clickValue);
        } else {
          gameState.credits += clickValue;
        }
        
        gameState.startCooldown('action');
        uiManager.updateAll();
      });
    }

    // Contract advance button
    const contractClickBtn = document.getElementById('contractClickBtn');
    if (contractClickBtn) {
      contractClickBtn.addEventListener('click', () => {
        if (!gameState.canClick('action') || !gameState.contractActive) return;
        
        const clickValue = UpgradeManager.getClickValue();
        ContractManager.advanceContract(clickValue);
        gameState.startCooldown('action');
        uiManager.updateAll();
      });
    }
  }

  static bindControlActions() {
    // Manual save
    const manualSaveBtn = document.getElementById('manualSaveBtn');
    if (manualSaveBtn) {
      manualSaveBtn.addEventListener('click', () => {
        saveManager.save();
        toastManager.show('Game saved manually!', 'success');
      });
    }

    // Autosave toggle
    const autosaveToggleBtn = document.getElementById('autosaveToggleBtn');
    if (autosaveToggleBtn) {
      autosaveToggleBtn.addEventListener('click', () => {
        saveManager.toggleAutosave();
      });
    }

    // Reset button with confirmation
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      let resetClickCount = 0;
      resetBtn.addEventListener('click', () => {
        resetClickCount++;
        
        if (resetClickCount < 3) {
          const textEl = resetBtn.querySelector('.btn-text');
          if (textEl) {
            textEl.textContent = `Reset (${3 - resetClickCount} more)`;
          }
          
          setTimeout(() => {
            resetClickCount = 0;
            const textEl = resetBtn.querySelector('.btn-text');
            if (textEl) {
              textEl.textContent = 'Reset';
            }
          }, 2000);
          return;
        }
        
        saveManager.reset();
      });
    }
  }

  static bindDelegatedEvents() {
    // Crew hiring (delegated event handling)
    document.addEventListener('click', (e) => {
      const crewBtn = e.target.closest('[data-crew-id]');
      if (crewBtn && crewBtn.classList.contains('crew-btn')) {
        const crewId = crewBtn.dataset.crewId;
        if (CrewManager.hireCrew(crewId)) {
          uiManager.updateAll();
        }
      }
    });

    // Upgrade purchases (delegated event handling)
    document.addEventListener('click', (e) => {
      const upgradeBtn = e.target.closest('[data-upgrade-id]');
      if (upgradeBtn && upgradeBtn.classList.contains('upgrade-btn')) {
        const upgradeId = upgradeBtn.dataset.upgradeId;
        if (UpgradeManager.purchaseUpgrade(upgradeId)) {
          uiManager.updateAll();
          saveManager.save();
        }
      }
    });

    // Contract taking (delegated event handling)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'takeContractBtn') {
        if (ContractManager.takeContract()) {
          uiManager.updateAll();
        }
      }
    });
  }

  static bindWindowEvents() {
    // Save on page unload
    window.addEventListener('beforeunload', () => {
      if (!saveManager.suppressSaves) {
        saveManager.save();
      }
    });

    // Save when tab becomes hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !saveManager.suppressSaves) {
        saveManager.save();
      }
    });

    // Update UI on resize for responsive handling
    window.addEventListener('resize', () => {
      uiManager.updateAll();
    });
  }
}

// ========================================
// GLOBAL INSTANCES
// ========================================
const gameState = new GameState();
const uiManager = new UIManager();
const toastManager = new ToastManager();
const saveManager = new SaveManager();
const autoclicker = new AutoclickerManager();
const gameEngine = new GameEngine();
const devMenu = new DevMenu();

// ========================================
// GLOBAL FUNCTIONS (for dev menu onclick handlers)
// ========================================
window.closeDevMenu = () => devMenu.close();
window.devMenu = devMenu; // Expose for onclick handlers

// ========================================
// INITIALIZATION
// ========================================
class GameInitializer {
  static async init() {
    try {
      // Show loading screen
      uiManager.showLoadingScreen();
      
      // Initialize managers
      devMenu.init();
      
      // Load saved data
      saveManager.load();
      
      // Apply initial upgrade effects
      UpgradeManager.updateCooldownReduction();
      UpgradeManager.updateClickMultiplier();
      
      // Set up autoclicker
      autoclicker.updateSnitchTimer();
      
      // Bind all event handlers
      EventManager.init();
      
      // Start game engine
      gameEngine.start();
      
      // Enable autosave
      saveManager.enableAutosave();
      
      // Update last saved display every second
      setInterval(() => saveManager.updateLastSavedDisplay(), 1000);
      
      // Initial UI update
      uiManager.updateAll();
      
      // Hide loading screen and show game
      uiManager.hideLoadingScreen();
      
      console.log('🎮 Bounty Office initialized successfully!');
      
    } catch (error) {
      console.error('Failed to initialize game:', error);
      toastManager.show('Failed to load game', 'error');
    }
  }
}

// ========================================
// APPLICATION ENTRY POINT
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  GameInitializer.init();
});

// ========================================
// PERFORMANCE MONITORING (Development)
// ========================================
if (typeof PerformanceObserver !== 'undefined') {
  // Performance monitoring for development
  try {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 16) { // Longer than one frame
          console.warn(`Slow operation detected: ${entry.name} took ${entry.duration}ms`);
        }
      });
    });
    
    observer.observe({ entryTypes: ['measure'] });
  } catch (e) {
    // Performance monitoring not available
  }
}

// ========================================
// ERROR HANDLING
// ========================================
window.addEventListener('error', (event) => {
  console.error('Game error:', event.error);
  toastManager.show('An error occurred. Check console for details.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  toastManager.show('An error occurred. Check console for details.', 'error');
});

// ========================================
// EXPORTS (for potential future module usage)
// ========================================
export {
  GameState,
  CrewManager,
  UpgradeManager,
  ContractManager,
  AutoclickerManager,
  UIManager,
  ToastManager,
  SaveManager,
  DevMenu,
  GameEngine,
  CONFIG,
  CREW_TYPES,
  CONTRACTS,
  UPGRADE_TYPES,
};