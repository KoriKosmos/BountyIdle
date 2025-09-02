// Game Configuration
const CONFIG = {
  SAVE_KEY: "bountySaveV2",
  BASE_COOLDOWN_MS: 1000,
  TICK_MS: 1000,
  REDUCE_CD_MAX_COUNT: 20,
  SINGLE_TICK_THRESHOLD: 1,
  TICK_INTERVAL_TOLERANCE: 0.001,
  AUTOSAVE_INTERVAL_MS: 30000,
  TOAST_DURATION_MS: 3000,
  MAX_TOASTS: 5
};

// Game Data
const CREW_TYPES = [
  {
    id: "novice",
    name: "Novice Hunter",
    baseCost: 20,
    scaling: 1.15,
    perTick: 0.5,
    count: 0,
    revealed: false,
    description: "Basic bounty hunter"
  },
  {
    id: "snitch",
    name: "Snitch (Autoclicker)",
    baseCost: 1000,
    scaling: 10,
    perTick: 0,
    count: 0,
    revealed: false,
    autoclickType: "action",
    baseClickInterval: 1,
    description: "Automatically clicks for you"
  }
];

const UPGRADE_TYPES = [
  {
    id: "reduceCooldown",
    name: "Reduce Cooldown",
    baseCost: 10,
    scaling: 1.15,
    description: "Reduces button click cooldown by 5%",
    maxCount: CONFIG.REDUCE_CD_MAX_COUNT
  },
  {
    id: "doubleClick",
    name: "Double Click Power",
    baseCost: 20,
    scaling: 2.5,
    description: "Multiplies click power by 2"
  }
];

const CONTRACTS = [
  {
    id: "familiar-face",
    description: "A familiar face enters the office",
    details: "You meet an old friend who needs help with a bounty. Complete the contract to earn a hefty reward.",
    goal: 1000,
    reward: 2000
  }
];

// Game State
class GameState {
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

// Game Manager
class GameManager {
  constructor() {
    this.state = new GameState();
    this.crewTypes = JSON.parse(JSON.stringify(CREW_TYPES));
    this.upgradeTypes = UPGRADE_TYPES;
    this.contracts = CONTRACTS;
    
    this.snitchTimer = null;
    this.lastSaveTime = Date.now();
    this.autosaveEnabled = true;
    this.autosaveId = null;
    this.tickId = null;
    this.suppressSaves = false;
    
    this.init();
  }

  init() {
    this.load();
    this.setupEventListeners();
    this.setupDevMenuEvents();
    this.startGameLoop();
    this.updateUI();
    this.updateSnitchAutoclicker();
    this.applyUpgradeEffects();
    this.updateCooldownVisual();
    this.startAutosave();
  }

  // Utility functions
  formatNumber(num, decimals = 0) {
    return num.toLocaleString(undefined, { 
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals 
    });
  }

  getElement(id) {
    return document.getElementById(id);
  }

  // Crew management
  getCrewCost(crew) {
    return Math.floor(crew.baseCost * Math.pow(crew.scaling, crew.count));
  }

  getSnitchIntervalTicks(snitch) {
    if (snitch.count <= 0) return snitch.baseClickInterval;
    return 1 / Math.pow(2, snitch.count - 1);
  }

  getSnitchIntervalMs(snitch) {
    if (snitch.count <= 0) return null;
    return this.getSnitchIntervalTicks(snitch) * CONFIG.TICK_MS;
  }

  // Upgrade management
  getUpgradeCost(upgrade) {
    const count = this.state.upgrades[upgrade.id] || 0;
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.scaling, count));
  }

  getButtonValue(typeId) {
    const t = this.state.buttonTypes[typeId] || { base: 1, multiplier: 1 };
    return (t.base || 1) * (t.multiplier || 1);
  }

  getClickValue() {
    return this.getButtonValue('action');
  }

  // Cooldown management
  canClick(typeId) {
    const cd = this.state.cooldowns[typeId] || { readyAt: 0 };
    return Date.now() >= (cd.readyAt || 0);
  }

  startCooldown(typeId) {
    if (!this.state.cooldowns[typeId]) return;
    const cd = this.state.cooldowns[typeId];
    const dur = cd.ms != null ? cd.ms : CONFIG.BASE_COOLDOWN_MS;
    cd.readyAt = Date.now() + dur;
    this.updateCooldownVisual();
  }

  // Upgrade effects
  applyUpgradeEffects() {
    this.updateCooldownFromUpgrades();
    this.updateClickPowerFromUpgrades();
  }

  updateCooldownFromUpgrades() {
    const count = this.state.upgrades.reduceCooldown || 0;
    const linearFactor = count >= CONFIG.REDUCE_CD_MAX_COUNT ? 0 : Math.max(0, 1 - 0.05 * count);
    const now = Date.now();
    
    for (const key of Object.keys(this.state.cooldowns)) {
      const cd = this.state.cooldowns[key];
      if (!cd) continue;
      
      const base = cd.baseMs || CONFIG.BASE_COOLDOWN_MS;
      const oldMs = cd.ms || base;
      const newMs = linearFactor === 0 ? 0 : Math.max(100, Math.round(base * linearFactor));
      cd.ms = newMs;
      
      if (cd.readyAt && cd.readyAt > now) {
        if (newMs === 0) {
          cd.readyAt = now;
        } else {
          const remaining = cd.readyAt - now;
          const scaled = Math.round(remaining * (newMs / oldMs));
          cd.readyAt = now + Math.max(0, scaled);
        }
      }
    }
  }

  updateClickPowerFromUpgrades() {
    if (!this.state.buttonTypes.action) {
      this.state.buttonTypes.action = { base: 1, multiplier: 1 };
    }
    const count = this.state.upgrades.doubleClick || 0;
    this.state.buttonTypes.action.multiplier = Math.pow(2, count);
  }

  // Contract management
  checkAndCompleteContract(contract) {
    if (this.state.contractProgress >= contract.goal) {
      this.completeContract(contract);
      return true;
    }
    return false;
  }

  completeContract(contract) {
    this.state.credits += contract.reward;
    this.state.contractActive = false;
    this.state.contractProgress = 0;
    this.showToast(`Contract completed! +${contract.reward} credits`);
  }

  // Snitch autoclicker
  updateSnitchAutoclicker() {
    const snitch = this.crewTypes[1];
    if (this.snitchTimer) {
      clearInterval(this.snitchTimer);
      this.snitchTimer = null;
    }
    
    const intervalMs = this.getSnitchIntervalMs(snitch);
    if (!intervalMs) return;
    
    this.snitchTimer = setInterval(() => {
      if (snitch.autoclickType === "action" && this.canClick('action')) {
        this.startCooldown('action');
        if (this.state.contractActive) {
          const contract = this.contracts[this.state.currentContract];
          this.state.contractProgress += this.getClickValue();
          this.checkAndCompleteContract(contract);
        } else {
          this.state.credits += this.getClickValue();
        }
        // Only update critical UI elements, no visual flashing
        this.updateCriticalUI();
      }
    }, intervalMs);
  }





  updateCriticalUI() {
    this.getElement("creditsDisplay").textContent = this.formatNumber(this.state.credits);
    
    if (this.state.contractActive) {
      const progressNum = this.getElement('contractProgressNum');
      if (progressNum) {
        progressNum.textContent = this.formatNumber(this.state.contractProgress);
      }
    }
  }

  // UI Management
  updateUI() {
    this.updateCreditsDisplay();
    this.updateCrewUI();
    this.updateUpgradesUI();
    this.updateContractsUI();
    this.updateActionButtons();
  }

  updateCreditsDisplay() {
    this.getElement("creditsDisplay").textContent = this.formatNumber(this.state.credits);
  }

  updateCrewUI() {
    const container = this.getElement("crewContainer");
    if (!container) return;

    let html = "";
    
    for (const crew of this.crewTypes) {
      let shouldShow = crew.revealed;
      
      // Special logic for Snitch - reveal when Reduce Cooldown is maxed
      if (crew.id === 'snitch') {
        const reduceCooldownCount = this.state.upgrades.reduceCooldown || 0;
        shouldShow = crew.revealed || reduceCooldownCount >= CONFIG.REDUCE_CD_MAX_COUNT;
      } else {
        // Other crew revealed when affordable
        shouldShow = crew.revealed || this.state.credits >= this.getCrewCost(crew);
      }
      
      if (!shouldShow) continue;

      if (!crew.revealed) {
        crew.revealed = true;
        this.save();
      }

            const cost = this.getCrewCost(crew);
      const canAfford = this.state.credits >= cost;
      const canClick = this.canClick('hire');
      const disabled = !(canAfford && canClick);

      let description = crew.description;
      if (crew.id === 'snitch') {
        const interval = this.getSnitchIntervalTicks(crew);
        const tickText = Math.abs(interval - CONFIG.SINGLE_TICK_THRESHOLD) < CONFIG.TICK_INTERVAL_TOLERANCE ? "tick" : "ticks";
        description = `Autoclicks every ${interval.toFixed(1)} ${tickText}`;
      }

      html += `
        <div class="crew-section" data-crew-id="${crew.id}">
          <div class="crew-header">
            <h3 class="crew-name">${crew.name}</h3>
            <div class="crew-stats">
              ${crew.perTick > 0 ? `<span class="crew-income">+${(crew.count * crew.perTick).toFixed(1)} credits/tick</span>` : ''}
              <span class="crew-description">${description}</span>
              <span class="crew-count">Hired: ${crew.count}</span>
            </div>
          </div>
          <div class="crew-actions">
            <button class="btn crew-btn ${!canAfford ? 'unavailable' : ''}" data-crew-id="${crew.id}" data-cooldown="hire" ${disabled ? 'disabled' : ''}>
              Hire ${crew.name}
            </button>
            <div class="crew-cost">
              <span class="text-secondary">Cost: ${cost}</span>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  updateUpgradesUI() {
    const container = this.getElement("upgradesContainer");
    if (!container) return;

    let html = "";
    
    for (const upgrade of this.upgradeTypes) {
      const count = this.state.upgrades[upgrade.id] || 0;
      const alreadyRevealed = this.state.revealedUpgrades[upgrade.id];
      const shouldShow = alreadyRevealed || count > 0 || this.state.credits >= upgrade.baseCost;
      
      if (!shouldShow) continue;
      
      if (!alreadyRevealed) {
        this.state.revealedUpgrades[upgrade.id] = true;
        this.save();
      }

      const cost = this.getUpgradeCost(upgrade);
      const canAfford = this.state.credits >= cost;
      const isMaxed = upgrade.maxCount && count >= upgrade.maxCount;
      const disabled = !canAfford || isMaxed;

      let extra = "";
      if (upgrade.id === 'reduceCooldown') {
        const net = Math.min(100, 5 * count);
        extra = ` <span class="text-accent">• Net: ${net}%</span>`;
      }

      html += `
        <div class="upgrade-section ${isMaxed ? 'maxed' : ''}" data-upgrade-id="${upgrade.id}">
          <div class="upgrade-header">
            <span class="upgrade-name">${isMaxed ? `${upgrade.name} (Max)` : upgrade.name}</span>
            <span class="upgrade-cost">${isMaxed ? '' : `Cost: ${cost}`}</span>
          </div>
          <div class="upgrade-description">${upgrade.description}${extra}</div>
          <button class="btn btn-secondary" data-upgrade-id="${upgrade.id}" ${disabled ? 'disabled' : ''}>
            ${isMaxed ? 'Maxed' : 'Purchase'}
          </button>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  updateContractsUI() {
    const section = this.getElement("contractsSection");
    const container = this.getElement("contractsContainer");
    if (!section || !container) return;

    // Unlock contracts when condition met
    if (!this.state.flags.contractsUnlocked && this.crewTypes.some(c => c.count >= 10)) {
      this.state.flags.contractsUnlocked = true;
      this.save();
      this.showToast("Contracts unlocked!");
    }

    if (!this.state.flags.contractsUnlocked) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    
    const contract = this.contracts[this.state.currentContract];
    if (!contract) return;

    if (!this.state.contractActive) {
      container.innerHTML = `
        <div class="contract-progress">
          <p>${contract.description}</p>
          <button class="btn btn-primary" id="takeContractBtn">Take Contract</button>
        </div>
      `;
    } else {
      const progressPercent = Math.min(100, (this.state.contractProgress / contract.goal) * 100);
      container.innerHTML = `
        <div class="contract-progress">
          <p>${contract.details}</p>
          <div>Progress: <strong id="contractProgressNum">${this.formatNumber(this.state.contractProgress)}</strong> / ${this.formatNumber(contract.goal)}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      `;
    }
  }

  updateActionButtons() {
    // Update hunt button value
    const huntValue = this.getElement("huntValue");
    if (huntValue) {
      huntValue.textContent = `+${this.formatNumber(this.getClickValue())} credit`;
    }

    // Update contract button visibility
    const contractBtn = this.getElement("contractBtn");
    if (contractBtn) {
      if (this.state.contractActive) {
        contractBtn.classList.remove("hidden");
      } else {
        contractBtn.classList.add("hidden");
      }
    }
  }

  updateCooldownVisual() {
    const now = Date.now();
    const buttons = document.querySelectorAll('button[data-cooldown]');
    let anyCooling = false;

    for (const btn of buttons) {
      const type = btn.getAttribute('data-cooldown') || 'action';
      const cd = this.state.cooldowns[type];
      if (!cd) continue;

      const total = cd.ms != null ? cd.ms : CONFIG.BASE_COOLDOWN_MS;
      const readyAt = cd.readyAt || 0;

      if (total === 0 || now >= readyAt) {
        btn.style.setProperty('--cooldown-width', '0%');
        btn.disabled = false;
      } else {
        const elapsed = Math.max(0, total - (readyAt - now));
        const pct = Math.max(0, Math.min(1, elapsed / total));
        btn.style.setProperty('--cooldown-width', (pct * 100).toFixed(1) + '%');
        btn.disabled = true;
        anyCooling = true;
      }
    }

    if (anyCooling) {
      requestAnimationFrame(() => this.updateCooldownVisual());
    }
  }

  // Game loop
  startGameLoop() {
    this.tickId = setInterval(() => {
      this.state.ticks += 1;

      if (this.state.contractActive) {
        const contract = this.contracts[this.state.currentContract];
        let contractPerTick = 0;
        for (const crew of this.crewTypes) {
          contractPerTick += crew.count * crew.perTick;
        }
        this.state.contractProgress += contractPerTick;
        this.checkAndCompleteContract(contract);
      } else {
        let passivePerTick = 0;
        for (const crew of this.crewTypes) {
          passivePerTick += crew.count * crew.perTick;
        }
        this.state.unbanked += passivePerTick;

        const whole = Math.floor(this.state.unbanked);
        if (whole > 0) {
          this.state.credits += whole;
          this.state.unbanked -= whole;
        }
      }

      this.updateCriticalUI();
    }, CONFIG.TICK_MS);
  }

  // Event handlers
  setupEventListeners() {
    // Hunt button
    this.getElement("huntBtn").addEventListener("click", () => {
      if (!this.canClick('action')) return;
      this.state.credits += this.getClickValue();
      this.startCooldown('action');
      this.updateUI();
    });

    // Contract button
    this.getElement("contractBtn").addEventListener("click", () => {
      if (!this.canClick('action')) return;
      if (!this.state.contractActive) return;
      
      const add = this.getClickValue();
      const contract = this.contracts[this.state.currentContract];
      this.state.contractProgress += add;
      this.checkAndCompleteContract(contract);
      
      const progressNum = this.getElement('contractProgressNum');
      if (progressNum) progressNum.textContent = this.formatNumber(this.state.contractProgress);
      
      this.startCooldown('action');
      this.updateUI();
    });

    // Delegated event listeners
    document.addEventListener('click', (e) => {
      const target = e.target;
      
      // Crew hiring
      if (target.hasAttribute('data-crew-id')) {
        this.handleCrewHire(target.getAttribute('data-crew-id'));
      }
      
      // Upgrade purchasing
      if (target.hasAttribute('data-upgrade-id')) {
        this.handleUpgradePurchase(target.getAttribute('data-upgrade-id'));
      }
      
      // Contract taking
      if (target.id === 'takeContractBtn') {
        this.handleTakeContract();
      }
    });

    // Save controls
    this.getElement("manualSaveBtn").addEventListener("click", () => {
      this.save();
      this.lastSaveTime = Date.now();
      this.updateLastSaved();
      this.showToast("Game manually saved!", "manual-save");
    });

    this.getElement("autosaveToggleBtn").addEventListener("click", () => {
      this.autosaveEnabled = !this.autosaveEnabled;
      this.getElement("autosaveToggleBtn").textContent = this.autosaveEnabled ? "Autosave ON" : "Autosave OFF";
      this.getElement("autosaveToggleBtn").classList.toggle("btn-active", this.autosaveEnabled);
      
      if (this.autosaveEnabled && !this.autosaveId) {
        this.startAutosave();
      } else if (!this.autosaveEnabled && this.autosaveId) {
        clearInterval(this.autosaveId);
        this.autosaveId = null;
      }
    });

    // Reset button with 3-press failsafe
    let resetPressCount = 0;
    this.getElement("resetBtn").addEventListener("click", () => {
      resetPressCount++;
      if (resetPressCount < 3) {
        this.getElement("resetBtn").textContent = `Reset Save (${3 - resetPressCount} more)`;
        setTimeout(() => {
          resetPressCount = 0;
          this.getElement("resetBtn").textContent = "Reset Save";
        }, 2000);
        return;
      }
      
      this.suppressSaves = true;
      clearInterval(this.autosaveId);
      clearInterval(this.tickId);
      localStorage.removeItem(CONFIG.SAVE_KEY);
      location.reload();
    });

    // Visibility change
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && !this.suppressSaves) {
        this.save();
      }
    });
  }

  handleCrewHire(crewId) {
    if (!this.canClick('hire')) return;
    
    const crew = this.crewTypes.find(c => c.id === crewId);
    if (!crew) return;
    
    const cost = this.getCrewCost(crew);
    if (this.state.credits < cost) return;
    
    this.state.credits -= cost;
    crew.count += 1;
    this.startCooldown('hire');
    
    if (crew.id === 'snitch') {
      this.updateSnitchAutoclicker();
      const interval = this.getSnitchIntervalTicks(crew);
      const tickText = Math.abs(interval - CONFIG.SINGLE_TICK_THRESHOLD) < CONFIG.TICK_INTERVAL_TOLERANCE ? "tick" : "ticks";
      this.showToast(`Hired ${crew.name}! Autoclicks every ${interval.toFixed(1)} ${tickText}`);
    } else {
      this.showToast(`Hired ${crew.name}! +${crew.perTick} credits/tick`);
    }
    
    this.updateUI();
  }

  handleUpgradePurchase(upgradeId) {
    const upgrade = this.upgradeTypes.find(u => u.id === upgradeId);
    if (!upgrade) return;
    
    if (upgrade.maxCount && (this.state.upgrades[upgradeId] || 0) >= upgrade.maxCount) return;
    
    const cost = this.getUpgradeCost(upgrade);
    if (this.state.credits < cost) return;
    
    this.state.credits -= cost;
    this.state.upgrades[upgradeId] = (this.state.upgrades[upgradeId] || 0) + 1;
    this.state.revealedUpgrades[upgradeId] = true;
    
    this.applyUpgradeEffects();
    this.save();
    this.updateUI();
    this.showToast(`Upgrade purchased: ${upgrade.name}`);
  }

  handleTakeContract() {
    this.state.contractActive = true;
    this.state.contractProgress = 0;
    this.state.flags.contractsHintRemoved = true;
    this.save();
    
    const contract = this.contracts[this.state.currentContract];
    this.showToast(`Contract taken: ${contract.description}`);
    this.updateUI();
  }



  // Save/Load system
  save() {
    if (this.suppressSaves) return;
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({
      state: this.state,
      crewTypes: this.crewTypes
    }));
  }

  load() {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return;
    
    try {
      const data = JSON.parse(raw);
      Object.assign(this.state, data.state || {});
      
      if (Array.isArray(data.crewTypes)) {
        for (let i = 0; i < this.crewTypes.length; ++i) {
          Object.assign(this.crewTypes[i], data.crewTypes[i]);
        }
      }
      
      // Ensure required properties exist
      if (!this.state.upgrades) this.state.upgrades = {};
      if (!this.state.revealedUpgrades) this.state.revealedUpgrades = {};
      if (!this.state.buttonTypes) this.state.buttonTypes = { action: { base: 1, multiplier: 1 } };
      if (!this.state.cooldowns) {
        this.state.cooldowns = {
          action: { baseMs: CONFIG.BASE_COOLDOWN_MS, ms: CONFIG.BASE_COOLDOWN_MS, readyAt: 0 },
          hire: { baseMs: CONFIG.BASE_COOLDOWN_MS, ms: CONFIG.BASE_COOLDOWN_MS, readyAt: 0 }
        };
      }
      
      this.applyUpgradeEffects();
    } catch (error) {
      console.error("Failed to load save:", error);
    }
  }

  startAutosave() {
    this.autosaveId = setInterval(() => {
      if (!this.autosaveEnabled) return;
      this.save();
      this.lastSaveTime = Date.now();
      this.updateLastSaved();
      this.showToast("Game autosaved!", "autosave");
    }, CONFIG.AUTOSAVE_INTERVAL_MS);
  }

  updateLastSaved() {
    const el = this.getElement("lastSaved");
    if (!el) return;
    
    const secs = Math.floor((Date.now() - this.lastSaveTime) / 1000);
    el.textContent = secs === 0 ? "Last saved just now" : `Last saved ${secs} seconds ago`;
  }

  // Toast system
  showToast(message, type = "info") {
    const container = this.getElement("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    
    if (type === "autosave") {
      toast.style.borderLeft = "4px solid var(--accent-success)";
    } else if (type === "manual-save") {
      toast.style.borderLeft = "4px solid var(--accent-primary)";
    } else if (type === "dev") {
      toast.classList.add("dev-toast");
    }
    
    container.appendChild(toast);
    
    // Remove oldest toast if too many
    const toasts = container.querySelectorAll('.toast');
    if (toasts.length > CONFIG.MAX_TOASTS) {
      const oldestToast = toasts[0];
      oldestToast.classList.add("fade-out");
      setTimeout(() => {
        if (oldestToast.parentNode) {
          oldestToast.parentNode.removeChild(oldestToast);
        }
      }, 300);
    }
    
    // Show toast
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });
    
    // Auto-remove
    setTimeout(() => {
      toast.classList.add("fade-out");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 500);
    }, CONFIG.TOAST_DURATION_MS);
  }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.game = new GameManager();
  
  // Update last saved time every second
  setInterval(() => {
    if (window.game) {
      window.game.updateLastSaved();
    }
  }, 1000);
});

// Dev Menu functionality - Add to GameManager class after last saved
GameManager.prototype.setupDevMenuEvents = function() {
  // Keyboard listener for "kori" to open dev menu
  let koriBuffer = '';
  document.addEventListener('keydown', (e) => {
    // Add the pressed key to the buffer
    koriBuffer += e.key.toLowerCase();
    
    // Keep only the last 4 characters to check for "kori"
    if (koriBuffer.length > 4) {
      koriBuffer = koriBuffer.slice(-4);
    }
    
    // Check if "kori" was typed
    if (koriBuffer === 'kori') {
      this.toggleDevMenu();
      koriBuffer = ''; // Reset buffer after opening
    }
    
    // ESC key to close dev menu
    if (e.key === 'Escape') {
      const devPanel = this.getElement("devMenuPanel");
      if (devPanel && !devPanel.classList.contains('hidden')) {
        this.toggleDevMenu();
      }
    }
  });

  // Close dev menu
  this.getElement("closeDevMenuBtn").addEventListener("click", () => {
    this.toggleDevMenu();
  });

  // Dev action buttons
  document.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-dev-action')) {
      const action = e.target.getAttribute('data-dev-action');
      this.handleDevAction(action);
    }
  });

  // Close dev menu when clicking outside
  document.addEventListener('click', (e) => {
    const devPanel = this.getElement("devMenuPanel");
    if (devPanel && !devPanel.contains(e.target)) {
      if (!devPanel.classList.contains('hidden')) {
        this.toggleDevMenu();
      }
    }
  });
};

GameManager.prototype.toggleDevMenu = function() {
  const panel = this.getElement("devMenuPanel");
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden');
    this.updateDevMenuInfo();
  } else {
    panel.classList.add('hidden');
  }
};

GameManager.prototype.updateDevMenuInfo = function() {
  this.getElement("devTicks").textContent = this.state.ticks;
  this.getElement("devUnbanked").textContent = this.formatNumber(this.state.unbanked, 2);
  this.getElement("devContractProgress").textContent = this.formatNumber(this.state.contractProgress);
};

GameManager.prototype.handleDevAction = function(action) {
  switch (action) {
    case 'addCredits':
      this.state.credits += 1000;
      this.showToast("Added 1000 credits", "dev");
      break;
      
    case 'addCrew':
      for (const crew of this.crewTypes) {
        crew.count += 10;
      }
      this.updateSnitchAutoclicker();
      this.showToast("Added 10 of each crew type", "dev");
      break;
      
    case 'maxUpgrades':
      for (const upgrade of this.upgradeTypes) {
        if (upgrade.maxCount) {
          this.state.upgrades[upgrade.id] = upgrade.maxCount;
        } else {
          this.state.upgrades[upgrade.id] = 100;
        }
      }
      this.applyUpgradeEffects();
      this.showToast("Maxed all upgrades", "dev");
      break;
      
    case 'completeContract':
      if (this.state.contractActive) {
        const contract = this.contracts[this.state.currentContract];
        this.state.contractProgress = contract.goal;
        this.checkAndCompleteContract(contract);
        this.showToast("Contract completed", "dev");
      } else {
        this.showToast("No active contract", "dev");
      }
      break;
      
    case 'toggleAutosave':
      this.autosaveEnabled = !this.autosaveEnabled;
      this.getElement("autosaveToggleBtn").textContent = this.autosaveEnabled ? "Autosave ON" : "Autosave OFF";
      this.getElement("autosaveToggleBtn").classList.toggle("btn-active", this.autosaveEnabled);
      this.showToast(`Autosave ${this.autosaveEnabled ? 'enabled' : 'disabled'}`, "dev");
      break;
      
    case 'forceSave':
      this.save();
      this.lastSaveTime = Date.now();
      this.updateLastSaved();
      this.showToast("Game force saved", "dev");
      break;
      
    case 'exportSave':
      const saveData = localStorage.getItem(CONFIG.SAVE_KEY);
      const blob = new Blob([saveData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bounty-save-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast("Save exported", "dev");
      break;
      
    case 'importSave':
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const saveData = JSON.parse(e.target.result);
              localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(saveData));
              location.reload();
            } catch (error) {
              this.showToast("Invalid save file", "dev");
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
      break;
  }
  
  this.updateUI();
  this.updateDevMenuInfo();
};